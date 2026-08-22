/**
 * 面談対応者（`ow_company_members`）の許容値。**API と DB の CHECK が同じものを見る。**
 *
 * ⚠️ CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
 *    DB 側の CHECK は `ow_company_members_created_via_check`
 *    （migration `20260823040000_member_self_apply.sql`）。
 *    **値を足すときは、ここと DB の CHECK の両方を直すこと。**
 */

/** その行がどう作られたか */
export const MEMBER_CREATED_VIA = {
  /** 本人がマイページから申請した。**企業の承認（is_public）を得るまで公開されない** */
  SELF: "self",
  /** 企業が招待した */
  INVITE: "invite",
  /** 運営が作った */
  ADMIN: "admin",
  /** 移行で入れた */
  MIGRATION: "migration",
} as const;

export type MemberCreatedVia = (typeof MEMBER_CREATED_VIA)[keyof typeof MEMBER_CREATED_VIA];

export const MEMBER_CREATED_VIA_VALUES: readonly MemberCreatedVia[] = [
  MEMBER_CREATED_VIA.SELF,
  MEMBER_CREATED_VIA.INVITE,
  MEMBER_CREATED_VIA.ADMIN,
  MEMBER_CREATED_VIA.MIGRATION,
];

/**
 * 4つの状態。**行の有無と2つのフラグから導く。列は増やさない。**
 *
 * ⚠️ `none` と `pending_company` を同じ見た目にしないこと。
 *    「まだ申請していない」と「申請したが承認待ち」は利用者にとって別のことで、
 *    混ぜると押し直すしかなくなる。
 */
export type MemberState =
  /** 行が無い＝まだ何もしていない（解除した後もここに戻る） */
  | "none"
  /** 企業が招待したが本人がまだ承認していない（display_consent=false） */
  | "pending_self"
  /** 本人が申請済み・**企業の承認待ち**（display_consent=true / is_public=false / created_via='self'） */
  | "pending_company"
  /** 本人は同意済みだが企業が非公開にしている（display_consent=true / is_public=false / created_via≠'self'） */
  | "unlisted"
  /** 公開中（display_consent=true / is_public=true） */
  | "listed";

/**
 * 行から状態を導く。**判定をここ以外に書かないこと。**
 *
 * ⚠️ `created_via` が NULL の行（この列より前に作られた行）を `pending_company` にしない。
 *    企業側が作った行なので、本人は既に同意している。未公開なのは**企業が非公開にしている**
 *    からで、本人が待たされているわけではない → `unlisted`。
 *    ⚠️ ここを `pending_self` にすると「本人がまだ承認していない」と誤って表示される。
 */
export function memberState(
  row: { display_consent: boolean; is_public: boolean; created_via: string | null } | null | undefined,
): MemberState {
  if (!row) return "none";
  if (!row.display_consent) return "pending_self";
  if (row.is_public) return "listed";
  return row.created_via === MEMBER_CREATED_VIA.SELF ? "pending_company" : "unlisted";
}
