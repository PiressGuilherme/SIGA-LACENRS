from django.urls import path

from .views import LoginCrachaView, LoginEmailView, LoginPageView, ValidarCrachaView

api_urlpatterns = [
    path('login/',          LoginEmailView.as_view(),   name='auth-login'),
    path('login-cracha/',   LoginCrachaView.as_view(),  name='auth-login-cracha'),
    path('validar-cracha/', ValidarCrachaView.as_view(), name='auth-validar-cracha'),
]

page_urlpatterns = [
    path('login/', LoginPageView.as_view(), name='login-page'),
]
