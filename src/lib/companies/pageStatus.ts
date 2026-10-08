/**
 * ★企業ページの「いまどういう状態か」を1つに決める（2026-10-08）。
 *
 * ⚠️★**`/biz/company` の3か所（上部バッジ・右上の案内・設定タブの「掲載状態」）は
 *    必ずこの関数を通すこと。** 条件を画面に書き写さない。
 *
 * ── なぜ作ったか ────────────────────────────────────────────────────────
 * 株式会社Third Box の画面で、3か所が別々の値を見て食い違っていた（2026-10-08 実測）。
 *   ・上部バッジ「公開済み・最新」      … **下書きと公開内容の差分**しか見ていなかった
 *   ・右上「公開には掲載利用規約への同意が必要です」 … **見ている人の**規約同意
 *   ・設定タブ「掲載状態: 未掲載」       … `is_published` だけ（`listing_status` を見ていない）
 * 実体は `is_published = false`（ページは 404）・`listing_status = 'draft'`・未同意。
 * ＝ ページが誰にも見えていないのに「公開済み」と出ていた。
 *
 * ⚠️ 3つのスイッチの意味は CLAUDE.md「企業ページの3つのスイッチ」。
 *      `is_published`    … 詳細ページが見えるか（404 ゲート）
 *      `listing_status`  … ディレクトリ（一覧）に載るか
 *      `listing_requested_at` … 企業が掲載を依頼した**記録**（状態ではない）
 *
 * ⚠️★規約同意は**会社単位ではなく、見ている人（auth ユーザー）単位**
 *    （`hasAgreedTerms(user.id, "listing")`）。同じ会社でも担当者ごとに違いうる。
 */

export type CompanyPageStatusKind =
  /** 一覧に載っていて、ページも見える */
  | "listed"
  /** 詳細ページが 404（`is_published = false`）。**差分のバッジより優先して出す** */
  | "page_hidden"
  /** ページは見えるが一覧には未掲載。掲載を依頼するには規約への同意が要る */
  | "terms_required"
  /** ページは見えるが一覧には未掲載。規約には同意済みで、まだ依頼していない */
  | "not_requested"
  /** ページは見えるが一覧には未掲載。依頼済みで運営の確認待ち */
  | "requested";

/** 掲載に向けて企業側が次にやること。`null` は「企業側でやることは無い」 */
export type CompanyNextStep = "agree_terms" | "request_listing" | "await_review" | null;

export type CompanyPageStatus = {
  kind: CompanyPageStatusKind;
  /** 短いラベル（バッジ・設定タブの見出し） */
  label: string;
  /** 1行の説明 */
  detail: string;
  nextStep: CompanyNextStep;
  /** 求職者がこの会社の詳細ページを開けるか */
  pageVisible: boolean;
};

export function companyPageStatus(input: {
  isPublished: boolean;
  listingStatus: string | null;
  termsAgreed: boolean;
  listingRequestedAt: string | null;
}): CompanyPageStatus {
  const { isPublished, listingStatus, termsAgreed, listingRequestedAt } = input;

  /* ⚠️ 次の一手は「規約 → 依頼 → 運営の確認」の順。ページの公開状態とは独立に決まる */
  const nextStep: CompanyNextStep =
    isPublished && listingStatus === "listed" ? null
    : !termsAgreed ? "agree_terms"
    : listingRequestedAt ? "await_review"
    : "request_listing";

  if (isPublished && listingStatus === "listed") {
    return {
      kind: "listed", label: "掲載中", nextStep, pageVisible: true,
      detail: "企業一覧と企業ページの両方に出ています。",
    };
  }
  if (!isPublished) {
    return {
      kind: "page_hidden", label: "ページ非公開", nextStep, pageVisible: false,
      detail:
        nextStep === "agree_terms" ? "企業ページはまだ公開されていません。掲載するには、まず掲載利用規約に同意してください。"
        : nextStep === "await_review" ? "企業ページはまだ公開されていません。掲載の依頼は届いています（運営が確認中）。"
        : "企業ページはまだ公開されていません。掲載するには、運営に掲載を依頼してください。",
    };
  }
  if (nextStep === "agree_terms") {
    return {
      kind: "terms_required", label: "規約未同意", nextStep, pageVisible: true,
      detail: "企業ページは見えますが、企業一覧には載っていません。掲載するには掲載利用規約への同意が必要です。",
    };
  }
  if (nextStep === "await_review") {
    return {
      kind: "requested", label: "掲載依頼中", nextStep, pageVisible: true,
      detail: "企業ページは見えますが、企業一覧にはまだ載っていません。掲載の依頼は届いています（運営が確認中）。",
    };
  }
  return {
    kind: "not_requested", label: "掲載依頼前", nextStep, pageVisible: true,
    detail: "企業ページは見えますが、企業一覧には載っていません。掲載するには運営に掲載を依頼してください。",
  };
}
