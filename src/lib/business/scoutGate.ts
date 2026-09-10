import { canUse, type PlanType } from "@/lib/constants/plans";

/**
 * 「この企業はいまスカウトを送れるか」の判定。**API と画面の両方がここを呼ぶ。**
 *
 * ── なぜ1本にしたか（2026-09-10）──────────────────────────────────────────
 * ⚠️★**プランのゲートが画面（`/biz/candidates:78`）にしか無かった。**
 *    `POST /api/biz/scouts` に判定が無く、**`free` の企業から送信が通る**
 *    （2026-09-10 に dev で実証: 送信元プラン `free` で 200）。
 *    `candidate_id` を知っていれば画面を通らずに送れるので、
 *    **「画面で選べない＝安全」ではなかった。**
 *
 * ⚠️★**同じ形を踏むのは3度目。** 2026-08-25 に掲載規約のゲートが UI だけで
 *    `PATCH /api/biz/company` にサーバー側チェックが無かった件があり、そのときは
 *    公開ゲートを `checkPublishable()` に集約して**4経路すべてから呼ぶ**形にした。
 *    今回も同じやり方に揃えている。**経路ごとに条件を書き写さないこと。**
 *
 * ── 2つの軸を混ぜないこと ────────────────────────────────────────────────
 * ⚠️★スカウトの可否は**軸が2つ**ある。**どちらが欠けても送れない。**
 *      ① `SCOUT_SENDING_ENABLED`  … **機能ごと**止めているか（env・全社共通）
 *      ② `plan_type`              … **その企業に**開いているか（`ow_company_plans`）
 *    ①は `POST /api/biz/scouts` の冒頭で見る（**認証より前**。未認証でも 503 を返せる）。
 *    ここが扱うのは②だけ。**①をここに持ち込まないこと** —— 持ち込むと
 *    「未認証でも 503」という現在の挙動が壊れる（プラン判定には認証が要るため）。
 *
 * ⚠️ 受け取る側の条件（`career_stance` / 在籍企業 / 手動ブロック / 勧奨禁止期間）は
 *    **DB のトリガー `trg_guard_scout` が見る**。ここには足さないこと ——
 *    相手ごとに変わる判定なので、「この企業が送れるか」とは別の話。
 *
 * ⚠️ `planType` が `null`（取得に失敗した／行が無い）ときは `canUse()` が
 *    **「何も開かない」に倒す**。ここで `?? "paid"` のような既定値を当てないこと。
 */
export function canSendScout(planType: PlanType | null): boolean {
  return canUse(planType, "scoutSend");
}

/** 送れないときに画面・API へ出す文言。⚠️ 経路ごとに書き分けないこと。 */
export const SCOUT_PLAN_BLOCKED_MESSAGE =
  "スカウトの送信は有料プランの機能です。";

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
export function isScoutSendingEnabled(): boolean {
  return process.env.SCOUT_SENDING_ENABLED === "true";
}
