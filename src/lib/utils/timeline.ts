/**
 * MergedTimeline props 整形ヘルパー
 *
 * ow_experiences と ow_user_educations の DB 行を
 * MergedTimeline の props 型（snake_case）に変換する。
 *
 * - buildTimelineCareerEntriesFromRaw: RawExperienceRow[] + 解決済み Map → MergedTimeline CareerEntry
 * - toTimelineEducationEntries: ow_user_educations 行 → MergedTimeline EducationEntry
 * - buildFutureData: ow_users row → FutureData | null
 *
 * 設計前提:
 * - avatarColor フォールバック: "linear-gradient(135deg, var(--royal), #3B5FD9)"
 * - initial: name.charAt(0)（UserProfileCard / MypageClient と同一ロジック）
 * - enrolled_at が NULL の学歴エントリは除外（MergedTimeline.EducationEntry は必須）
 */

import type {
  CareerEntry,
  EducationEntry,
  FutureData,
} from "@/components/profile/MergedTimeline";

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_AVATAR_COLOR = "linear-gradient(135deg, var(--royal), #3B5FD9)";

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
 * ow_companies の企業情報（名前 + ロゴ 3 フィールド）を格納する Map の value 型。
 * buildTimelineCareerEntriesFromRaw の第3引数 Map<company_id, CompanyLogoInfo> として使用。
 *
 * ロゴフィールドは optional ではなく null 許容: DB から取得した値をそのまま格納する。
 */
export type CompanyLogoInfo = {
  name: string;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
};

/** ow_experiences の SELECT 結果の行型 */
export type RawExperienceRow = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  /** ow_roles の UUID */
  role_category_id: string;
  role_title: string | null;
  /** DATE "YYYY-MM-DD" */
  started_at: string;
  /** DATE "YYYY-MM-DD" | null（is_current の場合 null）*/
  ended_at: string | null;
  is_current: boolean;
  description: string | null;
  join_reason: string | null;
  employment_type: string | null;
};

/**
 * ow_experiences の SELECT 結果 + 解決済み Map から MergedTimeline の CareerEntry を生成する。
 *
 * /mypage・/u/[id] 共通。ow_roles.name が日本語表示ラベルそのもの（"プロダクトマネージャー" 等）
 * なので、slug 変換（DB_NAME_TO_SLUG）を経由せず直接 role_label に使う。
 *
 * @param expRows        - ow_experiences SELECT 結果（is_current DESC, started_at DESC ソート済み）
 * @param roleNameById   - Map<role_category_id, ow_roles.name>（= 表示ラベル）
 * @param companyInfoById - Map<company_id, CompanyLogoInfo>（master 企業のみ。名前 + ロゴ 3 フィールド）
 */
export function buildTimelineCareerEntriesFromRaw(
  expRows: RawExperienceRow[],
  roleNameById: Map<string, string>,
  companyInfoById: Map<string, CompanyLogoInfo>,
): CareerEntry[] {
  return expRows.map((r) => {
    // ロゴ情報: master 企業（company_id あり）のみ取得。custom / anon は null
    const companyInfo = r.company_id ? companyInfoById.get(r.company_id) : undefined;

    // 会社名解決: master（company_id）> custom（company_text）> anon（company_anonymized）
    // company_id があっても companyInfoById に存在しない場合は「未解決」= null として扱う
    let company_name: string;
    const resolvedCompanyId = (r.company_id && companyInfo) ? r.company_id : null;
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
    const role_label = roleNameById.get(r.role_category_id) ?? r.role_category_id;

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

    return {
      id:            r.id,
      company_id:    resolvedCompanyId,
      company_name,
      logo_url:      companyInfo?.logoUrl ?? null,
      logo_letter,
      logo_gradient,
      role_label,
      role_title:    r.role_title,
      started_at:    r.started_at,
      ended_at:      r.ended_at,
      is_current:    r.is_current,
      description:   r.description,
      join_reason:   r.join_reason,
      employment_type: r.employment_type,
    };
  });
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

// ─── buildFutureData ──────────────────────────────────────────────────────────

/**
 * ow_users の avatar 情報 + future_aspirations から FutureData を生成する。
 *
 * 返り値:
 * - `FutureData`   — テキストあり、または viewerIsOwner（CTA 表示のため）
 * - `null`         — テキストなし かつ viewerIsOwner=false（セクション非表示）
 *
 * avatarColor フォールバック:
 * - `ow_users.avatar_color` が NULL の場合（全ユーザーの約 1%）に
 *   royal グラデーションを返す。NULL フォールバックは親側（MergedTimeline）には持たせない。
 */
export function buildFutureData(
  user: {
    name: string;
    avatar_color: string | null;
    future_aspirations: string | null;
  },
  viewerIsOwner: boolean
): FutureData | null {
  // オーナー以外かつテキストなし → セクション非表示
  if (!viewerIsOwner && !user.future_aspirations?.trim()) return null;

  return {
    text:        user.future_aspirations,
    avatarColor: user.avatar_color ?? FALLBACK_AVATAR_COLOR,
    initial:     user.name.charAt(0) || "?",
  };
}
