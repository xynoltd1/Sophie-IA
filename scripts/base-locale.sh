#!/usr/bin/env bash
#
# Monte un PostgreSQL local, applique toutes les migrations, joue les parcours.
# Voir scripts/base-locale/README.md.
set -euo pipefail

BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DATA=${PG_DATA:-/tmp/zelicall-pg}
PORT=${PG_PORT:-5433}
SOCK=${PG_SOCK:-/tmp}

if [ ! -x "$BIN/initdb" ]; then
  echo "PostgreSQL 16 introuvable dans $BIN. Donnez PG_BIN." >&2
  exit 1
fi

# PostgreSQL refuse de demarrer en root. Si on y est, on passe par un compte
# sans privileges, cree a la volee.
if [ "$(id -u)" = "0" ]; then
  id pg >/dev/null 2>&1 || useradd -m pg
  DATA=${PG_DATA:-/home/pg/zelicall-pg}
  mkdir -p "$(dirname "$DATA")" && chown -R pg "$(dirname "$DATA")"
  SU="su pg -c"
else
  SU="bash -c"
fi

echo "→ base jetable dans $DATA"
rm -rf "$DATA"
$SU "$BIN/initdb -D $DATA -U postgres --auth=trust" >/dev/null
$SU "$BIN/pg_ctl -D $DATA -l $DATA/log -o '-k $SOCK -p $PORT' start" >/dev/null
trap '$SU "$BIN/pg_ctl -D $DATA stop" >/dev/null 2>&1 || true' EXIT
sleep 2

p() { psql -h "$SOCK" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

echo "→ ce que Supabase fournit avant la premiere migration"
p -f scripts/base-locale/00_prelude_supabase.sql

echo "→ migrations"
for f in $(ls supabase/migrations/*.sql | sort); do
  if ! p -f "$f" 2>/tmp/pgerr; then
    echo "ECHEC : $f" >&2
    head -5 /tmp/pgerr >&2
    exit 1
  fi
done

echo "→ parcours"
for f in scripts/base-locale/0[1-9]_*.sql; do
  echo "   $(basename "$f")"
  psql -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$f"
done

echo "→ fonctions appelees par le serveur et non executables"
psql -h "$SOCK" -p "$PORT" -U postgres -tAc "
  select p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not has_function_privilege('service_role', p.oid, 'execute')
    and p.proname in (
      'assign_quote_reference','sophie_runtime_for_number','organization_for_number',
      'calls_awaiting_summary','receive_inbound_message','messages_to_send',
      'expired_recordings','calls_to_purge','purge_expired_transcripts',
      'purge_expired_summaries','purge_expired_call_events','purge_expired_messages',
      'record_retention_run','record_integration_check');"

echo "✓ termine"
