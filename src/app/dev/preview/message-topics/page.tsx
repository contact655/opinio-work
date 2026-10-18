import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { FirstMessageComposer, FirstMessageCard, FirstMessageRow, type FirstMessageSender } from "@/components/messages/FirstMessage";
import { topicsFor } from "@/lib/constants/messageTopics";

/**
 * ★最初の1通（テーマ＋一言）の見本（2026-10-17 / docs/messaging-unification-20261017.md の段階1）。
 * ⚠️ DB は読まない。送信の API はまだ無いので「送る」は押せない（onSend を渡していない）。
 * ⚠️ テーマの出し分けは topicsFor() をそのまま呼んでいる（見本用に条件を書き写さない）。
 */
const person: FirstMessageSender = { name: "検証 花子", companyName: "株式会社検証", role: "インサイドセールス", isRecruiter: false };
const recruiter: FirstMessageSender = { name: "検証 一郎", companyName: "株式会社検証", role: "人事部 採用担当", isRecruiter: true };
const noCompany: FirstMessageSender = { name: "検証 三郎", companyName: null, role: null, isRecruiter: false };

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="最初の1通（テーマ＋ひとこと）">
        <p>
          聞きたいことをテーマから1つ選び、ひとこと（100字まで）を添えて送る。受け取った人は返信するとそのまま会話になる（受け入れるボタンは無い）。
          テーマは送り主と相手の関係で出し分ける。★個人どうしの DM の書く画面は本番でもこの部品（2026-10-17）。採用のこと（企業担当者）と企業宛ては段階2・3で、まだ見本だけ。ここでは送信できない。
        </p>
      </PreviewHeader>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "8px 0 12px" }}>書く画面</h2>
      <Variant label="個人 → 個人（相手の現職が分かる）" note="「〈社名〉のこと」と「キャリアのこと」が出る。採用のことは出ない">
        <FirstMessageComposer recipientName="木村 雅樹" recipientLine="Salesforce ／ アカウントエグゼクティブ" sample
          sections={topicsFor({ recipient: { kind: "person", currentCompanyName: "Salesforce", hasCurrentCompany: true }, senderIsRecruiter: false })} />
      </Variant>
      <Variant label="個人 → 個人（現職が自由入力で社名を出せない）" note="見出しが「いまの会社のこと」になる">
        <FirstMessageComposer recipientName="検証 四郎" recipientLine="営業" sample
          sections={topicsFor({ recipient: { kind: "person", currentCompanyName: null, hasCurrentCompany: true }, senderIsRecruiter: false })} />
      </Variant>
      <Variant label="個人 → 個人（現職なし）" note="キャリアのことだけ">
        <FirstMessageComposer recipientName="検証 五郎" recipientLine={null} sample
          sections={topicsFor({ recipient: { kind: "person", currentCompanyName: null, hasCurrentCompany: false }, senderIsRecruiter: false })} />
      </Variant>
      <Variant label="企業担当者 → 個人" note="いちばん上に「採用のこと」。担当者もキャリアや会社の話を選べる（送り主は人）">
        <FirstMessageComposer recipientName="木村 雅樹" recipientLine="Salesforce ／ アカウントエグゼクティブ" sample
          sections={topicsFor({ recipient: { kind: "person", currentCompanyName: "Salesforce", hasCurrentCompany: true }, senderIsRecruiter: true })} />
      </Variant>
      <Variant label="個人 → 企業（企業ページから）" note="「この会社で働くこと」と「〈社名〉のこと」。キャリアのことは出さない">
        <FirstMessageComposer recipientName="株式会社SmartHR" recipientLine="担当者はまだいません。登録した時点で届きます" sample
          sections={topicsFor({ recipient: { kind: "company", companyName: "SmartHR" }, senderIsRecruiter: false })} />
      </Variant>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px" }}>受け取った側</h2>
      <Variant label="個人から（キャリアの相談）" note="送り主の名前と所属・聞きたいこと・ひとこと・返信欄。「今回は見送る」は相手に伝わらない">
        <FirstMessageCard sender={person} topic="career_manager" format="online_30" note="来年マネージャーになる予定で、最初の1年のことを伺いたいです。" dateText="10月17日" sample />
      </Variant>
      <Variant label="企業担当者から（採用のこと）" note="採用のテーマのときだけ「企業から」の印">
        <FirstMessageCard sender={recruiter} topic="hiring_casual" note="インサイドセールスの立ち上げ経験を拝見しました。一度カジュアルにお話しできませんか。" dateText="10月17日" sample />
      </Variant>
      <Variant label="企業担当者から（キャリアの話）" note="担当者でも採用以外のテーマなら「個人から」">
        <FirstMessageCard sender={recruiter} topic="career_foreign" note="外資から日系に移ったときのことを伺いたいです。" dateText="10月16日" sample />
      </Variant>
      <Variant label="所属が無い人から・ひとことが100字ちょうど" note="所属の行が出ない／長い文が折り返す">
        <FirstMessageCard sender={noCompany} topic="company_culture" dateText="10月15日" sample
          note={"御社の社風について伺いたいです。".repeat(6).slice(0, 100)} />
      </Variant>

      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 12px" }}>受信箱の一覧（未返信）</h2>
      <Variant label="企業から・個人からが混ざる" note="印で見分ける。テーマが先頭、ひとことは1行で切る">
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <FirstMessageRow sender={recruiter} topic="hiring_position" note="フィールドセールスのポジションをご紹介させてください。経歴を拝見して、ぜひお話ししたいと思いました。" dateText="10/17" unread />
          <FirstMessageRow sender={person} topic="career_manager" format="online_30" note="来年マネージャーになる予定で、最初の1年のことを伺いたいです。" dateText="10/17" unread />
          <FirstMessageRow sender={noCompany} topic="company_workstyle" note="リモートの比率を伺いたいです。" dateText="10/15" unread={false} />
        </div>
      </Variant>
    </div>
  );
}
