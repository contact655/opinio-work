import Link from "next/link";
import { OwnCompanyNote } from "@/components/companies/OwnCompanyNote";

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
  /** ★送った担当者の役職（2026-10-11）。「〇〇（役職）から・日付」 */
  senderRole?: string | null;
  dateText: string;
  reason: string;
  body: string | null;
  /** note … href が無くても掲載中のとき（検証用の求人を検証用の人が見ている）に添える一言。無ければ「掲載を終了しました」 */
  job: { title: string; href: string | null; note?: string | null } | null;
  /** ★運営会社か（2026-10-10）。true なら「この会社は OPINIO の運営会社です。」を出す（求職者側と企業のプレビューで同じ） */
  isOwnCompany?: boolean;
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
          {/* ★「〇〇（役職）から・日付」（2026-10-11 / モックに合わせた） */}
          <div data-state="letter-from" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
            {p.senderName ? `${p.senderName}${p.senderRole ? `（${p.senderRole}）` : ""}から・` : ""}{p.dateText}
          </div>
          {p.companyHref && (
            <Link href={p.companyHref} data-state="letter-company-link" style={{ display: "inline-block", marginTop: 2, fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>企業ページを見る</Link>
          )}
          {p.isOwnCompany && <OwnCompanyNote style={{ marginTop: 2 }} />}
        </div>
      </div>

      {/* ★理由と本文を1つの箱に、見出しなしで（2026-10-12 / 柴さんの指示。返信後の会話の1通目と同じ並び）。
            「あなたに送った理由」「メッセージ」の見出しは出さない。理由と本文のあいだは空行1つ */}
      <div data-state="letter-reason" style={{ marginTop: 12, background: "var(--bg-tint, #f6f7f9)", borderRadius: 10, padding: "12px 14px" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: reasonEmpty ? "var(--ink-mute)" : "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {reasonEmpty ? (p.placeholder?.reason ?? "") : p.reason}
        </p>
        {p.body && p.body.trim() && (
          <p data-state="letter-body" style={{ margin: "1.8em 0 0", fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.body}</p>
        )}
      </div>
      {p.job && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>関連する求人</div>
          {p.job.href
            ? <Link href={p.job.href} style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", textDecoration: "none", overflowWrap: "anywhere" }}>{p.job.title}</Link>
            : p.job.note
              ? <span style={{ fontSize: 14, color: "var(--ink)", overflowWrap: "anywhere" }}>{p.job.title}<span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 6 }}>{p.job.note}</span></span>
              : <span style={{ fontSize: 14, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{p.job.title}（掲載を終了しました）</span>}
        </div>
      )}
    </div>
  );
}
