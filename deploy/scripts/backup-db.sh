#!/bin/bash
# ===========================================
# DATABASE BACKUP SCRIPT
# Creates a timestamped pg_dump of the database
#
# Usage: ./deploy/scripts/backup-db.sh
# Requires: docker compose running with postgres service
#
# Backups are saved to ./backups/ with auto-cleanup of files older than 30 days
# ===========================================

set -e

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/unistyles_db_$TIMESTAMP.sql.gz"
# Coolify prefixes container names with the project/service id, so the
# default may not match in production — override via env.
CONTAINER_NAME="${POSTGRES_CONTAINER:-unistyles-postgres}"
DB_NAME="${POSTGRES_DB:-unistyles_db}"
DB_USER="${POSTGRES_USER:-unistyles}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
echo "  Container: $CONTAINER_NAME"
echo "  Database:  $DB_NAME"
echo "  Output:    $BACKUP_FILE"

# Run pg_dump inside the container and compress
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "  Backup created successfully: $SIZE"
else
    echo "  ERROR: Backup file was not created!"
    exit 1
fi

# Clean up old backups (older than RETENTION_DAYS)
DELETED=$(find "$BACKUP_DIR" -name "unistyles_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "  Cleaned up $DELETED backup(s) older than $RETENTION_DAYS days"
fi

echo "Backup complete."
