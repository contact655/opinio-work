import Link from "next/link";

/**
 * ★企業ページの下に出す「この会社の採用担当の方へ」（2026-10-17 / 柴さんの指示）。
 *
 * それまで企業の担当者の入口は、ヘッダーの「企業の方はこちら」（→ 会社を新しく作る）だけで、
 * 自分の会社のページから担当者になる道が無かった。
 *
 * - 行き先は `/auth?next=/biz/companies/add/new?company=<id>`。ログイン済みなら /auth がそのまま次へ送り、
 *   未ログインならログインか登録の後に着く。⚠️ `/biz/auth` に向けないこと（あちらの新規登録の導線は
 *   next を落とす）。
 * - 着いた先で会社が選ばれた状態になり、担当者がいなければ「最初の担当者として参加を依頼する」
 *   （運営の承認制。2026-10-17）、いれば「担当者への追加を依頼する」になる。
 * - ⚠️ 色で目立たせない。求職者向けのページの末尾にある、企業の人向けの小さな案内。
 * - ⚠️ ISR のページなので、閲覧者で出し分けない（呼び出し側が運営会社・検証用・プレビューで外す）。
 */
export function CompanyStaffEntry({ companyId }: { companyId: string }) {
  const next = `/biz/companies/add/new?company=${companyId}`;
  return (
    <div
      data-company-staff-entry
      style={{
        marginTop: "var(--space-8)",
        paddingTop: "var(--space-4)",
        borderTop: "1px solid var(--line-soft)",
        fontSize: 12,
        lineHeight: 1.7,
        color: "var(--ink-mute)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>この会社の採用担当の方へ</span>
      {"　"}担当者として登録すると、届いた応募の確認や企業ページの編集ができます。{" "}
      <Link
        href={`/auth?next=${encodeURIComponent(next)}`}
        prefetch={false}
        style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
      >
        担当者として参加を依頼する →
      </Link>
    </div>
  );
}
