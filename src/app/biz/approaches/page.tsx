import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { getApproachQuota, listSentApproaches } from "@/lib/approaches/server";
import { APPROACH_EXPIRE_DAYS, APPROACH_RESEND_DAYS, COMPANY_APPROACH_STATUS_LABELS } from "@/lib/constants/companyApproaches";

export const dynamic = "force-dynamic";

/* ⚠️ サイドバーの「声かけ」と同じ名前にする */
export const metadata = {
  title: { absolute: "声かけ | OPINIO Business" },
};

/**
 * ★企業が送った「声かけ」の一覧（2026-10-09）。
 *
 * ⚠️★状態は3つ（2026-10-10）:「承認待ち」「30日を過ぎました」「やり取り中」。判定は `companyApproachStatus`。
 *    **見送られたものは、30日以内は「承認待ち」、過ぎたら「30日を過ぎました」**（見送りは区別しない）
 *    （求職者が見送ったことは企業に伝えない決まり）。`listSentApproaches` は declined_at を読まない。
 * ⚠️ 送る入口はここではなく、候補者検索のカードと /u/[id]（その人を見たうえで送るため）。
 */
export default async function BizApproachesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const allowed = canUse(ctx.planType, "companyApproach");
  const [rows, quota] = allowed
    ? await Promise.all([listSentApproaches(ctx.tenantId), getApproachQuota(ctx.tenantId)])
    : [[], null];

  const layoutProps = {
    userName: ctx.userName,
    tenantName: ctx.tenantName,
    tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter,
    memberships: ctx.allCompanies,
    currentTenantId: ctx.tenantId,
  };
  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(new Date(iso));

  return (
    <BusinessLayout {...layoutProps}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>声かけ</h1>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 16px" }}>
          候補者検索で見つけた方に、理由を添えて「話を聞いてみたい」と伝えた記録です。
          相手が承認すると、メッセージでやり取りを始められます。
          相手が見送ったかどうかはお知らせしません。承認されていない声かけは、送ってから{APPROACH_EXPIRE_DAYS}日間は「承認待ち」、それ以降は「{APPROACH_EXPIRE_DAYS}日を過ぎました」と表示されます。
          <br />
          OPINIO が根拠をそろえてお届けする「
          <Link href="/biz/proposals" style={{ color: "var(--royal)", fontWeight: 700 }}>提案</Link>
          」とは別の機能です。
        </p>

        {!allowed ? (
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, fontSize: 13, color: "var(--ink-soft)" }}>
            ご利用のプランでは声かけを使えません。
          </div>
        ) : (
          <>
            {/* ⚠️ 取得に失敗したら「0件」と出さない */}
            {quota ? (
              <div data-state="approach-quota" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  { label: "今月送った数", value: `${quota.monthlyUsed} / ${quota.monthlyLimit}` },
                  { label: "承認待ち", value: `${quota.openCount} / ${quota.openLimit}` },
                ].map((x) => (
                  <div key={x.label} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", minWidth: 150 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{x.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{x.value}</div>
                  </div>
                ))}
                <p style={{ flexBasis: "100%", margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
                  承認待ちは、送ってから{APPROACH_EXPIRE_DAYS}日たつと数に入らなくなります。同じ方へは送ってから{APPROACH_RESEND_DAYS}日間は再び声をかけられません。
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", margin: "0 0 16px" }}>送信数を取得できませんでした。</p>
            )}

            {rows === null ? (
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error)" }}>一覧を取得できませんでした。時間をおいて再読み込みしてください。</p>
            ) : rows.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                まだ声かけを送っていません。
                <Link href="/biz/candidates" style={{ color: "var(--royal)", fontWeight: 700, marginLeft: 6 }}>候補者を探す →</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((r) => (
                  <div key={r.id} data-approach-status={r.status} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Link href={`/u/${r.candidate.id}`} target="_blank" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>
                        {r.candidate.name || "名前未設定"}
                      </Link>
                      {r.status === "accepted" ? (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>{COMPANY_APPROACH_STATUS_LABELS.accepted}</span>
                      ) : r.status === "expired" ? (
                        /* ★30日を過ぎて承認されていない（2026-10-10）。見送り・返事なしは区別しない */
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{COMPANY_APPROACH_STATUS_LABELS.expired}</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: "var(--warm-soft)", color: "var(--warm-ink)", border: "1px solid #FDE68A" }}>{COMPANY_APPROACH_STATUS_LABELS.pending}</span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: "auto" }}>
                        {fmt(r.createdAt)}{r.senderName ? ` · ${r.senderName}` : ""}
                      </span>
                    </div>
                    {r.candidate.headline && (
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>{r.candidate.headline}</div>
                    )}
                    <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{r.reason}</p>
                    {r.status === "accepted" && r.conversationId && (
                      <div style={{ marginTop: 10 }}>
                        <Link href={`/biz/conversations/${r.conversationId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>メッセージを開く →</Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </BusinessLayout>
  );
}
