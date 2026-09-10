#!/usr/bin/env bash
# ★dev サーバーを cold（キャッシュ空）から起動し直す（2026-09-11）
#
# ⚠️★**表示件数・人数・可視性の前後比較は、必ずこれを通すこと。**
#    `unstable_cache` が残っていると「適用後の結果」を「適用前の測定値」として読む。
#    実測の TTL: `/people` 1800秒 ／ 企業ページの社員一覧 300秒 ／ 事業領域 300秒。
#
# ⚠️★CLAUDE.md に注意書きを足しても**3回踏んだ**（2026-08-12 / 2026-09-10 / 2026-09-11）。
#    文章では防げないので、**手数を1つにする**のがこのスクリプトの目的。
#    ⚠️ 注意書きを増やす方向に戻さないこと。
#
# 使い方:
#   ./scripts/dev-cold.sh          # 止める → .next を消す → 起動 → 200 を待つ
#   ./scripts/dev-cold.sh --stop   # 止めるだけ
#
# ⚠️ 並行セッションがいる日は、相手の dev も落とすことになる。**先に一声かけること**
#    （CLAUDE.md「dev サーバーは片方のセッションだけが起動する」）。
set -euo pipefail
cd "$(dirname "$0")/.."

stop_dev() {
  local pids
  pids=$(lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "dev を止める: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 2
  fi
  pkill -f "next dev" 2>/dev/null || true
  sleep 1
}

stop_dev
if [ "${1:-}" = "--stop" ]; then echo "停止しました（.next は消していません）"; exit 0; fi

# ⚠️ dev が完全に止まってから消す。動いたまま消すと参照が壊れる（CLAUDE.md）。
rm -rf .next
echo ".next を削除しました（cold）"

LOG="${TMPDIR:-/tmp}/opinio-dev-cold.log"
nohup npm run dev > "$LOG" 2>&1 &
echo "起動中… ログ: $LOG"

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then echo "起動しました（${i}秒）"; exit 0; fi
  sleep 1
done
echo "60秒たっても 200 になりませんでした。$LOG を見てください" >&2
exit 1
