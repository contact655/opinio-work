import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import {
  industryMatchHeading,
  industryMatchReason,
  type IndustryMatchBlock,
} from "@/lib/companies/industryMatch";

/**
 * 「◯◯の経験が活きる会社」— `/mypage` の右カラムに出す。
 *
 * ⚠️★**ログイン中の本人にしか出ない。** `/search` にも `/companies` にも混ぜない。
 *
 * ⚠️★**1ブロックも無ければ、セクションごと何も描かない。**
 *    「該当なし」も出さない。出せる中身が無いのに枠だけ出すと、
 *    「機能が壊れている」ように見える（`/dev/preview` の0件表示とは目的が違う）。
 *
 * ⚠️ 出すのは対象業界が `vertical` の企業だけ。`horizontal`（業界を問わない）や
 *    `consumer`（消費者向け）は**混ぜない**。混ぜると見出しが嘘になる。
 *
 * ⚠️★**見出しに「業界」を足さないこと。** 文言は `industryMatchHeading()` から出す
 *    （`公共・団体業界` `その他サービス業界` が不自然になる。全22件で確認済み）。
 */
export function IndustryMatchSection({ blocks }: { blocks: IndustryMatchBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {blocks.map((b) => (
        <section
          key={b.industryId}
          style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          <h2 style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.6,
          }}>
            {industryMatchHeading(b.industryName)}
          </h2>
          {/* ⚠️ 年数は**マージしてから年単位に丸めた**値（`mergedYears`）。
                 小数で出さない（`started_at` は月精度）。
                 ⚠️ 0年のときは行ごと出さない（「0年の経験」は意味を成さない）。 */}
          {b.years > 0 && (
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>
              あなたの職歴から（{b.industryName} {b.years}年）
            </p>
          )}

          {/* ⚠️★`gridTemplateColumns` を `minmax(0, 1fr)` にし、item にも `minWidth: 0` を置く。
                 grid item の既定は `min-width: auto` で**中身の min-content より小さくならない**ため、
                 これが無いと長い社名で `textOverflow: ellipsis` が効かず**枠からはみ出す**。
                 実測（2026-09-04 / 右カラム 320px）: 「富士フイルムビジネスイノベーション
                 ジャパン株式会社」が親を超えていた（`.claude/rules/ui-debugging.md` の1・2番）。 */}
          <ul style={{
            listStyle: "none", margin: "10px 0 0", padding: 0,
            display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8,
          }}>
            {b.companies.map((c) => (
              <li key={c.id} style={{ minWidth: 0 }}>
                <Link
                  href={`/companies/${c.slug ?? c.id}`}
                  style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "8px 10px", borderRadius: 8,
                    border: "1px solid var(--line-soft)",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <CompanyLogo
                    name={c.name}
                    logoUrl={c.logoUrl}
                    logoLetter={c.logoLetter}
                    logoGradient={c.logoGradient}
                    size="sm"
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.name}
                    </span>
                    {/* ★理由文。⚠️ **会社ごとに手書きしない。** 対象業界データだけで書ける形。
                           ⚠️ 遷移データ由来の「◯人が移った」は入れない（`ow_transitions` が5行しかない）。
                           ⚠️★渡すのは **会社が言っている対象業界**（`c.matchedIndustryName`）で、
                              見出しの業種（`b.industryName`）ではない（2026-09-05）。
                              業種を2階層にしたので、「電機・機械の経験が活きる会社」の下に
                              「**製造業**向けにサービスを提供しています」と出る組み合わせがある。
                              **見出しは本人の申告どおり、繋がりはこの行で読める。** */}
                    <span style={{
                      display: "block", fontSize: 11.5, color: "var(--ink-mute)",
                      lineHeight: 1.6, marginTop: 1,
                    }}>
                      {industryMatchReason(c.matchedIndustryName)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
