#!/usr/bin/env bash
#
# OGP 画像の健全性チェック
#
#   使い方:
#     ./scripts/check-og.sh                      # 本番（https://opinio.jp）
#     ./scripts/check-og.sh http://localhost:3000 # ローカルの dev サーバー
#
# ── なぜ要るか ───────────────────────────────────────────────────────────────
#   **OGP は壊れても誰も気づかない。** 2026-05-23 から 2026-08-25 までの1年3か月、
#   バッジ付きの OG 画像が1枚も生成されていなかった（企業84 / 求人5 / 記事16 = 105枚）。
#   原因はバッジ pill の `width: "fit-content"` を satori 下の Yoga が受け付けず
#   例外を投げていたこと。
#
#   ⚠️ **それでも HTTP は 200 だった。** Next 14 の `ImageResponse` は
#      コンストラクタでヘッダを確定し、描画は ReadableStream の中で後から走るため、
#      描画が落ちても 5xx にならず「200 かつ空ボディ」になる。
#      → **「200 が返る」を成功条件にしてはいけない。バイト数と中身で見る。**
#
# ── 成功条件（3つとも満たすこと）─────────────────────────────────────────────
#   ① HTTP 200
#   ② content-length が 10,000 バイト以上（空ボディ・切れた応答を弾く）
#   ③ 先頭が PNG のマジックバイト（\x89PNG）
#
set -euo pipefail

BASE="${1:-https://opinio.jp}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

MIN_BYTES=10000
ng=0
total=0

# ── 検査対象 ────────────────────────────────────────────────────────────────
#   ページを実際に取得して <meta og:image> を読む。URL をここに直書きしない
#   （呼び出し側がパラメータを変えたときに、この台本だけ古くなるのを防ぐ）。
PAGES=(
  # 一覧（badge なし）
  "/companies"
  "/jobs"
  "/articles"
  "/business"
)

# 詳細ページ（badge あり＝今回壊れていた経路）は種別ごとに代表を拾う
pick() { # $1=一覧パス $2=リンクの正規表現 $3=件数
  curl -fsS --max-time 30 "$BASE$1" 2>/dev/null \
    | grep -oE "href=\"$2\"" | sed 's/href="//;s/"//' | sort -u | head -"$3" || true
}

while IFS= read -r p; do [ -n "$p" ] && PAGES+=("$p"); done < <(pick "/companies" "/companies/[a-z0-9-]+" 3)
while IFS= read -r p; do [ -n "$p" ] && PAGES+=("$p"); done < <(pick "/jobs"      "/jobs/[a-z0-9-]+"      2)
while IFS= read -r p; do [ -n "$p" ] && PAGES+=("$p"); done < <(pick "/articles"  "/articles/[a-z0-9-]+"  2)

printf '%s\n' "OGP チェック: $BASE"
printf '%s\n' "成功条件: 200 かつ ${MIN_BYTES} バイト以上 かつ PNG マジックバイト"
printf '%s\n' "──────────────────────────────────────────────────────────────────────"

for page in "${PAGES[@]}"; do
  total=$((total + 1))

  html="$TMP/page.html"
  if ! curl -fsS --max-time 30 -o "$html" "$BASE$page" 2>/dev/null; then
    printf '  ✗ %-42s ページを取得できない\n' "$page"; ng=$((ng + 1)); continue
  fi

  # og:image の URL を取り出す（&amp; を戻す）
  og="$(grep -oE '<meta[^>]+property="og:image"[^>]*>' "$html" | head -1 \
        | grep -oE 'content="[^"]*"' | sed 's/content="//;s/"$//' | sed 's/&amp;/\&/g')"
  [ -z "$og" ] && og="$(grep -o "$BASE/api/og[^\"]*" "$html" | head -1 | sed 's/&amp;/\&/g')"
  case "$og" in /*) og="$BASE$og" ;; esac

  if [ -z "$og" ]; then
    printf '  ✗ %-42s og:image が無い\n' "$page"; ng=$((ng + 1)); continue
  fi

  img="$TMP/og.png"
  code="$(curl -s --max-time 60 -o "$img" -w '%{http_code}' "$og")"
  bytes="$(wc -c < "$img" | tr -d ' ')"
  # PNG マジックバイト: 89 50 4E 47
  magic="$(head -c 4 "$img" | od -An -tx1 | tr -d ' \n')"
  badge="$(printf '%s' "$og" | grep -qE 'badge=[^&]+' && echo 'badge有' || echo 'badge無')"

  if [ "$code" = "200" ] && [ "$bytes" -ge "$MIN_BYTES" ] && [ "$magic" = "89504e47" ]; then
    printf '  ✓ %-42s %s %s bytes\n' "$page" "$badge" "$bytes"
  else
    printf '  ✗ %-42s %s status=%s bytes=%s magic=%s\n' "$page" "$badge" "$code" "$bytes" "$magic"
    ng=$((ng + 1))
  fi
done

printf '%s\n' "──────────────────────────────────────────────────────────────────────"
if [ "$ng" -eq 0 ]; then
  printf '%s\n' "OK: $total 件すべて正常"
else
  printf '%s\n' "NG: $total 件中 $ng 件が失敗"
  exit 1
fi
