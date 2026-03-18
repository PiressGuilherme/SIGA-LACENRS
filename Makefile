# =============================================================================
# SIGA-LACEN — Makefile de atalhos
# =============================================================================

.PHONY: help build up down logs shell migrate makemigrations superuser test \
        reset-db collectstatic

help:  ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

build:  ## Build das imagens Docker
	docker compose build

up:  ## Sobe os containers em foreground
	docker compose up

up-d:  ## Sobe os containers em background
	docker compose up -d

down:  ## Para e remove os containers
	docker compose down

down-v:  ## Para containers e remove volumes (APAGA O BANCO)
	docker compose down -v

logs:  ## Mostra logs de todos os containers
	docker compose logs -f

logs-backend:  ## Mostra logs apenas do backend
	docker compose logs -f backend

# ---------------------------------------------------------------------------
# Django
# ---------------------------------------------------------------------------

shell:  ## Abre o Django shell no container backend
	docker compose exec backend python manage.py shell

bash:  ## Abre bash no container backend
	docker compose exec backend bash

migrate:  ## Aplica migrations pendentes
	docker compose exec backend python manage.py migrate

makemigrations:  ## Gera novas migrations
	docker compose exec backend python manage.py makemigrations

superuser:  ## Cria superusuário interativamente
	docker compose exec backend python manage.py createsuperuser

collectstatic:  ## Coleta arquivos estáticos
	docker compose exec backend python manage.py collectstatic --noinput

# ---------------------------------------------------------------------------
# Banco de dados
# ---------------------------------------------------------------------------

reset-db:  ## PERIGO: derruba e recria o banco do zero
	@echo "⚠️  Isso vai APAGAR todos os dados. Confirme com: make reset-db CONFIRM=yes"
	@[ "$(CONFIRM)" = "yes" ] || (echo "Abortado." && exit 1)
	docker compose down -v
	docker compose up -d db
	@sleep 3
	docker compose run --rm backend python manage.py migrate

# ---------------------------------------------------------------------------
# Qualidade
# ---------------------------------------------------------------------------

test:  ## Roda os testes com pytest (futuro)
	docker compose exec backend python manage.py test --verbosity=2
