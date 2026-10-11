/**
 * ★求人を公開申請するために必要な項目（2026-10-11 / 柴さんの指示）。**判定はここの1か所。**
 *
 * 使う場所（同じ関数を通す。条件を書き写さないこと）:
 *   ・求人の作成・編集画面の左の目次「公開まであと〇つ」と各項目の「必須」の表示
 *   ・公開申請（段階2でサーバー側でも使う）・運営の審査画面（段階2）
 *
 * ⚠️★**「必須」の表示はこの一覧と一致させる。** ここに無い項目に「必須」を付けない
 *    （付けても申請できてしまうと、表示が嘘になる）。
 * ⚠️ クライアントからもサーバーからも読む。**DB や server-only のものを import しないこと。**
 * ⚠️ 法律で明示が必要な労働条件（職業安定法）を中心にしている。段階2で契約期間・変更の範囲・
 *    社会保険・受動喫煙などを足す。
 */

/** 求人の作成・編集画面のステップ。⚠️ `lib/business/jobEditSections.ts` と揃える */
export type JobEditStep = "job" | "conditions" | "requirements" | "process" | "more" | "review";

export type PublishRequirement = {
  key: string;
  /** 目次と申請の画面に出す名前 */
  label: string;
  step: JobEditStep;
  /** 押したときに移動する入力欄の id */
  fieldId: string;
};

/** 判定に要る値（画面のフォームでも DB の行でも、ここに詰め替えて渡す） */
export type PublishInput = {
  title: string | null | undefined;
  /** 選んだ職種の数（ow_job_roles） */
  roleCount: number;
  description: string | null | undefined;
  employmentType: string | null | undefined;
  salaryMin: number | string | null | undefined;
  salaryMax: number | string | null | undefined;
  location: string | null | undefined;
  workHours: string | null | undefined;
  holidays: string | null | undefined;
  probationPeriod: string | null | undefined;
};

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;
const num = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** ★必要な項目の一覧（並びは画面の順）。`missingForPublish` が返すのはこの中の足りないものだけ */
export const PUBLISH_REQUIREMENTS: readonly PublishRequirement[] = [
  { key: "title", label: "求人タイトル", step: "job", fieldId: "jef-title" },
  { key: "role", label: "職種", step: "job", fieldId: "jef-role" },
  { key: "description", label: "仕事内容", step: "job", fieldId: "jef-description" },
  { key: "employmentType", label: "雇用形態", step: "conditions", fieldId: "jef-employment" },
  { key: "salary", label: "給与（下限・上限）", step: "conditions", fieldId: "jef-salary-min" },
  { key: "location", label: "勤務地", step: "conditions", fieldId: "jef-location" },
  { key: "workHours", label: "勤務時間", step: "conditions", fieldId: "jef-work-hours" },
  { key: "holidays", label: "休日・休暇", step: "conditions", fieldId: "jef-holidays" },
  { key: "probation", label: "試用期間", step: "conditions", fieldId: "jef-probation" },
];

/** ★足りない項目（画面の順）。空なら公開申請できる */
export function missingForPublish(i: PublishInput): PublishRequirement[] {
  const min = num(i.salaryMin), max = num(i.salaryMax);
  const ok: Record<string, boolean> = {
    title: filled(i.title),
    role: i.roleCount > 0,
    description: filled(i.description),
    employmentType: filled(i.employmentType),
    salary: min !== null && max !== null && max >= min,
    location: filled(i.location),
    workHours: filled(i.workHours),
    holidays: filled(i.holidays),
    probation: filled(i.probationPeriod),
  };
  return PUBLISH_REQUIREMENTS.filter((r) => !ok[r.key]);
}

/** その項目が公開に必要か（「必須」の表示に使う） */
export function isPublishRequired(key: string): boolean {
  return PUBLISH_REQUIREMENTS.some((r) => r.key === key);
}
