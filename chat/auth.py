"""Autentikasi pengguna untuk Teman Bicara.

Login berbasis session Django (bukan token): setelah login, cookie session
dipakai untuk request berikutnya. Cukup username + password.
"""
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.request import Request


class RegisterAPIView(APIView):
    """Daftar akun baru dengan username + password."""

    def post(self, request: Request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''

        if not username or not password:
            return Response(
                {"detail": "Username dan password wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"detail": "Password minimal 8 karakter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username__iexact=username).exists():
            return Response(
                {"detail": "Username sudah digunakan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(username=username, password=password)
        login(request, user)
        return Response(
            {"detail": "Berhasil mendaftar.", "username": user.username},
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    """Masuk dengan username + password."""

    def post(self, request: Request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Username atau password salah."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        return Response({"detail": "Berhasil masuk.", "username": user.username})


class LogoutAPIView(APIView):
    """Keluar dari sesi."""

    def post(self, request: Request):
        logout(request)
        return Response({"detail": "Berhasil keluar."})


class MeAPIView(APIView):
    """Info pengguna yang sedang login."""

    def get(self, request: Request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "username": None})
        return Response({
            "authenticated": True,
            "username": request.user.username,
        })
