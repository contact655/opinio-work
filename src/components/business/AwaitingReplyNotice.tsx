import Link from "next/link";
import type { AwaitingReply } from "@/lib/interest/server";

/**
 * ★「あなたの返事を待っている人」（2026-10-27 / 話を聞きたい人 フェーズ1a）。/biz/messages の「すべて」タブの上部にだけ出す
 *   （/biz のホームには出さない。「対応が必要なもの」と重なるため / 柴さんの指示）。
 *   「話を聞いてみたい」で名前とプロフィールが届いたのに、まだ担当者が1通も送っていない人数。
 * ⚠️ 数え方は lib/interest/server.ts の countAwaitingReply だけ（検証用の企業には検証用の人だけを数える）。
 * ⚠️ 0人なら何も出さない。取れなかったときも出さない（ここは案内で、0人と言い切る場所ではない）。
 * ⚠️ 「返事待ち」タブ（企業から送って相手の返事を待っているもの）とは**向きが逆**。文言で取り違えないこと。
 */
export function AwaitingReplyNotice({ data, linkBase = "/biz/messages", now }: { data: AwaitingReply | null; linkBase?: string; /** サーバーの時刻（クライアントで Date.now() を使うとハイドレーションがずれうる） */ now: string }) {
  if (!data || data.count === 0) return null;
  const days = data.oldestAt ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(data.oldestAt)) / 86_400_000)) : null;
  return (
    <div data-state="awaiting-reply" style={{
      display: "flex", alignItems: "center", gap: "4px 12px", flexWrap: "wrap",
      padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", background: "var(--royal-50)", fontSize: 13, color: "var(--ink)",
    }}>
      <span>
        「話を聞いてみたい」と届いて、<strong>あなたの返事を待っている人</strong>が
        <strong data-state="awaiting-reply-count" style={{ margin: "0 2px" }}>{data.count}</strong>人います
        {days != null && <span style={{ color: "var(--ink-soft)" }}>（いちばん前は{days === 0 ? "今日" : `${days}日前`}）</span>}
      </span>
      {data.oldestConversationId && (
        <Link href={`${linkBase}?show=${data.oldestConversationId}`} data-state="awaiting-reply-open"
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
          いちばん前の人を開く →
        </Link>
      )}
    </div>
  );
}
