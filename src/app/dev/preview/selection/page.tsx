import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { SelectionView } from "@/app/biz/meetings/SelectionView";
import type { MeetingApplication } from "@/lib/business/mockMeetings";
import type { BizApplication } from "@/lib/business/applications";
import type { HistoryItem } from "@/lib/business/selectionHistory";

/**
 * ★選考管理（/biz/meetings）の左右2画面（2026-10-11）。
 * ⚠️ 本番は ow_casual_meetings・ow_job_applications とも 0行（2026-10-11 実測）。中身のある状態はここでしか見られない。
 * ⚠️★DB は読まない。右側の状態の変更・担当・メモ・採用確定は API を叩くので、この画面では**押さないこと**（id は架空なので失敗する）。
 */
const now = Date.now();
const ago = (d: number, h = 0) => new Date(now - d * 86400000 - h * 3600000).toISOString();
const NOW = new Date(now).toISOString();

const meeting = (id: string, over: Partial<MeetingApplication>): MeetingApplication => ({
  id, applicantUserId: `u-${id}`, conversationId: undefined, applicantName: "検証 花子", applicantInitial: "検", applicantGradient: "linear-gradient(135deg,#6b7280,#475569)",
  applicantAge: "—", applicantCurrentCompany: "検証株式会社", applicantCurrentRole: "アカウントエグゼクティブ",
  jobTitle: null, jobSalary: null, intent: "良い機会があれば", intentDetail: "", interestReason: "（検証）営業の体制づくりに関心があります。",
  questions: "（検証）チームの構成を伺いたいです。", preferredFormat: "オンライン", submittedAt: "2日前", createdAt: ago(2), status: "pending",
  isUnread: true, assigneeId: null, assigneeName: null, assigneeInitial: null, assigneeGradient: null, companyMemo: "", career: [], ...over,
});
const app = (id: string, over: Partial<BizApplication>): BizApplication => ({
  id, jobId: "j1", jobTitle: "エンタープライズ営業", userId: `u-${id}`, name: "検証 次郎", email: null, phone: null,
  message: "（検証）御社の営業組織で経験を活かしたいと考えています。", status: "reviewing", createdAt: ago(1), appliedAtLabel: "1日前", ...over,
});

const MEETINGS: MeetingApplication[] = [
  meeting("m1", { applicantUserId: "u-dup", applicantName: "検証 重複", jobTitle: "インサイドセールス", conversationId: "c-dup", createdAt: ago(0, 2) }),
  meeting("m2", { status: "scheduled", isUnread: false, applicantName: "検証 三郎", createdAt: ago(4) }),
  meeting("m3", { status: "completed", isUnread: false, applicantName: "検証 四郎", createdAt: ago(20) }),
];
const APPS: BizApplication[] = [
  app("a1", { userId: "u-dup", name: "検証 重複", jobTitle: "エンタープライズ営業", createdAt: ago(40), status: "rejected", conversationId: "c-dup" }),
  app("a2", { name: "検証 五郎", jobTitle: "カスタマーサクセス", createdAt: ago(1), status: "pending" }),
];
const DUP_HISTORY: HistoryItem[] = [
  { key: "m:m1", at: ago(0, 2), kind: "meeting_request", title: "カジュアル面談の申込：インサイドセールス", sub: "新規受信" },
  { key: "s:x", at: ago(25), kind: "approach_sent", title: "メッセージを送信（柴久人）", sub: "返信はありませんでした" },
  { key: "a:a1", at: ago(40), kind: "application", title: "応募：エンタープライズ営業", sub: "不採用" },
];
const FIXTURES: Record<string, { meta: string | null; history: HistoryItem[] }> = {
  "u-dup": { meta: "社会人7年・IS・検証株式会社・東京都", history: DUP_HISTORY },
  "u-m2": { meta: "社会人5年・AE・検証商事・大阪府", history: [{ key: "m:m2", at: ago(4), kind: "meeting_request", title: "カジュアル面談の申込：ポジション指定なし", sub: "面談予定" }] },
  "u-a2": { meta: "社会人3年・CS・検証テック・東京都", history: [{ key: "a:a2", at: ago(1), kind: "application", title: "応募：カスタマーサクセス", sub: "新着" }] },
};

export default function Page() {
  devOnly();
  const L = "/dev/preview/selection";
  return (
    <div>
      <PreviewHeader title="選考管理の左右2画面（/biz/meetings）">
        <p>本番は申込・応募とも0件。⚠️ 右側の操作（状態の変更・担当・メモ・採用確定）は押さないこと。</p>
      </PreviewHeader>
      <Variant label="カジュアル面談（同じ人が過去にも応募している）" note="一覧の3行目に「ほかにも1件」。右に「この会社とのこれまで」（応募・送ったメッセージ・面談の申込が時系列）">
        <SelectionView autoSelect={false} linkBase={L} now={NOW} meetings={MEETINGS} applications={APPS} currentUser={{ owUserId: "me", name: "柴久人", initial: "柴", gradient: "" }}
          initialShow="m:m1" fixtures={FIXTURES} />
      </Variant>
      <Variant label="選考・応募" note="上の段に「応募・カスタマーサクセス・受付日」。中身は今の応募の詳細（状態の変更）。メッセージが無いときは灰色の一文">
        <SelectionView autoSelect={false} linkBase={L} now={NOW} meetings={MEETINGS} applications={APPS} currentUser={{ owUserId: "me", name: "柴久人", initial: "柴", gradient: "" }}
          initialTab="applications" initialShow="a:a2" fixtures={FIXTURES} />
      </Variant>
      <Variant label="空（0件）" note="本番の今の状態。左にこれまでと同じ空の案内">
        <SelectionView autoSelect={false} linkBase={L} now={NOW} meetings={[]} applications={[]} currentUser={{ owUserId: "me", name: "柴久人", initial: "柴", gradient: "" }} />
      </Variant>
    </div>
  );
}
