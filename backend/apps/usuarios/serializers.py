from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    perfil = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ('id', 'email', 'nome_completo', 'perfil', 'is_active')
        read_only_fields = ('id', 'perfil', 'is_active')
