/**
 * ★企業ホーム（/biz/dashboard）の表示に使う型（2026-10-12 / 柴さんの指示で作り直した）。
 * ⚠️ DB や server-only のものを import しないこと（/dev/preview の固定データからも使う）。
 */

/** 対応が必要なもの1行。ボタンは1つ（返信する／確認する） */
export type HomeActionKind = "message" | "reply" | "interest" | "meetingRequest" | "application" | "savedSearch" | "stoppedJobs" | "materials";

export type HomeActionItem = {
  kind: HomeActionKind;
  /** 並び順（新しい順）。件数だけの行は今の時刻 */
  at: string;
  title: string;
  sub?: string;
  action: "返信する" | "確認する";
  href: string;
};

export type HomeActions = {
  items: HomeActionItem[];
  /** ★取得に失敗した種類の名前（画面に「一部を確認できませんでした」と出す。0件を装わない） */
  failed: string[];
};

/** はじめにやること1項目 */
export type HomeChecklistKey = "listing" | "jobCreate" | "jobPublish" | "roles" | "employees" | "casualMeeting";

export type HomeChecklistItem = {
  key: HomeChecklistKey;
  label: string;
  /** 補足（「公開まであと2つ」など）。済んだ項目には出さない */
  hint?: string | null;
  done: boolean;
  href: string;
};

/** 右の細い列 */
export type HomeSide = {
  /** 今月のメッセージ。使えないプランでは undefined（枠ごと出さない）／取れなければ null */
  quota?: { sentText: string; sentSub: string; sentPct: number; openText: string; openSub: string; openPct: number } | null;
  /** 求人の数。取れなければ null */
  jobs: { published: number; draft: number; stopped: number } | null;
  /** 企業ページの状態の1行（「公開中」「非公開・公開まであと2つ」など） */
  companyStatus: string;
};
