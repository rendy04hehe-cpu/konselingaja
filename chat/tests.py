from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Recommendation, Session
from .services import analyze_condition, _extract_json, _safe_result


class AnalyzeConditionShortCircuitTests(TestCase):
    """Analisis tidak dijalankan untuk percakapan singkat."""

    def test_short_conversation_returns_empty(self):
        messages = [
            {"role": "user", "content": "Halo"},
            {"role": "assistant", "content": "Halo juga."},
        ]
        result = analyze_condition(messages, {})
        self.assertFalse(result["recommend"])
        self.assertIsNone(result["condition"])
        self.assertEqual(result["confidence"], 0.0)


class AnalyzeConditionJsonTests(TestCase):
    """Parsing JSON dan normalisasi hasil."""

    def test_extract_json_from_code_block(self):
        text = 'Berikut hasilnya:\n```json\n{"condition": "kecemasan", "confidence": 0.8, "recommend": true, "reason": "tes"}\n```'
        data = _extract_json(text)
        self.assertEqual(data["condition"], "kecemasan")

    def test_safe_result_clamps_confidence(self):
        data = _safe_result({"condition": "kecemasan", "confidence": 5.0, "recommend": True})
        self.assertEqual(data["confidence"], 1.0)

    def test_safe_result_rejects_unknown_condition(self):
        data = _safe_result({"condition": "tidak dikenal", "confidence": 0.5})
        self.assertIsNone(data["condition"])
        self.assertFalse(data["recommend"])


class AnalyzeAPIViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_no_history_returns_no_recommendation(self):
        res = self.client.post("/api/chat/analyze/", {"history": []}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["recommend"])

    def test_empty_body_returns_no_recommendation(self):
        res = self.client.post("/api/chat/analyze/", {}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["recommend"])

    @patch("chat.views.analyze_condition")
    def test_recommendation_saved_once_per_session(self, mock_analyze):
        mock_analyze.return_value = {
            "condition": "kecemasan",
            "confidence": 0.8,
            "recommend": True,
            "reason": "pengguna menunjukkan kekhawatiran yang konsisten",
        }

        history = [
            {"role": "user", "content": "Aku selalu cemas."},
            {"role": "assistant", "content": "Seperti apa rasa cemas itu?"},
            {"role": "user", "content": "Sulit tidur, jantung berdebar."},
            {"role": "assistant", "content": "Itu terdengar melelahkan."},
            {"role": "user", "content": "Dua minggu ini aku tidak bisa fokus kerja."},
        ]

        # Panggilan pertama — analisis dijalankan
        res1 = self.client.post(
            "/api/chat/analyze/",
            {"history": history, "session_id": "11111111-1111-4111-8111-111111111111"},
            format="json",
        )
        self.assertEqual(res1.status_code, 200)
        self.assertTrue(res1.data["recommend"])
        self.assertEqual(res1.data["condition"], "kecemasan")
        mock_analyze.assert_called_once()

        # Rekomendasi tersimpan
        session = Session.objects.get(id="11111111-1111-4111-8111-111111111111")
        rec = session.recommendations.get()
        self.assertEqual(rec.condition, "kecemasan")
        self.assertEqual(rec.confidence, 0.8)
        self.assertFalse(rec.dismissed)

        # Panggilan kedua — analisis TIDAK dijalankan lagi
        res2 = self.client.post(
            "/api/chat/analyze/",
            {"history": history, "session_id": "11111111-1111-4111-8111-111111111111"},
            format="json",
        )
        self.assertEqual(res2.status_code, 200)
        self.assertFalse(res2.data["recommend"])
        self.assertTrue(res2.data["already_shown"])
        mock_analyze.assert_called_once()

    @patch("chat.views.analyze_condition")
    def test_recommend_false_not_saved(self, mock_analyze):
        mock_analyze.return_value = {
            "condition": None,
            "confidence": 0.2,
            "recommend": False,
            "reason": "",
        }

        history = [
            {"role": "user", "content": "Hari ini lumayan."},
            {"role": "assistant", "content": "Senang mendengarnya."},
            {"role": "user", "content": "Terima kasih sudah mendengarkan."},
        ]

        res = self.client.post(
            "/api/chat/analyze/",
            {"history": history, "session_id": "22222222-2222-4222-8222-222222222222"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["recommend"])
        self.assertEqual(Recommendation.objects.count(), 0)

    @patch("chat.views.analyze_condition")
    def test_analysis_failure_is_handled_by_service(self, mock_analyze):
        # Service tidak pernah raise — default aman
        mock_analyze.return_value = {
            "condition": None,
            "confidence": 0.0,
            "recommend": False,
            "reason": "",
        }
        history = [
            {"role": "user", "content": "Satu."},
            {"role": "user", "content": "Dua."},
            {"role": "user", "content": "Tiga."},
        ]
        res = self.client.post("/api/chat/analyze/", {"history": history}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["recommend"])
