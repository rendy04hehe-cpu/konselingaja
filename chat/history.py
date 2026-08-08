"""API riwayat percakapan pengguna.

Semua endpoint mengharuskan login (session-based). Riwayat disimpan per
Session (satu sesi = satu percakapan). Anonymous user tidak punya history —
fitur ini khusus akun yang sudah login.
"""
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.request import Request

from .models import Conversation, Message, Session


def _session_payload(session: Session, messages=None) -> dict:
    """Bentuk JSON untuk satu sesi beserta pesannya."""
    if messages is None:
        messages = list(
            Message.objects
            .filter(conversation__session=session)
            .order_by('created_at')
        )

    return {
        "session_id": str(session.id),
        "title": session.title or "Percakapan",
        "updated_at": session.last_activity.isoformat(),
        "messages": [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ],
    }


class HistoryListAPIView(APIView):
    """Daftar semua percakapan milik user (tanpa isi pesan)."""

    def get(self, request: Request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Harus login."}, status=status.HTTP_401_UNAUTHORIZED
            )

        sessions = (
            Session.objects
            .filter(owner=request.user)
            .order_by('-last_activity')
        )

        data = [
            {
                "session_id": str(s.id),
                "title": s.title or "Percakapan",
                "updated_at": s.last_activity.isoformat(),
                "message_count": Message.objects.filter(
                    conversation__session=s, role='user'
                ).count(),
            }
            for s in sessions[:100]
        ]
        return Response({"sessions": data})


class HistoryDetailAPIView(APIView):
    """Ambil isi satu percakapan milik user."""

    def get(self, request: Request, session_id: str):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Harus login."}, status=status.HTTP_401_UNAUTHORIZED
            )

        session = self._get_owned_session(request.user, session_id)
        if session is None:
            return Response(
                {"detail": "Percakapan tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(_session_payload(session))

    def delete(self, request: Request, session_id: str):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Harus login."}, status=status.HTTP_401_UNAUTHORIZED
            )

        session = self._get_owned_session(request.user, session_id)
        if session is None:
            return Response(
                {"detail": "Percakapan tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.delete()
        return Response({"detail": "Percakapan dihapus."})

    @staticmethod
    def _get_owned_session(user, session_id: str):
        try:
            return Session.objects.get(id=session_id, owner=user)
        except (Session.DoesNotExist, ValueError, ValidationError):
            return None


class HistorySaveAPIView(APIView):
    """Simpan percakapan berjalan ke akun user.

    Body: {session_id, title?, messages: [{role, content}, ...]}
    - Jika session_id kosong/belum ada & masih berbentuk UUID baru, session
      dibuat dengan owner = user.
    - Jika session_id sudah ada tapi bukan milik user → 404.
    """

    def post(self, request: Request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Harus login."}, status=status.HTTP_401_UNAUTHORIZED
            )

        session_id = (request.data.get('session_id') or '').strip()
        title = (request.data.get('title') or '').strip()
        messages = request.data.get('messages') or []

        if not messages:
            return Response(
                {"detail": "Tidak ada pesan untuk disimpan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session = self._resolve_session(request.user, session_id, title)
        if session is None:
            return Response(
                {"detail": "Percakapan tidak ditemukan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Jika sesi sebelumnya anonim (owner=None), klaim sebagai milik user.
        # Ini terjadi saat user mulai chat tanpa login lalu login di tengah percakapan.
        if session.owner_id is None:
            session.owner = request.user
            session.save(update_fields=['owner'])

        self._replace_messages(session, messages)

        if title and not session.title:
            session.title = title[:200]
        session.status = 'active'
        session.last_activity = timezone.now()
        session.save(update_fields=['title', 'status', 'last_activity'])

        return Response({
            "detail": "Percakapan disimpan.",
            "session_id": str(session.id),
        })

    @staticmethod
    def _resolve_session(user, session_id: str, title: str):
        """Kembalikan session milik user, atau buat jika belum ada.

        Aturan kepemilikan:
        - session_id kosong → buat session baru milik user.
        - session_id ada dan sudah milik user → pakai.
        - session_id ada tapi owner=None (sesi anonim yang dibuat endpoint
          analyze saat user belum login) → klaim, dipakai callernya.
        - session_id berupa UUID baru yang belum pernah tersimpan → buat
          session baru milik user dengan id tersebut. Ini normal: frontend
          selalu mengirim UUID baru untuk percakapan yang baru dimulai.
        - session_id milik user lain atau bukan UUID valid → None (404).
        """
        if not session_id:
            return Session.objects.create(owner=user, title=title or None)

        try:
            try:
                return Session.objects.get(id=session_id, owner=user)
            except Session.DoesNotExist:
                pass

            try:
                # Mungkin sesi anonim (owner=None) yang bisa diklaim.
                return Session.objects.get(id=session_id, owner__isnull=True)
            except Session.DoesNotExist:
                pass

            # UUID sudah dipakai orang lain → jangan sentuh, 404.
            if Session.objects.filter(id=session_id).exists():
                return None

            # UUID baru dari frontend yang belum pernah tersimpan.
            return Session.objects.create(
                id=session_id, owner=user, title=title or None
            )
        except (ValueError, ValidationError):
            return None

    @staticmethod
    def _replace_messages(session: Session, messages: list) -> None:
        """Hapus pesan lama sesi, lalu tulis ulang dari list."""
        Conversation.objects.filter(session=session).delete()

        conversation = Conversation.objects.create(session=session)
        for item in messages:
            role = 'user' if str(item.get('role')) == 'user' else 'assistant'
            content = str(item.get('content') or '').strip()
            if content:
                Message.objects.create(
                    conversation=conversation,
                    role=role,
                    content=content,
                )
