import Link from "next/link";

/**
 * ★声かけ1通の見た目（2026-10-10 / 候補者探し 段4）。**求職者に届く画面と、企業の「〇〇さんにはこう見えます」が同じ部品。**
 * ⚠️★片方だけ書き換えないこと（見え方のプレビューが嘘になる）。答えるボタンは呼び出し側が下に置く。
 * ⚠️ 関連する求人は、公開中のときだけ href がある（下ろされた求人は名前だけ出す）。
 */
export type ApproachLetterProps = {
  companyName: string;
  companyHref: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  senderName: string | null;
  dateText: string;
  reason: string;
  body: string | null;
  job: { title: string; href: string | null } | null;
  /** プレビューのとき、まだ入力されていない欄に出す薄い文字 */
  placeholder?: { reason: string };
};

export function ApproachLetter(p: ApproachLetterProps) {
  const reasonEmpty = !p.reason.trim();
  return (
    <div data-state="approach-letter">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", border: "1px solid var(--line)", background: "#fff", flexShrink: 0 }} />
        ) : (
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: p.logoGradient ?? "var(--royal)", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
            {p.logoLetter ?? p.companyName.charAt(0)}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {p.companyHref
            ? <Link href={p.companyHref} style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textDecoration: "none", overflowWrap: "anywhere" }}>{p.companyName}</Link>
            : <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{p.companyName}</span>}
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
            {p.senderName ? `${p.senderName} さんから · ` : ""}{p.dateText}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>あなたに声をかけた理由</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: reasonEmpty ? "var(--ink-mute)" : "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {reasonEmpty ? (p.placeholder?.reason ?? "") : p.reason}
        </p>
      </div>
      {p.body && p.body.trim() && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>メッセージ</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.body}</p>
        </div>
      )}
      {p.job && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>関連する求人</div>
          {p.job.href
            ? <Link href={p.job.href} style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", textDecoration: "none", overflowWrap: "anywhere" }}>{p.job.title}</Link>
            : <span style={{ fontSize: 14, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{p.job.title}（掲載を終了しました）</span>}
        </div>
      )}
    </div>
  );
}
