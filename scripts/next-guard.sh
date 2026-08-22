#!/usr/bin/env bash
#
# dev サーバーの二重起動だけを止める（2026-08-22）
#
#   package.json の "predev" から呼ばれる。`npm run dev` の直前に走る。
#
# ── 何を防ぐか ───────────────────────────────────────────────────────────────
#   ①「dev サーバーの二重起動」だけ。
#     2つの dev が同じ `.next/cache/webpack/` の pack を奪い合って壊し、
#     **変更が反映されない／消したはずの変数を参照して落ちる**という、
#     原因がコード側に見えてしまう事故になる（CLAUDE.md「dev サーバーは
#     絶対に2つ同時に起動しない」）。
#
# ── 何を防がないか（★ここを誤解しないこと）──────────────────────────────────
#   - **build / start は検出しない。** ローカルの build / start は `.next-prod` に
#     出るようになったので（`next.config.mjs` の `distDir`）、dev とは衝突しない。
#     **②③④は distDir 側で担保しており、ここで見る必要が無い。**
#   - **`npx next dev` を直接叩くと素通りする。** npm の `pre*` フックは
#     `npm run dev` 経由でしか走らない。
#   - **2セッションが同時に検査すると、数秒の窓で両方通る。**
#     実際に踏んだのは「数分間の重なり」なので実用上は足りるが、原理的な穴は残る。
#
# ── なぜロックファイルにしないか ──────────────────────────────────────────────
#   ロックファイルは SIGKILL やクラッシュで残ると**誰も起動できなくなる**ので、
#   「持ち主がまだ生きているか」を `kill -0` で見る処理が結局必要になる。
#   それは PID チェックそのもので、ロックファイルは失敗モードが増えるだけ。
#
# ⚠️ **迷ったら通す（fail-open）。** ここで誤って止めると開発が始められない。
#    確実に「生きている dev が居る」と分かったときだけ止める。

# ⚠️ `-e` は付けない。途中のコマンドが失敗しても**素通り**させたいため。
set -uo pipefail

# ── 逃げ道 ──────────────────────────────────────────────────────────────────
# 意図的に並走させたいときはこれで抜ける
if [ -n "${OPINIO_ALLOW_NEXT:-}" ]; then
  exit 0
fi

# 管理環境では dev は走らないが、1行で済むので念のため
if [ -n "${VERCEL:-}" ] || [ -n "${CI:-}" ]; then
  exit 0
fi

# ── ツールが無ければ素通り ──────────────────────────────────────────────────
# ⚠️ ここで止めると、pgrep の無い環境で dev が起動できなくなる
command -v pgrep >/dev/null 2>&1 || exit 0
command -v ps    >/dev/null 2>&1 || exit 0

# ── 自分の系列（npm / bash / このスクリプト）を除外するため祖先を集める ──────
# ⚠️ これが無いと、自分を起動した npm を「別の dev」と誤検知しうる
ancestors=" $$ "
p=$$
for _ in 1 2 3 4 5 6 7 8; do
  p="$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')"
  [ -z "$p" ] && break
  [ "$p" -le 1 ] 2>/dev/null && break
  ancestors="$ancestors$p "
done

# ── 検出（next dev / next-server の2つだけ）──────────────────────────────────
candidates="$( { pgrep -f 'next-server' 2>/dev/null; pgrep -f 'next dev' 2>/dev/null; } | sort -u )"

living=""
for pid in $candidates; do
  # 自分の系列は無視
  case "$ancestors" in *" $pid "*) continue ;; esac
  # ⚠️ ゾンビは「PID は在るが動いていない」。kill -0 は成功してしまうので ps の状態で弾く
  stat="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d ' ')"
  [ -z "$stat" ] && continue
  case "$stat" in Z*) continue ;; esac
  # 本当に生きているか
  kill -0 "$pid" 2>/dev/null || continue
  living="$living $pid"
done

# 見つからなければ通す
[ -z "${living// /}" ] && exit 0

# ── 中止（★どれと衝突しているかを名指しする）────────────────────────────────
# ⚠️ PID とコマンドラインを出さないと、結局 kill -9 の総当たりになる
{
  echo ""
  echo "  ✋ dev サーバーが既に動いています。二重起動を中止しました。"
  echo ""
  echo "     2つの dev が同じ .next/cache/webpack/ を奪い合うと pack が壊れ、"
  echo "     「変更が反映されない」「消したはずの変数を参照して落ちる」という"
  echo "     コード側を疑ってしまう事故になります。"
  echo ""
  echo "     動いているプロセス:"
  for pid in $living; do
    echo "       $(ps -o pid=,command= -p "$pid" 2>/dev/null | sed 's/^ *//')"
  done
  if command -v lsof >/dev/null 2>&1; then
    ports="$(lsof -nP -iTCP -sTCP:LISTEN -a -p "$(echo $living | tr ' ' ',')" 2>/dev/null \
             | awk 'NR>1 {print $9}' | sed 's/.*://' | sort -u | tr '\n' ' ')"
    [ -n "${ports// /}" ] && echo "       待ち受けポート: $ports"
  fi
  echo ""
  echo "     そのまま使う場合:  curl http://localhost:3000/..."
  echo "     止める場合:        kill$living"
  echo "     どうしても並走:    OPINIO_ALLOW_NEXT=1 npm run dev"
  echo ""
} >&2

exit 1
