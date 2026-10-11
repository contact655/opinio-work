/**
 * 提案の返答と段（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 * ── 流れ ──────────────────────────────────────────────────────────────────────
 *   1. 運営が提案を作る。届くのは**求職者だけ**（企業には何も見えない）
 *   2. 求職者が「話を聞いてみたい」（interested）か「今回は見送る」（declined）を選ぶ
 *   3. interested なら、どの企業でもその場で会話を作り、企業にメールで知らせる
 *   ★2026-10-11（同日）に企業側の設定（すぐにメッセージ／確認してから会うかを決める）をなくした（柴さんの指示）。
 *      「会う／今回は見送る」「14日の期限」は無い。
 *      ⚠️ `ow_company_proposal_settings` と `delivery_mode` / `company_respond_by` / `company_response` の列は
 *         **残してあるが使わない**（消すかは後で決める）。新しく答えた提案には delivery_mode = 'auto' を写す。
 *      ⚠️ 以前に企業が「今回は見送る」と答えた提案（company_response = 'declined'）だけは、記録どおり終了のまま
 *
 * ⚠️★**DB の CHECK（`candidate_response_check` / `company_response_check` / `delivery_mode_check`）と
 *    同じ値にすること。** 片方だけ足すと「押せるのに保存できない」になる。
 * ⚠️★**`null` は「まだ答えていない」。「見送った」ではない。**
 * ⚠️★**段は列で持たない。** 返答・写した設定・日時から `proposalPhase()` で導出する（食い違う余地を作らない）。
 *    画面・件数・API はすべてこの関数を通す。条件を書き写さないこと。
 */

/** 求職者の返答 */
export const CANDIDATE_RESPONSES = ["interested", "declined"] as const;
export type CandidateResponse = (typeof CANDIDATE_RESPONSES)[number];

/** 企業の返答。⚠️ 2026-10-11 から企業は答えない（以前の記録を読むためだけに残す） */
export const COMPANY_RESPONSES = ["want_to_meet", "declined"] as const;
export type CompanyResponse = (typeof COMPANY_RESPONSES)[number];

export const CANDIDATE_RESPONSE_LABELS: Record<CandidateResponse, string> = {
  interested: "話を聞いてみたい",
  declined: "今回は見送る",
};

export const COMPANY_RESPONSE_LABELS: Record<CompanyResponse, string> = {
  want_to_meet: "会う",
  declined: "今回は見送る",
};

export function isCandidateResponse(v: string): v is CandidateResponse {
  return (CANDIDATE_RESPONSES as readonly string[]).includes(v);
}
export function isCompanyResponse(v: string): v is CompanyResponse {
  return (COMPANY_RESPONSES as readonly string[]).includes(v);
}

/** ★企業の設定（2026-10-11 に廃止。値は DB の CHECK と同じ。新しく写すのは "auto" だけ） */
export const PROPOSAL_COMPANY_MODES = ["auto", "review"] as const;
export type ProposalCompanyMode = (typeof PROPOSAL_COMPANY_MODES)[number];
/** ★行が無い企業の扱い（柴さんの判断: 既定はすぐにメッセージを始める） */
export const DEFAULT_PROPOSAL_COMPANY_MODE: ProposalCompanyMode = "auto";
export function isProposalCompanyMode(v: string): v is ProposalCompanyMode {
  return (PROPOSAL_COMPANY_MODES as readonly string[]).includes(v);
}

/** ★求職者が答えられる日数（届いてから）。⚠️ DB の既定値（`respond_by = now() + 30 days`）と同じ値 */
export const PROPOSAL_RESPONSE_DAYS = 30;
/** ★「会社へのひとこと」の上限。⚠️ DB の CHECK（`candidate_note_length`）と同じ値 */
export const PROPOSAL_NOTE_MAX = 200;

/**
 * 提案の段。
 *   candidate_pending  … 求職者が未回答（企業には見えない）
 *   candidate_declined … 求職者が見送った（企業には見えない）
 *   candidate_expired  … 求職者が答えずに30日たった（企業には見えない）
 *   company_declined   … 以前の「確認してから」で企業が見送った（2026-10-11 より前の記録だけ）
 *   connecting         … 会話を作るはずだが、まだ作れていない（作成の失敗。運営が再試行で救う）
 *   introduced         … 会話ができた
 *   hidden             … いまはこの企業にこの候補者を見せてはいけない（`can_send_scout()` が false）。会話がまだ無いもの
 */
export type ProposalPhase =
  | "candidate_pending" | "candidate_declined" | "candidate_expired"
  | "company_declined"
  | "connecting" | "introduced" | "hidden";

export type ProposalPhaseInput = {
  candidateResponse: string | null;
  companyResponse: string | null;
  introducedAt: string | null;
  /** 求職者の締め切り（`respond_by`） */
  respondBy: string;
  deliveryMode: string | null;
  /** review の企業の締め切り（`company_respond_by`） */
  companyRespondBy: string | null;
};

const past = (iso: string | null, now: Date) => !!iso && new Date(iso).getTime() <= now.getTime();

/**
 * ★段を出す。**判定はここだけ。** `visible` は `can_send_scout()` の結果（`lib/evidence/proposalEnded.ts` の `visiblePairs`）。
 * ⚠️ 会話ができたもの（introduced）は、見せてよいかにかかわらず introduced のまま（会話は既にある）。
 */
export function proposalPhase(p: ProposalPhaseInput, visible: boolean, now = new Date()): ProposalPhase {
  if (p.introducedAt) return "introduced";
  if (p.candidateResponse === "declined") return "candidate_declined";
  if (p.candidateResponse !== "interested") {
    if (past(p.respondBy, now)) return "candidate_expired";
    return visible ? "candidate_pending" : "hidden";
  }
  if (!visible) return "hidden";
  if (p.companyResponse === "declined") return "company_declined";
  return "connecting";
}

/** ★会話を作ってよい段か（求職者が「話を聞いてみたい」と答えた。以前に企業が見送ったものを除く）。`introduce.ts` と `openReason.ts` が使う
 *  ⚠️ SQL で同じ条件を書いている所が2か所ある（admin/page.tsx の要対応・openReason.ts）。揃えること */
export function proposalShouldConnect(p: Pick<ProposalPhaseInput, "candidateResponse" | "companyResponse">): boolean {
  return p.candidateResponse === "interested" && p.companyResponse !== "declined";
}

/**
 * ★企業に見せてよいか。**求職者が「話を聞いてみたい」と答えたものだけ。**
 * ⚠️★未回答・見送り・30日経過は、企業には一切出さない（名前も件数の内訳も）。
 */
export function isVisibleToCompany(p: Pick<ProposalPhaseInput, "candidateResponse">): boolean {
  return p.candidateResponse === "interested";
}

/** 企業の画面での区分（届いた方／終了）。企業に見せない段は null */
export function companyTabOf(phase: ProposalPhase, candidateResponse: string | null): "arrived" | "ended" | null {
  if (candidateResponse !== "interested") return null;
  /* ★答えたあとで見せられなくなった方（会話がまだ無い）は、終了タブにも出さない・数えない（2026-10-11 / 柴さんの判断）。
        ⚠️ 名前なしの「終了」行でも、「答えた人がいた」ことが企業に分かってしまう */
  if (phase === "hidden") return null;
  if (phase === "introduced" || phase === "connecting") return "arrived";
  return "ended";
}

/** 締め切りまで「あと◯日」（切り上げ。過ぎていれば 0） */
export function daysLeftUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** ★案内の行の文言（企業側・求職者側の会話に同じ行）。⚠️ 本人の発言にしない（`kind = 'proposal_intro'`） */
export function proposalIntroLine(candidateName: string | null | undefined): string {
  const n = (candidateName ?? "").trim();
  /* ★2026-10-11（同日）に「紹介」もやめた（人材紹介と紛らわしいため / 柴さんの指示）。⚠️ 既に保存された行の本文は変わらない */
  return `${n && n !== "ユーザー" ? `${n}さん` : "候補者の方"}が、OPINIO のおすすめで貴社を知り、話を聞いてみたいそうです。`;
}
