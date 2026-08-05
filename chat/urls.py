from django.urls import path
from . import views

urlpatterns = [
    path('', views.ChatAPIView.as_view(), name='chat_api'),
    path('analyze/', views.AnalyzeAPIView.as_view(), name='chat_analyze'),
]
