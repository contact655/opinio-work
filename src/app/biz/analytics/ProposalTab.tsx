import Link from "next/link";
import type { CompanyProposalStats } from "@/lib/evidence/companyProposals";

/**
 * ★/biz/analytics の「提案」タブ（2026-10-11）。集計は `companyProposalStats`（lib/evidence/companyProposals.ts）。
 *   紹介した人数 → 「話を聞いてみたい」と答えた人数 → 面談の人数、とその割合。
 * ⚠️★人数だけ。名前も内訳も出さない（誰に紹介したかを企業に見せない）。
 * ⚠️★1日1回の集計（今日の0時より前）。「毎朝更新」を消さないこと —— 数字がすぐ動かない理由になる。
 */
export function ProposalTab({ stats, periodLabel }: { stats: CompanyProposalStats | null; periodLabel: string }) {
  if (!stats) {
    return <p style={{ fontSize: 13, color: "var(--error)" }}>紹介の数字を取得できませんでした（0件という意味ではありません）。</p>;
  }
  const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 100));
  const steps = [
    { key: "introduced", label: "ご紹介した方", count: stats.introduced, rate: null as number | null, of: null as string | null },
    { key: "raised", label: "「話を聞いてみたい」と答えた方", count: stats.raised, rate: pct(stats.raised, stats.introduced), of: "ご紹介した方の" },
    { key: "meetings", label: "面談につながった方", count: stats.meetings, rate: pct(stats.meetings, stats.raised), of: "答えた方の" },
  ];
  const max = Math.max(1, stats.introduced);
  return (
    <div data-state="proposal-analytics">
      <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: "0 0 12px" }}>
        {periodLabel}・毎朝更新（今日の分は明日の朝に反映されます）。人数で数えています。誰にご紹介したかは表示しません。
      </p>
      {stats.introduced === 0 ? (
        <div data-state="proposal-analytics-empty" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          この期間にご紹介した方はまだいません。登録が増えるほど、合う方に貴社をご紹介しやすくなります。
          <Link href="/biz/proposals" style={{ color: "var(--royal)", fontWeight: 700, marginLeft: 6 }}>OPINIOからの紹介を見る →</Link>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((s, i) => (
            <div key={s.key} data-step={s.key}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.label}</span>
                {s.rate !== null && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{s.of}{s.rate}%</span>}
                <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{s.count}人</span>
              </div>
              <div style={{ height: 8, background: "var(--line-soft)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(s.count / max) * 100}%`, background: "var(--royal)", opacity: 1 - i * 0.2, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
