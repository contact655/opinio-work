/**
 * MergedTimeline props 整形ヘルパー
 *
 * ow_experiences（career.ts CareerEntry / camelCase）と ow_user_educations の DB 行を
 * MergedTimeline の props 型（snake_case）に変換する。
 *
 * - toTimelineCareerEntries: career.ts CareerEntry → MergedTimeline CareerEntry
 * - toTimelineEducationEntries: ow_user_educations 行 → MergedTimeline EducationEntry
 * - buildFutureData: ow_users row → FutureData | null
 *
 * 設計前提:
 * - roleSlug → 表示ラベルは SLUG_TO_LABEL で解決（career.ts の DB_NAME_TO_SLUG の逆マップ）
 * - avatarColor フォールバック: "linear-gradient(135deg, #002366, #3B5FD9)"
 * - initial: name.charAt(0)（UserProfileCard / MypageClient と同一ロジック）
 * - enrolled_at が NULL の学歴エントリは除外（MergedTimeline.EducationEntry は必須）
 */

import type { CareerEntry as LegacyCareerEntry } from "@/lib/utils/career";
import type {
  CareerEntry,
  EducationEntry,
  FutureData,
} from "@/components/profile/MergedTimeline";

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_AVATAR_COLOR = "linear-gradient(135deg, #002366, #3B5FD9)";

/**
 * ow_roles.name → slug → 表示ラベルの変換マップ
 * career.ts の DB_NAME_TO_SLUG の逆マップ + slug 直接受け入れ対応。
 * CareerHistoryEditor の ROLE_OPTIONS と一致を保つこと。
 */
const SLUG_TO_LABEL: Record<string, string> = {
  product_manager:   "プロダクトマネージャー",
  product_owner:     "プロダクトオーナー",
  pmm:               "PMM",
  pm:                "PdM / PM",
  sales:             "営業",
  field_sales:       "フィールドセールス",
  enterprise_sales:  "エンタープライズ営業",
  inside_sales:      "インサイドセールス",
  sdr_bdr:           "SDR / BDR",
  cs:                "カスタマーサクセス",
  marketing:         "マーケティング",
  engineer:          "エンジニア",
  backend:           "バックエンド",
  frontend:          "フロントエンド",
  fullstack:         "フルスタック",
  sre:               "SRE / インフラ",
  ios_android:       "iOS / Android",
  data_scientist:    "データサイエンティスト",
  designer:          "デザイナー",
  biz_dev:           "事業開発",
  hrbp:              "HRBP",
  corporate:         "コーポレート",
  exec:              "経営・CxO",
  ceo:               "CEO",
  coo:               "COO",
  cpo:               "CPO",
  cto:               "CTO",
  cfo:               "CFO",
  other:             "その他",
};

// ============================================================
// CareerEntry 構築ヘルパー(2 系統あり)
// ============================================================
//
// 1. toTimelineCareerEntries(LegacyCareerEntry[]):
//    /u/[id] で使用。LegacyCareerEntry(camelCase + slug 解決済み)を受け取る。
//    DB_NAME_TO_SLUG の前処理が呼び出し側で必要。
//
// 2. buildTimelineCareerEntriesFromRaw(rawRows, roleMap, companyMap):
//    /mypage で使用(C-2 で追加)。DB の生データ + 解決済み Map を受け取る。
//    DB_NAME_TO_SLUG を経由しないため呼び出し側が薄い。
//
// 将来的には 2 に統一する想定(段階6-3-3 以降で /u/[id] を 2 に移行 → 1 を削除予定)。
// ============================================================

// ─── toTimelineCareerEntries ──────────────────────────────────────────────────

/**
 * career.ts の CareerEntry（camelCase、CareerTimeline 向け）を
 * MergedTimeline の CareerEntry（snake_case）に変換する。
 *
 * roleSlug が SLUG_TO_LABEL に存在しない場合は roleSlug をそのまま role_label とする
 * （不明ロールの graceful fallback）。
 */
export function toTimelineCareerEntries(
  careers: LegacyCareerEntry[]
): CareerEntry[] {
  return careers.map((c) => ({
    id:           c.id,
    company_name: c.companyName,
    role_label:   SLUG_TO_LABEL[c.roleSlug] ?? c.roleSlug,
    role_title:   c.roleTitle,
    started_at:   c.startedAt,
    ended_at:     c.endedAt,
    is_current:   c.isCurrent,
    description:  c.description,
  }));
}

// ─── buildTimelineCareerEntriesFromRaw ───────────────────────────────────────

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
};

/**
 * ow_experiences の SELECT 結果 + 解決済み Map から MergedTimeline の CareerEntry を生成する。
 *
 * /mypage で使用。ow_roles.name が日本語表示ラベルそのもの（"プロダクトマネージャー" 等）
 * なので、slug 変換（DB_NAME_TO_SLUG）を経由せず直接 role_label に使う。
 *
 * @param expRows       - ow_experiences SELECT 結果（is_current DESC, started_at DESC ソート済み）
 * @param roleNameById  - Map<role_category_id, ow_roles.name>（= 表示ラベル）
 * @param companyNameById - Map<company_id, company_name>（master 企業のみ）
 */
export function buildTimelineCareerEntriesFromRaw(
  expRows: RawExperienceRow[],
  roleNameById: Map<string, string>,
  companyNameById: Map<string, string>,
): CareerEntry[] {
  return expRows.map((r) => {
    // 会社名解決: master（company_id）> custom（company_text）> anon（company_anonymized）
    let company_name: string;
    if (r.company_id) {
      company_name = companyNameById.get(r.company_id) ?? "不明な企業";
    } else if (r.company_text) {
      company_name = r.company_text;
    } else {
      company_name = r.company_anonymized ?? "非公開企業";
    }

    // ow_roles.name は日本語表示ラベルそのものなので変換不要
    const role_label = roleNameById.get(r.role_category_id) ?? r.role_category_id;

    return {
      id:           r.id,
      company_name,
      role_label,
      role_title:   r.role_title,
      started_at:   r.started_at,
      ended_at:     r.ended_at,
      is_current:   r.is_current,
      description:  r.description,
    };
  });
}

// ─── toTimelineEducationEntries ───────────────────────────────────────────────

/** ow_user_educations SELECT 結果の行型（nullable を許容）*/
export type RawEducation = {
  id: string;
  school: string;
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
      id:          e.id,
      school:      e.school,
      faculty:     e.faculty,
      degree:      e.degree,
      enrolled_at: e.enrolled_at!,  // filtered above; guaranteed non-null
      graduated_at: e.graduated_at,
      is_current:  e.is_current,
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
