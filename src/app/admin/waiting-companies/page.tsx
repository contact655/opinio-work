import Link from "next/link";
import { loadWaitingCompanies } from "@/lib/admin/waitingCompanies";
import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";

/* ⚠️ 運営の作業一覧。キャッシュに載せない */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "担当者のいない企業で待っている人 | OPINIO 運営" } };

/**
 * ★利用者が待っているのに、答えられる担当者がいない企業（2026-10-17）。
 *   数え方は lib/admin/waitingCompanies.ts の1か所。/admin の要対応と同じ関数を通す。
 * ⚠️ 運営は応募を企業へ取り次がない。ここは「担当者の登録を案内する相手」を見つけるための一覧。
 * ⚠️ 取得に失敗したら「0社」と出さない。
 */
export default async function WaitingCompaniesPage() {
  /* ★運営権限をページ本体でも確かめる。DB を引く前に返す（lib/auth/adminPageGuard.ts）。消さないこと */
  if (!(await viewerIsAdmin())) return null;
  const rows = await loadWaitingCompanies();
  const fmt = (iso: string) => {
    const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    return d <= 0 ? "今日" : `${d}日前`;
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
        担当者のいない企業で待っている人
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        応募・カジュアル面談の申込・「興味あり」が届いているのに、答えられる担当者がまだいない企業です。
        運営は応募を企業へ取り次ぎません。企業に担当者の登録（企業ページ末尾の「この会社の採用担当の方へ」）を案内してください。
        実在の利用者が待っている企業が上、その中は待ちが古い順です。
      </p>

      {rows === null ? (
        <p data-state="waiting-failed" style={{ fontSize: 13, color: "var(--error-ink)" }}>
          取得できませんでした（0社という意味ではありません）。
        </p>
      ) : rows.length === 0 ? (
        <p data-state="waiting-empty" style={{ fontSize: 13, color: "var(--ink-mute)" }}>いまはありません。</p>
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          {rows.map((r) => (
            <div key={r.companyId} data-state="waiting-row" style={{
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              padding: "12px 16px", borderBottom: "1px solid var(--line-soft)",
            }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <Link href={`/companies/${r.slug ?? r.companyId}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
                  {r.name}
                </Link>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                  一番古い待ち: {fmt(r.oldestAt)}
                  {r.testOnly && <span style={{ marginLeft: 8 }}>（検証用アカウントだけ）</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-soft)" }}>
                {r.applications > 0 && <span>応募 <strong style={{ color: "var(--ink)" }}>{r.applications}</strong></span>}
                {r.meetings > 0 && <span>面談の申込 <strong style={{ color: "var(--ink)" }}>{r.meetings}</strong></span>}
                {r.interested > 0 && <span>興味あり <strong style={{ color: "var(--ink)" }}>{r.interested}</strong></span>}
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                {r.hasJoinRequest && (
                  <Link href="/admin/company-join-requests" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                    参加依頼あり →
                  </Link>
                )}
                <Link href={`/admin/companies/${r.companyId}`} style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
                  企業の管理 →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
