import { guardBizPage } from "@/lib/auth/companyAccess";
import { PROFILE_CLIENT_MODULES } from "@/components/candidates/profileClientModules";
/* ★右欄（候補者のプロフィール）の中身が使う client コンポーネントを、このページから参照しておく（profileClientModules.ts の注記） */
void PROFILE_CLIENT_MODULES;
import { CandidateProfileDrawerButton } from "@/components/candidates/CandidateProfileDrawer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { ThreadReplyArea } from "./ThreadReplyArea";
import { RecordMeetingButton, SchedulingTools } from "./SchedulingTools";
import { formatMeetingDateTime, MEETING_FORMATS } from "@/lib/constants/meetings";
import { loadCompanyThread } from "@/lib/conversations/companyThread";
import { ThreadMessages } from "../ThreadMessages";

export const dynamic = "force-dynamic";

/* ★タブの題（2026-09-21）。それまで指定が無く、サイト全体の題になっていた */
export const metadata = {
  title: { absolute: "メッセージ | OPINIO Business" },
};

export default async function BizConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const conversationId = params.id;

  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "messages.use");

  /* ★読み込み・既読は /biz/messages の右側と同じ関数（2026-10-11 に切り出した。条件は変えていない） */
  const thread = await loadCompanyThread(conversationId, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId });
  if (!thread) notFound();
  const { conv, candidate, participants, isParticipant, meetingState, companyAdmins, schedulingUrl: mySchedulingUrl } = thread;
  const candidateName = candidate?.name ?? "名前未設定";
  const candidateInitial = candidateName.trim().charAt(0).toUpperCase();
  const candidateAvatarColor =
    candidate?.avatar_color ?? "linear-gradient(135deg, #6b7280, #475569)";

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <style>{`
        .biz-conv-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (min-width: 1024px) { .biz-conv-grid { grid-template-columns: minmax(0, 1fr) 280px; } }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        {/* Back link */}
        <Link
          href="/biz/messages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--ink-soft)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          メッセージに戻る
        </Link>

        {/* Conversation title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Candidate avatar */}
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: candidateAvatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}>
            {candidateInitial}
          </div>
          <div>
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--ink)",
              margin: 0,
            }}>
              {candidateName} さんとのメッセージ
            </h1>
          </div>

          {/* Participant status badge */}
          <div style={{ marginLeft: "auto" }}>
            {isParticipant ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--success-ink)",
                background: "var(--success-soft)",
                border: "1px solid #A7F3D0",
              }}>
                ✓ 参加中
              </span>
            ) : (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-mute)",
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
              }}>
                未参加（閲覧のみ）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ★面談（2026-10-10 / 段4）。⚠️ 「選考管理に追加」は面談が決まる前は出さない（柴さんの判断）。
             決まったら「選考管理で見る」。リンクを送った会話では「面談日が決まったら記録する」 */}
      {meetingState?.scheduled ? (
        <div data-state="meeting-scheduled" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "var(--royal-50)", border: "1px solid var(--royal-100)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            面談：{formatMeetingDateTime(meetingState.scheduled.startsAt)}（{MEETING_FORMATS[meetingState.scheduled.format]}・{meetingState.scheduled.duration}分）
          </span>
          <Link href="/biz/meetings?tab=meetings" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>選考管理で見る →</Link>
        </div>
      ) : isParticipant && meetingState?.linkSent ? (
        <div style={{ marginBottom: 14 }}><RecordMeetingButton conversationId={conv.id} /></div>
      ) : null}

      {/* ── Main content: 2-column ── */}
      {/* ⚠️ 2026-10-11 まで「1fr 280px」固定で、375px では会話が幅 50px ほどに潰れていた。列数は CSS で変える（ui-debugging ②） */}
      <div className="biz-conv-grid">

        {/* ── Left: Chat messages ── */}
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Message area（★/biz/messages の右側と同じ部品。2026-10-11） */}
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, minHeight: 400 }}>
            <ThreadMessages thread={thread} />
          </div>

          {/* ★返信欄（2026-10-12）。参加していない管理者も返信でき、返信すると参加する（ThreadReplyArea） */}
          <ThreadReplyArea conversationId={conv.id} isParticipant={isParticipant} canReply={thread.canReply} sendBlocked={thread.sendBlocked}
            tools={<SchedulingTools conversationId={conv.id} admins={companyAdmins} myUserId={ctx.currentOwnId} initialSchedulingUrl={mySchedulingUrl} />} />
        </div>

        {/* ── Right: Candidate summary + participants ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Candidate profile card */}
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-inter), var(--font-noto)",
              marginBottom: 14,
            }}>
              候補者
            </div>

            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: candidateAvatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: "var(--font-inter), var(--font-noto)",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}>
                {candidateInitial}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                  {candidateName}
                </div>
                {candidate?.location && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{candidate.location}
                  </div>
                )}
              </div>
            </div>

            {/* About me */}
            {candidate?.about_me ? (
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-mute)",
                  display: "block",
                  marginBottom: 4,
                }}>
                  自己紹介
                </span>
                <p style={{
                  fontSize: 13,
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  {candidate.about_me}
                </p>
              </div>
            ) : (
              <div style={{
                marginBottom: 14,
                fontSize: 12,
                color: "var(--ink-mute)",
                fontStyle: "italic",
              }}>
                自己紹介は未設定です
              </div>
            )}

            {/* Candidate profile link */}
            {candidate?.id && (
              <div style={{
                paddingTop: 12,
                borderTop: "1px solid var(--line-soft)",
              }}>
                {/* ★画面を切り替えずに右から同じプロフィール欄を出す（2026-10-11。候補者を探すの右欄と同じ部品） */}
                <CandidateProfileDrawerButton userId={candidate.id} name={candidate.name ?? "候補者"} label="公開プロフィールを見る →" style={{ fontSize: 12 }} />
              </div>
            )}
          </div>

          {/* Participants list */}
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "var(--font-inter), var(--font-noto)",
              marginBottom: 12,
            }}>
              参加者 ({participants.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {participants.map((p) => {
                const roleLabel =
                  p.role === "candidate" ? "候補者" :
                  p.role === "company_admin" ? "HR" :
                  p.role;
                const isMe = p.user_id === ctx.currentOwnId;
                return (
                  <div key={p.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: isMe ? 600 : 400 }}>
                      {p.user?.name ?? "名前未設定"}
                      {isMe && (
                        <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 4 }}>
                          (自分)
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: p.role === "candidate" ? "var(--ink-soft)" : "var(--accent)",
                      background: p.role === "candidate" ? "var(--line-soft)" : "var(--royal-50)",
                      padding: "1px 7px",
                      borderRadius: 100,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      {roleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </BusinessLayout>
  );
}
