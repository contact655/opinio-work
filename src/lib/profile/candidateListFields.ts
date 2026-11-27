/**
 * ★企業の候補者一覧（/biz/candidates）に出る項目と、その案内（2026-11-27 / 柴さんの指示）。
 *   **純粋な値と関数。何も import しない**（node のテストから読むため）。
 *
 * /mypage の上部に「企業の候補者一覧に表示される項目」として、空いている項目だけを並べる。
 * 項目の一覧・埋まっているかの判定・案内の文言・入力画面へのリンクは、すべてここ1か所から作る。
 *
 * ⚠️★企業の候補者一覧（biz/candidates）の一覧カードの実装と一致させること。対応（2026-11-27 時点）:
 *   写真             … カードのアバター（ow_users.avatar_url）
 *   職歴（職種と会社名）… カード2行目「職種 @ 会社」。現職（is_current）のうち id が最も小さい1件の
 *                        role_title（社内での呼び方）と会社。lib/business/candidates/load.ts の currentExpByUser と同じ選び方
 *   転職への意向       … カード1行目の札（ow_profiles.career_stance）。絞り込み「転職への意向」にも使う
 *   居住地             … カード3行目（ow_users.location）。絞り込み「居住地」にも使う
 *   希望する職種       … 現職も会社も無い人のカード2行目「希望: ◯◯」。絞り込み「希望職種」にも使う（ow_profile_desired_roles）
 *   意向の更新日       … 絞り込み「意向を更新した時期」（7日／30日／90日以内。model.ts の STANCE_FRESHNESS_BANDS）
 *   **一覧カードの項目や絞り込みが変わったら、ここも変えること。**
 *
 * ⚠️★「採用担当は特に◯◯を見ています」のような、データの裏付けのない書き方をしない。
 *   ここで言ってよいのは「一覧に表示される」「絞り込みに使われる」という画面の仕様だけ。
 * ⚠️ 割合（%）や「あと N 項目」は出さない（docs/profile-progress-20260910.md）。
 */

/** 案内を出す相手の転職への意向（積極的に探している・いい話なら聞きたい・情報収集中）。
    ⚠️ 「今は考えていない」（no_contact）と未設定には出さない（企業の候補者一覧に出ない人に案内しても意味が無い）。
    値は lib/constants/careerPreferences.ts の CAREER_STANCES と同じ（テストで突き合わせる） */
export const CANDIDATE_LIST_NUDGE_STANCES = ["active", "open", "researching"] as const;

/** 意向の更新日がこれより前なら、更新を勧める1行を足す。
    ⚠️ 企業の絞り込み「意向を更新した時期」のいちばん長い帯（90日以内）と同じ値 */
export const STANCE_STALE_DAYS = 90;

/** 閉じたら出さない日数 */
export const CANDIDATE_LIST_NUDGE_SNOOZE_DAYS = 30;

export type CandidateListFieldInput = {
  hasAvatar: boolean;
  /** 現職（is_current）があるか */
  hasCurrentExperience: boolean;
  /** 現職の role_title（社内での呼び方）と会社の両方があるか（一覧カードの「職種 @ 会社」） */
  hasCurrentRoleAndCompany: boolean;
  careerStance: string | null;
  /** ow_profiles.career_stance_updated_at（ISO 文字列） */
  careerStanceUpdatedAt: string | null;
  location: string | null;
  desiredRoleCount: number;
};

export type CandidateListFieldKey = "photo" | "experience" | "stance" | "location" | "desiredRoles";

export type CandidateListField = {
  key: CandidateListFieldKey;
  label: string;
  filled: (d: CandidateListFieldInput) => boolean;
  /** 入力画面へのリンク（/mypage の該当の欄を開く） */
  href: (d: CandidateListFieldInput) => string;
};

/** ★一覧カードに出る項目。並びは案内に出す順（柴さんの指示の順） */
export const CANDIDATE_LIST_FIELDS: readonly CandidateListField[] = [
  { key: "photo", label: "写真", filled: (d) => d.hasAvatar, href: () => "/mypage?focus=photo" },
  {
    key: "experience", label: "職歴（職種と会社名）",
    filled: (d) => d.hasCurrentRoleAndCompany,
    /* 現職が無ければ職歴の追加（現職として開く）、あれば職歴の欄へ（社内での呼び方を入れてもらう） */
    href: (d) => (d.hasCurrentExperience ? "/mypage?focus=experience" : "/mypage?add=career"),
  },
  {
    key: "stance", label: "転職への意向",
    filled: (d) => !!d.careerStance && d.careerStance !== "no_contact",
    href: () => "/mypage?focus=intent",
  },
  { key: "location", label: "居住地", filled: (d) => !!d.location && d.location.trim() !== "", href: () => "/mypage?focus=location" },
  { key: "desiredRoles", label: "希望する職種", filled: (d) => d.desiredRoleCount > 0, href: () => "/mypage?focus=intent" },
];

export const CANDIDATE_LIST_NUDGE_TITLE = "企業の候補者一覧に表示される項目";
export const CANDIDATE_LIST_NUDGE_BODY =
  "企業の採用担当が候補者を探すとき、一覧には次の項目が表示されます。空いている項目を入れておくと、経歴が伝わりやすくなります。";
export const CANDIDATE_LIST_NUDGE_STALE_NOTE =
  "転職への意向は、更新した時期でも絞り込まれます。今の状況に合わせて更新しておくと、見つかりやすくなります。";

export type CandidateListNudge = {
  missing: { key: CandidateListFieldKey; label: string; href: string }[];
  /** 意向の更新日が STANCE_STALE_DAYS より前（または記録が無い） */
  stanceStale: boolean;
};

/** 案内の中身。出さない人には null（意向が対象外・空いている項目が無い） */
export function buildCandidateListNudge(d: CandidateListFieldInput, now: Date = new Date()): CandidateListNudge | null {
  if (!d.careerStance || !(CANDIDATE_LIST_NUDGE_STANCES as readonly string[]).includes(d.careerStance)) return null;
  const missing = CANDIDATE_LIST_FIELDS.filter((f) => !f.filled(d)).map((f) => ({ key: f.key, label: f.label, href: f.href(d) }));
  if (missing.length === 0) return null;
  const t = d.careerStanceUpdatedAt ? Date.parse(d.careerStanceUpdatedAt) : NaN;
  const stanceStale = Number.isNaN(t) || now.getTime() - t > STANCE_STALE_DAYS * 24 * 60 * 60 * 1000;
  return { missing, stanceStale };
}
