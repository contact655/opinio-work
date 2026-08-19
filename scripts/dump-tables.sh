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
#     ① 戻せるのは**1日単位**（最新は各日 15:0x UTC ≒ 日本時間の翌0時過ぎ）
#     ② Restore は**プロジェクト全体の巻き戻し**。1テーブルだけ戻すことはできない
#     ③ **Storage は含まれない**（企業ロゴの実ファイルは対象外）
#   足りないのは頻度ではなく**粒度**。DB を触る日は、触る表だけ手元に落としておく。
#
#   ⚠️ migration は復旧手段ではない（docs/todo.md）。
#      通しで流し直しても再現できない（実測 OK 54 / FAIL 58）。
#
# ── 接続情報：**新しく秘密情報をファイルに置かない** ─────────────────────────
#   次の順で試す。
#     A) 環境変数 `SUPABASE_DB_URL` があれば pg_dump を直接使う
#        → **スキーマ + データ**が出る（そのテーブルだけを作り直せる形）
#     B) 無ければ **Supabase CLI**（`supabase db dump --linked`）を使う
#        → CLI が保管している資格情報で繋ぐので**パスワードを扱わない**。
#          ただし CLI に「テーブル指定」が無いので、public を data-only で落として
#          **必要な表のぶんだけ切り出す**。つまり **B は data-only**。
#
#   ⚠️ B で足りるのは「値を戻す」場合だけ。**列を落とす migration の前は A を使う**
#      （data-only だと、消えた列の定義が復元できない）。
#      A に要る接続文字列: Supabase ダッシュボード → Project Settings → Database →
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

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  # ── A) pg_dump 直接（スキーマ + データ）──────────────────────────────────
  ARGS=()
  for t in "$@"; do ARGS+=(-t "public.${t}"); done

  LOCAL_MAJOR=0
  if command -v pg_dump >/dev/null 2>&1; then
    LOCAL_MAJOR="$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')"
  fi

  if [ "$LOCAL_MAJOR" -ge "$SERVER_MAJOR" ]; then
    echo "pg_dump ${LOCAL_MAJOR}（ローカル）でスキーマ+データを取得します"
    pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges "${ARGS[@]}" > "$OUT"
  elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    # ⚠️ サーバより古い pg_dump は "server version mismatch" で止まる
    echo "ローカルの pg_dump は ${LOCAL_MAJOR}（サーバ ${SERVER_MAJOR}）。Docker の postgres:${SERVER_MAJOR} を使います"
    docker run --rm -i "postgres:${SERVER_MAJOR}" \
      pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges "${ARGS[@]}" > "$OUT"
  else
    echo "pg_dump が古く（${LOCAL_MAJOR}）Docker も使えません。brew install postgresql@${SERVER_MAJOR} か Docker Desktop の起動を。" >&2
    rm -f "$OUT"; exit 1
  fi
  MODE="スキーマ+データ"
else
  # ── B) Supabase CLI（data-only）──────────────────────────────────────────
  echo "SUPABASE_DB_URL が無いので Supabase CLI で取得します（**data-only**）"
  TMP="$(mktemp -t dumptables)"
  # ⚠️ CLI にテーブル指定が無いので public 全体を落としてから切り出す。
  #    パスワードを扱わずに済むのが利点。
  npx supabase db dump --linked --data-only -s public -f "$TMP" >/dev/null
  awk -v tabs="$*" '
    BEGIN { n = split(tabs, a, " "); for (i = 1; i <= n; i++) want[a[i]] = 1 }
    /^-- Data for Name: / {
      t = $5; sub(/;$/, "", t)
      inblk = (t in want)
      if (inblk) print "\n-- ===== " t " ====="
      next
    }
    inblk { print }
  ' "$TMP" > "$OUT"
  rm -f "$TMP"
  MODE="データのみ（data-only）"
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
