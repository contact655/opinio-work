import type { Benefit } from "@/lib/companies/benefits";
// BizCompany — 企業側プロダクト用の型定義とモックデータ

export type PhotoCategory = "workspace" | "meeting" | "welfare" | "event";

export type OfficePhoto = {
  id: string;
  url: string;       // 実際の画像URL (mock では空文字)
  caption: string;
  category: PhotoCategory;
  gradient: string;  // mock 用の背景グラデーション
};

export type BizCompany = {
  // ── 基本情報 ──────────────────────────────────────────────
  name: string;
  mission: string;
  tagline: string;          // 公開ページ ヒーロー直下に表示
  industry: string;
  industryId: string;       // ow_industries.id（新マスタ）
  saasCategoryId: string;   // ow_saas_categories.id（IT企業のみ）
  genres: string[];         // slug 配列。ow_company_genres と同期。空配列を許容
  phase: string;
  url: string;
  careersUrl: string;
  logoGradient: string;
  logoLetter: string;
  logoUrl: string;

  // ── About（企業説明） ──────────────────────────────────────
  descriptionMarkdown: string;
  whyJoin: string;          // 入社理由・魅力（公開ページで参照）
  /* ⚠️★企業の特徴（company_features）は 2026-10-12 に入力欄ごと外した（求職者に表示されないため）。
        列とデータ（77社）と開示充実順の計算はそのまま。**フォームに戻さないこと。** */
  /** ★事業領域（2026-10-12 から下書きに入れる。それまでは選ぶと即時保存だった）。
   *  ⚠️ 下書きのキーは `business_domains`（`companyRequirements.ts` の DRAFT_BUSINESS_DOMAINS_KEY） */
  businessDomainIds: string[];
  primaryBusinessDomainId: string | null;
  fitPositives: string[];   // 「こんな人に向いている」ポイント
  fitNegatives: string[];   // 「注意点・向いていないかも」ポイント
  showFitNegatives: boolean;   // 「慎重に検討を」欄を公開するか

  // ── 数値データ ───────────────────────────────────────────
  /** ★従業員数の帯（2026-10-10。`EMPLOYEE_BANDS` の value）。空文字 = 未選択。
   *  ⚠️ 自由記述の従業員数は編集画面から外した（原文は DB に残る） */
  employeeCountBand: string;
  /** ★いつ時点か（"YYYY-MM"。input type="month" の値）。空文字 = 未入力 */
  employeeCountAsOf: string;
  /** 設立年（"2017"）。⚠️ 保存は `founded_year`（整数）なので年だけ */
  foundedAt: string;
  /* ⚠️★平均年齢・男女比・平均年収・累計調達額は 2026-10-12 に入力欄ごと外した（求職者に表示されないため）。
        列とデータは残す。**フォームに戻さないこと。** 戻すなら先に求職者側の表示を作る */
  evaluationSystem: string;
  /* ⚠️ 2026-08-31 に `string[]` から変えた。名前＋任意の詳細を持つ。
        型は `lib/companies/benefits.ts` に集約（ここで書き直さない）。 */
  benefitsTags: Benefit[];

  // ── 働き方 ───────────────────────────────────────────────
  location: string;
  nearestStation: string;
  remoteWorkStatus: string;
  workScheduleType: string;
  avgOvertimeHours: string;
  paidLeaveRate: string;
  workstyleNote: string;

  // ── オフィス写真（S4b で本格対応）────────────────────────
  photos: OfficePhoto[];

  // ── 公開設定 ────────────────────────────────────────────
  isPublished: boolean;
  acceptingCasualMeetings: boolean;
  /* ⚠️★通知先（notification_emails）は 2026-10-12 に「メンバーと権限」へ移した（下書きを通さず即時保存）。
        **このフォーム（＝下書き）に戻さないこと。** 戻すと「公開する」まで通知先が変わらない */

  // ── 面談スケジュール ──────────────────────────────────
  availabilityDays: string[];    // 例: ["月","水","金"]
  availabilityTimes: string[];   // 例: ["朝（9〜12時）","夜（18〜21時）"]
  availabilityNotes: string;     // 補足コメント（任意）

  // ── リアル開示 ─────────────────────────────────────────
  realityDisclosure: {
    notFor: string;              // こんな人には向かない（フリーテキスト）
    turnoverReasons: string[];   // 退職理由カテゴリ（複数選択）
    onboardingGaps: string;      // 入社後ギャップ（フリーテキスト）
  };

  // ── モック用メタ ────────────────────────────────────────
  lastPublishedAt: string;    // "2026年4月12日 14:32"
  lastPublishedAgo: string;   // "14日前"
  hasDraftChanges: boolean;
  /* ⚠️ numbersUpdatedAt（「数値を最新として公開する」の日付）は 2026-10-12 に外した。表示先が無い */
};


/* ⚠️ タブ（COMPANY_SECTIONS）は 2026-10-12 にやめた（柴さんの指示）。/biz/company は1ページ。
      並びは CompanyEditClient の本文の順（基本情報 → 会社紹介 → 働き方 → 写真）。 */

/* ⚠️ 業種の選択肢をここに持たない。**`ow_industries` のマスタが唯一の出どころ。**
      2026-08-14 までここに独自の8値があり、`/biz/company` の編集フォームが
      求職者側のフィルタに存在しない値を保存できてしまっていた。その後
      `industryGroups.ts` からの再輸出にしたが、2026-08-25 に業種を
      `ow_industries`（フラット20件）へ移したので**再輸出ごと落とした**
      （読む側が1つも無くなったため）。選択肢は `lib/companies/industries.ts`。 */

/* ⚠️★**PHASE_OPTIONS をここに戻さないこと**（2026-09-06 に削除）。
      業種で同じことを 2026-08-14 にやったのと**まったく同じ形**だった ——
      `/biz/company` の編集フォームだけが独自の語彙を持ち、
      求職者側のフィルタにも DB の CHECK にも無い値を保存しようとしていた。

      ここにあった8値（シード / シリーズA / シリーズB-C / レイターステージ /
      上場(東証グロース) / 上場(東証プライム) / 上場(東証スタンダード) / その他）は
      **1つも `ow_companies_phase_check` を通らない。**
      `ow_companies` は UPDATE が列単位 GRANT なので、企業が事業ステージを選ぶと
      **企業情報の保存が丸ごと失敗していた。**

      選択肢の唯一の出どころは [lib/constants/phase.ts](../constants/phase.ts)。 */

/* ⚠️★**`REMOTE_OPTIONS` をここに戻さないこと**（2026-09-18 に削除）。
      `PHASE_OPTIONS` を 2026-09-06 に外したのと**まったく同じ形**だった ——
      4件とも**日本語を value にしていた**ため、DB の
      `ow_companies_remote_work_status_check`（英字4値）に1つも通らず、
      **企業が勤務形態を選ぶと企業情報の保存が丸ごと失敗していた**
      （`ow_companies` は UPDATE が列単位 GRANT）。

      選択肢の唯一の出どころは
      [lib/constants/workStyle.ts](../constants/workStyle.ts) の
      `COMPANY_REMOTE_WORK_STATUSES`。 */

/* ⚠️★**`work_time_system` は DB に CHECK が無く、語彙が保証されていない**（2026-09-18 に確認）。
      ここは日本語をそのまま value として送るが、自由記述列なので保存は落ちない
      （勤務形態 `remote_work_status` は CHECK があったため、同じ形で保存が丸ごと失敗していた）。
   ⚠️★**絞り込み・集計に使うなら、先に CHECK と定数を用意すること。**
      いまのまま絞り込むと、綴りの違う値が静かに結果から漏れる
      （CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」）。 */
export const WORK_SCHEDULE_OPTIONS = [
  "固定時間制",
  "フレックスタイム制",
  "裁量労働制",
  "その他",
];

/**
 * ★入力欄に渡す選択肢（2026-10-08）。**先頭に「未選択」（value ""）を置く。**
 *
 * ⚠️★それまで空の選択肢が無く、値が `""`（未入力）のときブラウザが**先頭の
 *    「固定時間制」を選択済みのように表示していた**（Third Box で実際に見えた）。
 *    DB の値ではない —— 実測（2026-10-08）: 「固定時間制」を持つ企業は **0社**
 *    （NULL 127 ／ フレックスタイム制 1）。求職者側に出ている企業も0社。
 * ⚠️ 既存データは書き換えていない（書き換える必要が無い）。
 * ⚠️ リモートワーク状況（`COMPANY_REMOTE_WORK_SELECT_OPTIONS`）と同じ形・同じ文言。
 */
export const WORK_SCHEDULE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "未選択" },
  ...WORK_SCHEDULE_OPTIONS.map((v) => ({ value: v, label: v })),
];
