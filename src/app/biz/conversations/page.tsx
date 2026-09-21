import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { ConversationsClient } from "./ConversationsClient";
import { unreadConversationIds } from "@/lib/conversations/unread";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "対話管理 | OPINIO Business" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type CandidateInfo = {
  id: string;
  name: string | null;
  avatar_color: string | null;
};

export type ConversationRow = {
  id: string;
  kind: string | null;
  stage: string | null;
  status: string | null;
  last_message_at: string | null;
  created_at: string;
  candidate: CandidateInfo | null;
  /** ★未読があるか。サイドバーのバッジと**同じ関数**で決める（2026-09-21） */
  isUnread: boolean;
};

// ── No-tenant fallback ────────────────────────────────────────────────────────


// ── Main page ─────────────────────────────────────────────────────────────────

export default async function BizConversationsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();

  const { data: rawRows, error } = await supabase
    .from("ow_conversations")
    .select(`
      id, kind, stage, status, last_message_at, created_at,
      candidate:ow_users!candidate_user_id(id, name, avatar_color)
    `)
    .eq("company_id", ctx.tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BizConversationsPage] fetch error:", error.message);
  }

  /* ★未読のドット（2026-09-21）。サイドバーの「メッセージ」バッジと**同じ関数**で決める。
        ⚠️ それまでは「24時間以内に動きがあった」で出しており、**読んでいても出て、
           25時間前の未読には出なかった**。バッジの数字とドットの数が食い違わないように揃えた。 */
  const unread = await unreadConversationIds(ctx.currentOwnId, { companyId: ctx.tenantId });

  // Normalise: Supabase may return a single object or an array for the join
  const convList: ConversationRow[] = (rawRows ?? []).map((c: any) => ({
    id: c.id,
    kind: c.kind,
    stage: c.stage,
    status: c.status,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    candidate: Array.isArray(c.candidate)
      ? (c.candidate[0] ?? null)
      : c.candidate ?? null,
    isUnread: unread.has(c.id),
  }));

  /* ★空状態の文言を分けるためだけに数える（2026-08-31）。件数は使わず**あるか無いか**だけ。
        ⚠️ 失敗したら false に倒す（fail-closed）。 */
  const { count: publishedJobCount, error: pubErr } = await supabase
    .from("ow_jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.tenantId)
    .eq("status", "published");
  if (pubErr) console.error("[biz/conversations] published job count:", pubErr.message);
  const hasPublishedJobs = (publishedJobCount ?? 0) > 0;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <ConversationsClient conversations={convList} hasPublishedJobs={hasPublishedJobs} />
    </BusinessLayout>
  );
}
