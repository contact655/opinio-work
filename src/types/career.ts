// ----------------------------------------------------------------
// キャリア軌跡 Phase 1 — 型定義
// 公開制御の主従:
//   is_published (ow_career_profiles) = 運営者が操作する公開スイッチ
//   ow_users.visibility = ユーザー全体の可視性
//   矛盾する場合はより厳しい方を優先（RLS + resolvePublicStep 両方で保証）
// ----------------------------------------------------------------

/** 企業名の公開レベル */
export type CompanyVisibility = "real" | "masked" | "hidden";

/** ow_career_profiles 行 */
export type CareerProfile = {
  id: string;
  userId: string;
  headline: string | null;
  yearsOfExperience: number | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * ow_experiences 行（Phase 1 で追加した 4 カラム込み）
 * これが「線の要素」。入力層の実データを全フィールド保持する。
 */
export type CareerStep = {
  id: string;
  userId: string;
  /** FK → ow_companies（マスタ企業が紐づく場合） */
  companyId: string | null;
  /** 実名（入力層）: マスタに無い企業、または実名入力 */
  companyText: string | null;
  /** 匿名ラベル（入力層）: visibility_company='masked' 時の表示用 */
  companyAnonymized: string | null;
  roleCategoryId: string;
  roleTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  description: string | null;
  displayOrder: number;
  joinReason: string | null;
  employmentType: string | null;
  /** 年収（万円）: 入力層の実数。visibility_salary=false の場合は公開しない */
  salaryMan: number | null;
  /** 企業名の公開レベル */
  visibilityCompany: CompanyVisibility;
  /** 年収を公開するか（既存行は false） */
  visibilitySalary: boolean;
  /** 転職理由（join_reason）を公開するか */
  visibilityReason: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * resolvePublicStep() が返す「公開用ステップ」。
 * 実データは含まない。クライアントに渡してよい。
 * visibility_company='hidden' のステップは null になる。
 */
export type PublicCareerStep = {
  id: string;
  /** 公開表示する企業名（masked → company_anonymized, hidden → null） */
  companyDisplay: string | null;
  /** 実名公開のときだけ companyId を渡す（企業詳細ページへのリンク用） */
  companyId: string | null;
  roleTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  /** 年収: visibility_salary=false のとき null */
  salaryMan: number | null;
  /** 転職理由: visibility_reason=false のとき null */
  joinReason: string | null;
  employmentType: string | null;
  displayOrder: number;
};
