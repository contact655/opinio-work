// src/components/companies/CompanySearchResults.tsx
// 検索結果グリッド — Server Component
// キーワード / フィルタが適用されているときのみ表示（カルーセルの代わり）

import Link from "next/link";
import { INDUSTRY_GROUPS } from "@/lib/search/industryGroups";
import { resolveIndustryKey } from "@/lib/search/industryGroups";
import type { CompanyForCarousel } from "@/types/genre";
import { CompanyCardList } from "./CompanyCardList";

type Props = {
  /** ★絞り込みの結果（2026-10-09 からページ側で引いて渡す）。
   *  ⚠️ ここで `searchCompanies` を呼び直さないこと。ページは同じ結果の件数を
   *     並び替えの行に出すので、2回引くと**件数と本体がずれうる**（docs/list-filters-20261009.md）。 */
  companies: CompanyForCarousel[];
  /** 事業領域の `?industry=`。カードのタグを合わせるためだけに使う */
  industry?: string;
  /* ⚠️ `pane` / `paneLabel` は 2026-09-30 に削除した（絞り込み結果を分割ビューから
        外したため）。**戻すなら `CompanySplitLayout` で包む話とセット**で、
        「グリッドは全画面」という決めごとを覆すことになる。 */
  /**
   * ★いま右ペインに出している企業の id（2026-09-08）。カードに印を付ける。
   * ⚠️ **id で渡すこと。** `?selected=` は slug でも uuid でもありうるので、
   *    `getCompanyBySlugOrId` が解決した `resolvedId` を渡す。
   */
  /** ★選択中の `?selected=` の値。⚠️ **slug でも uuid でもありうる**ので両方と突き合わせる
   *  （2026-09-18。解決済み id で比べていたときは、そのためにページ先頭で await が必要だった） */
  selectedKey?: string | null;
};

export function CompanySearchResults({ companies, industry, selectedKey = null }: Props) {

  /* カードのタグに出す事業領域の slug。⚠️ 絞り込んでいなければ null（＝主のタグのまま）。
     ⚠️ `searchCompanies` が絞り込みに使うのと**同じ変換**を通すこと。ここがズレると
        「絞り込みには効いているのにタグは主のまま」という、直そうとした症状に逆戻りする。 */
  const activeDomainSlug = industry ? resolveIndustryKey(industry) : null;

  return (
    <>
      <style>{`
        .search-results-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 641px) {
          .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        }
        @media (min-width: 1025px) {
          .search-results-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
        }

        /* genre-card は globals.css にも定義があるが、ここでも定義する（絞り込み結果の枠内で完結させるため）。

           ⚠️ このコメントに 山括弧 と 二重引用符 を書かないこと。
              JSX の style タグの中身は**サーバーだけが実体参照へ変換する**ため、
              クライアントの描画と一致せず hydration error になる。
              2026-08-11 まで、ここに山括弧つきで style タグ名が書かれており、
              絞り込み中の /companies を開くたびに毎回発生していた。
              同日その注意書き自体に山括弧を含めてしまい、再発させている（2度踏んだ）。 */
        .genre-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.07), 0 4px 16px rgba(15, 23, 42, 0.08);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          height: 100%;
          will-change: transform;
        }
        .genre-card:hover {
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.12);
          transform: translateY(-10px) scale(1.01);
        }
        .genre-card:active {
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px) scale(0.98);
          transition-duration: 0.06s;
        }
      `}</style>

      {/* ⚠️★件数の見出しは 2026-10-09 に外した。件数は1段目の並び替えの隣に出す
             （絞り込んでいないときと同じ場所。絞り込むと別の場所に移っていた）。 */}

      {/* 検索結果グリッド */}
      {companies.length === 0 ? (
        <div style={{
          background: "var(--bg-tint)",
          borderRadius: 16,
          padding: "56px 24px",
          textAlign: "center",
          border: "1px solid var(--line)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--royal-50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            条件に合う企業が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
            検索キーワードを変えるか、絞り込み条件を減らしてみてください
          </p>
          {/* 提案アクション */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "9px 20px", borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              background: "var(--royal)", color: "#fff",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(0,35,102,0.20)",
            }}>
              すべての企業を見る →
            </Link>
            <Link href="/companies?hiring=1" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "9px 20px", borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              background: "#fff7ed", color: "#c2410c",
              border: "1px solid #fed7aa",
              textDecoration: "none",
            }}>
              面談受付中の企業を見る
            </Link>
          </div>

          {/* 業種から辿り直す導線（2026-08-05 追加）。
              ⚠️ キーワードを変えるか条件を減らすか、の2択で行き止まりにしないため。
                 URL は LP の業種チップと同じ形式（/companies?industry=<key>）に揃えている。 */}
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 12 }}>
              業種から探す
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {INDUSTRY_GROUPS.map((g) => (
                <Link
                  key={g.key}
                  href={`/companies?industry=${g.key}`}
                  style={{
                    padding: "7px 14px", borderRadius: 100,
                    background: "#fff", border: "1px solid var(--line)",
                    fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ★★絞り込み結果も**分割ビューに載せない**（2026-09-30 / 柴さんの判断）。
              カードを押したら `/companies/[slug]` へ**全画面で遷移する**。
           ⚠️★**一覧グリッドと同日に揃えた。片方だけ戻さないこと。**
              使い分けは「**グリッドは全画面 / 1列（?view=list）は分割**」。
              ここはビュートグルに関係なく常にグリッドなので、グリッド側の規則に従う。
           ⚠️★**`CompanySplitLayout` で包み直さないこと。** 中で `CompanySplitLinks`
              （クリックの横取り）を噛ませるので、包んだ瞬間に右ペインへ戻る。
           ⚠️ `selectedKey` は残してある。詳細ビューで選んだ状態のまま絞り込むと
              `?selected=` が URL に残るので、印だけ付く（ペインは出ない）。 */
        /* ★★2段に分ける（2026-10-01 / 柴さんの判断）。
              「Salesforce」で WalkMe・富士フイルム・nCino が並び、**なぜ出たのか**が
              画面から分からなかった（3社とも**説明文**に Salesforce を含むだけ）。
           ⚠️★**見出しを出すのは「説明で一致」が1件以上あるときだけ。**
              全部が社名一致なら見出しは要らない（見れば分かる）。
           ⚠️★**説明で一致だけのときも見出しを出す。** `?q=CRM` は社名一致0・説明一致11で、
              「なぜ11社出たのか」を言うのがこの見出しの役目。
           ⚠️ 段の中身は `nameMatch`（`searchCompanies` が付ける印）で分ける。
              **ここで判定をやり直さないこと。** 書き写すと必ず割れる。 */
        <SectionedGrid
          companies={companies}
          activeDomainSlug={activeDomainSlug}
          selectedKey={selectedKey}
        />
      )}
    </>
  );
}

/** 検索結果を「社名で一致」「説明にこの語を含む」の2段で描く。片方だけなら見出しを出さない場合がある */
function SectionedGrid({
  companies, activeDomainSlug, selectedKey,
}: {
  companies: CompanyForCarousel[];
  activeDomainSlug?: string | null;
  selectedKey?: string | null;
}) {
  /* ⚠️ `nameMatch` が undefined ＝ キーワード無し（絞り込みだけ）。段に分けない */
  const hasFlag = companies.some((c) => c.nameMatch !== undefined);
  const nameHits = hasFlag ? companies.filter((c) => c.nameMatch) : companies;
  const descHits = hasFlag ? companies.filter((c) => !c.nameMatch) : [];
  const showHeadings = descHits.length > 0;

  return (
    <>
      {showHeadings && nameHits.length > 0 && <ResultHeading label="社名で一致" count={nameHits.length} />}
      {nameHits.length > 0 && <Grid companies={nameHits} activeDomainSlug={activeDomainSlug} selectedKey={selectedKey} />}
      {showHeadings && <ResultHeading label="説明にこの語を含む" count={descHits.length} first={nameHits.length === 0} />}
      {descHits.length > 0 && <Grid companies={descHits} activeDomainSlug={activeDomainSlug} selectedKey={selectedKey} />}
    </>
  );
}

/** 段の見出し。⚠️ グリッドの**外**に置く（中に入れるとグリッドのセルとして並ぶ） */
function ResultHeading({ label, count, first }: { label: string; count: number; first?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 8,
      margin: first ? "0 0 12px" : "24px 0 12px",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{count}件</span>
    </div>
  );
}

function Grid({
  companies, activeDomainSlug, selectedKey,
}: {
  companies: CompanyForCarousel[];
  activeDomainSlug?: string | null;
  selectedKey?: string | null;
}) {
  return (
        <div className="search-results-grid">
          {companies.map((company) => (
            /* ⚠️★`activeDomainSlug` を渡す（2026-09-07）。渡さないとカードのタグは主のままで、
                  従の事業領域でヒットした企業は「なぜ出たのか」が画面から分からない
                  （絞り込みもファセットも全紐づけを見るため、主でない値でもヒットする）。
               ⚠️ **`resolveIndustryKey` を通した値**を渡すこと。`?industry=fintech` は
                  `finance` に読み替わってから絞り込まれるので、生の値だとタグが一致しない。 */
            <CompanyCardList
              key={company.id}
              company={company}
              compact
              activeDomainSlug={activeDomainSlug}
              /* ⚠️ 絞り込み結果も**同タブ**（2026-09-07）。`/companies` の一覧と揃える。
                    ここだけ別タブに戻すと、同じカード部品が画面によって挙動が変わる。 */
              openInNewTab={false}
              /* ★いま右ペインに出している企業に印を付ける（2026-09-08）。
                 ⚠️ 一覧グリッド側と同じく **id で突き合わせる**。 */
              selected={company.id === selectedKey || company.slug === selectedKey}
            />
          ))}
        </div>
  );
}
