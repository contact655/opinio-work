import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { ConversationsClient } from "./ConversationsClient";
import { unreadConversationIds } from "@/lib/conversations/unread";

export const dynamic = "force-dynamic";

export const metadata = {
  /* ★サイドバーの名前に揃えた（2026-09-21）。それまで「対話管理」だった */
  title: { absolute: "メッセージ | OPINIO Business" },
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
  /** ★自分がこの会話に参加しているか（2026-09-21）。参加していないとメッセージを読めない（RLS） */
  isParticipant: boolean;
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

  /* ★自分が参加している会話（2026-09-21）。一覧で「未参加」を見分けるため。
        ⚠️ 失敗したら「全部参加している」に倒す（「未参加」と誤って出すと、
           参加済みの人に「参加する」を促すことになる）。ログは出す。 */
  const { data: myParts, error: partErr } = await supabase
    .from("ow_conversation_participants")
    .select("conversation_id")
    .eq("user_id", ctx.currentOwnId)
    .is("left_at", null);
  if (partErr) console.error("[BizConversationsPage] participants:", partErr.message);
  const joined = new Set((myParts ?? []).map((p) => p.conversation_id as string));

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
    isParticipant: partErr ? true : joined.has(c.id),
  }));

  /* ⚠️ 2026-10-10 に公開求人の有無を数えるのをやめた。空状態の文言を「会話が開く4つの場面」に
        書き換え、求人の有無で分ける必要が無くなったため（ConversationsClient の注記）。 */

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <ConversationsClient conversations={convList} />
    </BusinessLayout>
  );
}
