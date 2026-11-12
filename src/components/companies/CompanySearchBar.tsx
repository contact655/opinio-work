"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ActiveFilterRow, FilterButton, ListFilterDrawer, type FilterSection, type FilterValues } from "@/components/common/ListFilterDrawer";
import { companySortLabel } from "@/components/companies/GridSortBar";
import { ListSearchButton } from "@/components/common/ListSearchButton";
import { useEffect, useState } from "react";
import type { BusinessDomainOption } from "@/lib/companies/businessDomains";
import { WORK_STYLE_LABELS } from "@/lib/constants/workStyle";
import { PREFECTURE_FILTER_GROUPS, PREFECTURES } from "@/lib/utils/location";
/* ⚠️ フェーズは**マスタ全件**を出す（該当0社の段も出す）。実データから絞らないこと
      —— 段階の梯子が歯抜けに見える。経緯は lib/constants/phase.ts のコメント。 */
import { PHASE_OPTIONS } from "@/lib/constants/phase";
import { COMPANY_STAGES } from "@/lib/companies/classification";

/* ⚠️ 勤務形態（`?workStyle=`）の選択肢は 2026-08-11 に画面から外したまま（`remote_work_status` が76社中2社しか無いため）。
      URL で効いているときだけ、選んでいる条件のチップに出す（下の activeChips） */
import { fetchCompanyBookmarks } from "@/lib/bookmarks/companyBookmarks";
import { COMPANY_SIZE_GROUPS } from "@/lib/constants/employeeBand";
import { splitMulti } from "@/lib/search/companyListParams";



type Props = {
  /** 事業領域の選択肢。⚠️ **マスタが唯一の出どころ。** ここに値を書かない。
   *  ⚠️ 実データに1社でもあるものだけをサーバ側が渡す（0件の選択肢を出さない）。 */
  industryOptions: BusinessDomainOption[];
  /** ★業種の選択肢（2026-10-12 / `?ind=`）。掲載中の会社がある業種だけ（fetchIndustryFacets） */
  industryTreeOptions: { value: string; label: string; group: string; count: number }[];
  companySuggestions?: { id: string; name: string }[];
  /** ★会社規模の選択肢（2026-10-10）。⚠️ 掲載中の企業が1社以上あるまとまりだけ（0件の選択肢を出さない）。
   *  空ならチップごと出さない（ただし選択中なら外せるように出す） */
  sizeOptions?: { value: string; label: string; count: number }[];
  /** ★都道府県ごとの掲載企業数（2026-10-29）。会社がある県を上に、0社の県は薄くして下に出す。
   *  ⚠️ 47県すべて出す方針（CLAUDE.md ⑥）は変えない。取れなければ null（従来の並び）。 */
  prefectureCounts?: Record<string, number> | null;
};

// ★FilterChip は 2026-09-18 に `components/common/FilterChip.tsx` へ切り出した。
//    ⚠️ `/people` と**同じ部品**。ここに書き戻すと、また同じ名前の別実装が2つになる。

// ── メインコンポーネント ──────────────────────────────────────────────────────
export function CompanySearchBar({
  industryOptions,
  industryTreeOptions,
  companySuggestions = [],
  sizeOptions = [],
  prefectureCounts = null,
  /**
   * ★並び替え・表示形式・件数（2026-09-17）。**同じ行に入れるために受け取る。**
   *
   * それまで `/companies` の上部は**帯が2本**（検索 95px ＋ 並び替え 103px）で、
   * 一覧が始まるのは **275px**（本番 1440px 実測）だった。/jobs を 2026-09-17 に
   * 1本（69px / 162px）にしたのと同じ形に揃えた（柴さんの要望）。
   *
   * ⚠️★**ここで `GridSortBar` 本体を描かないこと**（並び替えだけは `CompanySortSelect` を使う）。表示形式の切り替えを出すかと件数は
   *    ページが持っている（2026-10-09 から絞り込み中も並び替えと件数を出す）。**判定を2箇所に増やさない。**
   */
  sortBar = null,
}: Props & { sortBar?: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  /* ★「フィルター」のパネル（2026-11-12）。条件はすべてここで選ぶ（/people と同じ形） */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    // 企業カードと同じ一覧。共有キャッシュを通すので追加のリクエストは飛ばない
    fetchCompanyBookmarks().then((c) => setBookmarkCount(c.ids.size));
  }, []);

  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const filtered = inputValue.length >= 1
    ? companySuggestions
        .filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase()))
        .slice(0, 6)
    : [];

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    /* ★履歴を積まない（2026-10-09 / 柴さんの指示）。条件を3つ選んでも「戻る」1回で
          一覧に来る前のページへ戻る。⚠️ push に戻さないこと（戻るが条件を1つずつ外す操作になる） */
    router.replace(`?${params.toString()}`);
  }

  /* ★「一覧内を検索」になった（2026-10-01 / ステップ2）。
        ⚠️★**打つたびに URL を書き換えるのはやめた。** Enter で確定する。
           それまで 300ms のデバウンスで `?q=` を push しており、
           1文字ごとに履歴が積まれていた（戻るが効かない形）。
        ⚠️ `inputValue` は**入力中の値**。確定済みは URL（`currentQuery`）。
           サジェストの計算に入力中の値が要るので、ページ側で持っている。 */
  const currentQuery = searchParams.get("q") ?? "";

  function commitQuery(v: string) {
    setInputValue(v);
    updateParam("q", v || null);
  }

  function clearQuery() {
    setInputValue("");
    updateParam("q", null);
  }

  const currentPhase      = searchParams.get("phase") ?? "";
  const currentLocation   = searchParams.get("location") ?? "";
  const currentIndustry   = searchParams.get("industry") ?? "";
  const currentTarget     = searchParams.get("target") ?? "";
  const currentInd        = searchParams.get("ind") ?? "";
  const currentStage      = searchParams.get("stage") ?? "";
  const currentHiring     = searchParams.get("hiring") === "1";
  const currentForeign    = searchParams.get("foreign") === "1";
  const currentWorkStyle  = searchParams.get("workStyle") ?? "";
  const currentSize       = searchParams.get("size") ?? "";
  /* ★複数選択の値（2026-10-29） */
  const indValues      = splitMulti(currentInd);
  const industryValues = splitMulti(currentIndustry);
  const locationValues = splitMulti(currentLocation);
  const stageValues    = splitMulti(currentStage);
  const sizeValues     = splitMulti(currentSize);
  /* ⚠️ 選択肢は「掲載中の企業がある」まとまりだけ。選択中のものが消えていたら外せるように足す */
  const sizeChipOptions = sizeOptions.map((o) => ({ value: o.value, label: o.label }));
  for (const sv of sizeValues) {
    if (sizeChipOptions.some((o) => o.value === sv)) continue;
    const g = COMPANY_SIZE_GROUPS.find((x) => x.value === sv);
    if (g) sizeChipOptions.push({ value: g.value, label: g.label });
  }
  const currentSortLabel  = companySortLabel(searchParams.get("sort"));

  /*
    都道府県は **47件すべて**を「よく選ばれる」→「すべての都道府県」の順で出す。
    ⚠️★**分け方も語彙も [lib/utils/location.ts](../../lib/utils/location.ts) の
       `PREFECTURE_FILTER_GROUPS` が唯一の出どころ。** `/jobs` の2箇所も同じものを使う。
       ここで COMMON_PREFECTURES を展開し直さないこと（3箇所で並びが割れる）。
    ⚠️ 該当0件の県も出す（都道府県だけの例外。経緯は location.ts のコメント）。
  */
  const locationOptions = prefectureCounts
    ? [
        ...PREFECTURES.filter((p) => (prefectureCounts[p] ?? 0) > 0).map((p) => ({
          value: p, label: p, group: "会社がある都道府県", count: prefectureCounts[p],
        })),
        ...PREFECTURES.filter((p) => !((prefectureCounts[p] ?? 0) > 0)).map((p) => ({
          value: p, label: p, group: "そのほかの都道府県", muted: true,
        })),
      ]
    : PREFECTURE_FILTER_GROUPS.flatMap((g) =>
        g.prefectures.map((l) => ({ value: l, label: l, group: g.group })),
      );

  const labelOf = (opts: readonly { value: string; label: string }[], v: string) =>
    opts.find((o) => o.value === v)?.label ?? v;
  void currentSortLabel;

  /* ★「フィルター」のパネルの項目（2026-11-12 / 柴さんの指示「ユーザーと同じように」）。
        条件の意味と URL のキーはそれまでのチップと同じ（同じ項目の中は OR・項目どうしは AND）。
     ⚠️ 選択肢の作り方は変えていない（業種・事業・会社規模は掲載中の会社があるものだけ・都道府県とステージは全部） */
  const industrySectionOptions = industryOptions.map((d) => ({
    value: d.slug, label: d.name,
    searchOnly: d.display_kind === "search",
    keywords: (d.aliases ?? []).join(" "),
    count: "count" in d ? (d as { count: number }).count : undefined,
  }));
  const sections: FilterSection[] = [
    ...((industryTreeOptions.length > 0 || currentInd)
      ? [{ key: "ind", title: "業種", kind: "multi" as const, options: industryTreeOptions, searchable: true }]
      : []),
    { key: "industry", title: "事業", kind: "multi", options: industrySectionOptions, searchable: true, hint: "2つ目・3つ目の事業にも当たります" },
    { key: "location", title: "都道府県", kind: "multi", options: locationOptions, searchable: true },
    { key: "stage", title: "事業ステージ", kind: "multi", options: COMPANY_STAGES.map((x) => ({ value: x.value, label: x.label, desc: x.desc })), columns: 1 },
    ...(sizeChipOptions.length > 0 ? [{ key: "size", title: "会社規模", kind: "multi" as const, options: sizeChipOptions }] : []),
    { key: "foreign", title: "資本", kind: "toggle", label: "外資系" },
    { key: "hiring", title: "募集", kind: "toggle", label: "募集あり" },
  ];
  const values: FilterValues = {
    ind: indValues, industry: industryValues, location: locationValues, stage: stageValues, size: sizeValues,
    foreign: currentForeign ? ["1"] : [], hiring: currentHiring ? ["1"] : [],
  };
  /* パネルで選んだ条件をまとめて当てる（URL を1回だけ書き換える。履歴は積まない） */
  function applyFilters(next: FilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["ind", "industry", "location", "stage", "size"]) {
      const v = (next[k] ?? []).join(",");
      if (v) params.set(k, v); else params.delete(k);
    }
    for (const k of ["foreign", "hiring"]) {
      if ((next[k] ?? []).length > 0) params.set(k, "1"); else params.delete(k);
    }
    router.replace(`?${params.toString()}`);
  }
  /* リセットは条件だけを外す（検索語・並び替え・表示形式は残す）。URL だけで効いている旧フェーズなども外す */
  function resetFilters() {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["ind", "industry", "location", "stage", "size", "foreign", "hiring", "phase", "target", "workStyle"]) params.delete(k);
    router.replace(`?${params.toString()}`);
  }
  const filterCount = Object.values(values).reduce((n, v) => n + v.length, 0)
    + (currentPhase ? 1 : 0) + (currentTarget ? 1 : 0) + (currentWorkStyle ? 1 : 0);

  /* ★選んでいる条件のチップ（2026-11-12）。パネルを閉じていても、いま効いている条件を全部ここに出す。
     ⚠️ 消さないこと（条件をパネルに畳んだので、無いと絞り込んだ理由が画面から消える）。
     ⚠️ 検索語（q）は入れない（入力欄に出ていて、そこの ✕ で消せる）。
     ⚠️ 旧フェーズ・顧客の業界・勤務形態はパネルに項目が無いが、URL で効いているときはここに出して外せるようにする */
  const removeOne = (key: string, v: string, cur: string[]) => {
    const rest = cur.filter((x) => x !== v);
    updateParam(key, rest.length > 0 ? rest.join(",") : null);
  };
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...indValues.map((v) => ({ key: `ind:${v}`, label: labelOf(industryTreeOptions, v), onRemove: () => removeOne("ind", v, indValues) })),
    ...industryValues.map((v) => ({ key: `industry:${v}`, label: labelOf(industrySectionOptions, v), onRemove: () => removeOne("industry", v, industryValues) })),
    ...locationValues.map((v) => ({ key: `location:${v}`, label: v, onRemove: () => removeOne("location", v, locationValues) })),
    ...stageValues.map((v) => ({ key: `stage:${v}`, label: labelOf(COMPANY_STAGES, v), onRemove: () => removeOne("stage", v, stageValues) })),
    ...sizeValues.map((v) => ({ key: `size:${v}`, label: labelOf(sizeChipOptions, v), onRemove: () => removeOne("size", v, sizeValues) })),
    ...(currentForeign ? [{ key: "foreign", label: "外資系", onRemove: () => updateParam("foreign", null) }] : []),
    ...(currentHiring ? [{ key: "hiring", label: "募集あり", onRemove: () => updateParam("hiring", null) }] : []),
    ...(currentPhase ? [{ key: "phase", label: labelOf(PHASE_OPTIONS, currentPhase), onRemove: () => updateParam("phase", null) }] : []),
    ...(currentTarget ? [{ key: "target", label: `顧客の業界: ${currentTarget}`, onRemove: () => updateParam("target", null) }] : []),
    ...(currentWorkStyle ? [{ key: "workStyle", label: WORK_STYLE_LABELS[currentWorkStyle] ?? currentWorkStyle, onRemove: () => updateParam("workStyle", null) }] : []),
  ];

  return (
    <>

      {/* ★lt-compact: 1024px 以上では検索・条件・件数を1行にまとめる（2026-10-21。globals.css）。⚠️ sortBar をこの直下に置くこと */}
      {/* ★lt-compact--keep（2026-10-29 / 柴さんの指示）: 1024px 以上で、絞り込みを開いても・条件を選んでも
             1行目（検索・チップ・件数）を動かさない。パネルと選択中の条件は1行目の下に全幅で出す（globals.css）。
             それまでは開いた瞬間に2段へ組み変わり、押した「絞り込み」ボタン自体が左へ飛んでいた。 */}
      <div className="lt-compact lt-like-people" style={{ marginBottom: 0 }}>
        {/* ★2026-10-20: 3行にした（柴さんの要望。見本 /dev/preview/list-toolbar）。
               1行目 検索欄（常に開いている）／2行目 絞り込み＋条件のチップ／3行目 件数と並び替え（sortBar） */}
        <div className="lt-search-row">
          <ListSearchButton
            alwaysOpen
            value={currentQuery}
            draft={inputValue}
            onDraftChange={setInputValue}
            onCommit={commitQuery}
            onClear={clearQuery}
            placeholder="企業名・キーワードで検索"
            inputAriaLabel="企業を検索"
            suggestions={filtered.map((c) => ({ key: c.id, label: c.name }))}
            onPickSuggestion={(sg) => commitQuery(sg.label)}
          />
        </div>
        {/* ★`list-toolbar`: スマホでは1行に並べ、横にスクロールする（2026-10-17。globals.css 末尾） */}
        {/* ⚠️ 下の余白は CSS（.lt-chip-row）。インラインに戻すと1行にまとめたときに消せない */}
        {/* ★2026-11-12: 条件のチップを1行に並べる形をやめ、「フィルター」1つにした（/people と同じ形。柴さんの指示）。
               条件はすべてパネル（ListFilterDrawer）で選ぶ。1024px 以上は並び替えのすぐ左に並ぶ（globals.css の .lt-like-people）。
            ⚠️ チップを1行に並べる形に戻さないこと。⚠️ 選んでいる条件は下の ActiveFilterRow に必ず出す */}
        <div className="csb-bar list-toolbar lt-chip-row" style={{ paddingTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {/* 保存件数 */}
          {bookmarkCount > 0 && (
            <a
              href="/mypage"
              className="csb-bookmark-link"
              style={{
                flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 999,
                background: "#fef2f2", border: "1.5px solid #fecaca",
                color: "#dc2626", fontSize: 12, fontWeight: 700,
                textDecoration: "none", whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 13 }}>♥</span>
              {bookmarkCount}件保存中
            </a>
          )}
          <FilterButton count={filterCount} onClick={() => setDrawerOpen(true)} />
        </div>

        {/* ★3行目: 件数（左）と並び替え（右）。⚠️ 出すかどうかと件数はページが決める */}
        {sortBar}

        <ActiveFilterRow chips={activeChips} />

        {/* ⚠️★**「絞り込み中」のサマリー行は廃止した**（2026-09-06 / 柴さんの判断）。
               絞り込みはチップ自体が選択状態（濃紺 + ✕）で示すので、
               同じことを2箇所に出していた。「なくても分かる」。
            ⚠️ 復活させるなら、**チップに出ない絞り込みが画面から消えないか**を
               先に確かめること（ここには `workStyle` も入っていた。
               あれは `SHOW_WORK_STYLE_FILTER = false` でチップ自体が出ていない）。 */}
      </div>
      <ListFilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="企業フィルター"
        sections={sections} values={values} onApply={applyFilters} onReset={resetFilters} />
    </>
  );
}
