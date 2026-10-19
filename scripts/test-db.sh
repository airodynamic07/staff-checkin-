#!/usr/bin/env bash
# Runs the pgTAP tests in supabase/tests against a throwaway local Postgres 16
# (needs postgresql-16, postgresql-16-pgtap and postgresql-16-cron installed).
# Use this where Docker is unavailable; otherwise `npx supabase test db` works too.
set -euo pipefail
shopt -s nullglob
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN=/usr/lib/postgresql/16/bin
DATA="$(mktemp -d)"
PORT=${PGTEST_PORT:-54329}
RUN_AS=()
if [ "$(id -u)" = 0 ]; then
  chown postgres "$DATA"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
"${RUN_AS[@]}" "$BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$BIN/pg_ctl" -D "$DATA" -l "$DATA/log" -w -o "-p $PORT -k /tmp -c shared_preload_libraries=pg_cron -c cron.database_name=postgres -c timezone=UTC -c wal_level=logical" start >/dev/null
PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f "$ROOT/scripts/supabase-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done
status=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  if out=$("${PSQL[@]}" -t -A -f "$t" 2>&1) && ! grep -q '^not ok' <<<"$out"; then
    echo "$(basename "$t") .. ok ($(grep -c '^ok' <<<"$out") tests)"
  else
    echo "$(basename "$t") .. FAIL"; grep -E '^not ok|^#|ERROR' <<<"$out" | head -40; status=1
  fi
done
exit $status
