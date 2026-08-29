import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト管理 | OPINIO Business" } };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sent:       { label: "未読",     color: "var(--royal)",    bg: "var(--royal-50)",     border: "var(--royal-100)" },
  read:       { label: "既読",     color: "var(--ink-soft)", bg: "var(--bg-tint)",      border: "var(--line)" },
  interested: { label: "興味あり", color: "var(--success)",  bg: "var(--success-soft)", border: "#6EE7B7" },
  declined:   { label: "辞退",     color: "var(--ink-mute)", bg: "#F1F5F9",             border: "var(--line)" },
};

export default async function BizScoutsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();

  const { data: scouts } = await admin
    .from("ow_scouts")
    .select("id, status, sent_at, replied_at, conversation_id, message, candidate_id, ow_jobs(id, title)")
    .eq("company_id", ctx.tenantId)
    .order("sent_at", { ascending: false });

  // Resolve candidate ow_users info via auth_id
  const authIds = Array.from(new Set((scouts ?? []).map((s: any) => s.candidate_id).filter(Boolean)));
  const { data: users } = authIds.length > 0
    ? await admin.from("ow_users").select("id, auth_id, name, avatar_color").in("auth_id", authIds).eq("is_test", false)
    : { data: [] };

  const userMap = new Map((users ?? []).map((u: any) => [u.auth_id, u]));

  const rows = (scouts ?? []).map((s: any) => ({
    id: s.id as string,
    status: s.status as string,
    sentAt: s.sent_at as string,
    repliedAt: s.replied_at as string | null,
    conversationId: s.conversation_id as string | null,
    message: s.message as string,
    jobTitle: (s.ow_jobs as any)?.title as string | null,
    jobId: (s.ow_jobs as any)?.id as string | null,
    candidate: userMap.get(s.candidate_id) as { id: string; name: string; avatar_color: string | null } | null,
  }));

  const interestedCount = rows.filter((r) => r.status === "interested").length;
  const readOrMore = rows.filter((r) => r.status !== "sent").length; // read + interested + declined
  const replyRate = readOrMore > 0 ? Math.round((interestedCount / readOrMore) * 100) : null;

  const counts = {
    total: rows.length,
    interested: interestedCount,
    pending: rows.filter((r) => r.status === "sent" || r.status === "read").length,
    replyRate,
  };

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* 上部バー: ステータスタブ + ボタン */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          {/* ステータスタブ */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { label: "すべて", count: counts.total, active: true },
              { label: "返答待ち", count: counts.pending, active: false },
              { label: "興味あり", count: counts.interested, active: false, success: true },
              ...(counts.replyRate !== null ? [{ label: `返信率 ${counts.replyRate}%`, count: null, active: false, purple: true }] : []),
            ].map((tab) => (
              <div key={tab.label} style={{
                padding: "7px 13px",
                background: tab.active ? "var(--royal)" : "#fff",
                border: `1px solid ${tab.active ? "var(--royal)" : (tab as any).success ? "#6EE7B7" : (tab as any).purple ? "#C4B5FD" : "var(--line)"}`,
                borderRadius: 100, fontSize: 12, fontWeight: 600,
                color: tab.active ? "#fff" : (tab as any).success ? "var(--success)" : (tab as any).purple ? "#7C3AED" : "var(--ink-soft)",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {tab.label}
                {tab.count !== null && (
                  <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 10, fontWeight: 700, opacity: 0.8 }}>
                    {tab.count}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* 候補者を探すボタン */}
          <Link href="/biz/candidates" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            候補者を探す
          </Link>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
            padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📤</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              まだスカウトを送信していません
            </p>
            <Link href="/biz/candidates" style={{
              display: "inline-block", marginTop: 12,
              background: "var(--royal)", color: "#fff",
              padding: "10px 24px", borderRadius: 8,
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>
              候補者を探す →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((row) => {
              const st = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.sent;
              return (
                <div key={row.id} style={{
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                  padding: "18px 22px",
                  borderLeft: `3px solid ${st.color}`,
                  display: "flex", alignItems: "flex-start", gap: 16,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: row.candidate?.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "#fff",
                  }}>
                    {(row.candidate?.name ?? "?")[0]}
                  </div>

                  {/* Main */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {row.candidate?.name ?? "候補者"}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                        background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                      }}>
                        {st.label}
                      </span>
                      {row.jobTitle && (
                        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          求人: {row.jobTitle}
                        </span>
                      )}
                    </div>

                    <p style={{
                      fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
                      margin: "0 0 10px",
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {row.message}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                        送信: {new Date(row.sentAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                        {row.repliedAt && (
                          <> · 返答: {new Date(row.repliedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}</>
                        )}
                      </span>
                      {row.candidate && (
                        <Link
                          href={`/u/${row.candidate.id}`}
                          target="_blank"
                          style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}
                        >
                          プロフィールを見る →
                        </Link>
                      )}
                      {row.conversationId && (
                        <Link
                          href={`/biz/conversations/${row.conversationId}`}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6,
                            background: "var(--success-soft)", color: "var(--success)",
                            border: "1px solid #6EE7B7", textDecoration: "none",
                          }}
                        >
                          会話を見る →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BusinessLayout>
  );
}
