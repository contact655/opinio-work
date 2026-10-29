"use client";

import Link from "next/link";
import { useCompanyViewerState } from "@/lib/companies/useCompanyViewerState";

/**
 * ★記事が1件も無い企業ページで、**その会社の担当者にだけ**「記事を書く」を出す（2026-10-29 / 柴さんの指示）。
 *
 * - 求職者・未ログインには何も出さない。それまでは「まだ取材記事がありません／OPINIO編集部による
 *   取材記事が順次公開されます」を全員に出しており、「OPINIO が書くのを待つ場所」に読めていた。
 *   このセクションは各企業が自分のことを発信するための場所（編集部の記事は例外）。
 * - 書く場所は /biz/posts（企業記事。ow_company_posts）。公開するとこのページの「企業からの投稿」に載る。
 * - ⚠️ 担当者かどうかはクライアントで取る（ページは ISR。サーバーで認証を読まない）。
 *   判定は viewer-state API の canWriteStories（役割が stories.edit を持つ有効な担当者）。
 * - ⚠️ 複数社の担当者は、/biz で選んでいる会社の記事画面が開く（切り替えは /biz 側）。
 */
export function CompanyStoriesStaffCta({ companyId }: { companyId: string }) {
  const { ready, canWriteStories } = useCompanyViewerState(companyId);
  if (!ready || !canWriteStories) return null;

  return (
    <section
      data-state="company-stories-staff-cta"
      style={{
        background: "#fff",
        border: "1px dashed var(--line)",
        borderRadius: 18,
        padding: "var(--space-6) var(--cd-pad-x, 32px)",
        marginBottom: "var(--space-6)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>
        担当者の方にだけ表示しています
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
        この会社の記事はまだありません
      </div>
      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        記事を書いて公開すると、このページの「企業からの投稿」に載ります。
      </p>
      <Link
        href="/biz/posts"
        prefetch={false}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 18px", borderRadius: 10,
          fontSize: 13, fontWeight: 700, textDecoration: "none",
          background: "var(--royal)", color: "#fff",
        }}
      >
        記事を書く →
      </Link>
    </section>
  );
}
