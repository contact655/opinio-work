import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";

/**
 * 「あなたに合いそうな募集・企業」— `/mypage/applications` の末尾に出す。
 *
 * ⚠️★**マッチ度%・星評価を出さない**（Hisato 思想⑦「数値データ撤廃」）。
 *    出すのは**なぜ選ばれたかの文**だけ。数字は求職者に判断を委ねる形にならない。
 *
 * ⚠️★**出せるものが無ければセクションごと描かない。**「該当なし」も出さない
 *    （`IndustryMatchSection` と同じ扱い）。枠だけ出すと壊れているように見える。
 *
 * ⚠️★**根拠を必ず添える。** 求人は「登録した希望条件」から、企業は「職歴」から出ており、
 *    出どころが違う。どちらも見出しの下に一言で書く。書かないと
 *    「なぜこれが出たのか」が本人に分からない。
 *
 * ⚠️ 企業は `/mypage` の右カラム（`IndustryMatchSection`）と**同じ出どころ**
 *    （`fetchIndustryMatchBlocks`）。会社の推薦ロジックを2つ持つと片方だけ直る形の
 *    食い違いが生まれるので、**意図的に共有している**。見せ方だけ違う。
 */

export type SuggestedJob = {
  id: string;
  slug: string | null;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyUrl: string | null;
  /** なぜ選ばれたか。⚠️ `computeRecommendations` が作る。ここで書き足さない */
  reasonText: string;
};

export type SuggestedCompany = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  /** ⚠️ `industryMatchReason()` が作る。会社ごとに手書きしない */
  reason: string;
};

export function SuggestionsSection({
  jobs,
  companies,
}: {
  jobs: SuggestedJob[];
  companies: SuggestedCompany[];
}) {
  if (jobs.length === 0 && companies.length === 0) return null;

  return (
    <div style={{ marginTop: 32, display: "grid", gap: 16 }}>
      {jobs.length > 0 && (
        <section style={CARD}>
          <h2 style={HEADING}>あなたに合いそうな募集</h2>
          <p style={NOTE}>あなたが登録した希望条件から選んでいます</p>
          <ul style={LIST}>
            {jobs.map((j) => (
              <li key={j.id} style={ITEM}>
                <CompanyLogo
                  name={j.companyName}
                  logoUrl={j.companyLogoUrl}
                  companyUrl={j.companyUrl}
                  size="sm"
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/jobs/${j.slug ?? j.id}`} style={TITLE_LINK}>
                    {j.title}
                  </Link>
                  <p style={SUB}>{j.companyName}</p>
                  <p style={REASON}>{j.reasonText}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/jobs" style={MORE}>募集をもっと見る →</Link>
        </section>
      )}

      {companies.length > 0 && (
        <section style={CARD}>
          <h2 style={HEADING}>あなたに合いそうな企業</h2>
          <p style={NOTE}>あなたの職歴にある業界から選んでいます</p>
          <ul style={LIST}>
            {companies.map((c) => (
              <li key={c.id} style={ITEM}>
                <CompanyLogo
                  name={c.name}
                  logoUrl={c.logoUrl}
                  logoLetter={c.logoLetter}
                  logoGradient={c.logoGradient}
                  size="sm"
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={`/companies/${c.slug ?? c.id}`} style={TITLE_LINK}>
                    {c.name}
                  </Link>
                  {/* ⚠️ タグラインが無ければ行ごと出さない（「—」で埋めない） */}
                  {c.tagline && <p style={SUB}>{c.tagline}</p>}
                  <p style={REASON}>{c.reason}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/companies" style={MORE}>企業をもっと見る →</Link>
        </section>
      )}
    </div>
  );
}

/* ⚠️ レスポンシブで変える値（fontSize / padding / display / flexDirection / width）は
      インラインに書かない —— という規則の対象外。ここはブレークポイントで変えない。
      （`.claude/rules/ui-debugging.md`「インラインstyle と CSS の優先順位」） */
const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "16px 18px",
};

const HEADING: React.CSSProperties = {
  margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.6,
};

const NOTE: React.CSSProperties = {
  margin: "3px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6,
};

const LIST: React.CSSProperties = {
  listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 12,
};

/* ⚠️★`minWidth: 0` を子に置く（親の grid/flex は既定が `min-width: auto` で、
      中身の min-content より小さくならない）。無いと長い社名で枠からはみ出す。 */
const ITEM: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0,
};

const TITLE_LINK: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none",
  display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const SUB: React.CSSProperties = {
  margin: "2px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const REASON: React.CSSProperties = {
  margin: "4px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
};

const MORE: React.CSSProperties = {
  display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 600,
  color: "var(--royal)", textDecoration: "none",
};
