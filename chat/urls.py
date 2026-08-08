from django.urls import path
from . import views, auth, history

urlpatterns = [
    path('', views.ChatAPIView.as_view(), name='chat_api'),
    path('analyze/', views.AnalyzeAPIView.as_view(), name='chat_analyze'),

    # Autentikasi
    path('auth/register/', auth.RegisterAPIView.as_view(), name='auth_register'),
    path('auth/login/', auth.LoginAPIView.as_view(), name='auth_login'),
    path('auth/logout/', auth.LogoutAPIView.as_view(), name='auth_logout'),
    path('auth/me/', auth.MeAPIView.as_view(), name='auth_me'),

    # Riwayat percakapan (khusus login)
    path('history/', history.HistoryListAPIView.as_view(), name='history_list'),
    path('history/save/', history.HistorySaveAPIView.as_view(), name='history_save'),
    path('history/<str:session_id>/', history.HistoryDetailAPIView.as_view(), name='history_detail'),
]
