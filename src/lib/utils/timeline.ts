/**
 * MergedTimeline props 整形ヘルパー
 *
 * ow_experiences と ow_user_educations の DB 行を
 * MergedTimeline の props 型（snake_case）に変換する。
 *
 * - buildTimelineCareerEntriesFromRaw: RawExperienceRow[] + 解決済み Map → MergedTimeline CareerEntry
 * - toTimelineEducationEntries: ow_user_educations 行 → MergedTimeline EducationEntry
 *
 * 設計前提:
 * - enrolled_at が NULL の学歴エントリは除外（MergedTimeline.EducationEntry は必須）
 */

import type {
  CareerEntry,
  EducationEntry,
} from "@/components/profile/MergedTimeline";

// ─── Logo fallback helpers ────────────────────────────────────────────────────

/**
 * 会社名の文字列から決定論的なグラデーションインデックスを生成する。
 * 同じ会社名は常に同じ色になる（ページリロードでも一致）。
 */
function hashGradientIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  }
  return h % COMPANY_GRADIENTS.length;
}

/** テスト会社 DB と同じ 6 色ローテーション */
const COMPANY_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)", // royal
  "linear-gradient(135deg, #064E3B, var(--success))", // green
  "linear-gradient(135deg, #92400E, #D97706)", // amber
  "linear-gradient(135deg, #4C1D95, #7C3AED)", // purple
  "linear-gradient(135deg, #991B1B, #DC2626)", // red
  "linear-gradient(135deg, #164E63, #0891B2)", // teal
];

/** 非公開企業用ニュートラルグラデーション */
const ANON_GRADIENT = "linear-gradient(135deg, #475569, #6b7280)";

// ─── buildTimelineCareerEntriesFromRaw ───────────────────────────────────────

/**
 * ow_companies の企業情報（名前 + ロゴ + マスク用メタ情報）を格納する Map の value 型。
 * buildTimelineCareerEntriesFromRaw の第3引数 Map<company_id, CompanyLogoInfo> として使用。
 *
 * ロゴフィールドは optional ではなく null 許容: DB から取得した値をそのまま格納する。
 * industry / phase / employee_count は visibility_company_profile='masked' 時の代替表示生成に使用。
 */
export type CompanyLogoInfo = {
  name: string;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  industry?: string | null;
  phase?: string | null;
  employee_count?: number | null;
  /** false のとき企業ページへのリンクを生成しない（会社名はテキストで表示） */
  isPublished?: boolean;
};

// ─── Masked company label ─────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  seed: "シード", series_a: "シリーズA", "series-a": "シリーズA",
  series_b: "シリーズB", "series-b": "シリーズB",
  series_c: "シリーズC", "series-c": "シリーズC",
  ipo: "IPO準備中", "IPO準備中": "IPO準備中",
  listed: "上場", 上場: "上場",
  大企業: "大企業", 外資系: "外資系",
};

/**
 * visibility_company_profile='masked' のとき、会社マスタの情報から代替表示テキストを生成する。
 * 例: "SaaS（シリーズB・50名規模）"
 * company_anonymized が入力済みの場合はそちらを優先する。
 */
function generateMaskedCompanyLabel(
  companyInfo: CompanyLogoInfo | undefined,
  companyAnonymized: string | null,
): string {
  if (companyAnonymized) return companyAnonymized;
  if (!companyInfo) return "非公開企業";
  const { industry, phase, employee_count } = companyInfo;
  const phaseLabel = phase ? (PHASE_LABEL[phase] ?? null) : null;
  const sizeLabel = employee_count ? `${employee_count}名規模` : null;
  const suffix = [phaseLabel, sizeLabel].filter(Boolean).join("・");
  if (!industry && !suffix) return "非公開企業";
  if (!suffix) return industry!;
  if (!industry) return suffix;
  return `${industry}（${suffix}）`;
}

/** ow_experiences の SELECT 結果の行型 */
export type RawExperienceRow = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  /** ow_roles の UUID */
  role_category_id: string;
  role_title: string | null;
  /** 部署名（例: "第6営業部"）。任意 — SELECT に含めない画面がある */
  department?: string | null;
  /** 役職ランクの**生値**（"manager" 等）。表示時は rankLabel() を通すこと */
  rank?: string | null;
  /** DATE "YYYY-MM-DD" */
  started_at: string;
  /** DATE "YYYY-MM-DD" | null（is_current の場合 null）*/
  ended_at: string | null;
  is_current: boolean;
  description: string | null;
  /** ⚠️ 任意。2026-08-06 に authenticated から SELECT 権限を剥がしたので、
   *  session クライアントで引く画面（/mypage）は SELECT に含めていない。 */
  join_reason?: string | null;
  employment_type: string | null;
  /** プロフィールページでの企業名表示制御 */
  visibility_company_profile?: "real" | "masked" | "hidden" | null;
};

/** ow_roles の id → 名前 + 親カテゴリ名 の Map value 型 */
export type RoleInfo = {
  name: string;
  parent_name: string | null;
};

/**
 * ow_experiences の SELECT 結果 + 解決済み Map から MergedTimeline の CareerEntry を生成する。
 *
 * /mypage・/u/[id] 共通。ow_roles.name が日本語表示ラベルそのもの（"プロダクトマネージャー" 等）
 * なので、slug 変換（DB_NAME_TO_SLUG）を経由せず直接 role_label に使う。
 *
 * @param expRows         - ow_experiences SELECT 結果（is_current DESC, started_at DESC ソート済み）
 * @param roleInfoById    - Map<role_category_id, RoleInfo>（name + parent_name）
 * @param companyInfoById - Map<company_id, CompanyLogoInfo>（master 企業のみ。名前 + ロゴ + 業種/フェーズ）
 * @param isOwner         - true のときは visibility_company_profile を無視（本人は常に実名表示）
 */
export function buildTimelineCareerEntriesFromRaw(
  expRows: RawExperienceRow[],
  roleInfoById: Map<string, RoleInfo>,
  companyInfoById: Map<string, CompanyLogoInfo>,
  isOwner = false,
): CareerEntry[] {
  const results: (CareerEntry | null)[] = expRows.map((r) => {
    // プロフィールページ表示制御（本人は常にスキップ）
    const profileVis = r.visibility_company_profile ?? "real";
    if (!isOwner && profileVis === "hidden") return null;
    // ロゴ情報: master 企業（company_id あり）のみ取得。custom / anon は null
    const companyInfo = r.company_id ? companyInfoById.get(r.company_id) : undefined;

    // 会社名解決: master（company_id）> custom（company_text）> anon（company_anonymized）
    let company_name: string;
    // リンクは is_published=true の企業のみ（false は会社名をテキスト表示）
    const resolvedCompanyId = (r.company_id && companyInfo && companyInfo.isPublished !== false) ? r.company_id : null;
    if (r.company_id && companyInfo) {
      company_name = companyInfo.name;
    } else if (r.company_text) {
      // 自由入力テキスト（company_id なし）
      company_name = r.company_text;
    } else {
      // 非公開（company_id が解決しなかった場合も含む）
      company_name = r.company_anonymized ?? "非公開";
    }

    // ow_roles.name は日本語表示ラベルそのものなので変換不要
    const roleInfo = roleInfoById.get(r.role_category_id);
    const role_label = roleInfo?.name ?? r.role_category_id;

    // ロゴ文字 + グラデーション解決:
    //   1. master 企業 → DB の logo_letter / logo_gradient を優先
    //   2. 自由入力企業 → company_text の頭文字 + 名前ハッシュでグラデーション決定
    //   3. 非公開企業 → "非" + ニュートラルグレー
    let logo_letter: string | null;
    let logo_gradient: string | null;

    if (companyInfo?.logoLetter && companyInfo?.logoGradient) {
      // master 企業かつロゴ登録済み
      logo_letter   = companyInfo.logoLetter;
      logo_gradient = companyInfo.logoGradient;
    } else if (r.company_id && companyInfo) {
      // master 企業だがロゴ未登録 → 会社名頭文字 + 決定論的グラデーション
      logo_letter   = companyInfo.name.charAt(0) || null;
      logo_gradient = companyInfo.name ? COMPANY_GRADIENTS[hashGradientIndex(companyInfo.name)] : null;
    } else if (r.company_text) {
      // 自由入力企業 → 会社名頭文字 + 決定論的グラデーション
      logo_letter   = r.company_text.replace(/^(株式会社|有限会社|合同会社)/, "").charAt(0) || r.company_text.charAt(0) || null;
      logo_gradient = COMPANY_GRADIENTS[hashGradientIndex(r.company_text)];
    } else {
      // 非公開企業
      logo_letter   = "非";
      logo_gradient = ANON_GRADIENT;
    }

    // masked 時: 会社名・ID・ロゴを代替表示に差し替え（実データをクライアントに渡さない）
    let effectiveCompanyName = company_name;
    let effectiveCompanyId: string | null = resolvedCompanyId;
    let effectiveLogoUrl: string | null = companyInfo?.logoUrl ?? null;
    let effectiveLogoLetter = logo_letter;
    let effectiveLogoGradient = logo_gradient;

    if (!isOwner && profileVis === "masked") {
      effectiveCompanyName = generateMaskedCompanyLabel(companyInfo, r.company_anonymized ?? null);
      effectiveCompanyId   = null;
      effectiveLogoUrl     = null;
      effectiveLogoLetter  = "非";
      effectiveLogoGradient = ANON_GRADIENT;
    }

    return {
      id:              r.id,
      company_id:      effectiveCompanyId,
      company_name:    effectiveCompanyName,
      logo_url:        effectiveLogoUrl,
      logo_letter:     effectiveLogoLetter,
      logo_gradient:   effectiveLogoGradient,
      role_label,
      role_parent_name: roleInfo?.parent_name ?? null,
      role_title:      r.role_title,
      /* ⚠️ SELECT に列が無い画面（/mypage）では undefined になる。
            `?? null` に倒しても「未入力」と区別が付かないので、
            **undefined のまま渡して表示側で落とす**。 */
      department:      r.department,
      rank:            r.rank,
      started_at:      r.started_at,
      ended_at:        r.ended_at,
      is_current:      r.is_current,
      description:     r.description,
      join_reason:     r.join_reason ?? null,
      employment_type: r.employment_type,
    };
  });
  return results.filter((e): e is CareerEntry => e !== null);
}

// ─── toTimelineEducationEntries ───────────────────────────────────────────────

/** ow_user_educations SELECT 結果の行型（nullable を許容）*/
export type RawEducation = {
  id: string;
  school: string;
  school_id?: string | null;   // Phase 3: FK to ow_schools (nullable)
  school_master?: {            // Phase 3: LEFT JOIN result
    id: string;
    name: string;
    logo_letter: string | null;
    logo_gradient: string | null;
    logo_url: string | null;
  } | null;
  faculty: string | null;
  degree: string | null;
  /** DATE "YYYY-MM-DD" | null（DB 制約なし） */
  enrolled_at: string | null;
  /** DATE "YYYY-MM-DD" | null（is_current の場合 null）*/
  graduated_at: string | null;
  is_current: boolean;
};

/**
 * ow_user_educations の SELECT 結果を MergedTimeline の EducationEntry に変換する。
 *
 * enrolled_at が NULL のエントリは除外する（MergedTimeline.EducationEntry は必須フィールド）。
 */
export function toTimelineEducationEntries(
  edus: RawEducation[]
): EducationEntry[] {
  return edus
    .filter((e) => !!e.enrolled_at)
    .map((e) => ({
      id:           e.id,
      school:       e.school,
      school_id:    e.school_id ?? null,
      school_master: e.school_master ?? null,
      faculty:      e.faculty,
      degree:       e.degree,
      enrolled_at:  e.enrolled_at!,  // filtered above; guaranteed non-null
      graduated_at: e.graduated_at,
      is_current:   e.is_current,
    }));
}

