#!/bin/bash
set -e

echo "==> Aguardando banco de dados em ${DB_HOST:-db}:${DB_PORT:-5432}..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER}" -q; do
    sleep 1
done
echo "==> Banco disponível."

# Roda migrate/fixtures/collectstatic apenas ao iniciar o servidor Django.
# Não roda para comandos de manutenção (makemigrations, shell, test, etc.).
case "$1" in
    gunicorn)
        echo "==> [prod] Aplicando migrations..."
        python manage.py migrate --noinput
        echo "==> [prod] Carregando dados iniciais (grupos)..."
        python manage.py loaddata fixtures/grupos_iniciais.json --ignorenonexistent || true
        echo "==> [prod] Coletando arquivos estáticos..."
        python manage.py collectstatic --noinput --clear
        ;;
    python)
        if [ "$2" = "manage.py" ] && [ "$3" = "runserver" ]; then
            echo "==> [dev] Aplicando migrations..."
            python manage.py migrate --noinput
            echo "==> [dev] Carregando dados iniciais (grupos)..."
            python manage.py loaddata fixtures/grupos_iniciais.json --ignorenonexistent || true
            echo "==> [dev] Arquivos estáticos servidos pelo runserver."
        fi
        ;;
esac

exec "$@"
