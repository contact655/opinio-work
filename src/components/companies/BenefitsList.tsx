import React from "react";
import { InfoCard } from "@/app/(jobseeker)/companies/[id]/InfoCard";
import { CollapsibleList } from "@/app/(jobseeker)/companies/[id]/CollapsibleList";
import type { ChipVariant } from "@/lib/utils/chipVariant";

/**
 * 福利厚生の本体（カテゴリ分け + カード + すべて見る）。
 *
 * ── なぜ部品にしたか（2026-08-30）────────────────────────────────────────────
 * **企業詳細と求人詳細で実装が2つに割れていた。** どちらも同じ
 * `ow_companies.benefits`(text[]) を出しているのに、求人側は
 * 独自のアイコン判定を持ち、**キーワードが企業側と食い違っていた。**
 *
 * | | 企業詳細 | 求人詳細（旧） |
 * |---|---|---|
 * | カテゴリ分け | **あり**（5分類 + その他） | **無し**（全件を平坦に並べる） |
 * | すべて見る | **あり**（カテゴリ3つまで） | **無し**（10件が全部出る） |
 * | 緑（money）の判定 | `chipVariant` の `money` | **色を直書き**（`#065f46` など） |
 * | 拾えないキーワード | — | `介護` `育児` `食事` `ランチ` `社食` `株式` `勉強会` `セミナー` `資格`※ |
 *
 * ※ 求人側は `フルリモート` `勉強会` `セミナー` などを持たず、
 *   同じ値でもアイコンが変わる状態だった。
 *
 * ⚠️★**ここに集約した以上、呼び出し側でアイコンやカテゴリを判定しないこと。**
 *    片方だけ分岐を足すと、また同じ食い違いが生まれる。
 *
 * ⚠️ **セクションの外枠（見出し・余白）は各ページが持つ。** この部品は中身だけ返す。
 *    企業詳細は「福利厚生」、求人詳細は「福利厚生・評価制度」で見出しが違い、
 *    求人詳細は下に評価制度が続くため。
 *
 * ⚠️ 0件のときは **null を返す**。「カジュアル面談でご確認ください」の空状態は
 *    企業詳細だけが出す（求人詳細はセクションごと出さない）。**ここに持ち込まない。**
 */

/** ⚠️ 上限は**カテゴリ数**。カテゴリの途中で切ると「働き方」の一部だけ見えている
 *  状態になり、何が隠れているか分からない。件数で切らないこと。 */
export const BENEFIT_CATEGORY_LIMIT = 3;

type BenefitIconDef = { svg: React.ReactNode; variant?: ChipVariant };
function getBenefitIconDef(benefit: string): BenefitIconDef {
  const b = benefit;
  const royal: BenefitIconDef = {
    svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  };
  if (b.includes("リモート") || b.includes("在宅") || b.includes("テレワーク") || b.includes("フルリモート"))
    return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> };
  if (b.includes("フレックス") || b.includes("時差出勤"))
    return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> };
  if (b.includes("副業") || b.includes("兼業"))
    return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> };
  if (b.includes("ストックオプション") || b.includes("SO") || b.includes("持株"))
    return { variant: "money", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> };
  if (b.includes("書籍") || b.includes("学習") || b.includes("研修") || b.includes("勉強会") || b.includes("資格"))
    return { svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> };
  if (b.includes("育休") || b.includes("産休") || b.includes("子育て") || b.includes("保育"))
    return { svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> };
  if (b.includes("食事") || b.includes("ランチ") || b.includes("社食"))
    return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> };
  if (b.includes("健康") || b.includes("医療") || b.includes("保険"))
    return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> };
  if (b.includes("確定拠出") || b.includes("退職金"))
    return { variant: "money", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> };
  // default: checkmark
  return royal;
}
const BENEFIT_CATEGORIES = [
  { key: "work_style", label: "働き方", keywords: ["リモート", "在宅", "テレワーク", "フルリモート", "フレックス", "時差", "副業", "兼業"] },
  /* ⚠️ 「株式」を足した（2026-08-08）。ラベルが「報酬・株式」なのに
        キーワードに無く、「RSU（譲渡制限付き株式）」がその他に落ちていた。 */
  { key: "rewards",    label: "報酬・株式", keywords: ["ストックオプション", "SO", "持株", "株式", "確定拠出", "退職金", "給与", "賞与", "インセンティブ"] },
  { key: "growth",     label: "学習・成長", keywords: ["書籍", "学習", "研修", "勉強会", "資格", "セミナー"] },
  /* ⚠️ 「育児」「介護」を足した（2026-08-08）。ラベルが「育児・家族」なのに
        キーワードは「育休」だけで、「育児・介護休暇制度」がその他に落ちていた。 */
  { key: "family",     label: "育児・家族", keywords: ["育休", "産休", "育児", "介護", "子育て", "保育"] },
  { key: "health",     label: "食事・健康", keywords: ["食事", "ランチ", "社食", "健康", "医療", "保険"] },
];

/* ⚠️ どのキーワードにも当たらない値は "other" を返す。
      **1件も欠けさせない**ため、描画側で必ず「その他」として出す。 */
function categorize(b: string): string {
  for (const cat of BENEFIT_CATEGORIES) {
    if (cat.keywords.some((kw) => b.includes(kw))) return cat.key;
  }
  return "other";
}

export function BenefitsList({ benefits }: { benefits: string[] | null | undefined }) {
  if (!benefits || benefits.length === 0) return null;

  const grouped = new Map<string, string[]>();
  for (const b of benefits) {
    const key = categorize(b);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  /* ⚠️ 1件も無いカテゴリは見出しごと出さない。
        ⚠️ "other" を**必ず最後に足す**。カテゴリ定義だけを回すと、
           どこにも当たらなかった値が画面から静かに消える。 */
  const activeCats = [...BENEFIT_CATEGORIES, { key: "other", label: "その他", keywords: [] as string[] }]
    .filter((cat) => (grouped.get(cat.key)?.length ?? 0) > 0);

  return (
    <CollapsibleList
      limit={BENEFIT_CATEGORY_LIMIT}
      labelCollapsed={`すべて見る（残り ${activeCats.length - BENEFIT_CATEGORY_LIMIT}）`}
      containerStyle={{ display: "flex", flexDirection: "column", gap: 18 }}
      buttonWrapperStyle={{ marginTop: "var(--space-4)" }}
      items={activeCats.map((cat) => (
        <div key={cat.key}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
            letterSpacing: "0.04em", marginBottom: 8,
          }}>
            {cat.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {(grouped.get(cat.key) ?? []).map((b) => {
              const def = getBenefitIconDef(b);
              return (
                <InfoCard
                  key={b}
                  icon={<span style={{ display: "flex", alignItems: "center", transform: "scale(1.5)" }}>{def.svg}</span>}
                  label={b}
                  variant={def.variant}
                />
              );
            })}
          </div>
        </div>
      ))}
    />
  );
}
