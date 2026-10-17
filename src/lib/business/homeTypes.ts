/**
 * ★企業ホーム（/biz/dashboard）の表示に使う型（2026-10-12 / 柴さんの指示で作り直した）。
 * ⚠️ DB や server-only のものを import しないこと（/dev/preview の固定データからも使う）。
 */

/** 対応が必要なもの1行。ボタンは1つ（返信する／確認する） */
export type HomeActionKind = "message" | "reply" | "interest" | "unanswered" | "meetingRequest" | "application" | "savedSearch" | "stoppedJobs" | "materials";

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
  /** ★今日・明日の面談（2026-10-12）。選考管理の「決まった面談」と同じ `listCompanyMeetings`。無ければ空配列、取れなければ null */
  meetings: HomeMeeting[] | null;
};

/** 「今日 15:00 山田 太郎さん オンライン・30分」 */
export type HomeMeeting = { id: string; dayLabel: "今日" | "明日"; time: string; name: string; detail: string; href: string };

/** はじめにやること1項目 */
export type HomeChecklistKey = "review" | "listing" | "jobCreate" | "jobPublish" | "roles" | "employees" | "casualMeeting";

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
  quota?: { sentText: string; sentSub?: string; openText: string; openSub: string; openPct: number } | null;
  /** 求人の数。取れなければ null */
  jobs: { published: number; draft: number; stopped: number } | null;
  /** 企業ページの状態の1行（「公開中」「非公開・公開まであと2つ」など） */
  companyStatus: string;
  /** ★役割で出す欄（2026-10-12）。false の欄は出さない（押した先を開けないため）。省略はすべて出す */
  show?: { jobs: boolean; company: boolean };
};
