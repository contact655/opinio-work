import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import ConversationsClient from "@/app/(jobseeker)/mypage/conversations/ConversationsClient";
import type { IncomingApproachView } from "@/components/approaches/incomingApproachView";

/**
 * ★求職者のメッセージ（/mypage/conversations）の「未返信」を開いたところ（2026-10-11 / モックとの照合用）。
 * ⚠️ DB は読まない（固定データ）。実データでは、受け取る設定がオンで企業から届いている検証用アカウントが揃わないので、ここで見る。
 * ⚠️★「送信」「今回は見送る」「ブロック」「運営に報告」を押さないこと（固定の id は実在しないので 404 で止まるが、押す理由が無い）。
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const approach: IncomingApproachView = {
  id: "00000000-0000-0000-0000-000000000001",
  createdAt: daysAgo(2),
  reason: "インサイドセールスとして SaaS の新規開拓に取り組まれてきた経歴を拝見しました。当社の法人開拓チームの立ち上げについてお話を伺いたいです。",
  body: "ご都合のよいときに、30分ほどオンラインでお話しできればうれしいです。",
  senderName: "検証 一郎",
  senderRole: "人事部 採用担当",
  companyName: "株式会社検証",
  companyHref: "/companies",
  isOwnCompany: false,
  logoUrl: null,
  logoLetter: "検",
  logoGradient: null,
  job: { title: "インサイドセールス（IT・SaaS 領域の法人開拓）", href: "/jobs" },
};

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="メッセージ（/mypage/conversations）">
        <p>一覧の行（企業ロゴ・企業名・日付・「まだ返信していません」）を押すと、右に開く（狭い画面ではその場で開く）。一番下に「企業からのメッセージを受け取る：受け取る　設定を変える」。</p>
      </PreviewHeader>
      <Variant label="企業から1件・受け取る" note="行を押して開いたところを見る">
        <ConversationsClient initialConversations={[]} initialRequests={[]} initialApproaches={[approach]} initialTab="unreplied" acceptApproaches />
      </Variant>
    </div>
  );
}
