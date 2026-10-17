import Link from "next/link";
import { PrivateNote } from "@/components/mypage/PrivateNote";

/**
 * ★/mypage のホーム最上部の「届いているもの」（2026-10-09）。
 *
 * 提案と未返信のメッセージ（企業から・個人から）を、件数と一行の説明つきで並べる。⚠️ **0件のときはカードごと出さない。**
 * ⚠️ 件数は `lib/mypage/navBadges.ts` の数え方（ナビの数字と同じ）。ここで数え直さない。
 * ⚠️ 説明文は「提案」と「お願い」の違いを伝えるためのもの。どちらも**相手側の対応を待つ**状態ではなく、
 *    **本人が答える番**のものだけを数えている。
 * ⚠️ 提案が取得失敗（null）のときは行ごと出さない（0 と書くと「無い」と嘘になる）。
 */
export function InboxCard({ proposals, messageRequests, approaches = null }: { proposals: number | null; messageRequests: number; approaches?: number | null }) {
  const rows = [
    proposals !== null && proposals > 0 && {
      key: "proposals",
      label: "あなたに合いそうな会社",
      count: proposals,
      text: "OPINIO が根拠をそろえてお届けしている企業との出会い",
      href: "/mypage/proposals",
    },
    /* ★企業から・個人からの最初のメッセージは「未返信のメッセージ」1行にまとめた（2026-10-11 / 柴さんの指示。
          「メッセージリクエスト」を「メッセージ」にまとめた）。⚠️ 企業からの件数が取れない（null）ときは個人からだけ数える */
    messageRequests + (approaches ?? 0) > 0 && {
      key: "unreplied",
      label: "未返信のメッセージ",
      count: messageRequests + (approaches ?? 0),
      text: "企業や個人から届いた最初のメッセージです。返信すると、そのままやり取りが始まります",
      href: "/mypage/conversations?tab=unreplied",
    },
  ].filter(Boolean) as { key: string; label: string; from?: string; count: number; text: string; href: string }[];

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="届いているもの"
      data-state="mypage-inbox"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}
    >
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>届いているもの</h2>
      <div style={{ margin: "2px 0 6px" }}><PrivateNote /></div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((r, i) => (
          <Link
            key={r.key}
            href={r.href}
            data-inbox-row={r.key}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
              textDecoration: "none", color: "inherit", minHeight: 44,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {r.from && <FromTag label={r.from} />}
                {r.label}
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)", whiteSpace: "nowrap" }}>{r.count}件</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.6 }}>{r.text}</div>
            </div>
            <span aria-hidden="true" style={{ color: "var(--royal)", fontSize: 14, flexShrink: 0 }}>→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** ★「企業から」「個人から」の印（2026-10-11）。/mypage/conversations の欄でも同じ形を使う */
export function FromTag({ label }: { label: string }) {
  return (
    <span data-from-tag={label} style={{ display: "inline-block", flexShrink: 0, whiteSpace: "nowrap", marginRight: 6, padding: "1px 7px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg-tint, #f6f7f9)", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", verticalAlign: "1px" }}>
      {label}
    </span>
  );
}
