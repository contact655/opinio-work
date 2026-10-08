
/* ⚠️★★スカウトは 2026-10-08 に廃止した（提案に一本化）。`canSendScout()` と
      `SCOUT_PLAN_BLOCKED_MESSAGE`、`PLAN_FEATURES` の `scoutSend` は削除した。**戻さないこと。**
   ⚠️ このファイルを残しているのは、候補者検索が使う `isCompanyReviewed()` が同居しているため。 */

/**
 * ★「スカウト機能そのものが開いているか」（`SCOUT_SENDING_ENABLED`）。
 *
 * ⚠️★**この判定を各画面で書き写さないこと**（2026-09-10）。それまで
 *    `process.env.SCOUT_SENDING_ENABLED === "true"` が**4箇所に直書き**されており、
 *    さらに**文言だけ固定で書かれた画面が2つ**（LP の FAQ・料金ページ）あった。
 *    開ける日に「消し忘れ」と「消しすぎ」の両方が起きる形だった。
 *
 * ⚠️★**サーバー専用。** `SCOUT_SENDING_ENABLED` は `NEXT_PUBLIC_` ではないので、
 *    **クライアント側で呼ぶと常に false になる**（しかもエラーにならない）。
 *    クライアントに伝えるときは**サーバーで判定して props で渡す**こと
 *    （`/mypage/scouts` と `/biz/candidates` が既にその形）。
 *    ⚠️ このファイルを `"use client"` の部品から import しないこと。
 *
 * ⚠️ `canSendScout()`（プラン）とは**別の軸**。両方が要る。
 *
 * ⚠️ 反映には**再デプロイが要る**（Vercel の環境変数はデプロイ単位）。
 *    加えて LP は ISR（`revalidate = 300`）なので、最大5分は古い文言が出る。
 */
/* ⚠️★2026-10-08 の時点で残っている読み手は `/business/pricing` の FAQ だけ
      （並行セッションの作業中ファイルなので触っていない）。あちらから
      「（スカウト送信機能は現在ご利用いただけません）」の行を外したら、**この関数ごと削除する。** */
export function isScoutSendingEnabled(): boolean {
  return process.env.SCOUT_SENDING_ENABLED === "true";
}

/**
 * ★「運営の審査が終わっているか」（2026-09-20）。
 *
 * ⚠️★**`is_published` を見ないこと。** 2026-09-20 まで
 *    `/biz/candidates` と `POST /api/biz/scouts` が **`ctx.isPublished`** で門を作り、
 *    画面には「運営審査が完了するまでお待ちください」と出していた。**列と文言が別物。**
 *    実際に踏んだ（柴さん）:
 *      株式会社Third Box は `is_approved = true`（＝運営が承認済み）なのに、
 *      `is_published = false`（ページを下げている）だけで**審査待ち扱い**されていた。
 *
 * ⚠️★3つのスイッチの意味は CLAUDE.md「企業ページの3つのスイッチ」にある。
 *      `is_approved`     … 運営が内容を確認した   ← **審査はこれ**
 *      `is_published`    … 詳細ページが見えるか（**取り下げ用**の404ゲート）
 *      `listing_status`  … ディレクトリに載るか
 *    `/admin/companies` の説明文にも「ページ表示は取り下げ用です（通常は触りません）」
 *    と書いてある。**取り下げスイッチを審査の代わりに読まない。**
 *
 * ⚠️ 実測（2026-09-20 / 本番・検証用を除く103社）: 承認済みだがページ非表示は **2社**
 *    （KOSKA・ZAP。どちらも `source='user'` ＝利用者が作った企業で、
 *    `POST /api/biz/companies` が `is_published = false` で作るため）。
 *    **利用者が自分で企業を作った経路は、承認されてもここで止まっていた。**
 *
 * ⚠️★**画面と API の両方がここを呼ぶこと。** 片方だけ直すと、画面では探せるのに
 *    送信だけ 403、という形になる（このファイルの冒頭にある「3度目」と同じ形）。
 */
export function isCompanyReviewed(ctx: { isApproved: boolean }): boolean {
  return ctx.isApproved;
}

/** 審査が済んでいないときの文言。⚠️ 経路ごとに書き分けないこと。 */
export const COMPANY_REVIEW_BLOCKED_MESSAGE =
  "運営審査が完了するまでお待ちください";
