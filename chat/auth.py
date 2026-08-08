"""Autentikasi pengguna untuk Teman Bicara.

Login berbasis session Django (bukan token): setelah login, cookie session
dipakai untuk request berikutnya. Cukup username + password.

Saat registrasi, pengguna wajib mengisi profil singkat (umur, jenis
kelamin, pekerjaan) yang disimpan ke AccountProfile dan dipakai sebagai
konteks percakapan. Pengguna yang sudah login tidak perlu mengisi form
identitas lagi.
"""
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.request import Request

from .models import AccountProfile


def _profile_payload(profile: AccountProfile | None) -> dict | None:
    """Bentuk JSON profil pengguna terdaftar."""
    if profile is None:
        return None
    return {
        "name": profile.name,
        "age": profile.age,
        "gender": profile.gender,
        "occupation": profile.occupation,
    }


class RegisterAPIView(APIView):
    """Daftar akun baru dengan username + password + profil singkat."""

    def post(self, request: Request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        name = (request.data.get('name') or '').strip()
        age = request.data.get('age')
        gender = (request.data.get('gender') or '').strip()
        occupation = (request.data.get('occupation') or '').strip()

        errors = []

        # Validasi akun
        if not username or not password:
            errors.append("Username dan password wajib diisi.")
        elif User.objects.filter(username__iexact=username).exists():
            errors.append("Username sudah digunakan.")

        if not password:
            errors.append("Password wajib diisi.")
        elif len(password) < 8:
            errors.append("Password minimal 8 karakter.")

        # Validasi profil (wajib saat register)
        parsed_age = self._parse_age(age)
        if parsed_age is None:
            errors.append("Umur wajib diisi (angka 10–100).")
        if not gender:
            errors.append("Jenis kelamin wajib diisi.")
        if not occupation:
            errors.append("Pekerjaan wajib diisi.")

        if errors:
            return Response(
                {"detail": " ".join(errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(username=username, password=password)
        account_profile = AccountProfile.objects.create(
            user=user,
            name=(name or username)[:100],
            age=parsed_age,
            gender=gender[:30],
            occupation=occupation[:100],
        )

        login(request, user)
        return Response(
            {
                "detail": "Berhasil mendaftar.",
                "username": user.username,
                "profile": _profile_payload(account_profile),
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _parse_age(value):
        """Konversi nilai umur ke int dalam rentang 10–100, else None."""
        if value is None or value == '':
            return None
        try:
            age = int(value)
        except (TypeError, ValueError):
            return None
        return age if 10 <= age <= 100 else None


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
        return Response({
            "detail": "Berhasil masuk.",
            "username": user.username,
            "profile": _profile_payload(getattr(user, 'account_profile', None)),
        })


class LogoutAPIView(APIView):
    """Keluar dari sesi."""

    def post(self, request: Request):
        logout(request)
        return Response({"detail": "Berhasil keluar."})


class MeAPIView(APIView):
    """Info pengguna yang sedang login, termasuk profil terdaftar."""

    def get(self, request: Request):
        if not request.user.is_authenticated:
            return Response({"authenticated": False, "username": None})
        profile = getattr(request.user, 'account_profile', None)
        return Response({
            "authenticated": True,
            "username": request.user.username,
            "profile": _profile_payload(profile),
        })
