#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# SECURITY DEFINER の関数が、クライアントのロールから呼べる状態になっていないかを確かめる
# （2026-10-09 / 柴さんの指示）
#
#   ./scripts/check-definer-grants.sh              # 本番を検査。許可リスト外が1件でもあれば exit 1
#   ./scripts/check-definer-grants.sh --self-test  # 許可リストを空にして走らせ、許可済みの関数が
#                                                  # すべて検出されることを確かめる（陽性対照）
#
# ★なぜ要るか
#   public スキーマの関数は、作った時点で **PUBLIC が実行できる**（Postgres の既定）。
#   SECURITY DEFINER は RLS を越えて走るので、そのまま anon / authenticated から呼べると
#   他人のデータが引ける。2026-10-09 に7本がこの状態で見つかった
#   （`get_blocked_companies` で、未ログインでも他人の在籍先の社名が返った）。
#   → 20261009050000 で塞いだ。**同じ形が新しく生まれていないか**をこれで見る。
#
# ★検査するもの
#   public スキーマの SECURITY DEFINER 関数（トリガー関数を除く）のうち、
#   PUBLIC・anon・authenticated のどれかが実行できるもの。許可リストに載っていなければ失敗。
#
# ⚠️★本番に対して**読み取りだけ**で動く。問い合わせは `BEGIN READ ONLY … ROLLBACK` の中で行う。
#    ⚠️★`PGOPTIONS=-c default_transaction_read_only=on` は**使えない**。接続が Supabase の
#       プーラー経由で、起動時オプションが捨てられる（2026-10-09 に実測。`show` が off のままで、
#       一時テーブルが作れてしまった）。
# ⚠️ 接続は `dump-tables.sh` と同じ（`SUPABASE_DB_URL` か、Supabase CLI の一時資格情報）。
#    資格情報はファイルに書かない。使い終わったら unset する。
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

# ── 許可リスト（ここに足すときは CLAUDE.md の「SECURITY DEFINER の関数の決まり」を読むこと）─────
#  ① RLS ポリシーの中で使う補助関数。**呼んだ本人のことしか答えない**
#     （外すとポリシーの評価ごと 403 になる。RLS で計107か所使っている / 2026-10-09 実測）
#  ② クライアント（セッションのクライアント）から呼ぶ RPC で、**中で auth.uid() による
#     本人確認をしているもの**。2026-10-09 時点で**該当なし**。
#     ⚠️ `create_conversation` はここに居たが、20261009080000 でクライアントから外した
#        （企業との会話はサーバーが「開いてよい理由」を確かめて作る。`lib/conversations/openReason.ts`）
ALLOW=(
  "auth_is_admin()"                              # ①
  "auth_is_company_admin(target_company_id uuid)" # ①
  "auth_is_company_member(target_company_id uuid)" # ①
  "auth_ow_user_id()"                            # ①
  "auth_is_active_company_admin(p_company_id uuid)" # ①
)

SELF_TEST=0
[ "${1:-}" = "--self-test" ] && SELF_TEST=1

# ── psql を選ぶ（サーバは 17 系。古い psql でも読み取りは通るが、揃える）────────────
PSQL=""
for c in "/opt/homebrew/opt/postgresql@17/bin/psql" "/usr/local/opt/postgresql@17/bin/psql" "$(command -v psql || true)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then PSQL="$c"; break; fi
done
[ -n "$PSQL" ] || { echo "psql が見つかりません"; exit 2; }

SQL=$(cat <<'EOSQL'
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn,
       array_to_string(array_remove(array[
         case when exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                           where a.grantee = 0 and a.privilege_type = 'EXECUTE') then 'PUBLIC' end,
         case when has_function_privilege('anon', p.oid, 'EXECUTE') then 'anon' end,
         case when has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'authenticated' end
       ], null), ',') as roles
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.prosecdef
   and p.prokind = 'f'
   and p.prorettype <> 'trigger'::regtype
   and (has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
 order by 1;
EOSQL
)

# ── 接続（読み取り専用のトランザクションの中で問い合わせる）────────────────────
#   ⚠️ `-q` で BEGIN / ROLLBACK の表示を消す。消さないと結果の行に混ざる。
RO=(-X -A -t -q -F $'\t' -v ON_ERROR_STOP=1 -c "begin transaction read only;" -c "$SQL" -c "rollback;")
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  ROWS="$("$PSQL" "$SUPABASE_DB_URL" "${RO[@]}")"
else
  CREDS="$(npx supabase db dump --linked --data-only -s public --dry-run 2>/dev/null | grep '^export PG' || true)"
  [ -n "$CREDS" ] || { echo "Supabase CLI の一時資格情報を取得できませんでした（supabase link 済みか確認）"; exit 2; }
  eval "$CREDS"
  ROWS="$("$PSQL" "${RO[@]}")"
  unset PGPASSWORD
fi

[ "$SELF_TEST" = 1 ] && ALLOW_EFFECTIVE=() || ALLOW_EFFECTIVE=("${ALLOW[@]}")

is_allowed() {
  local f="$1"
  for a in "${ALLOW_EFFECTIVE[@]+"${ALLOW_EFFECTIVE[@]}"}"; do [ "$a" = "$f" ] && return 0; done
  return 1
}

BAD=0
FOUND=()
while IFS=$'\t' read -r fn roles; do
  [ -z "$fn" ] && continue
  FOUND+=("$fn")
  if ! is_allowed "$fn"; then
    echo "NG  $fn  ← 実行できるロール: $roles"
    BAD=$((BAD + 1))
  fi
done <<< "$ROWS"

if [ "$SELF_TEST" = 1 ]; then
  # ★陽性対照: 許可リストの関数が1つ残らず検出されること
  MISS=0
  for a in "${ALLOW[@]}"; do
    hit=0; for f in "${FOUND[@]+"${FOUND[@]}"}"; do [ "$f" = "$a" ] && hit=1; done
    [ "$hit" = 1 ] || { echo "自己テスト失敗: 許可リストの $a が検出されなかった"; MISS=$((MISS + 1)); }
  done
  if [ "$MISS" = 0 ] && [ "$BAD" -ge "${#ALLOW[@]}" ]; then
    echo "✓ 自己テスト: 許可リストを空にすると ${BAD} 件を検出（許可リスト ${#ALLOW[@]} 件をすべて含む）。検出器は効いている"
    exit 0
  fi
  echo "✗ 自己テスト失敗"; exit 1
fi

if [ "$BAD" -gt 0 ]; then
  echo "✗ 許可リスト外で、クライアントのロールから呼べる SECURITY DEFINER 関数が ${BAD} 件あります。"
  echo "  migration で revoke execute ... from public, anon, authenticated; を当て、必要なロールにだけ grant してください。"
  exit 1
fi
echo "OK: 許可リスト外の SECURITY DEFINER 関数は 0 件（検査した関数のうち許可済み ${#FOUND[@]} 件）"
