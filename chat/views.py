import os
import traceback
from typing import Any, Dict, List

from openai import OpenAI
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.request import Request
from django.http import StreamingHttpResponse

from .models import Recommendation, Session
from .services import analyze_condition, build_chat_system_instruction, stream_chat_response


class AnalyzeAPIView(APIView):
    """Analisis kondisi pengguna — dijalankan di background.

    Analisis TIDAK pernah dikembalikan ke pengguna sebagai diagnosis.
    Hanya dipakai untuk memutuskan apakah rekomendasi psikolog/psikiater
    perlu ditampilkan, dan disimpan sebagai riwayat per sesi.
    """

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        data: Dict[str, Any] = request.data
        history: List[Dict[str, str]] = data.get('history', [])
        profile: Dict[str, Any] = data.get('profile', {})
        session_id: str = data.get('session_id', '')

        if not history:
            return Response({"recommend": False}, status=status.HTTP_200_OK)

        session = self._get_session(session_id)
        
        if session and session.recommendations.exists():
            return Response(
                {"recommend": False, "already_shown": True},
                status=status.HTTP_200_OK,
            )

        result = analyze_condition(history, profile)

        if result.get('recommend') and session:
            self._save_recommendation(session, result)

        return Response(result, status=status.HTTP_200_OK)

    def _get_session(self, session_id: str) -> Session | None:
        if not session_id:
            return None
        try:
            session, _ = Session.objects.get_or_create(id=session_id)
            return session
        except Exception:
            return None

    def _save_recommendation(self, session: Session, result: Dict[str, Any]) -> None:
        Recommendation.objects.create(
            session=session,
            recommendation_type='professional',
            reason=result.get('reason') or '',
            condition=result.get('condition'),
            confidence=result.get('confidence'),
        )


class ChatAPIView(APIView):
    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response | StreamingHttpResponse:
        data: Dict[str, Any] = request.data
        user_message: str = data.get('message', '').strip()
        history: List[Dict[str, str]] = data.get('history', [])
        profile: Dict[str, Any] = data.get('profile', {})

        if not user_message:
            return Response({"reply": "Pesan tidak boleh kosong."}, status=status.HTTP_400_BAD_REQUEST)

        system_instruction = build_chat_system_instruction(profile)

        try:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                return Response({"reply": "GROQ_API_KEY belum dikonfigurasi."}, status=status.HTTP_400_BAD_REQUEST)

            messages = self._build_messages(system_instruction, history, user_message)
            return StreamingHttpResponse(stream_chat_response(messages), content_type='text/plain')

        except Exception as e:
            traceback.print_exc()
            return Response({"reply": f"Maaf, sepertinya aku mengalami sedikit kendala koneksi: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _build_messages(self, system_instruction: str, history: List[Dict[str, str]], user_message: str) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": system_instruction}]
        for msg in history:
            role = "user" if msg.get("role") == "user" else "assistant"
            content = msg.get("content", "")
            if content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})
        return messages
