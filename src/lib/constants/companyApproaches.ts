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

/** ★「転職意欲」の画面の下に出す1行と、設定画面の説明（2026-10-11）。⚠️ 言い換えないこと（入口ごとに同じ文）
 *  ⚠️★2026-10-17 に「転職について」から直した。画面の名前は /mypage の「転職の状況」（カード）と「転職意欲」（行）・
 *     オンボーディング3画面目の「転職意欲」で、「転職について」という名前の場所はどこにも無かった。
 *  APPROACH_DEFAULT_NOTICE は「転職意欲」の行のすぐ下に出す（オンボーディング・/mypage のカードの中）ので場所を書かない。
 *  APPROACH_STOP_EXPLANATION は別の画面（設定）に出すので、マイページのどこかまで書く。 */
export const APPROACH_DEFAULT_NOTICE =
  "企業から、理由つきのメッセージが届くことがあります。「転職意欲」を「今は考えていない」にすると止められます。";
export const APPROACH_STOP_EXPLANATION =
  "マイページの「転職の状況」で「転職意欲」を「今は考えていない」にすると、企業の検索に表示されず、メッセージも届かなくなります。";

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
/** ★候補者を探すの右欄のメッセージ欄で、1回に読み込む件数（2026-10-12 に 3 → 10）。
 *   最初は最新の10通、欄の中で上へスクロールすると前の10通ずつ足す */
export const PANE_THREAD_RECENT = 10;

/**
 * ★返信したときに会話の1通目として入る本文（DB 関数 `reply_to_company_approach` と同じ組み立て。
 *   supabase/migrations/20261011050000_message_request_reply.sql）。⚠️ 片方だけ変えないこと。
 *   画面では見出し「【送った理由】」を出さず、理由と本文だけを吹き出しにする（会社側・求職者側とも）。
 *   1通目かどうかはこの文字列との**完全一致**で見る（理由に空行が入りうるので、本文を分けて推測しない）。
 */
export function approachFirstMessageBody(reason: string, body: string | null): string {
  return `【送った理由】\n${reason}${body ? `\n\n${body}` : ""}`;
}
/** 吹き出しに出す1通目（見出しなし） */
export function approachFirstDisplayText(reason: string, body: string | null): string {
  return [reason, body].filter((x) => !!x && x.trim()).join("\n\n");
}
/** 本文の長さ（任意）。⚠️ DM のお願い（`MAX_MESSAGE_REQUEST_LENGTH`）と同じ値 */
export const APPROACH_BODY_MAX = 2000;

/*
 * ⚠️★企業から送る数の上限は無い。
 *    ・月10通は 2026-10-17 に外した（柴さんの判断）
 *    ・返事待ち10件の枠と、30日の期限は 2026-10-18 に外した（柴さんの判断。「メッセージに期限を設けない」）
 *    同じ人への連投は「返事が来るまで同じ人へは送れない」（期限なし）で止まる。
 *    ⚠️ 期限が無いので、返事の無いメッセージはずっと「返信を待っています」のまま。求職者はいつでも返信できる
 *       （DB 関数 `reply_to_company_approach` の30日の判定も外した。supabase/pending/20261018040000）。
 */
/** 返信があった相手へ、送ってから次に送れるまでの日数（返事待ちのあいだは日数に関係なく送れない） */
export const APPROACH_RESEND_DAYS = 180;
/** 同じ理由（空白を詰めて完全一致）を使い回せない日数 */
export const APPROACH_REASON_REUSE_DAYS = 30;

/** 使い回し判定のための正規化。⚠️ 空白（全角を含む）を詰めるだけ。似た文は見ない */
export function normalizeApproachReason(s: string): string {
  return s.replace(/[\s　]+/g, "");
}

/**
 * ★企業に見せる声かけの状態（2026-10-10）。/biz/approaches・候補者検索のカード・/u/[id] の「声かけ済み」が**同じ関数**を見る。
 *   pending  … 返信が無い（⚠️ 見送られたものを含む。企業には見送りを伝えない。期限は無いのでずっとこのまま）
 *   accepted … 返信あり（やり取り中）
 * ⚠️ declined_at を引数に取らないこと（見送ったかどうかで表示を変えない）。
 * ⚠️ 2026-10-18 まで「expired（30日を過ぎました）」があった。期限をなくしたので外した。
 */
export type CompanyApproachStatus = "pending" | "accepted";
export const COMPANY_APPROACH_STATUS_LABELS: Record<CompanyApproachStatus, string> = {
  pending: "返事待ち",
  accepted: "返信あり",
};
export function companyApproachStatus(p: { createdAt: string; acceptedAt: string | null }): CompanyApproachStatus {
  return p.acceptedAt ? "accepted" : "pending";
}

/**
 * ★同じ方へもう一度送ろうとしたときの案内（2026-10-11 / 柴さんの指示）。**送信の API・候補者検索のカード・
 *   右のプレビュー・/u/[id]・送る画面が同じ関数を見る。** 文言を各画面に書き写さないこと。
 *   状態は `companyApproachStatus`（見送りは区別しない）:
 *     pending  … 「◯月◯日に送ったメッセージリクエストの返事を待っています。…」＋「送った内容を見る」
 *     accepted … 「すでにやり取りが始まっています。」＋「メッセージを開く」（★送る画面ではなく会話へ）
 * ⚠️ 判定（403 で断る・180日）は変えていない。変えたのは言い方と案内先だけ。
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
  const p = jstParts(s.sentAt);
  const md = `${jstPart(p, "month")}月${jstPart(p, "day")}日`;
  return {
    label: `返事待ち（${md}に送信）`,
    message: `${md}に送ったメッセージの返事を待っています。返事が来る前に、続けて送ることはできません。`,
    action: { label: "送った内容を見る", href: `/biz/messages?tab=pending&show=${s.id}` },
  };
}

/**
 * ★送ったあとの状態を言う灰色の1行（2026-10-11 / モックに合わせた）。/biz/messages の一覧・候補者検索のカード・
 *   候補者の詳細が同じ関数を見る。 色付きのバッジにしない（灰色の文字で出す）。
 *     pending  … 「返信を待っています」（⚠️ 期限が無いので残り日数は出さない。2026-10-18）
 *     accepted … 「返信がありました」
 */
export function approachStatusLine(state: CompanyApproachStatus): string {
  return state === "accepted" ? "返信がありました" : "返信を待っています";
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
/** この会社から送っている方（送った日） */
export function approachAlreadySentLine(sentAtIso: string): string {
  /* ⚠️ 「10/11」ではなく「10月11日」（柴さんの指示）。日本時間で区切る */
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(new Date(sentAtIso));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${v("month")}月${v("day")}日に送っています`;
}
/**
 * ★返信率を出し始める件数（2026-10-11）。送った件数がこれ未満なら「—」。
 *   ⚠️ 2026-10-18 に分母を「送った件数」にした（それまでは「返信あり＋30日を過ぎた」。期限をなくしたため）。
 * ⚠️ 分析タブの「参考値」の境（`REFERENCE_ONLY_BELOW`）とは別。こちらは数字を出さない。
 */
export const APPROACH_RATE_MIN_RESOLVED = 10;

/** ★/biz/messages の見出しの説明（2026-10-11 / 柴さんの指示。「メッセージ」にまとめた）。⚠️ ヘルプ（/biz/help/messages）も同じ文を使う。
 *  ⚠️ 「リクエスト」「受け入れ」「確認する」と書かない */
export const APPROACH_HEADLINE = "気になる候補者に、理由を添えてメッセージを送れます。相手が返信すると、そのままメッセージでやり取りが始まります。";
/** ★返事がないときの説明（2026-10-11 / 柴さんの文言）。⚠️「見送られたかどうかは〜」という書き方をしない */
/*  ⚠️ 2026-10-18 に期限の一文（「30日たつと『返信はありませんでした』」）を外した */
export const APPROACH_SILENCE_NOTE = "返事がない場合、その理由は表示されません。返事が来るまで「返信を待っています」と表示されます。";
