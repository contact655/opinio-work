"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SortSelect } from "@/components/common/SortSelect";

type Props = { totalCount: number };

const SORT_OPTIONS = [
  {
    value: "newest",
    label: "新着順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
  /* ⚠️ 「募集中あり優先」（value: "jobs"）は 2026-08-18 に外した。
        検索バーの「募集あり」フィルタと**同じことを別の形で言っていた**（ルール⑧）。
        しかも公開求人を持つ企業は 79社中1社なので、並べ替えても動くのは1社だけだった。
     ⚠️ 旧 URL の `?sort=jobs` は既定（updated_at 降順＝新着順）に落ちる。壊れない。 */
  /* ⚠️ 「年収高い順」（value: "salary"）は 2026-08-25 に外した。**戻さないこと。**
        年収はポジションによって違うので、会社単位の1つの数字では表せない。
        実データでも、求人に年収が入っている企業は 79社中**1社**しかなく、
        残り78社は 0 として並ぶだけだった（「募集中あり優先」を外したのと同じ理由）。
     ⚠️ 旧 URL の `?sort=salary` は既定（updated_at 降順＝新着順）に落ちる。壊れない。 */
  {
    value: "employees",
    label: "社員数順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    value: "disclosure",
    label: "開示充実順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
      </svg>
    ),
  },
];

export function GridSortBar({ totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";
  const currentView = searchParams.get("view") ?? "card";

  const setSort = (s: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s === "newest") p.delete("sort");
    else p.set("sort", s);
    router.push(`/companies?${p.toString()}`);
  };

  const setView = (v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v === "card") p.delete("view");
    else p.set("view", v);
    router.push(`/companies?${p.toString()}`);
  };

  return (
    <>

      {/* ⚠️★**白いカードの装飾（枠・影・角丸・余白）を外した**（2026-09-17）。
             この行は検索窓と同じツールバーの中に入ったので、装飾を残すと
             「窓の中の窓」になり、**行の高さが 62px になってツールバー全体が
             121px に膨らむ**（実測）。`/jobs` で同じ理由で外したのと同じ。
          ⚠️ 区切りは中の縦罫だけ。**背景も枠も足さないこと。** */}
      <div className="sort-bar-row" style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>

        {/* ★ピル3つ（**約345px**）から畳んだ（2026-09-17 / 柴さんの要望）。約140px になる。
               ⚠️★**いま何順かは閉じていても見える**（ボタンに現在値が出る）。
                  隠れるのは他の選択肢だけ。絞り込みのチップとは事情が違う。
               ⚠️ 選択肢はこのファイルの `SORT_OPTIONS`（外した2つの理由もそこにある）。
                  **部品側に選択肢を持たせないこと。**
               ⚠️★`icon` は使わなくなったが `SORT_OPTIONS` から消していない。
                  **あの定数のコメントに「なぜ2つ外したか」が書いてある**ので、
                  形を崩さずそのまま残す。 */}
        <SortSelect
          value={current}
          onChange={setSort}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />

        {/* 右: ビュートグル + 件数 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* ビュートグル（一覧/詳細） */}
          <div style={{
            display: "flex", gap: 2,
            background: "var(--line-soft)", borderRadius: 8, padding: 2,
          }}>
            <button
              type="button"
              onClick={() => setView("card")}
              className="view-btn"
              style={{
                background: currentView === "card" ? "var(--royal)" : "transparent",
                color: currentView === "card" ? "#fff" : "var(--ink-mute)",
              }}
              title="コンパクト一覧"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              一覧
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className="view-btn"
              style={{
                background: currentView === "list" ? "var(--royal)" : "transparent",
                color: currentView === "list" ? "#fff" : "var(--ink-mute)",
              }}
              title="詳細リストビュー"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              詳細
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: "var(--line)" }} />

          {/* 件数 */}
          <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
            <strong style={{
              color: "var(--ink)", fontWeight: 800,
              fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 16,
            }}>{totalCount}</strong>
            <span style={{ marginLeft: 2 }}>社</span>
          </span>
        </div>
      </div>
    </>
  );
}
