"use client";

import Link from "next/link";
import { useCompanyEmployees } from "@/lib/companies/useCompanyEmployees";

/*
 * 右ペインの「社員・OB/OG」（2026-09-18）。
 *
 * ⚠️★**取得は `useCompanyEmployees` を使う。素の `fetch` を書かないこと。**
 *    あのフックは企業IDごとに1本だけ飛ばすよう `inflight` Map で束ねてある。
 *    2026-09-07 に、同じページの2つの部品が同じAPIを**2回**叩いていたのを直した仕組み。
 *    ここで別の取得を書くと、企業詳細ページと同じ二重取得が分割ビューでも起きる。
 *
 * ⚠️ 閲覧者依存なのでクライアントで取る（未ログインには元から0件）。
 *    ⚠️ **取得前は何も描かない。** 空の箱を先に出すと、0件の人にはそれが残り続ける。
 *
 * ⚠️ ペインは要約。**人数と数名の名前まで**にして、全部は詳細ページに任せる。
 */

const MAX = 6;

export function CompanyPaneEmployees({ companyId, detailHref }: { companyId: string; detailHref: string }) {
  const data = useCompanyEmployees(companyId);
  if (!data) return null;

  const current = data.current ?? [];
  const alumni = data.alumni ?? [];
  /* ⚠️ 中身が無ければ見出しごと出さない（0人を「0名」と書かない） */
  if (current.length === 0 && alumni.length === 0) return null;

  const shown = [...current, ...alumni].slice(0, MAX);
  const rest = current.length + alumni.length - shown.length;

  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
      padding: "var(--space-6)", minWidth: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: "var(--space-3)" }}>
        社員・OB/OG
        <span style={{ fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>
          {/* ⚠️ 0 の側は書かない（「OB・OG 0名」を出さない） */}
          {[current.length ? `現役 ${current.length}名` : null, alumni.length ? `OB・OG ${alumni.length}名` : null]
            .filter(Boolean).join(" / ")}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {shown.map((p) => (
          <Link key={p.userId} href={`/u/${p.userId}`} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 999,
            border: "1px solid var(--line)", background: "var(--bg-tint)",
            textDecoration: "none", color: "var(--ink)", fontSize: 12.5, fontWeight: 600,
            maxWidth: "100%", minWidth: 0,
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
          </Link>
        ))}
      </div>
      {rest > 0 && (
        <div style={{ marginTop: "var(--space-3)", fontSize: 12, color: "var(--ink-mute)" }}>
          <Link href={detailHref} style={{ color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
            ほか {rest} 名は詳細ページに
          </Link>
        </div>
      )}
    </div>
  );
}

export default CompanyPaneEmployees;
