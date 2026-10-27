import { guardBizPage } from "@/lib/auth/companyAccess";
import { PROFILE_CLIENT_MODULES } from "@/components/candidates/profileClientModules";
/* ★右欄（候補者のプロフィール）の中身が使う client コンポーネントを、このページから参照しておく（profileClientModules.ts の注記） */
void PROFILE_CLIENT_MODULES;
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inChunks } from "@/lib/supabase/paging";
import { canUse } from "@/lib/constants/plans";
import { getApproachQuota, listSentApproaches, startOfMonthJst } from "@/lib/approaches/server";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import type { CandidateTestMismatch } from "@/lib/business/candidates/model";
import { unreadConversationIds } from "@/lib/conversations/unread";
import { MessagesView } from "./MessagesView";
import { EmptyPane, NoSelectionPane, PendingPane, ThreadPane } from "./MessagePane";
import { candidateHeaderMeta, loadCompanyThread } from "@/lib/conversations/companyThread";
import type { SentApproach } from "@/lib/approaches/server";
import { unseenProposalConversationIds, interestConversationIds } from "@/lib/evidence/companyProposals";
import { canUseCandidateSearch, isCompanyReviewed } from "@/lib/business/scoutGate";
import { countAwaitingReply } from "@/lib/interest/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "メッセージ | OPINIO Business" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type CandidateInfo = {
  id: string;
  name: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
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
  /** ★企業から送ったメッセージに返信があり、企業がまだこの会話を開いていない（2026-10-11） */
  isNewReply: boolean;
  /** ★求職者が OPINIO のおすすめを見て「話を聞いてみたい」と答えてできた会話（2026-10-11）。一覧で「貴社に興味があります」 */
  fromInterest: boolean;
  /** ★最後のメッセージの冒頭（2026-10-11）。⚠️ セッションのクライアントで読むので、参加していない会話は null（RLS） */
  lastMessage: string | null;
  /** ★最後のメッセージを送った人（2026-10-11）。自分＝"me" ／ 同じ会社の別の担当者＝氏名 ／ 候補者＝"candidate" ／ 分からない＝null */
  lastSender: "me" | "candidate" | { colleague: string } | null;
};

/**
 * ★企業のメッセージ（2026-10-11 / 柴さんの指示。「メッセージリクエスト」を「メッセージ」にまとめた）。
 *   旧 /biz/conversations（会話の一覧）と旧 /biz/approaches（送ったリクエスト）を1つの画面にした。
 *   1本の一覧（会話と、送って返信のないもの）。タブ: すべて／未読／返事待ち。状態のバッジは使わない（2026-10-11）。
 * ⚠️ ルール（180日・見送りは見せない）。月10通は 2026-10-17、返事待ち10件と30日の期限は 2026-10-18 に外した。言葉と URL だけ。
 * ⚠️ 旧 URL は next.config.mjs で 301 転送（/biz/conversations → ここ、/biz/approaches → ?tab=pending）。
 */
export default async function BizMessagesPage({ searchParams }: { searchParams?: { tab?: string; sent?: string; show?: string; filter?: string; auto?: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "messages.use");

  const supabase = createClient();

  const { data: rawRows, error } = await supabase
    .from("ow_conversations")
    .select(`
      id, kind, stage, status, last_message_at, created_at,
      candidate:ow_users!candidate_user_id(id, name, avatar_color, avatar_url)
    `)
    .eq("company_id", ctx.tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) console.error("[biz/messages] conversations:", error.message);


  /* ★自分が参加している会話（一覧で「未参加」を見分ける）。⚠️ 失敗したら「全部参加している」に倒す */
  const { data: myParts, error: partErr } = await supabase
    .from("ow_conversation_participants")
    .select("conversation_id")
    .eq("user_id", ctx.currentOwnId)
    .is("left_at", null);
  if (partErr) console.error("[biz/messages] participants:", partErr.message);
  const joined = new Set((myParts ?? []).map((p) => p.conversation_id as string));

  /* ★送ったメッセージ（企業からの1通目）。返事待ちのタブと、新しい返信の印に使う */
  const allowed = canUse(ctx.planType, "companyApproach");
  const [sent, quota] = allowed
    ? await Promise.all([listSentApproaches(ctx.tenantId), getApproachQuota(ctx.tenantId)])
    : [[], null];
  /* ★右側で開くもの（2026-10-11 / 左右2画面）。?show= は会話の id か、送ったメッセージの id（どちらも受ける）。
        返信があった送ったメッセージは、その会話を開く。⚠️ 自社の会話・自社の送ったメッセージだけ（他社の id は何も開かない） */
  const showParam = typeof searchParams?.show === "string" && /^[0-9a-f-]{36}$/i.test(searchParams.show) ? searchParams.show : null;
  const convIdSet = new Set((rawRows ?? []).map((c) => c.id as string));
  let selectedConvId: string | null = null;
  let selectedSent: SentApproach | null = null;
  if (showParam) {
    if (convIdSet.has(showParam)) selectedConvId = showParam;
    else {
      const s0 = (sent ?? []).find((r) => r.id === showParam) ?? null;
      if (s0?.status === "accepted" && s0.conversationId && convIdSet.has(s0.conversationId)) selectedConvId = s0.conversationId;
      else if (s0 && s0.status !== "accepted") selectedSent = s0;
    }
  }
  /* ★開いた会話は、ここで既読にする（`loadCompanyThread`。参加者のときだけ）。⚠️ 一覧の未読を数えるより先に読む */
  /* ★一覧のいちばん上を自動で開いたとき（?auto=1。MessagesView が付ける）は既読にしない（2026-10-20 / 柴さんの判断 A案）。
        開いただけで届いたばかりの返信の未読が消え、担当者が気づかないまま残っていた。触ったときに既読にする（ReadOnInteraction） */
  const autoOpened = searchParams?.auto === "1";
  const thread = selectedConvId ? await loadCompanyThread(selectedConvId, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId }, { markRead: !autoOpened }) : null;
  const selectedCandidateId = thread?.candidate?.id ?? selectedSent?.candidate.id ?? null;
  const paneMeta = selectedCandidateId ? await candidateHeaderMeta(selectedCandidateId) : null;

  /* ★未読のドット。サイドバーの「メッセージ」バッジと**同じ関数**で決める（2026-09-21） */
  const unread = await unreadConversationIds(ctx.currentOwnId, { companyId: ctx.tenantId });

  const newReplyConvIds = new Set((sent ?? []).filter((r) => r.unseen && r.conversationId).map((r) => r.conversationId as string));
  /* ★提案から始まって、まだ誰も開いていない会話も「新しい」印を付ける（2026-10-11）。
        ⚠️ 企業の担当者はまだ参加者でないので、参加者の未読では数えられない。⚠️ 提案を読むのは companyProposals.ts だけ */
  for (const id of Array.from(await unseenProposalConversationIds(ctx.tenantId))) newReplyConvIds.add(id);
  const [interestIds, awaitingReply] = await Promise.all([interestConversationIds(ctx.tenantId), countAwaitingReply(ctx.tenantId)]);
  /* ⚠️ いま開いた会話は、上で企業が見た印を付けた（参加者のとき）。この描画の「新しい」印からも外す */
  if (thread?.isParticipant && !autoOpened) newReplyConvIds.delete(thread.conv.id);

  /* ★一覧の「最後のメッセージの冒頭1行」（2026-10-11 / 柴さんの指示。LinkedIn の受信箱と同じ）。
        ⚠️★admin で読まないこと。セッションのクライアントで読めば、参加していない会話は RLS で落ちる（読めない人に本文を出さない） */
  const convIds = (rawRows ?? []).map((c) => c.id as string);
  const lastBody = new Map<string, string>();
  const lastSenderPid = new Map<string, string>();
  if (convIds.length > 0) {
    /* ★会話 id を分けて、1,000 行ずつ最後まで引く（2026-10-19。超えると古い会話の冒頭1行が黙って空になっていた）。
          ⚠️ 分けるのは会話の単位なので、1つの会話のメッセージは同じかたまりに入り、新しい順が保たれる */
    const { data: msgs, error: mErr } = await inChunks(convIds, (part, from, to) => supabase
      .from("ow_conversation_messages").select("id, conversation_id, body, sent_at, sender_participant_id")
      .in("conversation_id", part).is("deleted_at", null).order("sent_at", { ascending: false }).order("id").range(from, to), "biz messages last");
    if (mErr) console.error("[biz/messages] last messages:", mErr);
    for (const m of msgs) {
      if (lastBody.has(m.conversation_id as string)) continue;
      lastBody.set(m.conversation_id as string, m.body as string);
      if (m.sender_participant_id) lastSenderPid.set(m.conversation_id as string, m.sender_participant_id as string);
    }
  }
  /* ★送った人を「あなた／同じ会社の担当者の氏名／候補者」に分ける。
        ⚠️ 引くのは、上で本文を読めた会話（＝参加している会話）の最後の送り手だけ。admin で読むが、出すのは自社の担当者の氏名だけ */
  const senderOf = new Map<string, "me" | "candidate" | { colleague: string }>();
  const pids = Array.from(new Set(Array.from(lastSenderPid.values())));
  if (pids.length > 0) {
    const admin = createAdminClient();
    const { data: parts, error: pErr } = await admin.from("ow_conversation_participants").select("id, user_id, role").in("id", pids);
    if (pErr) console.error("[biz/messages] senders:", pErr.message);
    const colleagueIds = (parts ?? []).filter((x) => x.role === "company_admin" && x.user_id !== ctx.currentOwnId).map((x) => x.user_id as string);
    const names = new Map<string, string>();
    if (colleagueIds.length > 0) {
      const { data: us, error: uErr } = await admin.from("ow_users").select("id, name").in("id", colleagueIds);
      if (uErr) console.error("[biz/messages] sender names:", uErr.message);
      for (const u of us ?? []) names.set(u.id as string, (u.name as string) || "担当者");
    }
    for (const x of parts ?? []) {
      if (x.user_id === ctx.currentOwnId) senderOf.set(x.id as string, "me");
      else if (x.role === "company_admin") senderOf.set(x.id as string, { colleague: names.get(x.user_id as string) ?? "担当者" });
      else senderOf.set(x.id as string, "candidate");
    }
  }

  const convList: ConversationRow[] = (rawRows ?? []).map((c: any) => ({
    id: c.id,
    kind: c.kind,
    stage: c.stage,
    status: c.status,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    candidate: Array.isArray(c.candidate) ? (c.candidate[0] ?? null) : c.candidate ?? null,
    isUnread: unread.has(c.id),
    isParticipant: partErr ? true : joined.has(c.id),
    isNewReply: newReplyConvIds.has(c.id),
    fromInterest: interestIds.has(c.id),
    lastMessage: lastBody.get(c.id) ?? null,
    lastSender: (lastSenderPid.has(c.id) && senderOf.get(lastSenderPid.get(c.id) as string)) || null,
  }));

  /* ★1通も送っていないときだけ「いまメッセージを送れる候補者：N人」を数える。
        ⚠️ 候補者検索と**同じ関数**（`loadCompanyCandidates` → `can_send_company_approach_many`）。取れなかったら null */
  let approachableCount: number | null | undefined;
  /* ★検証用かどうかが担当者と合わず外した人がいたか（2026-10-26）。0人の理由として出す */
  let approachTestMismatch: CandidateTestMismatch | null = null;
  const approachReviewPending = !isCompanyReviewed(ctx);
  /* ★候補者の人数は、候補者を探すと同じ条件（審査済み・プラン）のときだけ数える（2026-10-26）。
        ⚠️ 数えないときは「取得できませんでした」ではなく審査待ちの文言を出す（approachReviewPending） */
  if (allowed && sent !== null && sent.length === 0 && canUseCandidateSearch(ctx)) {
    const { candidates, testMismatch } = await loadCompanyCandidates({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, planType: ctx.planType });
    approachTestMismatch = testMismatch;
    approachableCount = candidates.length > 0 && candidates.every((c) => c.approach === undefined)
      ? null
      : candidates.filter((c) => c.approach?.eligible === true).length;
  }
  /* ★送れる人0人のときの「求人を公開する」を出すか。公開中の求人が1件でもあれば出さない（取れなかったら出さない） */
  let hasPublishedJob: boolean | null = null;
  if (approachableCount === 0) {
    const { count, error: jErr } = await createAdminClient().from("ow_jobs").select("id", { count: "exact", head: true })
      .eq("company_id", ctx.tenantId).eq("status", "published");
    if (jErr) console.error("[biz/messages] ow_jobs:", jErr.message);
    else hasPublishedJob = (count ?? 0) > 0;
  }

  /* ★タブは「すべて」「未読」「返事待ち」（2026-10-11 / 柴さんの指示）。旧 ?tab=expired は「すべて」へ */
  const tab = searchParams?.tab === "pending" || searchParams?.tab === "unread" ? searchParams.tab : "all";
  const backHref = tab === "all" ? "/biz/messages" : `/biz/messages?tab=${tab}`;
  const nowDate = new Date();
  const pane = thread ? <ThreadPane thread={thread} meta={paneMeta} backHref={backHref} myOwUserId={ctx.currentOwnId} deferRead={autoOpened} />
    : selectedSent ? <PendingPane sent={selectedSent} meta={paneMeta} backHref={backHref} />
    : null;
  const selectedKey = thread ? `c:${thread.conv.id}` : selectedSent ? `s:${selectedSent.id}` : null;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <MessagesView
        allowed={allowed}
        conversations={convList}
        sent={sent}
        quota={quota}
        initialTab={tab}
        sentId={searchParams?.sent}
        pane={pane}
        selectedKey={selectedKey}
        emptyPane={<EmptyPane canSend={allowed} />}
        noSelectionPane={<NoSelectionPane />}
        now={nowDate.toISOString()}
        approachableCount={approachableCount}
        approachTestMismatch={approachTestMismatch}
        approachReviewPending={approachReviewPending}
        hasPublishedJob={hasPublishedJob}
        sentThisMonthFrom={searchParams?.filter === "sent_this_month" ? startOfMonthJst(nowDate) : null}
        awaitingReply={awaitingReply}
      />
    </BusinessLayout>
  );
}
