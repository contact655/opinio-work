/**
 * ★企業ページの「いまどういう状態か」を1つに決める（2026-10-08。2026-10-28 に公開は企業・停止は運営へ作り替えた）。
 *
 * ⚠️★**`/biz/company` の3か所（上部バッジ・右上の案内・設定タブの「公開の状態」）とホームの右の列は
 *    必ずこの関数を通すこと。** 条件を画面に書き写さない。
 *
 * ── 状態 ──────────────────────────────────────────────────────────────────
 *   suspended   … 運営が停止中（suspended_at）。**ほかの状態より優先**。企業は公開に戻せない
 *   listed      … 一覧に載っていて、ページも見える（＝公開中）
 *   page_hidden … 詳細ページが 404（is_published = false）
 *   not_listed  … ページは見えるが一覧には載っていない
 *
 * ⚠️ 2026-10-28 まで「掲載を依頼する」（listing_requested_at）→ 運営が掲載、だった。依頼の状態はもう無い。
 * ⚠️★規約同意は**会社単位ではなく、見ている人（auth ユーザー）単位**（`hasAgreedTerms(user.id, "listing")`）。
 */

export type CompanyPageStatusKind = "suspended" | "listed" | "page_hidden" | "not_listed";

/** 企業側が次にやること。`null` は「企業側でやることは無い」 */
export type CompanyNextStep = "agree_terms" | "publish" | "request_unsuspend" | null;

export type CompanyPageStatus = {
  kind: CompanyPageStatusKind;
  label: string;
  detail: string;
  nextStep: CompanyNextStep;
  /** 求職者がこの会社の詳細ページを開けるか */
  pageVisible: boolean;
};

export function companyPageStatus(input: {
  isPublished: boolean;
  listingStatus: string | null;
  termsAgreed: boolean;
  suspended: boolean;
}): CompanyPageStatus {
  const { isPublished, listingStatus, termsAgreed, suspended } = input;
  if (suspended) {
    return {
      kind: "suspended", label: "停止中", nextStep: "request_unsuspend", pageVisible: false,
      detail: "運営により停止されています。企業ページと求人は求職者に表示されません。内容を直したら「停止解除を依頼する」を押してください。",
    };
  }
  if (isPublished && listingStatus === "listed") {
    return { kind: "listed", label: "公開中", nextStep: null, pageVisible: true, detail: "企業一覧と企業ページの両方に出ています。" };
  }
  const nextStep: CompanyNextStep = termsAgreed ? "publish" : "agree_terms";
  if (!isPublished) {
    return {
      kind: "page_hidden", label: "非公開", nextStep, pageVisible: false,
      detail: "企業ページはまだ公開されていません。必要な項目を入れて「公開する」を押すと公開されます。",
    };
  }
  return {
    kind: "not_listed", label: "一覧に未掲載", nextStep, pageVisible: true,
    detail: "企業ページは見えますが、企業一覧には載っていません。「公開する」を押すと一覧にも載ります。",
  };
}

/**
 * ★企業ページの状態を1行で。/biz/company の上部と、ホームの右の列「企業ページ」が**この関数**を使う。
 * ⚠️ `blockingCount` は companyRequirements.ts で数えた「公開まであと〇つ」（公開中なら always の項目だけ）。ここで数えない。
 */
export function companyStatusText(
  status: CompanyPageStatus,
  o: { hasChanges: boolean; unsuspendRequestedAt?: string | null; blockingCount: number },
): string {
  if (status.kind === "suspended") return o.unsuspendRequestedAt ? "停止中・停止解除を依頼済み（運営が確認中）" : "停止中";
  if (status.kind === "listed") return o.hasChanges ? "公開中・未公開の変更あり" : "公開中";
  const where = status.pageVisible ? "企業一覧に未掲載" : "非公開";
  if (o.blockingCount > 0) return `${where}・公開まであと${o.blockingCount}つ`;
  return `${where}・公開できます`;
}
