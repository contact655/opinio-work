import { NextResponse } from "next/server";
import { hasResendKey } from "@/lib/notify/email";

/**
 * デプロイの同一性を確認するためのエンドポイント。
 *
 * ⚠️ **「Vercel が Ready になった」を完了条件にしない。**
 *    Ready は「そのデプロイが出来上がった」であって「本番の別名が
 *    そのデプロイを指している」とは限らない。`vercel inspect --json` も
 *    `meta.githubCommitSha` を返さない（実測 2026-08-15。返るキーは
 *    aliases / builds / contextName / createdAt / id / name / readyState / target / url）。
 *
 *    照合はこれ1本で済ませる:
 *      curl -s https://opinio.jp/api/health
 *    返ってきた `commit` が push したコミットの先頭8桁と一致したら完了。
 *
 * ⚠️ **環境変数の中身は出さない。** 返すのはコミットの先頭8桁とビルド時刻、
 *    それに**設定が入っているかの真偽**だけ。認証は不要にしてある。
 *    ⚠️★真偽であっても、**入っているかどうか自体が秘密になるもの**は足さないこと。
 *
 * ⚠️★**毎回その場で返す（force-dynamic）。外さないこと**（2026-10-22）。
 *    それまでは GET の結果がビルドで固定され、Vercel のキャッシュ（x-vercel-cache: HIT）が
 *    **新しいデプロイが出たあとも前の版の commit を返していた**（実測: 本番は cb4a8939 なのに 1cbc99a2 を返した）。
 *    このエンドポイントでデプロイを確かめる前提が崩れる。
 * ⚠️ ビルド時刻は next.config.mjs の env（OPINIO_BUILT_AT）でビルドのときに埋め込む。
 *    モジュールの中で new Date() すると、force-dynamic ではサーバーが起動した時刻になってしまう。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    /** Vercel のビルド環境変数。ローカルでは undefined なので null を返す */
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
    builtAt: process.env.OPINIO_BUILT_AT ?? null,
    /* ★メールの送信設定が入っているか（2026-09-10）。**値は出さない。**
       ⚠️ これが false のまま `SCOUT_SENDING_ENABLED` を開けると、
          メールは1通も届かないまま「送信しました」と出る。**開ける前にここを見る。** */
    hasResendKey: hasResendKey(),
  }, { headers: { "Cache-Control": "no-store" } });
}
