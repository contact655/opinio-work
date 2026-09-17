"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { ARTICLE_TYPES } from "@/app/articles/mockArticleData";
import { SortSelect } from "@/components/common/SortSelect";

const LINE = "var(--line)";
const INK_MUTE = "var(--ink-mute)";

/* ★並び替えの選択肢（2026-09-17 に定数へ出した）。描画は components/common/SortSelect。
   ⚠️ `value` は URL の `?sort=` に入る値そのもの。ラベルだけ変えないこと。
   ⚠️★既定は `latest`。`updateParam` が **"latest" を消す**（`?sort=` を付けない）ので、
      ここに既定値を増やすなら向こうの条件も見ること。 */
/* ★カテゴリの選択肢（2026-09-17）。**既定の「すべて」だけ言い換えている。**
   ⚠️★理由は狭い画面。`.sort-select-label` は 767px 以下で「カテゴリ」の語を落とすので、
      そのまま「すべて」だけが残ると**何の「すべて」か画面から消える**。
      「すべての記事」なら語が無くても通る（並び替えの「新着順」と同じ性質）。
   ⚠️ `ARTICLE_TYPES`（mockArticleData）は**書き換えないこと**。
      あれは他の画面も読む共有の語彙で、ここは表示だけの言い換え。
   ⚠️ `value` は URL の `?type=` に入る値そのもの。**触らない。** */
const ARTICLE_TYPE_OPTIONS = ARTICLE_TYPES.map((t) =>
  t.value === "all" ? { ...t, label: "すべての記事" } : t,
);

const ARTICLE_SORT_OPTIONS = [
  { value: "latest",  label: "新着順" },
  { value: "popular", label: "読了時間順" },
] as const;

export default function ArticleFilterBar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = searchParams.get("type") ?? "all";
  const currentSort = searchParams.get("sort") ?? "latest";
  const currentQ    = searchParams.get("q") ?? "";

  const [localQ, setLocalQ] = useState(currentQ);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "all" || value === "latest") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  const handleQueryChange = useCallback((val: string) => {
    setLocalQ(val);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (val.trim()) params.set("q", val.trim());
      else params.delete("q");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
  }, [searchParams, pathname, router]);

  const currentView = searchParams.get("view") ?? "list";

  return (
    <div style={{
      position: "sticky", top: 60, zIndex: 30,
      background: "#fff",
      borderBottom: `1px solid ${LINE}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      /* ⚠️ 帯が1本になったぶん詰めた（20px -> 12px）。詰めすぎると検索窓がヘッダーに
            貼り付いて見える。12 が下限（`/jobs` `/companies` `/people` と同じ）。
         ⚠️★★**`padding` の一括指定に戻さないこと**（2026-09-17 に直した）。
            この要素は `px-5 md:px-12` で左右の余白を持つ約束だが、
            **インラインの一括指定が左右を 0 で上書きしていて、一度も効いていなかった**
            （実測: 本番も dev も `padding-left: 0px`）。CLAUDE.md の
            「インライン style と CSS の優先順位」をそのまま踏んでいた形。
            ⚠️ 症状は**記事一覧とツールバーの左端がズレる**こと（1440px で 0 と 48）。
               375px では検索窓が画面の端に貼り付き、件数が右端をはみ出していた。
            → 縦だけを指定する（`paddingTop`）。左右はクラスに任せる。 */
      paddingTop: 12,
    }} className="px-5 md:px-12">
      {/* ⚠️ ここも一括指定にしない（上と同じ理由）。左右は親のクラスが持つ。 */}
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", paddingBottom: 14 }}>

        {/* ── ★ツールバーは1行（2026-09-17 に2本の帯を1本にした）────────────────
               それまで「検索＋カテゴリ」と「並び順＋表示形式＋件数」で帯が2段あり、
               記事一覧が始まるのは **213px**（本番実測 / 1440px）だった。
               `/jobs`（162）・`/companies`（164）・`/people`（164）と同じ形に揃えた。

            ⚠️★**カテゴリタブは畳んでいない。** `/companies` の6つは「詳細検索」に畳んだが、
               こちらは**絞り込みではなく記事の主たる目次**（`role="tablist"`）。
               畳むと、このページの入口をクリックの奥に隠すことになる。
               ⚠️ 代わりに**タブ列だけが横スクロールする**（下の overflowX）。
                  以前は行そのものがスクロール容器だったので、検索窓ごと流れていた。

            ⚠️ 右端に寄せるのは `marginLeft: auto`。**行を折ったときだけ効く。** */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Keyword search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK_MUTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="タイトル・企業名で検索"
              value={localQ}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="記事を検索"
              /* ⚠️★フォーカス時の二重枠を止める（2026-09-09）。globals.css の
                    `input:focus-visible` が border の外に outline を足すので、
                    この入力欄のように**自分で丸い枠を持っている**と線が2本になる。
                    `.search-pill` は outline だけを消し、枠の色と淡いリングは残す。
                 ⚠️ 枠の色を変えたい場合も、ここに `outline` を書き戻さないこと。 */
              className="search-pill"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 28px 9px 30px",
                border: `1.5px solid ${localQ ? "var(--royal)" : LINE}`,
                borderRadius: 100, height: 38,
                fontSize: 13, color: "var(--ink)",
                background: "#fff", outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
            />
            {localQ && (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                aria-label="検索をクリア"
                style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: INK_MUTE, fontSize: "var(--text-base)", lineHeight: 1, padding: 0 }}
              ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            )}
          </div>

          {/* ★カテゴリ（2026-09-17 にピル5つからドロップダウンへ / 柴さんの指示）。
                 実体は components/common/SortSelect —— 並び替えと**同じ部品**。
                 ⚠️ ここに直書きしないこと。

              ⚠️★**畳んだぶん、カテゴリはクリックの奥に入った。** 承知のうえ。
                 その代わり**いま何で絞っているかは閉じていても見える**（ボタンに現在値が出る）
                 ので、`/companies` の絞り込みチップのように
                 「選択中の条件」を別に外へ出す必要はない。
              ⚠️ 直前まで `role="tablist"` だった。**戻さないこと** ——
                 ピル5つで約560pxを使っており、検索窓が 422px まで痩せていた。

              ⚠️ `updateParam` が "all" を消すので、「すべて」に戻すと `?type=` が落ちる（意図どおり）。 */}
          <SortSelect
            label="カテゴリ"
            value={currentType}
            options={ARTICLE_TYPE_OPTIONS}
            onChange={(v) => updateParam("type", v)}
          />

          {/* ── ★並び替え・表示形式・件数（2026-09-17 に下の帯からここへ移した）──────
              ⚠️★`flexShrink: 0` にしないこと。375px で親を超える（`/people` で実際に踏んだ）。
                 `flexWrap` で中を折り、`minWidth: 0` で縮めさせる。 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, rowGap: 8,
            flexWrap: "wrap", minWidth: 0, marginLeft: "auto",
          }}>
            {/* ★並び替え（2026-09-17 にドロップダウンへ）。実体は components/common/SortSelect。
                `/jobs`・`/companies`・`/people` と**同じ部品**。⚠️ ここに直書きしないこと。
                ⚠️ ラベルは部品の既定の「並び替え」。**以前の「並び順:」に戻さないこと**
                   —— 同じ操作が4画面で違う語になる。
                ⚠️ `updateParam` が "latest" を消すので、既定に戻すと `?sort=` が落ちる（意図どおり）。 */}
            <SortSelect
              value={currentSort}
              options={ARTICLE_SORT_OPTIONS}
              onChange={(v) => updateParam("sort", v)}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* ⚠️★**表示切替は `/companies` の `GridSortBar` と同じ見た目にする**（2026-09-06）。
                     それまでは articles だけ「白い箱 + 影 + royal の文字」で、
                     企業一覧の「濃紺の塗り + 白文字」と違っていた。
                  ⚠️ ボタンのスタイルは globals.css の **`.view-btn`**（企業一覧と共有）。
                     ここに padding や font-size を書き足さないこと —— 2ページでまたズレる。
                  ⚠️★**ラベルは「一覧 / 詳細」**（2026-09-09 に柴さんの指示で変更）。
                     それまでは「グリッド / リスト」で、2026-09-06 のコメントは
                     「揃えないこと」と書いていた。理由は *`/companies` の「詳細」は
                     情報量の多い行だが、記事のリストは逆に省スペースな行で意味が合わない*。
                     ⚠️★**その理由は承知のうえで、語を揃える判断に変えた。**
                        同じ位置・同じ意匠のトグルが、ページごとに違う語で出ているほうが
                        迷う、という判断（柴さん）。**「グリッド / リスト」に戻さないこと。**
                     ⚠️ 記事の「詳細」が省スペースな行である点は変わっていない。
                        情報量を増やすかどうかは別の判断。 */}
              <div style={{
                display: "flex", gap: 2,
                background: "var(--line-soft)", borderRadius: 8, padding: 2,
              }}>
                {([
                  { mode: "grid", label: "一覧", title: "一覧表示", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  )},
                  { mode: "list", label: "詳細", title: "詳細表示", icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                      <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                      <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                    </svg>
                  )},
                ] as const).map(({ mode, label, title, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateParam("view", mode === "list" ? null : mode)}
                    className="view-btn"
                    title={title}
                    style={{
                      background: currentView === mode ? "var(--royal)" : "transparent",
                      color: currentView === mode ? "#fff" : "var(--ink-mute)",
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: "var(--line)" }} />
              <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: INK_MUTE, whiteSpace: "nowrap", fontWeight: 500 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 800, fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)" }}>{total}</strong> 本
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
