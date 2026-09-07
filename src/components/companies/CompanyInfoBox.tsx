import { Fragment } from "react";
import type { Company } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import type { CompanyTargetIndustry } from "@/types/genre";
import { orderedBusinessDomains } from "@/types/genre";
import { CAPITAL_TYPE_LABELS } from "@/lib/constants/capitalType";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";
import { formatUrlForDisplay, splitUrlForWrap } from "@/lib/utils/url";

/**
 * 「企業情報」ボックス。**サイドバー（デスクトップ）と本文（モバイル）の両方が使う。**
 *
 * ── ⚠️★なぜ切り出したか（2026-09-07）──────────────────────────────────────
 * 企業詳細のサイドバーは `hidden lg:flex` で **1023px 以下では表示されない**。
 * このボックスは本文に代替が無かったので、**モバイルでは中身が丸ごと消えていた**。
 * 実測（掲載83社 / 2026-09-07）:
 *   事業領域 83/83（100%）・従業員数 79・設立 79・資本区分 66・親会社 61・
 *   代表者 13・顧客の業界 10・従業員数(世界) 4・リモート状況 2
 * とくに**事業領域は100%埋まっている唯一の分類**で、直前の2バッチ（82d0f7e1 / 2fb60095）で
 * 19社に複数値を入れた成果が**モバイルには1文字も届いていなかった**。
 *
 * ⚠️★**同じ内容を2箇所に書かないこと。** `lg:hidden` の複製を作る案は採らなかった。
 *    このリポジトリは「同じものが2箇所に割れて片方だけ直る」を何度も踏んでいる
 *    （勤務形態のラベルが6箇所 / 業種が二系統 / 開示充実順が2つ）。
 *    前例は `LocationsCapitalSection`（2026-08-30 に同じ理由で切り出した）。
 *
 * ⚠️ **「値が無い行は出さない」を維持する**（下の `.filter((item) => item.value)`）。
 *    充填の低い項目（代表者13社・顧客の業界10社・従業員数(世界)4社・リモート状況2社）は
 *    大半の企業で行ごと出ない。**それが正しい**（CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 *
 * ⚠️ 幅は置き場所で変わる。サイドバーでは値カラムが 172px だが、本文では広くなる。
 *    **`gridTemplateColumns` をレスポンシブで変えたくなってもインラインに書かないこと**
 *    （インラインはメディアクエリに勝つ。CLAUDE.md / ui-debugging）。
 */
export function CompanyInfoBox({
  company,
  detail,
  targetIndustries = [],
  title,
}: {
  company: Company;
  detail: CompanyDetail;
  /** 顧客の業界（軸2）。⚠️ `vertical` の企業だけが値を持つ。空なら行ごと出さない */
  targetIndustries?: CompanyTargetIndustry[];
  /**
   * 見出し。**省略するとサイドバー用の小さい見出し（現行の見た目）** を出す。
   * ⚠️ 本文（モバイル）は隣のセクションと揃える必要があるので `SecTitle` を渡す。
   * ⚠️★**省略時の分岐を消さないこと。** デスクトップのサイドバーを1pxも変えないための既定。
   */
  title?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {title ?? (
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#334155",
            marginBottom: "var(--space-3)",
            fontFamily: "var(--font-inter), var(--font-noto)",
          }}
        >
          企業情報
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* ジャンルチップ: 登録済み企業のみ表示、未登録は行ごと非表示 */}
        {company.genres.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "76px 1fr",
              gap: "var(--space-2)",
              fontSize: "var(--text-sm)",
              alignItems: "flex-start",
              padding: "var(--space-2) 0",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 3 }}>ジャンル</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {company.genres.map((g) => (
                <span
                  key={g.id}
                  style={{
                    padding: "var(--space-1) var(--space-3)",
                    borderRadius: 14,
                    fontSize: "var(--text-xs)",
                    background: "var(--bg-tint)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--line)",
                    fontWeight: 500,
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {(
          [
            /* ⚠️ 下の `.filter((item) => item.value)` が値の無い行を落とす。
                  ラベルは「業界」ではなく**事業領域**（何をやっている会社か）。 */
            /* ⚠️★**紐づいている事業領域を全部出す**（2026-09-07）。主だけを出していたので、
                  従でヒットした企業は「なぜ絞り込みに出たのか」が結果側で説明されていなかった
                  （絞り込みもファセットも全紐づけを見る）。`orderedBusinessDomains` が主を先頭にする。
               ⚠️★**区切りは `／`。下の「顧客の業界」の `・` に揃えないこと。**
                  事業領域の名前は「HR・人材」「AI・データ」のように**それ自体が `・` を含む**ので、
                  `・` で繋ぐと「HR・人材・基幹業務システム」となり3件に読める。
                  顧客の業界（「建設」「金融・保険」）とは事情が違う。 */
            { key: "事業領域", value: orderedBusinessDomains(company.business_domains).map((d) => d.name).join("／"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
            /* 顧客の業界（＝軸2「誰に売っているか」。内部の呼び名は「対象業界」）。
               ⚠️★**事業領域のすぐ下に置く。** 2つ並んで初めて軸の違いが伝わる
                  （「プロジェクト管理 を 建設 に売っている会社」と1組で読める）。
                  離して置くと、`/companies` の絞り込みに2つチップがある理由が
                  結果ページ側で説明されないままになる —— それが 2026-09-06 に
                  「事業領域と対象業界はわかりづらい」と言われた形。
               ⚠️ **ラベルは「顧客の業界」。**「対象業界」に戻さないこと
                  （その会社自身の業界と読める。CLAUDE.md の判断）。
               ⚠️ 値が無ければ下の `.filter((item) => item.value)` が行ごと落とす。
                  「業界を問わない」等のフォールバックを書かないこと ——
                  0件は `horizontal` / `consumer` / **未確認**のどれでもありうる。 */
            { key: "顧客の業界", value: targetIndustries.map((t) => t.name).join("・"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
            /* ⚠️ `capital_notes` の置き場所は2箇所ある（2026-08-13）。
                  **`capital_notes` はここに出さない。**「拠点・資本関係」セクション
                  （本文）の資本関係カードに移した（2026-08-13）。
               ⚠️ 値カラムは実測 **172px** しかなく、注記は3行に折り返していた。
                  サイドバーは「ラベル：短い値」を拾う場所で、文章を読む場所ではない。
               ⚠️ `listed_exchange` は使わない。**未使用カラム**で描画先が無い。
                  上場市場・証券コードは capital_notes の文中に書く。 */
            ...(detail.capitalType ? [{ key: "資本区分", value: CAPITAL_TYPE_LABELS[detail.capitalType] ?? detail.capitalType, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg> }] : []),
            /* ⚠️ ラベルは「親会社」。値は parent_company_name（**親会社名**）で、
                  所在地ではない。直下に「所在地」行が並ぶため、
                  「本社」だと本社所在地と誤読される（2026-08-13 改称）。
                  値の参照先は変えていない。 */
            ...(detail.parentCompanyName ? [{ key: "親会社", value: detail.parentCompanyName + (detail.parentCompanyCountry ? `（${detail.parentCompanyCountry}）` : ""), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> }] : []),
            { key: "従業員数", value: formatEmployeeCount(company.employee_count) ?? "", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ...(detail.globalEmployeeCount ? [{ key: "従業員数（世界）", value: formatEmployeeCount(detail.globalEmployeeCount), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
            /* 所在地。**`headquarters_address` が無い社だけ**、`location` で出す（2026-08-13）。
               ⚠️ 住所（番地まで）がある社は「拠点・資本関係」セクションの本社カードに出すので、
                  **ここには出さない。同じ項目を2箇所に出すと値が違って見えて読み手が迷う。**
               ⚠️ 住所は172pxの値カラムでは2行に折り返す。`location`（「東京都」等）は1行に収まる。
                  充填が進めば自動的に本文カード側へ寄り、全社埋まればこの行は消える。
               ⚠️ `hq` は location をそのまま入れたもの（queries.ts）。
                  `?? "東京都"` のような既定値は入れないこと。値が無ければ空のまま。
               ⚠️ 「拠点」「最寄り駅」はここから削除した。どちらも本文の
                  「拠点・資本関係」セクションに移してある。 */
            ...(detail.headquartersAddress ? [] : [{ key: "所在地", value: detail.hq, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> }]),
            ...(detail.remoteWorkStatus ? [{ key: "リモート状況", value: ({ full_remote: "フルリモート", hybrid: "ハイブリッド", on_site: "フル出社", other: "その他" } as Record<string, string>)[detail.remoteWorkStatus] ?? detail.remoteWorkStatus, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }] : []),
            { key: "設立", value: detail.established, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { key: "代表者", value: detail.ceo, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
            ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
          ] as { key: string; value: string; icon: React.ReactNode; isLink?: boolean; subText?: string }[]
        )
          .filter((item) => item.value)
          .map(({ key, value, icon, isLink, subText }) => (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
                alignItems: "flex-start",
                padding: "var(--space-2) 0",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                {icon}{key}
              </span>
              {isLink ? (
                <a
                  href={value.startsWith("http") ? value : `https://${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--royal)",
                    textDecoration: "underline",
                    fontWeight: 500,
                    /* ⚠️ break-all はドメインの途中で改行する（`https://www.salesforce.co` / `m/jp/`）。
                          表示は formatUrlForDisplay で短くし、折り返しは「/」の直後に置いた
                          <wbr> に任せる。ドメインは割れない。
                       ⚠️ `minWidth: 0` を外さないこと。この行は grid の `1fr` 列で、
                          既定の最小サイズが min-content になる。URL は途中で切れない1語なので、
                          列が URL の幅（実測 258px）まで広がり、**値カラムが 172px → 258px に膨らんで
                          サイドバーから 60px はみ出す**。break-all にはこの問題が無い（1文字で切れるため）。
                       ⚠️ anywhere は最後の逃げ道。<wbr> で切れない極端に長い1語だけが対象。 */
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {splitUrlForWrap(formatUrlForDisplay(value)).map((seg, i, arr) => (
                    <Fragment key={i}>
                      {seg}
                      {i < arr.length - 1 && <wbr />}
                    </Fragment>
                  ))} →
                </a>
              ) : (
                <div>
                  <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: "var(--text-sm)" }}>{value}</span>
                  {subText && <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6 }}>{subText}</p>}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
