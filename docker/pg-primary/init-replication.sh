#!/bin/bash
set -e

# Create replication user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_pass';
EOSQL

# Append replication entries to pg_hba.conf
echo "host replication replicator all md5" >> "$PGDATA/pg_hba.conf"

# Configure WAL settings for replication
cat >> "$PGDATA/postgresql.conf" <<EOF
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
EOF

# Reload config
pg_ctl reload -D "$PGDATA"
