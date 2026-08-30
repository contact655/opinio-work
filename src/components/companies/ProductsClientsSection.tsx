import React from "react";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { SecTitle } from "@/app/(jobseeker)/companies/[id]/SecTitle";
import { CollapsibleList } from "@/app/(jobseeker)/companies/[id]/CollapsibleList";
import CustomerCasesClient from "@/app/(jobseeker)/companies/[id]/CustomerCasesClient";
import { CHIP_STYLES } from "@/lib/utils/chipVariant";

/**
 * 製品・導入事例セクション（2026-08-31 に企業ページから切り出した）。
 *
 * ⚠️ ページ内のローカル関数だと `/dev/preview` から import できない。
 *    実データは **主要製品あり17社 / 導入事例あり3社**（2026-08-30 実測）で、
 *    1製品・2製品・上限超えといった境界を実データで踏むのが難しい。
 *
 * ⚠️ 切り出しただけで**中身は1文字も変えていない**（実HTMLの一致で確認済み）。
 */

/** ⚠️ 初期表示は5件＝900px で1行ちょうど（2026-08-13） */
const PRODUCTS_LIMIT = 5;

// ─── ProductsClientsSection ───────────────────────────────────────────────────

/** 製品名から（...）形式のサブタイトルを分離する */
function parseProductName(raw: string): { name: string; sub: string | null } {
  const m = raw.match(/^(.+?)（(.+?)）\s*$/);
  if (m) return { name: m[1].trim(), sub: m[2].trim() };
  const m2 = raw.match(/^(.+?)\((.+?)\)\s*$/);
  if (m2) return { name: m2[1].trim(), sub: m2[2].trim() };
  return { name: raw, sub: null };
}

/**
 * キーワードから製品カードの**アイコン**を決める。
 *
 * ⚠️ **色は出し分けない（2026-08-23）。** 以前はカテゴリごとに7色
 *    （royal / amber / purple / green / indigo / slate / sky）を当てていたが、
 *    凡例が無いので読み手には色の意味が分からず、しかも
 *    「緑＝カスタマーサポート製品」が他所の「緑＝金銭条件」と衝突していた。
 *    製品は金銭条件ではないので、すべて neutral。
 *    → src/lib/utils/chipVariant.ts
 */
function productStyle(name: string): { bg: string; border: string; color: string; icon: React.ReactNode } {
  const n = name.toLowerCase();
  const NEUTRAL = CHIP_STYLES.neutral;
  const ROYAL = NEUTRAL, WARM = NEUTRAL, PURPLE = NEUTRAL,
        GREEN = NEUTRAL, INDIGO = NEUTRAL, SLATE = NEUTRAL, SKY = NEUTRAL;

  if (/(crm|sales|営業|セールス)/.test(n))
    return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> };
  if (/(market|マーケ|メール|email)/.test(n))
    return { ...WARM, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> };
  if (/(analytic|data|分析|レポ|insight|tableau|bi)/.test(n))
    return { ...PURPLE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> };
  if (/(service|support|サービス|サポート|cs|カスタマ|success)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> };
  if (/(platform|cloud|クラウド|プラットフォーム)/.test(n))
    return { ...SKY, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> };
  if (/(ai|ml|機械学習|人工知能|llm|gpt|agentforce|einstein)/.test(n))
    return { ...INDIGO, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> };
  if (/(integrat|api|連携|インテグレ|mule|slack|コラボ)/.test(n))
    return { ...SLATE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> };
  if (/(hr|human|採用|人事|タレント|talent|commerce|ec|financial)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg> };
  return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> };
}

// ─── ⑦ 資本関係・グループ ────────────────────────────────────────────────────

/* ⚠️ CAPITAL_TYPE_LABELS は `lib/constants/capitalType.ts` へ移した（2026-08-30）。
      求人詳細でも同じ表示名を使うため。ここに戻すと表が2つに割れる。 */


export function ProductsClientsSection({ detail }: { detail: CompanyDetail }) {
  const hasProducts = detail.main_products && detail.main_products.length > 0;
  const hasCases    = detail.customer_cases && detail.customer_cases.length > 0;
  const hasCustomers = detail.main_customers && detail.main_customers.length > 0;

  if (!hasProducts && !hasCases && !hasCustomers) return null;

  // id は "products-clients" のまま（CompanyCardList.tsx 等の外部参照があるため変更不可）
  return (
    <section
      id="products-clients"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          }
        >
          製品・導入事例
        </SecTitle>
      </div>

      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

        {/* ── 製品・サービス ── */}
        {hasProducts && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" as const }}>主な製品・サービス</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0 }}>{detail.main_products!.length}製品</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            {/* ⚠️ 列数を縮めるのは 900px 以上だけ（2026-08-12）。
                   狭い画面で製品数に合わせると、**カードが横に伸びる**。
                   1製品の企業（Opinio / Translead）が 375px で
                   139px → 285px の全幅カードになった（実測）。
                   「カードの大きさは維持する」ので 2列 / 3列は固定のままにする。
                ⚠️ auto-fit は使わない。カードが引き伸ばされて1枚が巨大化する。
                ⚠️ 900px 以上は固定幅（183px）。1fr のままでも 946/5 ≒ 183px で
                   同じ見た目になるが、製品数が減っても列幅が変わらないことを
                   明示しておくために固定値にしている。
                ⚠️ このスタイルタグの中に山括弧と二重引用符を書かないこと。
                   サーバーだけが実体参照へ変換し hydration error になる。 */}
            <style>{`
              .products-grid {
                display: grid;
                gap: var(--space-2);
                justify-content: start;
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
              @media (min-width: 640px) {
                .products-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              }
              @media (min-width: 900px) {
                .products-grid { grid-template-columns: repeat(var(--product-cols, 5), minmax(0, 183px)); }
              }
            `}</style>
            {/* ⚠️ 初期表示は5件＝900px で1行ちょうど（2026-08-13）。
                   **列数の式は変えていない**（`Math.min(全件, 5)`）。畳んでも列幅が
                   動かないよう、母数は表示件数ではなく全件のまま。 */}
            <CollapsibleList
              limit={PRODUCTS_LIMIT}
              labelCollapsed={`すべて見る（残り ${detail.main_products!.length - PRODUCTS_LIMIT}）`}
              containerClassName="products-grid"
              /* ⚠️★列数は**CSS変数で要素ごとに**渡す（2026-08-31）。
                    以前は `<style>` の中に `repeat(${Math.min(len,5)}, ...)` を
                    埋め込んでいたが、**クラス名が固定なので同じページに2つ以上
                    置くと最後の style が全部に勝つ。**
                    本番は1インスタンスなので実害は無かったが、`/dev/preview/products` で
                    7個並べたら**全部が最後の値（2列）になり、列数を検証できなかった。**
                 ⚠️ 母数は表示件数ではなく**全件**のまま（畳んでも列幅が動かないため）。 */
              containerStyle={{ ["--product-cols" as string]: Math.min(detail.main_products!.length, 5) } as React.CSSProperties}
              buttonWrapperStyle={{ marginTop: "var(--space-3)" }}
              items={detail.main_products!.map((raw, i) => {
                /* ⚠️ `sub`（括弧内の説明）を捨てないこと（2026-08-12 修正）。
                      2026-08-12 まで `name` しか使っておらず、
                      「SmartHR（クラウド人事労務ソフト）」の括弧内が画面に出ていなかった。
                      データは全社 `製品名（説明）` の形で入っている。 */
                const { name, sub } = parseProductName(raw);
                const s = productStyle(name);
                return (
                  <div
                    key={i}
                    style={{
                      background: "#fff",
                      border: `1px solid var(--line)`,
                      borderRadius: 10,
                      padding: "10px var(--space-3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      /* ⚠️ 高さは固定。説明が無い製品（「BPO事業」等）と混ざっても
                            カードの高さを揃えるため。min-height にしないのは、
                            min-height が height に勝って揃わなくなるのを避けるため。
                         ⚠️ 72px は「製品名1行＋説明2行」が入る高さ。62px だと
                            説明が2行になる製品（「マーケティングオートメーション」
                            「API 統合・インテグレーション」等）で下が切れる。実測で決めた値。 */
                      height: 72,
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                    {/* アイコン */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.icon}
                    </div>
                    {/* ⚠️ minWidth: 0 が要る。これが無いと flex item が
                           min-content まで広がり、ellipsis が効かない。 */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.35, fontFamily: "var(--font-inter), var(--font-noto)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </p>
                      {sub && (
                        /* ⚠️ 12px 未満にしないこと（globals.css の --text-xs が下限）。
                              2行までで打ち切り、カードの高さが崩れないようにする。 */
                        <p style={{
                          margin: "2px 0 0", fontSize: "var(--text-xs)", fontWeight: 500,
                          color: "var(--ink-mute)", lineHeight: 1.3,
                          fontFamily: "var(--font-inter), var(--font-noto)",
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                        }}>
                          {sub}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            />
          </div>
        )}

        {/* ── 区切り線 ── */}
        {hasProducts && (hasCases || hasCustomers) && (
          <div style={{ height: 1, background: "var(--line)", margin: "8px 0 4px" }} />
        )}

        {/* ── 主な導入事例 ── */}
        {hasCases && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" as const }}>主な導入事例</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0 }}>{detail.customer_cases!.length}社</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <CustomerCasesClient cases={detail.customer_cases!} defaultCollapsed={detail.customer_cases!.length > 3} />
          </div>
        )}

        {/* ── 主な顧客タグ（customer_cases がない場合のフォールバック） ── */}
        {!hasCases && hasCustomers && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)", fontFamily: "var(--font-inter), var(--font-noto)", letterSpacing: "0.02em" }}>
                主な顧客
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                {detail.main_customers!.length} 社
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {detail.main_customers!.map((c, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 14px",
                    borderRadius: 100,
                    background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--royal)",
                    fontFamily: "var(--font-inter), var(--font-noto)",
                    lineHeight: 1.4,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


// ─── Locations & Capital Section ─────────────────────────────────────────────

/* ⚠️ 「拠点・資本関係」は `components/companies/LocationsCapitalSection.tsx` に
      移した（2026-08-30）。**求人詳細でも同じものを出すため。**
      ここに戻すと実装が2つに割れ、片方だけ直る形になる。
   ⚠️ 見出しは呼び出し側から `title` で渡す（このページの `SecTitle` を使う）。 */

// ─── Benefits Section ─────────────────────────────────────────────────────────
