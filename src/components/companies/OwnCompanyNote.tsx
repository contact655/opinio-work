/**
 * ★「この会社は OPINIO の運営会社です。」（2026-10-10 / 柴さんの指示）
 *
 * 出す場所（どれも判定は `lib/companies/ownCompany.ts` の `getOwnCompanyId()`。⚠️ slug や id を書き写さない）:
 *   - 企業ページの上部（社名の近く）
 *   - 求人ページの会社名の近く
 *   - 求職者に届く提案（/mypage/proposals）と声かけ（/mypage/approaches）
 * ⚠️★企業一覧のカードには出さない（柴さんの指示）。
 * ⚠️ 色で目立たせない（注意ではなく事実の開示。ui-conventions の「色の役割」で黄色は使わない）。
 * ⚠️ 文言はここ1か所。画面ごとに書かないこと。
 */
export const OWN_COMPANY_NOTE = "この会社は OPINIO の運営会社です。";

export function OwnCompanyNote({ style }: { style?: React.CSSProperties }) {
  return (
    <p data-own-company-note style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--ink-soft)", ...style }}>
      {OWN_COMPANY_NOTE}
    </p>
  );
}
