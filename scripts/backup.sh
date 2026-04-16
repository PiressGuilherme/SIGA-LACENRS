#!/bin/bash
# =============================================================================
# SIGA-LACEN — Backup automatizado
# Executado via cron diariamente as 01:30
# Backups sao sincronizados para Google Drive pelo rclone as 02:00
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuracao
# ---------------------------------------------------------------------------
BACKUP_DIR="/mnt/HD/cdctserver/siga-backups"
PROJECT_DIR="/home/cdctserver/SIGA-LACENRS"
DATE=$(date +%Y%m%d_%H%M)
RETENTION_DAYS=30
LOG="$BACKUP_DIR/backup.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"; }

mkdir -p "$BACKUP_DIR"

log "--- Inicio do backup ---"

# ---------------------------------------------------------------------------
# 1. Banco de dados PostgreSQL (formato custom, comprimido)
# ---------------------------------------------------------------------------
DB_FILE="$BACKUP_DIR/db_${DATE}.dump"
if docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db \
    pg_dump -U siga_user -Fc siga_lacen > "$DB_FILE" 2>>"$LOG"; then
    log "OK  Banco: db_${DATE}.dump ($(du -h "$DB_FILE" | cut -f1))"
else
    log "ERRO Banco: falha no pg_dump"
fi

# ---------------------------------------------------------------------------
# 2. Media files (uploads)
# ---------------------------------------------------------------------------
MEDIA_FILE="$BACKUP_DIR/media_${DATE}.tar.gz"
if docker run --rm \
    -v siga-lacenrs_media_files:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/media_${DATE}.tar.gz" -C /data . 2>>"$LOG"; then
    log "OK  Media: media_${DATE}.tar.gz ($(du -h "$MEDIA_FILE" | cut -f1))"
else
    log "ERRO Media: falha no tar"
fi

# ---------------------------------------------------------------------------
# 3. Configuracao (.env + certificados)
# ---------------------------------------------------------------------------
CONFIG_FILE="$BACKUP_DIR/config_${DATE}.tar.gz"
if tar czf "$CONFIG_FILE" \
    -C "$PROJECT_DIR" .env docker/nginx/certs/ 2>>"$LOG"; then
    log "OK  Config: config_${DATE}.tar.gz"
else
    log "ERRO Config: falha no tar"
fi

# ---------------------------------------------------------------------------
# 4. Verificar integridade do dump
# ---------------------------------------------------------------------------
if pg_restore --list "$DB_FILE" > /dev/null 2>&1; then
    log "OK  Verificacao: dump integro"
else
    log "AVISO Verificacao: pg_restore --list falhou — verificar manualmente"
fi

# ---------------------------------------------------------------------------
# 5. Limpeza — remover backups mais antigos que $RETENTION_DAYS dias
# ---------------------------------------------------------------------------
DELETED=$(find "$BACKUP_DIR" \( -name "db_*.dump" -o -name "media_*.tar.gz" -o -name "config_*.tar.gz" \) -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    log "OK  Limpeza: $DELETED arquivo(s) antigo(s) removido(s)"
fi

log "--- Backup concluido ---"
