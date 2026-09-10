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
 * ⚠️ モジュールスコープで評価する。`force-dynamic` にすると `BUILT_AT` が
 *    ビルド時刻ではなくコールドスタート時刻になり、意味が変わる。
 */
const BUILT_AT = new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    /** Vercel のビルド環境変数。ローカルでは undefined なので null を返す */
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
    builtAt: BUILT_AT,
    /* ★メールの送信設定が入っているか（2026-09-10）。**値は出さない。**
       ⚠️ これが false のまま `SCOUT_SENDING_ENABLED` を開けると、
          メールは1通も届かないまま「送信しました」と出る。**開ける前にここを見る。** */
    hasResendKey: hasResendKey(),
  });
}
