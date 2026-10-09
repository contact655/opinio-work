import Link from "next/link";

/**
 * ★/mypage のホーム最上部の「届いているもの」（2026-10-09）。
 *
 * 提案とメッセージのお願いを、件数と一行の説明つきで並べる。⚠️ **0件のときはカードごと出さない。**
 * ⚠️ 件数は `lib/mypage/navBadges.ts` の数え方（ナビの数字と同じ）。ここで数え直さない。
 * ⚠️ 説明文は「提案」と「お願い」の違いを伝えるためのもの。どちらも**相手側の対応を待つ**状態ではなく、
 *    **本人が答える番**のものだけを数えている。
 * ⚠️ 提案が取得失敗（null）のときは行ごと出さない（0 と書くと「無い」と嘘になる）。
 */
export function InboxCard({ proposals, messageRequests, approaches = null }: { proposals: number | null; messageRequests: number; approaches?: number | null }) {
  const rows = [
    proposals !== null && proposals > 0 && {
      key: "proposals",
      label: "提案",
      count: proposals,
      text: "OPINIO が根拠をそろえてお届けしている企業との出会い",
      href: "/mypage/proposals",
    },
    messageRequests > 0 && {
      key: "requests",
      label: "メッセージのお願い",
      count: messageRequests,
      text: "承認すると内容を読めて、やり取りを始められます",
      href: "/mypage/conversations#requests",
    },
    /* ★企業からの声かけ（2026-10-09）。⚠️ 提案（OPINIO が根拠をそろえる）・お願い（個人から）と
          区別がつく説明にする。取得に失敗（null）したら行ごと出さない */
    approaches !== null && approaches > 0 && {
      key: "approaches",
      label: "企業からの声かけ",
      count: approaches,
      text: "企業があなたの経歴を見て、理由を添えて連絡してきています",
      href: "/mypage/approaches",
    },
  ].filter(Boolean) as { key: string; label: string; count: number; text: string; href: string }[];

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="届いているもの"
      data-state="mypage-inbox"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>届いているもの</h2>
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
                {r.label}
                <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>{r.count}件</span>
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
