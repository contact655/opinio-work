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
 * ⚠️ 法律で明示が必要な労働条件（職業安定法 第5条の3）を中心にしている。
 * ⚠️★**業務委託は雇用ではない**ので、労働条件の項目（契約期間・変更の範囲・始業終業・休憩・
 *    時間外・固定残業代・休日・試用期間・社会保険・受動喫煙）は求めない。
 * ⚠️ 既に公開している求人は、これで自動的に下ろさない。運営の画面で「要対応」として出すだけ。
 */

import { laborFromRow, type LaborTerms } from "./laborTerms";

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
  labor: LaborTerms;
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
  { key: "contractPeriod", label: "契約期間", step: "conditions", fieldId: "jef-contract-period" },
  { key: "salary", label: "給与（下限・上限）", step: "conditions", fieldId: "jef-salary-min" },
  { key: "fixedOvertime", label: "固定残業代", step: "conditions", fieldId: "jef-fixed-overtime" },
  { key: "location", label: "勤務地", step: "conditions", fieldId: "jef-location" },
  { key: "workplaceChange", label: "就業場所の変更の範囲", step: "conditions", fieldId: "jef-workplace-change" },
  { key: "dutiesChange", label: "業務の変更の範囲", step: "conditions", fieldId: "jef-duties-change" },
  { key: "workHours", label: "始業・終業時刻", step: "conditions", fieldId: "jef-work-hours" },
  { key: "breakTime", label: "休憩時間", step: "conditions", fieldId: "jef-break-time" },
  { key: "overtime", label: "時間外労働の有無", step: "conditions", fieldId: "jef-overtime" },
  { key: "holidays", label: "休日・休暇", step: "conditions", fieldId: "jef-holidays" },
  { key: "probation", label: "試用期間", step: "conditions", fieldId: "jef-probation" },
  { key: "socialInsurance", label: "社会保険", step: "conditions", fieldId: "jef-social-insurance" },
  { key: "smoking", label: "受動喫煙防止の措置", step: "conditions", fieldId: "jef-smoking" },
];

/** 雇用ではないので労働条件を求めない雇用形態 */
const NON_EMPLOYMENT = new Set(["業務委託"]);
/** 業務委託でも求める項目（それ以外の労働条件は求めない） */
const ALWAYS = new Set(["title", "role", "description", "employmentType", "salary", "location"]);

/** ★この雇用形態で公開に必要な項目（「必須」の表示に使う） */
export function requirementsFor(employmentType: string | null | undefined): PublishRequirement[] {
  const contract = NON_EMPLOYMENT.has(employmentType ?? "");
  return PUBLISH_REQUIREMENTS.filter((r) => !contract || ALWAYS.has(r.key));
}

/** ★足りない項目（画面の順）。空なら公開申請できる */
export function missingForPublish(i: PublishInput): PublishRequirement[] {
  const min = num(i.salaryMin), max = num(i.salaryMax);
  const l = i.labor;
  const ok: Record<string, boolean> = {
    title: filled(i.title),
    role: i.roleCount > 0,
    description: filled(i.description),
    employmentType: filled(i.employmentType),
    // 期間の定めありなら、期間と更新の有無まで
    contractPeriod: l.contractPeriod === "indefinite"
      || (l.contractPeriod === "fixed" && filled(l.contractPeriodDetail) && filled(l.contractRenewal)),
    salary: min !== null && max !== null && max >= min,
    // 固定残業代ありなら、時間と金額まで
    fixedOvertime: l.fixedOvertime === "no"
      || (l.fixedOvertime === "yes" && num(l.fixedOvertimeHours) !== null && num(l.fixedOvertimePay) !== null),
    location: filled(i.location),
    workplaceChange: filled(l.workplaceChangeScope),
    dutiesChange: filled(l.dutiesChangeScope),
    workHours: filled(i.workHours),
    breakTime: filled(l.breakTime),
    overtime: filled(l.overtime),
    holidays: filled(i.holidays),
    probation: filled(i.probationPeriod),
    socialInsurance: l.socialInsurance.length > 0,
    // 「その他」なら内容まで
    smoking: filled(l.smokingMeasure) && (l.smokingMeasure !== "other" || filled(l.smokingNote)),
  };
  return requirementsFor(i.employmentType).filter((r) => !ok[r.key]);
}

/** その項目がこの雇用形態で公開に必要か（「必須」の表示に使う） */
export function isPublishRequired(key: string, employmentType: string | null | undefined): boolean {
  return requirementsFor(employmentType).some((r) => r.key === key);
}

/**
 * ★DB の行から判定する（公開申請の API・運営の画面で使う）。
 * ⚠️ 行には JOB_PUBLISH_COLUMNS の列が全部要る。足りないと「未入力」と判定される
 *    （＝申請できない側に倒れる。黙って通す側には倒れない）。
 */
export const JOB_PUBLISH_COLUMNS =
  "id, title, description, employment_type, salary_min, salary_max, salary_negotiable, location, work_hours, holidays, probation_period, contract_period, contract_period_detail, contract_renewal, contract_renewal_limit, workplace_change_scope, workplace_change_note, duties_change_scope, duties_change_note, break_time, overtime, fixed_overtime, fixed_overtime_hours, fixed_overtime_pay, social_insurance, smoking_measure, smoking_note" as const;

export function missingForPublishFromRow(row: Record<string, unknown>, roleCount: number): PublishRequirement[] {
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const negotiable = row.salary_negotiable === true;
  return missingForPublish({
    title: str(row.title),
    roleCount,
    description: str(row.description),
    employmentType: str(row.employment_type),
    salaryMin: negotiable ? null : (row.salary_min as number | null),
    salaryMax: negotiable ? null : (row.salary_max as number | null),
    location: str(row.location),
    workHours: str(row.work_hours),
    holidays: str(row.holidays),
    probationPeriod: str(row.probation_period),
    labor: laborFromRow(row),
  });
}
