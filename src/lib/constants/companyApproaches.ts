/**
 * ★企業からの「声かけ」（2026-10-09）。**文言と上限はここが唯一の定義。**
 *
 * 企業の担当者が、候補者検索で見つけた人に理由を添えて「話を聞いてみたい」と連絡する機能。
 * OPINIO が根拠をそろえて出す「提案」とは別の機能（両方を残す）。
 *
 * ⚠️★画面の言葉に「スカウト」を使わない（2026-10-08 に廃止した一斉送信型とは別物）。
 * ⚠️★受け取るかどうかは `ow_profiles.accept_company_approaches`（3値）で、転職意欲とは別の設定。
 *    null（まだ選んでいない）は**受け取らない扱い**。既存の利用者は全員 null から始まる。
 * ⚠️ 上限は件数（濃度）の制約なので DB の CHECK は張らない。UI と API の2層で守る
 *    （CLAUDE.md「濃度は自動的に3層の対象にはならない」）。**route に数字を書き写さない。**
 */

/** 設定の名前。⚠️ 4つの入口（オンボーディング・/mypage のカード・確認カード・/mypage/settings）で同じ語にする */
export const APPROACH_SETTING_LABEL = "企業からのメッセージリクエスト";

/** 一度だけの確認カードとオンボーディングの問い */
export const APPROACH_CONSENT_QUESTION = "企業からのメッセージリクエストを受け取りますか？";

/**
 * 何が起きるかの説明。⚠️★**同意の範囲そのもの。** 4つの入口で言い換えないこと。
 * ⚠️★「在籍した会社とそのグループ会社」は `can_send_scout()` の条件（20261009040000）に合わせた文。
 *    関数より先に文言だけ変えないこと。
 */
export const APPROACH_CONSENT_DESCRIPTION =
  "受け取ると、候補者検索であなたを見つけた企業から、理由を添えた「メッセージリクエスト」が届くことがあります。" +
  "話してみるかどうかはあなたが決められ、見送っても企業には伝わりません。" +
  "在籍した会社とそのグループ会社からは届きません。";

export const APPROACH_CONSENT_OPTIONS = [
  { value: true, label: "受け取る" },
  { value: false, label: "受け取らない" },
] as const;

/** 状態の表示。⚠️ null を「受け取らない」と書かない（本人はまだ選んでいない） */
export function approachConsentText(v: boolean | null | undefined): string {
  if (v === true) return "受け取る";
  if (v === false) return "受け取らない";
  return "未設定";
}

/* ── 送る側の上限（段2）────────────────────────────────────────────────── */

/** 理由の長さ。⚠️ 短すぎると「誰にでも送れる一言」になるので下限を置く */
export const APPROACH_REASON_MIN = 30;
export const APPROACH_REASON_MAX = 200;
/** 本文の長さ（任意）。⚠️ DM のお願い（`MAX_MESSAGE_REQUEST_LENGTH`）と同じ値 */
export const APPROACH_BODY_MAX = 2000;

/** 1社あたり、1か月（日本時間の月初区切り）に送れる数。⚠️ 断られたものも数える */
export const APPROACH_MONTHLY_LIMIT = 10;
/**
 * 1社あたり、承認待ちのまま並べられる数。
 * ⚠️★断られたものも「承認待ち」として数える。企業には断ったことを伝えない決まりなので、
 *    断られた分だけ枠が空くと、枠の増減から断られたことが分かってしまう。
 */
export const APPROACH_OPEN_LIMIT = 10;
/** 同じ企業から同じ人へ、送ってから再送できない日数（承認待ちと断られたを区別しない） */
export const APPROACH_RESEND_DAYS = 180;
/** 同じ理由（空白を詰めて完全一致）を使い回せない日数 */
export const APPROACH_REASON_REUSE_DAYS = 30;
/**
 * 承認待ちのまま、求職者の一覧から消すまでの日数。
 * ⚠️ 企業側は「まだ承認されていません」のまま（断ったのか期限で消えたのかを区別させない）。
 */
export const APPROACH_EXPIRE_DAYS = 30;

/** 使い回し判定のための正規化。⚠️ 空白（全角を含む）を詰めるだけ。似た文は見ない */
export function normalizeApproachReason(s: string): string {
  return s.replace(/[\s　]+/g, "");
}

/**
 * ★企業に見せる声かけの状態（2026-10-10）。/biz/approaches・候補者検索のカード・/u/[id] の「声かけ済み」が**同じ関数**を見る。
 *   pending  … 送ってから30日以内で、承認されていない（⚠️ 見送られたものを含む。企業には見送りを伝えない）
 *   expired  … 30日を過ぎて承認されていない（見送り・返事なしを区別しない）
 *   accepted … 承認済み（やり取り中）
 * ⚠️ declined_at を引数に取らないこと（見送ったかどうかで表示を変えない）。
 */
export type CompanyApproachStatus = "pending" | "expired" | "accepted";
export const COMPANY_APPROACH_STATUS_LABELS: Record<CompanyApproachStatus, string> = {
  pending: "返事待ち",
  expired: `${APPROACH_EXPIRE_DAYS}日を過ぎました`,
  accepted: "やり取り中",
};
export function companyApproachStatus(p: { createdAt: string; acceptedAt: string | null }, now = new Date()): CompanyApproachStatus {
  if (p.acceptedAt) return "accepted";
  return now.getTime() - new Date(p.createdAt).getTime() > APPROACH_EXPIRE_DAYS * 24 * 60 * 60 * 1000 ? "expired" : "pending";
}

/**
 * ★枠の言い方（2026-10-11 / 柴さんの指示。企業側の表示だけ）。/biz/approaches・書く画面・ホームが同じ関数を見る。
 *   「今月送った数 N/10」→「今月の残り N通」、「承認待ち N/10」→「返事待ち N件」。
 * ⚠️ DB の値・API の数え方は変えていない（`getApproachQuota` の monthlyUsed / openCount のまま）。
 */
export function approachMonthlyResetLabel(now: Date): string {
  const m = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" }).format(now).replace(/\D/g, ""));
  return `${(m % 12) + 1}月1日`;
}
export function approachQuotaTexts(q: { monthlyUsed: number; monthlyLimit: number; openCount: number; openLimit: number }, now: Date) {
  return {
    remaining: Math.max(0, q.monthlyLimit - q.monthlyUsed),
    remainingSub: `毎月${q.monthlyLimit}通・${approachMonthlyResetLabel(now)}に戻ります`,
    openSub: `同時に${q.openLimit}件まで・${APPROACH_EXPIRE_DAYS}日で枠に戻ります`,
  };
}

/**
 * ★受け入れ率を出し始める件数（2026-10-11）。結果の出た声かけ（受け入れられた＋30日を過ぎた）がこれ未満なら「—」。
 * ⚠️ 分析タブの「参考値」の境（`REFERENCE_ONLY_BELOW`）とは別。こちらは数字を出さない。
 */
export const APPROACH_RATE_MIN_RESOLVED = 10;

/** ★/biz/approaches の見出しの説明（2026-10-11 / 柴さんの文言）。⚠️ ヘルプのページ（/biz/help/approaches）も同じ文を使う */
export const APPROACH_HEADLINE = "気になる候補者に、理由を添えて『話を聞かせてもらえませんか』と送れます。相手が受け入れると、メッセージでやり取りできます。";
