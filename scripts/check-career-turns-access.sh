#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# 転機の3問（ow_career_turns）が、本人と集計処理（service role）以外から読み書きできないことを確かめる
# （2026-10-27 / フェーズ1c・柴さんの指示）
#
#   ./scripts/check-career-turns-access.sh              # 本番を検査。1つでも通れば exit 1
#   ./scripts/check-career-turns-access.sh --self-test  # 陽性対照: service_role では読めること・検査が「通った」を検出できること
#
# ★確かめること（どれも 42501 permission denied になるべき）
#   anon           … SELECT / INSERT
#   authenticated  … SELECT / INSERT / UPDATE / DELETE（★本人の JWT を名乗っても。＝本人が API を通さずに書けない）
#   ＋ カタログ: RLS 有効・ポリシー0本・anon / authenticated に表の権限なし
#
# ⚠️★書き込みを試すので、全体を 1つのトランザクションに入れて **必ず ROLLBACK** する（データは変わらない）。
#    INSERT が通ってしまった場合も ROLLBACK で消える。
# ⚠️ 本人の JWT は、検証用アカウント（is_test）の auth_id を request.jwt.claims に入れて名乗る。
#    セッションは作らない（管理用の鍵でセッションを作らない決まり）。
# ⚠️ 接続は SUPABASE_DB_URL（postgres ロール）で走らせる。
#    ⚠️★Supabase CLI の一時資格情報（cli_login_*）は ow_users を読めず、検証用アカウントを引けずに止まる（2026-10-27 実測）。
#       そのときは同じ SQL を Supabase の SQL 実行（MCP の execute_sql）で流す。2026-10-27 はそれで全項目 ok を確認した
#       （陽性対照として、トランザクションの中で authenticated に SELECT を配ると「NG: 通った」になることも確認）。
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

SELF_TEST=0
[ "${1:-}" = "--self-test" ] && SELF_TEST=1

PSQL=""
for c in "/opt/homebrew/opt/postgresql@17/bin/psql" "/usr/local/opt/postgresql@17/bin/psql" "$(command -v psql || true)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then PSQL="$c"; break; fi
done
[ -n "$PSQL" ] || { echo "psql が見つかりません"; exit 2; }

# ★1つの試行 = 1つの DO ブロック。42501 なら OK、それ以外（通った・別のエラー）は NG を RAISE NOTICE で出す
SQL=$(cat <<'EOSQL'
begin;
create temporary table _ct_result(role text, op text, outcome text) on commit drop;
grant all on _ct_result to anon, authenticated, service_role;

-- 本人を名乗るための検証用アカウント（is_test）と、その人の職歴1件
create temporary table _ct_me on commit drop as
  select u.id as ow_id, u.auth_id, (select e.id from ow_experiences e where e.user_id = u.id order by e.started_at limit 1) as exp_id
    from ow_users u
   where u.is_test = true and u.auth_id is not null
     and exists (select 1 from ow_experiences e where e.user_id = u.id)
   order by u.created_at limit 1;
grant select on _ct_me to anon, authenticated, service_role;

-- カタログ
insert into _ct_result
select 'catalog', 'rls_enabled', case when relrowsecurity then 'ok' else 'NG' end from pg_class where oid = 'public.ow_career_turns'::regclass
union all
select 'catalog', 'policies=0', case when count(*) = 0 then 'ok' else 'NG: ' || count(*) end from pg_policy where polrelid = 'public.ow_career_turns'::regclass
union all
select 'catalog', 'anon_has_no_privilege',
  case when has_table_privilege('anon','public.ow_career_turns','SELECT,INSERT,UPDATE,DELETE') then 'NG' else 'ok' end
union all
select 'catalog', 'authenticated_has_no_privilege',
  case when has_table_privilege('authenticated','public.ow_career_turns','SELECT,INSERT,UPDATE,DELETE') then 'NG' else 'ok' end
union all
-- ★任意の段の軸（2026-10-27 / migration 20261027100000）も同じ形
select 'catalog', 'axes_rls_enabled', case when relrowsecurity then 'ok' else 'NG' end from pg_class where oid = 'public.ow_career_turn_axes'::regclass
union all
select 'catalog', 'axes_policies=0', case when count(*) = 0 then 'ok' else 'NG: ' || count(*) end from pg_policy where polrelid = 'public.ow_career_turn_axes'::regclass
union all
select 'catalog', 'axes_client_has_no_privilege',
  case when has_table_privilege('anon','public.ow_career_turn_axes','SELECT,INSERT,UPDATE,DELETE')
         or has_table_privilege('authenticated','public.ow_career_turn_axes','SELECT,INSERT,UPDATE,DELETE') then 'NG' else 'ok' end;

-- anon
set local role anon;
do $$ begin perform 1 from public.ow_career_turns limit 1; insert into _ct_result values ('anon','select','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('anon','select','ok'); when others then insert into _ct_result values ('anon','select','NG: '||sqlstate); end $$;
do $$ declare m record; begin select * into m from _ct_me;
  insert into public.ow_career_turns(experience_id, user_id, next_priority) values (m.exp_id, m.ow_id, 'salary');
  insert into _ct_result values ('anon','insert','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('anon','insert','ok'); when others then insert into _ct_result values ('anon','insert','NG: '||sqlstate); end $$;
do $$ begin perform 1 from public.ow_career_turn_axes limit 1; insert into _ct_result values ('anon','select axes','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('anon','select axes','ok'); when others then insert into _ct_result values ('anon','select axes','NG: '||sqlstate); end $$;
reset role;

-- authenticated（本人を名乗る）
select set_config('request.jwt.claims', json_build_object('sub', (select auth_id from _ct_me), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin perform 1 from public.ow_career_turns limit 1; insert into _ct_result values ('authenticated(本人)','select','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('authenticated(本人)','select','ok'); when others then insert into _ct_result values ('authenticated(本人)','select','NG: '||sqlstate); end $$;
do $$ declare m record; begin select * into m from _ct_me;
  insert into public.ow_career_turns(experience_id, user_id, next_priority) values (m.exp_id, m.ow_id, 'salary');
  insert into _ct_result values ('authenticated(本人)','insert','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('authenticated(本人)','insert','ok'); when others then insert into _ct_result values ('authenticated(本人)','insert','NG: '||sqlstate); end $$;
do $$ begin perform 1 from public.ow_career_turn_axes limit 1; insert into _ct_result values ('authenticated(本人)','select axes','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('authenticated(本人)','select axes','ok'); when others then insert into _ct_result values ('authenticated(本人)','select axes','NG: '||sqlstate); end $$;
do $$ begin update public.ow_career_turns set next_priority = 'salary' where true; insert into _ct_result values ('authenticated(本人)','update','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('authenticated(本人)','update','ok'); when others then insert into _ct_result values ('authenticated(本人)','update','NG: '||sqlstate); end $$;
do $$ begin delete from public.ow_career_turns where true; insert into _ct_result values ('authenticated(本人)','delete','NG: 通った');
  exception when insufficient_privilege then insert into _ct_result values ('authenticated(本人)','delete','ok'); when others then insert into _ct_result values ('authenticated(本人)','delete','NG: '||sqlstate); end $$;
reset role;

-- service_role（陽性対照。集計処理は読めること）
set local role service_role;
do $$ begin perform count(*) from public.ow_career_turns; insert into _ct_result values ('service_role','select','ok(読める)');
  exception when others then insert into _ct_result values ('service_role','select','NG: '||sqlstate); end $$;
reset role;

select role, op, outcome, (select case when exp_id is null then '検証用の職歴が見つからない' else '' end from _ct_me) from _ct_result order by 1, 2;
rollback;
EOSQL
)

ARGS=(-X -A -t -q -F $'\t' -v ON_ERROR_STOP=1)
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  OUT="$(printf '%s\n' "$SQL" | "$PSQL" "$SUPABASE_DB_URL" "${ARGS[@]}")"
else
  CREDS="$(npx supabase db dump --linked --data-only -s public --dry-run 2>/dev/null | grep '^export PG' || true)"
  [ -n "$CREDS" ] || { echo "Supabase CLI の一時資格情報を取得できませんでした（supabase link 済みか確認）"; exit 2; }
  eval "$CREDS"
  OUT="$(printf '%s\n' "$SQL" | "$PSQL" "${ARGS[@]}")"
  unset PGPASSWORD
fi

echo "$OUT" | awk -F'\t' 'NF{printf "%-22s %-32s %s %s\n", $1, $2, $3, $4}'
NG=$(echo "$OUT" | awk -F'\t' '$3 ~ /^NG/' | wc -l | tr -d ' ')
OKSVC=$(echo "$OUT" | awk -F'\t' '$1=="service_role" && $3 ~ /^ok/' | wc -l | tr -d ' ')
if [ "$SELF_TEST" = 1 ]; then
  # 陽性対照: service_role は読めること（＝検査が「通った」を見分けられる）
  [ "$OKSVC" = 1 ] && { echo "自己テスト OK（service_role は読める＝通った経路を見分けられる）"; exit 0; } || { echo "自己テスト NG"; exit 1; }
fi
[ "$NG" = 0 ] && [ "$OKSVC" = 1 ] && { echo "OK: 他人・anon・本人（API を通さない）からは読み書きできない"; exit 0; }
echo "NG が ${NG} 件"; exit 1
