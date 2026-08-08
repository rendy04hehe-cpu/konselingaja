"""Tes untuk endpoint autentikasi dan riwayat percakapan.

Mencakup register/login/logout, daftar riwayat, detail riwayat, hapus
riwayat, dan penyimpanan percakapan — termasuk sesi anonim (owner=None)
yang diklaim oleh user saat menyimpan.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Message, Session


class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_requires_username_and_password(self):
        res = self.client.post("/api/chat/auth/register/", {}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("detail", res.data)

    def test_register_requires_min_length_password(self):
        res = self.client.post(
            "/api/chat/auth/register/",
            {"username": "userbaru", "password": "pendek"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_register_creates_user_and_logs_in(self):
        res = self.client.post(
            "/api/chat/auth/register/",
            {"username": "userbaru", "password": "password123"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.filter(username="userbaru").exists())

        # Session cookie terpasang → user langsung login
        me = self.client.get("/api/chat/auth/me/")
        self.assertTrue(me.data["authenticated"])
        self.assertEqual(me.data["username"], "userbaru")

    def test_register_duplicate_username_rejected(self):
        User.objects.create_user(username="sama", password="password123")
        res = self.client.post(
            "/api/chat/auth/register/",
            {"username": "SAMA", "password": "password123"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_login_wrong_password(self):
        User.objects.create_user(username="user", password="password123")
        res = self.client.post(
            "/api/chat/auth/login/",
            {"username": "user", "password": "salah"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_login_success_sets_session(self):
        User.objects.create_user(username="user", password="password123")
        res = self.client.post(
            "/api/chat/auth/login/",
            {"username": "user", "password": "password123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        me = self.client.get("/api/chat/auth/me/")
        self.assertTrue(me.data["authenticated"])

    def test_logout_clears_session(self):
        User.objects.create_user(username="user", password="password123")
        self.client.login(username="user", password="password123")
        self.assertTrue(self.client.get("/api/chat/auth/me/").data["authenticated"])

        res = self.client.post("/api/chat/auth/logout/")
        self.assertEqual(res.status_code, 200)
        me = self.client.get("/api/chat/auth/me/")
        self.assertFalse(me.data["authenticated"])


class HistoryAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="user", password="password123"
        )
        self.other = User.objects.create_user(
            username="other", password="password123"
        )

    def _login(self, user=None):
        user = user or self.user
        self.client.force_login(user)

    def _create_session(self, owner=None, title="Percakapan"):
        return Session.objects.create(owner=owner, title=title)

    # --- Autentikasi wajib ---

    def test_history_requires_login(self):
        res = self.client.get("/api/chat/history/")
        self.assertEqual(res.status_code, 401)

    def test_history_save_requires_login(self):
        res = self.client.post(
            "/api/chat/history/save/",
            {"session_id": "", "messages": [{"role": "user", "content": "Halo"}]},
            format="json",
        )
        self.assertEqual(res.status_code, 401)

    def test_history_detail_requires_login(self):
        res = self.client.get(f"/api/chat/history/{uuid.uuid4()}/")
        self.assertEqual(res.status_code, 401)

    # --- Daftar riwayat ---

    def test_list_returns_only_owned_sessions(self):
        mine = self._create_session(owner=self.user)
        self._create_session(owner=self.other)
        self._login()

        res = self.client.get("/api/chat/history/")
        self.assertEqual(res.status_code, 200)
        ids = [s["session_id"] for s in res.data["sessions"]]
        self.assertIn(str(mine.id), ids)
        self.assertEqual(len(ids), 1)

    # --- Simpan ---

    def test_save_creates_new_session_with_owner(self):
        self._login()
        res = self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": "",
                "title": "Kuliah",
                "messages": [
                    {"role": "user", "content": "Hari ini berat."},
                    {"role": "assistant", "content": "Ceritakan lebih lanjut."},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["session_id"])

        session = Session.objects.get(id=res.data["session_id"])
        self.assertEqual(session.owner, self.user)
        self.assertEqual(session.title, "Kuliah")
        self.assertEqual(Message.objects.filter(conversation__session=session).count(), 2)

    def test_save_claims_anonymous_session(self):
        """Sesi anonim (owner=None, dibuat endpoint analyze) diklaim user."""
        anon = Session.objects.create(owner=None, title=None)
        self._login()

        res = self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": str(anon.id),
                "messages": [{"role": "user", "content": "Halo"}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        anon.refresh_from_db()
        self.assertEqual(anon.owner, self.user)

        # Kini muncul di daftar riwayat user
        listing = self.client.get("/api/chat/history/")
        ids = [s["session_id"] for s in listing.data["sessions"]]
        self.assertIn(str(anon.id), ids)

    def test_save_others_session_rejected(self):
        """Sesi milik user lain tidak boleh ditimpa/diklaim."""
        theirs = self._create_session(owner=self.other, title="Punya orang lain")
        self._login()

        res = self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": str(theirs.id),
                "messages": [{"role": "user", "content": "Halo"}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 404)
        theirs.refresh_from_db()
        self.assertEqual(theirs.owner, self.other)

    def test_save_invalid_uuid_returns_404(self):
        self._login()
        res = self.client.post(
            "/api/chat/history/save/",
            {"session_id": "bukan-uuid", "messages": [{"role": "user", "content": "Halo"}]},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_save_without_messages_returns_400(self):
        self._login()
        res = self.client.post(
            "/api/chat/history/save/",
            {"session_id": "", "messages": []},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_save_replaces_previous_messages(self):
        session = self._create_session(owner=self.user)
        self._login()

        res = self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": str(session.id),
                "messages": [{"role": "user", "content": "Halo lagi"}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(Message.objects.filter(conversation__session=session).count(), 1)

        # Simpan ulang dengan konten baru → pesan lama diganti
        res2 = self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": str(session.id),
                "messages": [
                    {"role": "user", "content": "Halo lagi"},
                    {"role": "assistant", "content": "Halo juga."},
                ],
            },
            format="json",
        )
        self.assertEqual(res2.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(Message.objects.filter(conversation__session=session).count(), 2)

    # --- Detail ---

    def test_detail_returns_messages(self):
        session = self._create_session(owner=self.user)
        self._login()

        # Simpan dulu lewat API agar konsisten
        self.client.post(
            "/api/chat/history/save/",
            {
                "session_id": str(session.id),
                "messages": [
                    {"role": "user", "content": "Halo"},
                    {"role": "assistant", "content": "Halo juga."},
                ],
            },
            format="json",
        )

        res = self.client.get(f"/api/chat/history/{session.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["messages"]), 2)
        self.assertEqual(res.data["messages"][0]["role"], "user")
        self.assertEqual(res.data["messages"][0]["content"], "Halo")

    def test_detail_other_users_404(self):
        session = self._create_session(owner=self.other)
        self._login()
        res = self.client.get(f"/api/chat/history/{session.id}/")
        self.assertEqual(res.status_code, 404)

    # --- Hapus ---

    def test_delete_removes_session(self):
        session = self._create_session(owner=self.user)
        self._login()

        res = self.client.delete(f"/api/chat/history/{session.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(Session.objects.filter(id=session.id).exists())

    def test_delete_other_users_404(self):
        session = self._create_session(owner=self.other)
        self._login()
        res = self.client.delete(f"/api/chat/history/{session.id}/")
        self.assertEqual(res.status_code, 404)
        self.assertTrue(Session.objects.filter(id=session.id).exists())
