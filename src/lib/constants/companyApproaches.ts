/**
 * ★企業からの「声かけ」（2026-10-09）。**文言と上限はここが唯一の定義。**
 *
 * 企業の担当者が、候補者検索で見つけた人に理由を添えて「話を聞いてみたい」と連絡する機能。
 * OPINIO が根拠をそろえて出す「提案」とは別の機能（両方を残す）。
 *
 * ⚠️★画面の言葉に「スカウト」を使わない（2026-10-08 に廃止した一斉送信型とは別物）。
 * ⚠️★2026-10-11 から**全員が最初から受け取る**（柴さんの指示）。止める方法は「転職について」の
 *    「今は考えていない」で兼ねる（その人は候補者検索に出ず、メッセージも届かない）。専用のスイッチは作らない。
 *    `ow_profiles.accept_company_approaches` は判定に使わない（列とデータは残してある。扱いは別に決める）。
 * ⚠️ 上限は件数（濃度）の制約なので DB の CHECK は張らない。UI と API の2層で守る
 *    （CLAUDE.md「濃度は自動的に3層の対象にはならない」）。**route に数字を書き写さない。**
 */

/** ★「転職について」の画面の下に出す1行と、設定画面の説明（2026-10-11）。⚠️ 言い換えないこと（入口ごとに同じ文） */
export const APPROACH_DEFAULT_NOTICE =
  "企業から、理由つきのメッセージが届くことがあります。「転職について」でいつでも止められます。";
export const APPROACH_STOP_EXPLANATION =
  "「転職について」で「今は考えていない」にすると、企業の検索に表示されず、メッセージも届かなくなります。";

/** 設定の名前（2026-10-11 以降はスイッチとしては使っていない。会話一覧の見出しなど表示にだけ残る） */
export const APPROACH_SETTING_LABEL = "企業からのメッセージを受け取る";

/** 一度だけの確認カードとオンボーディングの問い */
export const APPROACH_CONSENT_QUESTION = "企業からのメッセージを受け取りますか？";

/**
 * 何が起きるかの説明。⚠️★**同意の範囲そのもの。** 4つの入口で言い換えないこと。
 * ⚠️★「在籍した会社とそのグループ会社」は `can_send_scout()` の条件（20261009040000）に合わせた文。
 *    関数より先に文言だけ変えないこと。
 */
export const APPROACH_CONSENT_DESCRIPTION =
  "受け取ると、候補者検索であなたを見つけた企業から、理由を添えたメッセージが届くことがあります。" +
  "返信すると、そのままやり取りが始まります。見送っても企業には伝わりません。" +
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
  accepted: "返信あり",
};
export function companyApproachStatus(p: { createdAt: string; acceptedAt: string | null }, now = new Date()): CompanyApproachStatus {
  if (p.acceptedAt) return "accepted";
  return now.getTime() - new Date(p.createdAt).getTime() > APPROACH_EXPIRE_DAYS * 24 * 60 * 60 * 1000 ? "expired" : "pending";
}

/**
 * ★同じ方へもう一度送ろうとしたときの案内（2026-10-11 / 柴さんの指示）。**送信の API・候補者検索のカード・
 *   右のプレビュー・/u/[id]・送る画面が同じ関数を見る。** 文言を各画面に書き写さないこと。
 *   状態は `companyApproachStatus`（見送りは区別しない）:
 *     pending  … 「◯月◯日に送ったメッセージリクエストの返事を待っています。…」＋「送った内容を見る」
 *     accepted … 「すでにやり取りが始まっています。」＋「メッセージを開く」（★送る画面ではなく会話へ）
 *     expired  … 「この方へは◯年◯月◯日から、もう一度送れます。」（30日経過と見送りを区別しない）
 * ⚠️ 判定（403 で断る・180日・枠）は変えていない。変えたのは言い方と案内先だけ。
 * ⚠️★ブロックされている相手に送り済みなら、ブロックではなくこの案内を返す（`sendApproach` が先に見る）。
 *    ＝ ブロックされた場合も「返事待ち」と見分けがつかない。
 */
export type ApproachResendSubject = {
  id: string;
  state: CompanyApproachStatus;
  sentAt: string;
  resendAt: string;
  conversationId: string | null;
};
const jstParts = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
const jstPart = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
export function approachResendNotice(s: ApproachResendSubject): {
  /** 候補者の画面・一覧・プレビューに出す短い言い方（2026-10-11 / 柴さんの指示） */
  label: string;
  /** 送信の API と送る画面で返す文 */
  message: string;
  action: { label: string; href: string } | null;
} {
  if (s.state === "accepted") {
    return {
      label: "返信あり",
      message: "すでにやり取りが始まっています。",
      action: { label: "メッセージを開く", href: s.conversationId ? `/biz/messages/${s.conversationId}` : `/biz/messages?tab=pending&show=${s.id}` },
    };
  }
  if (s.state === "pending") {
    const p = jstParts(s.sentAt);
    const md = `${jstPart(p, "month")}月${jstPart(p, "day")}日`;
    return {
      label: `返事待ち（${md}に送信）`,
      message: `${md}に送ったメッセージの返事を待っています。返事が来る前に、続けて送ることはできません。`,
      action: { label: "送った内容を見る", href: `/biz/messages?tab=pending&show=${s.id}` },
    };
  }
  const r = jstParts(s.resendAt);
  const ymd = `${jstPart(r, "year")}年${jstPart(r, "month")}月${jstPart(r, "day")}日`;
  return { label: `${ymd}から送れます`, message: `この方へは${ymd}から、もう一度送れます。`, action: null };
}

/**
 * ★送ったあとの状態を言う灰色の1行（2026-10-11 / モックに合わせた）。/biz/messages の一覧・候補者検索のカード・
 *   候補者の詳細が同じ関数を見る。 色付きのバッジにしない（灰色の文字で出す）。
 *     pending  … 「返信を待っています・あと〇日」
 *     expired  … 「返信はありませんでした・〇年〇月〇日から再び送れます」（見送りと30日経過を区別しない）
 *     accepted … 「返信がありました」
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export function approachDaysLeft(sentAt: string, now = new Date()): number {
  const elapsed = Math.floor((now.getTime() - new Date(sentAt).getTime()) / DAY_MS);
  return Math.max(1, APPROACH_EXPIRE_DAYS - elapsed);
}
export function approachStatusLine(state: CompanyApproachStatus, sentAt: string, now = new Date()): string {
  if (state === "accepted") return "返信がありました";
  if (state === "pending") return `返信を待っています・あと${approachDaysLeft(sentAt, now)}日`;
  const r = jstParts(new Date(new Date(sentAt).getTime() + APPROACH_RESEND_DAYS * DAY_MS).toISOString());
  return `返信はありませんでした・${jstPart(r, "year")}年${jstPart(r, "month")}月${jstPart(r, "day")}日から再び送れます`;
}

/** ★送れない相手への一文（2026-10-11 / 柴さんの指示）。**理由ごとに分けない**（受け取らない設定・ブロック・
 *   受け取る範囲の外・転職に興味なし のどれでも同じ文言・同じ見た目・同じ API の応答）。
 *   ⚠️「受け取っていません」と書かない（本人の設定だと読める） */
export const APPROACH_UNAVAILABLE_MESSAGE = "現在、この方にはメッセージを送れません。";

/* ★送れない理由の1行（候補者検索の右のプレビューと一覧の上。2026-10-11 / 柴さんの指示）。⚠️ 灰色の文字で出す（バッジにしない）。
      ⚠️ ここに無い理由（受け取る範囲の外・受け取らない企業）は区別せず APPROACH_UNAVAILABLE_MESSAGE（相手の設定を企業に伝えない） */
/** 検証用の会社を実アカウントで見ているとき（送り手と候補者の is_test が違う）。⚠️ 実在の会社の画面には出さない */
export const APPROACH_TEST_COMPANY_MESSAGE = "検証用の会社のため、このアカウントからは送れません";
/** 「転職について」が「今は考えていない」の方 */
export const APPROACH_NOT_LOOKING_MESSAGE = "今は転職を考えていない方です";
/** 180日以内にこの会社から送っている方（送った日） */
export function approachAlreadySentLine(sentAtIso: string): string {
  /* ⚠️ 「10/11」ではなく「10月11日」（柴さんの指示）。日本時間で区切る */
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(new Date(sentAtIso));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${v("month")}月${v("day")}日に送っています`;
}
/** ★企業側の上限に当たっているときの1行（今月の送信数 → 返信待ちの順に見る）。当たっていなければ null */
export function approachCompanyLimitLine(q: { monthlyUsed: number; monthlyLimit: number; openCount: number; openLimit: number } | null, now: Date): string | null {
  if (!q) return null;
  if (q.monthlyUsed >= q.monthlyLimit) return `今月の送信数が上限（${q.monthlyLimit}通）に達しました。${approachMonthlyResetLabel(now)}から送れます`;
  if (q.openCount >= q.openLimit) return `返信待ちが${q.openLimit}件あります。返信が来るか、${APPROACH_EXPIRE_DAYS}日たつと送れます`;
  return null;
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
 * ★返信率を出し始める件数（2026-10-11）。結果の出たリクエスト（返信あり＋30日を過ぎた）がこれ未満なら「—」。
 * ⚠️ 分析タブの「参考値」の境（`REFERENCE_ONLY_BELOW`）とは別。こちらは数字を出さない。
 */
export const APPROACH_RATE_MIN_RESOLVED = 10;

/** ★/biz/messages の見出しの説明（2026-10-11 / 柴さんの指示。「メッセージ」にまとめた）。⚠️ ヘルプ（/biz/help/messages）も同じ文を使う。
 *  ⚠️ 「リクエスト」「受け入れ」「確認する」と書かない */
export const APPROACH_HEADLINE = "気になる候補者に、理由を添えてメッセージを送れます。相手が返信すると、そのままメッセージでやり取りが始まります。";
/** ★返事がないときの説明（2026-10-11 / 柴さんの文言）。⚠️「見送られたかどうかは〜」という書き方をしない */
/*  ⚠️ 2026-10-11（バッジをやめた日）に「『30日を過ぎました』になります」から変えた。一覧の灰色の文字（返信はありませんでした）と揃える */
export const APPROACH_SILENCE_NOTE = `返事がない場合、その理由は表示されません。${APPROACH_EXPIRE_DAYS}日たつと「返信はありませんでした」と表示されます。`;
