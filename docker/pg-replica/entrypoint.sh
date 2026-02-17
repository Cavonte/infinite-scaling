#!/bin/bash
set -e

# Wait for the primary to be ready
until pg_isready -h "$POSTGRES_PRIMARY_HOST" -p "$POSTGRES_PRIMARY_PORT" -U postgres; do
  echo "Waiting for primary at $POSTGRES_PRIMARY_HOST:$POSTGRES_PRIMARY_PORT..."
  sleep 2
done

# If data directory is empty, do a base backup from the primary
if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  echo "Running pg_basebackup from $POSTGRES_PRIMARY_HOST:$POSTGRES_PRIMARY_PORT..."
  pg_basebackup \
    -h "$POSTGRES_PRIMARY_HOST" \
    -p "$POSTGRES_PRIMARY_PORT" \
    -U replicator \
    -D "$PGDATA" \
    -Fp -Xs -R -P

  # Ensure standby.signal exists (pg_basebackup -R should create it)
  touch "$PGDATA/standby.signal"

  # Set permissions
  chmod 0700 "$PGDATA"
fi

# Start postgres in standby mode
exec postgres
