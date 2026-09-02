import React from "react";
import { splitParenSuffix } from "@/lib/utils/parenSuffix";
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
/* ⚠️ 分解の規則は `lib/utils/parenSuffix.ts` に集約した（2026-09-02）。
      福利厚生でも同じ形が必要になったため。**ここに正規表現を戻さないこと。** */
const parseProductName = splitParenSuffix;

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

/**
 * 部署名から**主な営業先カードのアイコン**を決める。
 *
 * ⚠️ **色は出し分けない。** `productStyle` と同じ理由（凡例が無い色分けを増やさない）。
 *    → src/lib/utils/chipVariant.ts の「色の役割」
 *
 * ⚠️ `productStyle` を流用しないこと。あちらは製品名（CRM / Tableau など）を
 *    前提にした正規表現で、「情報システム部」は既定のモニターアイコンに落ちる。
 *    部署は部署の語彙で引く。
 */
function salesTargetStyle(name: string): { bg: string; border: string; color: string; icon: React.ReactNode } {
  const n = name.toLowerCase();
  const NEUTRAL = CHIP_STYLES.neutral;

  // 情報システム・IT（⚠️「営業」より先に判定する。「営業支援システム部」のような
  //    複合語で、より具体的なほうを採りたいため）
  if (/(情報システム|情シス|it部|ｉｔ|システム部|インフラ|セキュリティ|dx|技術|開発|エンジニア)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg> };
  // 人事・採用・労務
  if (/(人事|採用|hr|労務|人材|タレント|talent|総務)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg> };
  // マーケティング・広報
  if (/(マーケ|広報|宣伝|pr|ブランド|market)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg> };
  // 経理・財務・法務
  if (/(経理|財務|会計|法務|コンプライアンス|finance|legal)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg> };
  // 経営・役員
  if (/(経営|役員|取締役|cxo|ceo|事業部長|企画)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="9" y1="13" x2="9.01" y2="13"/></svg> };
  // カスタマーサポート・CS
  if (/(サポート|カスタマ|cs部|問い合わせ|コールセンター|support)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> };
  // 営業・セールス（⚠️ 最後に置く。「営業」は他の部署名にも含まれうる）
  if (/(営業|セールス|sales|インサイド|フィールド)/.test(n))
    return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> };
  // 既定：部署一般（建物）
  return { ...NEUTRAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/></svg> };
}

// ─── ⑦ 資本関係・グループ ────────────────────────────────────────────────────

/* ⚠️ CAPITAL_TYPE_LABELS は `lib/constants/capitalType.ts` へ移した（2026-08-30）。
      求人詳細でも同じ表示名を使うため。ここに戻すと表が2つに割れる。 */


export function ProductsClientsSection({ detail }: { detail: CompanyDetail }) {
  const hasProducts = detail.main_products && detail.main_products.length > 0;
  const hasCases    = detail.customer_cases && detail.customer_cases.length > 0;
  const hasCustomers = detail.main_customers && detail.main_customers.length > 0;
  /* ⚠️ 主な営業先は `main_customers`（顧客そのもの）とは**別の項目**。
        顧客企業の中の「どの部署に売るか」を持つ。片方が空でも他方は出す。 */
  const hasSalesTargets = detail.main_sales_targets && detail.main_sales_targets.length > 0;

  if (!hasProducts && !hasCases && !hasCustomers && !hasSalesTargets) return null;

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


        {/* ── 製品・サービス ── */}
        {hasProducts && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" as const }}>主な製品・サービス</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0 }}>{detail.main_products!.length}製品</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
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

        {/* ── 区切り線（製品 ↔ 営業先） ── */}
        {hasProducts && hasSalesTargets && (
          <div style={{ height: 1, background: "var(--line)", margin: "8px 0 4px" }} />
        )}

        {/* ── 主な営業先 ── */}
        {/* ⚠️ 「主な顧客」とは別物。あちらは**顧客そのもの**（企業名）で、
               こちらは**顧客企業の中のどの部署に売るか**。粒度が違うので統合しないこと。
           ⚠️ `customer_cases` の有無で出し分けない（主な顧客はフォールバックだが、
               これは独立した項目）。 */}
        {hasSalesTargets && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" as const }}>主な営業先</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", flexShrink: 0 }}>{detail.main_sales_targets!.length}部門</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <CollapsibleList
              limit={PRODUCTS_LIMIT}
              labelCollapsed={`すべて見る（残り ${detail.main_sales_targets!.length - PRODUCTS_LIMIT}）`}
              containerClassName="products-grid"
              containerStyle={{ ["--product-cols" as string]: Math.min(detail.main_sales_targets!.length, 5) } as React.CSSProperties}
              buttonWrapperStyle={{ marginTop: "var(--space-3)" }}
              items={detail.main_sales_targets!.map((raw, i) => {
                /* ⚠️ 製品と同じく `部署名（補足）` の形を許す。捨てないこと。 */
                const { name, sub } = parseProductName(raw);
                const s = salesTargetStyle(name);
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
                      /* ⚠️ 製品カードと同じ 72px。同じ節に2種類の高さを並べない。 */
                      height: 72,
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.icon}
                    </div>
                    {/* ⚠️ minWidth: 0 が要る（無いと ellipsis が効かない）。 */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.35, fontFamily: "var(--font-inter), var(--font-noto)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {name}
                      </p>
                      {sub && (
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
        {(hasProducts || hasSalesTargets) && (hasCases || hasCustomers) && (
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
