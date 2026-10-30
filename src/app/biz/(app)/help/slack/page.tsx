import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";

export const metadata = {
  title: { absolute: "Slack の設定方法 | OPINIO Business" },
};

/**
 * ★Slack の Incoming Webhook の発行手順（2026-10-12）。「メンバーと権限」の Slack 通知の欄からリンクする。
 * ⚠️ Slack 側の画面名は Slack の表示に合わせる（変わったら直す）。
 */
export default async function SlackHelpPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  const li: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.9, color: "var(--ink)", marginBottom: 4 };
  return (
    <BusinessLayout userName={ctx.userName} tenantName={ctx.tenantName} tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter} memberships={ctx.allCompanies} currentTenantId={ctx.tenantId}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, maxWidth: 880 }}>
        <div>
          <Link href="/biz/members" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>← メンバーと権限に戻る</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "8px 0 0" }}>Slack の設定方法</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
            Slack の「Incoming Webhook」の URL を OPINIO に登録すると、返信・面談の申込・応募があったときに、指定したチャンネルにお知らせが届きます。
          </p>
        </div>
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Webhook の URL を発行する（5分ほど）</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li style={li}>通知を受け取るチャンネルを用意します。<strong>人事の担当者だけが入っているチャンネル</strong>にしてください。</li>
            <li style={li}>ブラウザで <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)" }}>api.slack.com/apps</a> を開き、「Create New App」→「From scratch」を選びます。アプリ名（例：OPINIO 通知）とワークスペースを選んで作成します。</li>
            <li style={li}>左のメニューの「Incoming Webhooks」を開き、「Activate Incoming Webhooks」をオンにします。</li>
            <li style={li}>下の「Add New Webhook to Workspace」を押し、手順1のチャンネルを選んで「許可する」を押します。</li>
            <li style={li}>表示された「Webhook URL」（<code>https://hooks.slack.com/services/…</code>）をコピーします。</li>
            <li style={li}>OPINIO の「メンバーと権限」→「Slack 通知」に貼り付けて保存し、「テスト送信」を押します。チャンネルにテストのお知らせが届けば完了です。</li>
          </ol>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-mute)" }}>
            ワークスペースの設定によっては、アプリの追加に Slack の管理者の承認が要ります。その場合は社内の Slack 管理者に依頼してください。
          </p>
        </section>
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>届く内容</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>「新しい返信が1件あります」「面談の申込が1件あります」「応募が1件あります」と、OPINIO の該当画面へのリンクだけです。</li>
            <li style={li}>メッセージの本文や連絡先は送りません。候補者の名前は「候補者の名前を通知に含める」をオンにしたときだけ入ります。</li>
            <li style={li}>同じ件が30分以内に続いたときは、最初の1件だけお知らせします（続きは OPINIO で確認できます）。</li>
            <li style={li}>Webhook の URL が使えなくなる（チャンネルの削除・アプリの削除など）と、設定の欄に「通知が届いていません」と出ます。3回続けて届かなかったときは自動で止まります。URL を登録し直すか、テスト送信が届けば再開します。</li>
          </ul>
        </section>
      </div>
    </BusinessLayout>
  );
}
