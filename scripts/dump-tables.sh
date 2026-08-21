#!/usr/bin/env bash
#
# 作業前ダンプ ── 指定したテーブルだけを1ファイルに落とす
#
#   使い方:
#     ./scripts/dump-tables.sh ow_transitions ow_experiences
#     ./scripts/dump-tables.sh ow_users            # 1テーブルでもよい
#
#   出力: .dumps/YYYYMMDD-HHMM-<テーブル名>.sql
#
# ── なぜ要るか ───────────────────────────────────────────────────────────────
#   Supabase の日次バックアップには3つの制約がある（2026-08-20 確認）:
#     ① 戻せるのは**1日単位**（**8日分**保持。最新は各日 15:0x UTC ≒ 日本時間の翌0時過ぎ）
#     ② Restore は**プロジェクト全体の巻き戻し**。1テーブルだけ戻すことはできない
#     ③ **Storage は含まれない**（企業ロゴの実ファイルは対象外）
#   足りないのは頻度ではなく**粒度**。DB を触る日は、触る表だけ手元に落としておく。
#
#   ⚠️ **PITR は無効**（検討して見送り。2026-08-20）。**このダンプが1テーブル復旧の唯一の手段。**
#   ⚠️ migration は復旧手段ではない（docs/todo.md）。
#      通しで流し直しても再現できない（実測 OK 54 / FAIL 58）。
#
# ── 接続情報：**新しく秘密情報をファイルに置かない** ─────────────────────────
#   次の順で試す。**どちらもスキーマ+データが出る**（2026-08-22 に B を作り直した）。
#     A) 環境変数 `SUPABASE_DB_URL` があれば pg_dump に直接渡す
#     B) 無ければ **Supabase CLI の一時資格情報を借りる**。
#        `supabase db dump --linked --dry-run` は**実行せずに pg_dump 用の
#        bash スクリプトを表示するだけ**なので、そこから `export PG*` の行を
#        取り出して eval し、自前の pg_dump に渡す。
#        → **Docker 不要**。パスワードは環境変数にしか置かない。
#     C) それも無理なら Docker（`SUPABASE_DB_URL` がある場合のみ）
#
#   ⚠️ **以前の B は `supabase db dump --linked` を直接呼んでおり、Docker 必須だった。**
#      Docker Desktop が落ちていると作業前ダンプごと失敗し、しかも data-only なので
#      列を落とす migration の前には使えなかった（2026-08-22 に実際に踏んだ）。
#      **いまは B でも列定義が残るので、列を落とす migration の前にも使える。**
#
#   ⚠️ A に要る接続文字列: Supabase ダッシュボード → Project Settings → Database →
#      Connection string。**リポジトリ内のファイルに書かないこと。**
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then
  echo "使い方: $0 <テーブル名> [テーブル名...]" >&2
  echo "  例:   $0 ow_transitions ow_experiences" >&2
  exit 1
fi

mkdir -p .dumps
STAMP="$(date +%Y%m%d-%H%M)"
NAME="$(IFS=-; echo "$*")"
OUT=".dumps/${STAMP}-${NAME}.sql"

SERVER_MAJOR=17
if [ -f supabase/.temp/postgres-version ]; then
  SERVER_MAJOR="$(cut -d. -f1 < supabase/.temp/postgres-version)"
fi

ARGS=()
for t in "$@"; do ARGS+=(-t "public.${t}"); done

# ── pg_dump のバイナリを選ぶ ─────────────────────────────────────────────────
#   ⚠️ **サーバと同じメジャー以上が要る。** 古いと "server version mismatch" で止まる。
#      2026-08-22 時点: サーバ 17 / PATH 上の pg_dump は Homebrew の 16。
#      postgresql@17 は入っているが link されていないので、**直接パスで拾う**。
pick_pg_dump() {
  if command -v pg_dump >/dev/null 2>&1 \
     && [ "$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')" -ge "$SERVER_MAJOR" ]; then
    command -v pg_dump; return 0
  fi
  local c
  for c in "/opt/homebrew/opt/postgresql@${SERVER_MAJOR}/bin/pg_dump" \
           "/usr/local/opt/postgresql@${SERVER_MAJOR}/bin/pg_dump"; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  return 1
}
PGDUMP="$(pick_pg_dump || true)"

if [ -n "${SUPABASE_DB_URL:-}" ] && [ -n "$PGDUMP" ]; then
  # ── A) 環境変数の接続文字列 ─────────────────────────────────────────────
  echo "$($PGDUMP --version) でスキーマ+データを取得します（SUPABASE_DB_URL）"
  "$PGDUMP" "$SUPABASE_DB_URL" --no-owner --no-privileges "${ARGS[@]}" > "$OUT"
  MODE="スキーマ+データ"

elif [ -n "$PGDUMP" ]; then
  # ── B) Supabase CLI の一時資格情報を借りる（Docker 不要）────────────────
  #
  #   ⚠️ 以前の B は `supabase db dump --linked` を呼んでいたが、**あれは Docker 必須**で、
  #      Docker Desktop が落ちていると作業前ダンプごと失敗していた（2026-08-22 に踏んだ）。
  #      しかも data-only なので、列を落とす migration の前には使えなかった。
  #
  #   `--dry-run` は**実行せずに pg_dump 用の bash スクリプトを表示するだけ**。
  #   そこから `export PG*` の行だけを取り出して eval し、自前の pg_dump に渡す。
  #   → **Docker が要らず、しかもスキーマ+データが取れる。**
  #
  #   ⚠️ **資格情報は環境変数にしか置かない。** ファイルにも echo にも出さない。
  #      PGPASSWORD は使い終わったら unset する。
  echo "SUPABASE_DB_URL が無いので Supabase CLI の一時資格情報を使います（Docker 不要）"
  CREDS="$(npx supabase db dump --linked --data-only -s public --dry-run 2>/dev/null \
             | grep '^export PG' || true)"
  if [ -z "$CREDS" ]; then
    echo "資格情報を取得できませんでした。'npx supabase login' と 'npx supabase link' を確認してください。" >&2
    rm -f "$OUT"; exit 1
  fi
  eval "$CREDS"
  #   ⚠️ **`--role postgres` が要る。** CLI のログインロール
  #      （cli_login_postgres.<ref>）は ow_* に直接の権限を持たず、
  #      これが無いと `permission denied for table ...` / `LOCK TABLE` で落ちる。
  #      `supabase db dump` 自身も同じフラグを付けている（--dry-run で確認できる）。
  "$PGDUMP" --role postgres --no-owner --no-privileges "${ARGS[@]}" > "$OUT"
  unset PGPASSWORD
  MODE="スキーマ+データ"

elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && [ -n "${SUPABASE_DB_URL:-}" ]; then
  # ── C) 最後の手段: Docker の pg_dump ───────────────────────────────────
  echo "ローカルに pg_dump ${SERVER_MAJOR} が無いので Docker の postgres:${SERVER_MAJOR} を使います"
  docker run --rm -i "postgres:${SERVER_MAJOR}" \
    pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges "${ARGS[@]}" > "$OUT"
  MODE="スキーマ+データ"

else
  echo "pg_dump ${SERVER_MAJOR} 以上が見つかりません。'brew install postgresql@${SERVER_MAJOR}' を実行してください。" >&2
  rm -f "$OUT"; exit 1
fi

# ── 確認（0バイトで終わらせない）───────────────────────────────────────────
BYTES=$(wc -c < "$OUT" | tr -d ' ')
if [ "$BYTES" -lt 100 ]; then
  echo "⚠️ 出力が ${BYTES} バイトしかありません。テーブル名が正しいか確認してください: $OUT" >&2
  exit 1
fi

echo
echo "出力: $OUT （${BYTES} バイト / ${MODE}）"
echo "テーブルごとの行数（実測。0 なら中身が入っていない）:"
for t in "$@"; do
  # ⚠️ **形式が2つある。** A(pg_dump) は COPY、B(CLI) は複数行 INSERT。
  #    どちらも「1行 = 値のタプル1つ」を数える。
  n=$(awk -v tbl="$t" '
    # --- B: "-- ===== <table> =====" で区切られた塊の中の "(...)" 行
    $0 == "-- ===== " tbl " =====" { inb=1; next }
    /^-- ===== / { inb=0 }
    inb && /^[[:space:]]*\(/ { c++ }
    # --- A: COPY public.<table> ... \.
    $1=="COPY" && $2=="public." tbl { inc=1; next }
    inc && $0=="\\." { inc=0; next }
    inc { c++ }
    END { print c+0 }
  ' "$OUT")
  printf "  %-28s %s 行\n" "$t" "$n"
done

echo
echo "⚠️ .dumps/ は .gitignore 済み。**本番データをコミットしないこと。**"
