/** ★求職者に届いた、企業からの最初のメッセージ（画面用。2026-10-11 に /mypage/approaches から移した） */
export type IncomingApproachView = {
  id: string;
  createdAt: string;
  reason: string;
  body: string | null;
  senderName: string | null;
  /** ★送った担当者の役職（2026-10-11）。無ければ null */
  senderRole: string | null;
  companyName: string;
  companyHref: string | null;
  /** ★運営会社か（2026-10-10） */
  isOwnCompany: boolean;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  /** ★関連する求人（2026-10-10）。href が null なら掲載を終了している */
  job: { title: string; href: string | null; note?: string | null } | null;
};
