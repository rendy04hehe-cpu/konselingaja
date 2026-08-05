from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.views.decorators.csrf import ensure_csrf_cookie

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', TemplateView.as_view(template_name='index.html'), name='index'),
    path('chat.html', ensure_csrf_cookie(TemplateView.as_view(template_name='chat.html')), name='chat_html'),
    path('api/chat/', include('chat.urls')),
]
