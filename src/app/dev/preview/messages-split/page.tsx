import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { MessagesView } from "@/app/biz/messages/MessagesView";
import { EmptyPane, PendingPane, ThreadPane } from "@/app/biz/messages/MessagePane";
import type { ConversationRow } from "@/app/biz/messages/page";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";
import type { CompanyThread, ThreadMessage } from "@/lib/conversations/companyThread";
import { proposalIntroLine } from "@/lib/constants/proposalResponses";

/**
 * ★メッセージの左右2画面（/biz/messages）（2026-10-11）。
 * ⚠️ 実データで踏めるのは「返事待ち」1件だけ。返信あり・興味あり・空はここで見る（本番のデータは作らない）。
 * ⚠️★この配下で DB を読まないこと。固定データだけ。
 * ⚠️ 下の入力欄は見た目の確認用。**送らないこと**（会話の id は架空なので送っても 404 になる）。
 * ⚠️ 左右に並ぶかはビューポートの幅で決まる（1280px 以上）。ブラウザ自体をリサイズして狭い形も見る。
 */
const daysAgo = (n: number, h = 0) => new Date(Date.now() - n * 24 * 60 * 60 * 1000 - h * 60 * 60 * 1000).toISOString();
const NOW = new Date().toISOString();
const quota: ApproachQuota = { monthlyUsed: 2, monthlyLimit: 10, openCount: 1, openLimit: 10 };

const conv = (id: string, name: string, extra: Partial<ConversationRow> = {}): ConversationRow => ({
  id, kind: "company", stage: "active", status: "active", last_message_at: daysAgo(0, 1), created_at: daysAgo(5),
  candidate: { id: `cu-${id}`, name, avatar_color: null, avatar_url: null }, isUnread: false, isParticipant: true, isNewReply: false, fromInterest: false,
  lastMessage: "ご連絡ありがとうございます。来週のどこかで30分ほどお話しできればと思います。", lastSender: "candidate", ...extra,
});
const pending: SentApproach = {
  id: "p1", createdAt: daysAgo(2), reason: "（検証）フィールドセールスとして長く法人営業をされてきた経験が、当社の営業体制づくりに活きると考えご連絡しました。",
  status: "pending", conversationId: null, body: null, acceptedAt: null, unseen: false, jobTitle: null,
  candidate: { id: "u-p1", name: "検証 花子", headline: null, avatarUrl: null, avatarColor: null, username: null }, senderName: "柴久人",
};
const convReplied = conv("c1", "検証 三郎", { lastMessage: "ご連絡ありがとうございます。来週のどこかで30分ほどお話しできればと思います。" });
const convInterest = conv("c2", "検証 八郎", { fromInterest: true, last_message_at: daysAgo(1), lastMessage: "（検証）御社の営業体制についてお話を伺いたいです。" });

const part = (id: string, role: string, name: string) => ({ id, role, user_id: `u-${id}`, user: { name } });
const me = part("pm", "company_admin", "柴久人");
const cand = (name: string) => part("pc", "candidate", name);
const msg = (id: string, body: string, p: ThreadMessage["participant"], at: string, kind = "text"): ThreadMessage =>
  ({ id, body, kind, payload: null, sent_at: at, sender_participant_id: p?.id ?? null, participant: p });

const base = (id: string, name: string, messages: ThreadMessage[], extra: Partial<CompanyThread> = {}): CompanyThread => ({
  conv: { id, kind: "company", stage: "active", status: "active", last_message_at: daysAgo(0), created_at: daysAgo(5) },
  candidate: { id: `cu-${id}`, name, about_me: null, location: "東京都", avatar_color: null },
  participants: [me, cand(name)], isParticipant: true, canReply: true, sendBlocked: null, messages, messagesFailed: false,
  approachFirst: null, replyNote: null, companyAdmins: [], schedulingUrl: null, meetingState: null, ...extra,
});

const REASON = "（検証）カスタマーサクセスの立ち上げ経験について、直接お話を伺いたいと考えました。";
const repliedThread = base("c1", "検証 三郎", [
  msg("m1", `【送った理由】\n${REASON}`, me, daysAgo(3)),
  msg("m2", "ご連絡ありがとうございます。ちょうど次のキャリアを考えていたところでした。来週のどこかで30分ほどお話しできればと思います。", cand("検証 三郎"), daysAgo(1)),
  msg("m3", "ありがとうございます。では水曜の15時はいかがでしょうか。", me, daysAgo(0, 1)),
], { approachFirst: { messageId: "m1", reason: REASON, body: null }, replyNote: { messageId: "m2", text: "返信がありました" } });
const interestThread = base("c2", "検証 八郎", [
  msg("i0", proposalIntroLine("検証 八郎"), null, daysAgo(1, 2), "proposal_intro"),
  msg("i1", "（検証）御社の営業体制についてお話を伺いたいです。", cand("検証 八郎"), daysAgo(1)),
]);

export default function Page() {
  devOnly();
  const L = "/dev/preview/messages-split";
  return (
    <div>
      <PreviewHeader title="メッセージの左右2画面（/biz/messages）">
        <p>実データで踏めるのは返事待ちだけ。返信あり・興味あり・空の右側をここで見る。⚠️ 入力欄から送らないこと。</p>
      </PreviewHeader>
      <Variant label="返信あり" note="自社は右寄せの薄い青、相手は左寄せの白。各吹き出しの上に「名前・日時」。下に入力欄（既存の ReplyForm）">
        <MessagesView autoSelect={false} linkBase={L} now={NOW} allowed conversations={[convReplied, convInterest]} sent={[pending]} quota={quota}
          selectedKey="c:c1" pane={<ThreadPane thread={repliedThread} meta="社会人6年・CSM・検証株式会社・東京都" backHref={L} myOwUserId="u-pm" />} />
      </Variant>
      <Variant label="貴社に興味があります" note="最初に中央の灰色の案内（proposal_intro）。一覧の3行目に「貴社に興味があります」">
        <MessagesView autoSelect={false} linkBase={L} now={NOW} allowed conversations={[convReplied, convInterest]} sent={[pending]} quota={quota}
          selectedKey="c:c2" pane={<ThreadPane thread={interestThread} meta="社会人4年・IS・検証株式会社・大阪府" backHref={L} myOwUserId="u-pm" />} />
      </Variant>
      <Variant label="返事待ち" note="入力欄を出さず、下に中央の灰色「返信を待っています（あと〇日）」「返信が来るまで、続けては送れません」">
        <MessagesView autoSelect={false} linkBase={L} now={NOW} allowed conversations={[convReplied]} sent={[pending]} quota={quota}
          selectedKey="s:p1" pane={<PendingPane sent={pending} meta="社会人8年・AE・検証株式会社・東京都" backHref={L} now={new Date()} />} />
      </Variant>
      <Variant label="空（未読タブで0件）" note="右側に「まだメッセージはありません」と「候補者を探して送る」">
        <MessagesView autoSelect={false} linkBase={L} now={NOW} allowed initialTab="unread" conversations={[convReplied]} sent={[]} quota={quota}
          emptyPane={<EmptyPane canSend />} />
      </Variant>
    </div>
  );
}
