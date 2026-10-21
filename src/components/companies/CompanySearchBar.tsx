"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterChip } from "@/components/common/FilterChip";
import { DetailSearchToggle, ActiveFilterChips, DetailSearchPanel, type ActiveFilter } from "@/components/common/DetailSearch";
import { companySortLabel } from "@/components/companies/GridSortBar";
import { ListSearchButton } from "@/components/common/ListSearchButton";
import { useEffect, useRef, useState } from "react";
import type { BusinessDomainOption } from "@/lib/companies/businessDomains";
import { WORK_STYLE_LABELS, WORK_STYLE_OPTIONS } from "@/lib/constants/workStyle";
import { PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";
/* ⚠️ フェーズは**マスタ全件**を出す（該当0社の段も出す）。実データから絞らないこと
      —— 段階の梯子が歯抜けに見える。経緯は lib/constants/phase.ts のコメント。 */
import { PHASE_OPTIONS } from "@/lib/constants/phase";
import { COMPANY_STAGES } from "@/lib/companies/classification";

/**
 * 勤務形態フィルターを出すか。
 *
 * ⚠️ 2026-08-11 時点で `ow_companies.remote_work_status` に値があるのは
 *    **76社中2社**しかない。出すと「リモート可は2社だけ」と誤読されるので隠している。
 *    充填率が上がったら true に戻す。ロジック側（searchCompanies）は無変更。
 */
const SHOW_WORK_STYLE_FILTER = false;
import { fetchCompanyBookmarks } from "@/lib/bookmarks/companyBookmarks";
import { COMPANY_SIZE_GROUPS } from "@/lib/constants/employeeBand";



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
};

// ★FilterChip は 2026-09-18 に `components/common/FilterChip.tsx` へ切り出した。
//    ⚠️ `/people` と**同じ部品**。ここに書き戻すと、また同じ名前の別実装が2つになる。

// ── メインコンポーネント ──────────────────────────────────────────────────────
export function CompanySearchBar({
  industryOptions,
  industryTreeOptions,
  companySuggestions = [],
  sizeOptions = [],
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
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 企業カードと同じ一覧。共有キャッシュを通すので追加のリクエストは飛ばない
    fetchCompanyBookmarks().then((c) => setBookmarkCount(c.ids.size));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
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
  /* ⚠️ 選択肢は「掲載中の企業がある」まとまりだけ。選択中のものが消えていたら外せるように足す */
  const sizeChipOptions = sizeOptions.map((o) => ({ value: o.value, label: o.label }));
  if (currentSize && !sizeChipOptions.some((o) => o.value === currentSize)) {
    const g = COMPANY_SIZE_GROUPS.find((x) => x.value === currentSize);
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
  const locationOptions = PREFECTURE_FILTER_GROUPS.flatMap((g) =>
    g.prefectures.map((l) => ({ value: l, label: l, group: g.group })),
  );

  /* ★いま効いている条件のチップ（2026-09-17）。**「絞り込む」を閉じていても外に出す。**
     ⚠️★**消さないこと。** 6つのチップを畳んだので、これが無いと
        **絞り込んだ結果を見ている最中に理由が画面から消える**
        （/jobs の `activeChips` と同じ判断）。
     ⚠️ 並びは下のチップの並びと**同じ順**にしてある。片方だけ変えないこと。
     ⚠️ ✕ は近道であって唯一の入口ではない。「絞り込む」を開けば元のチップからも外せる。
     ⚠️ 検索語（`q`）は入れない。入力欄に出ていて、そこの ✕ で消せる。 */
  const activeChips: ActiveFilter[] = [];

  const labelOf = (opts: { value: string; label: string }[], v: string) =>
    opts.find((o) => o.value === v)?.label ?? v;

  /* ★詳細検索の中にある条件だけを出す（2026-10-09 の軸の入れ替え）。
        事業領域・都道府県は1段目に常に見えていて、選択状態をチップ自身が持つ。
        ここに入れると同じ語が2回並ぶ。⚠️ 並びは詳細検索の中の並びと同じ順にしてある */
  /* ⚠️ フェーズ（旧 ?phase=）と顧客の業界（旧 ?target=）はチップを外した（2026-10-12）。
        被リンクで来たときに外せるよう、選択中なら効いている条件として出す */
  if (currentPhase) activeChips.push({ key: "phase", label: labelOf(PHASE_OPTIONS, currentPhase), clear: () => updateParam("phase", null) });
  if (currentStage) activeChips.push({ key: "stage", label: labelOf(COMPANY_STAGES.map((x) => ({ value: x.value, label: x.label })), currentStage), clear: () => updateParam("stage", null) });
  if (currentSize) activeChips.push({ key: "size", label: labelOf(sizeChipOptions, currentSize), clear: () => updateParam("size", null) });
  if (currentTarget) activeChips.push({ key: "target", label: `顧客の業界: ${currentTarget}`, clear: () => updateParam("target", null) });
  if (currentWorkStyle) activeChips.push({ key: "workStyle", label: WORK_STYLE_LABELS[currentWorkStyle] ?? currentWorkStyle, clear: () => updateParam("workStyle", null) });
  if (currentForeign) activeChips.push({ key: "foreign", label: "外資系", clear: () => updateParam("foreign", null) });
  if (currentHiring) activeChips.push({ key: "hiring", label: "募集あり", clear: () => updateParam("hiring", null) });
  /* ⚠️ 並び替えは 2026-10-20 から件数の右に常に出しているので、選択中の条件には入れない（同じ語が2回並ぶ） */
  void currentSortLabel;

  /* ⚠️ かつてここで `activeFilters`（「絞り込み中」行のチップ）を組み立てていた。
        2026-09-06 に行ごと廃止したので消した。理由はこのファイル下部のコメント。
        ⚠️★2026-09-17 に**別の理由で**戻した（上の `activeChips`）。あちらは
           「同じことを2箇所に出していた」ので消したが、今回は**チップを畳んだので
           理由が画面から消える**のを防ぐため。**目的が違う。** */

  return (
    <>

      {/* ★lt-compact: 1024px 以上では検索・条件・件数を1行にまとめる（2026-10-21。globals.css）。⚠️ sortBar をこの直下に置くこと */}
      <div ref={wrapRef} className="lt-compact" style={{ marginBottom: 0 }}>
        {/* ★2026-10-20: 3行にした（柴さんの要望。見本 /dev/preview/list-toolbar）。
               1行目 検索欄（常に開いている）／2行目 絞り込み＋条件のチップ／3行目 件数と並び替え（sortBar） */}
        <div className="lt-search-row">
          <ListSearchButton
            alwaysOpen
            value={currentQuery}
            draft={inputValue}
            onDraftChange={(v) => { setInputValue(v); setOpenChip(null); }}
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
        <div className="csb-bar list-toolbar lt-chip-row" style={{ paddingTop: 0 }}>

          {/* ⚠️ 「一覧内を検索」のボタンは 2026-10-20 に上の行（常に開いた検索欄）へ移した */}

          {/* ★絞り込みのトグル（2026-09-17 に**全幅**で出すようにした）。
                 文言は `/jobs` と揃えて「詳細検索」。**片方だけ変えないこと。**
              ⚠️ 選択中の数をバッジで出す（閉じていても効いている件数が分かる）。 */}
          <DetailSearchToggle
            label="絞り込み"
            alwaysShowLabel
            open={filtersExpanded}
            count={activeChips.length}
            onToggle={() => setFiltersExpanded(!filtersExpanded)}
          />

          {/* ★1段目に常に見える軸（2026-10-09）: 事業領域 / 都道府県 / 話を聞ける人。
                 ⚠️ 詳細検索の中は フェーズ / 顧客の業界 / 外資系 / 募集あり / 並び替え。 */}
          {/* 事業領域（何を作っているか）
              ⚠️★**ラベルは「事業領域」。**「業種」に戻さないこと（2026-09-06）。
                 中身は `ow_business_domains` で、`/jobs` も「事業領域」と呼んでいる。
                 「業種」は `ow_industries`（IT・ソフトウェア／製造業…）に使う語で、
                 **すぐ隣の「対象業界」チップがそちらのマスタ**。名前が衝突する。
              ⚠️ URL のキーは `?industry=` のまま。2026-08-26 の移行で被リンクを
                 切らないためで、**キーとラベルが一致していないのは承知のうえ。** */}
          {/* ★業種（2026-10-12 / `?ind=`）。大分類を選ぶと、その小分類と大分類だけの会社も出る（提案A）。
                 ⚠️ 掲載中の会社がある業種だけ（0件の選択肢を出さない） */}
          {(industryTreeOptions.length > 0 || currentInd) && (
            <FilterChip
              label="業種"
              value={currentInd}
              options={industryTreeOptions}
              onSelect={(v) => { updateParam("ind", v); setOpenChip(null); }}
              isOpen={openChip === "ind"}
              onToggle={() => toggleChip("ind")}
              listStyle
              searchable
            />
          )}

          {/* ★事業（2026-10-12 に「事業領域」から改名。中身は ow_business_domains・URL は `?industry=` のまま）。
                 ⚠️ 主な事業以外（2つ目・3つ目）にも当たる（searchCompanies は全部の紐付けを見る）。
                 ⚠️ 全部を並べない。main の事業を先に出し、search の事業は入力して探す（searchOnly）。
                 ⚠️ 掲載中の会社がある事業だけ（getBusinessDomainFacets）。 */}
          <FilterChip
            label="事業"
            value={currentIndustry}
            options={industryOptions.map((d) => ({
              value: d.slug, label: d.name,
              searchOnly: d.display_kind === "search",
              keywords: (d.aliases ?? []).join(" "),
              count: "count" in d ? (d as { count: number }).count : undefined,
            }))}
            onSelect={(v) => { updateParam("industry", v); setOpenChip(null); }}
            isOpen={openChip === "industry"}
            onToggle={() => toggleChip("industry")}
            listStyle
            searchable
            hint="2つ目・3つ目の事業にも当たります"
          />

          {/* 都道府県。⚠️ 47件あるので `searchable`（絞り込み入力）を付ける */}
          <FilterChip
            label="都道府県"
            value={currentLocation}
            options={locationOptions}
            onSelect={(v) => { updateParam("location", v); setOpenChip(null); }}
            isOpen={openChip === "location"}
            onToggle={() => toggleChip("location")}
            listStyle
            searchable
          />

          {/* ⚠️ 「話を聞ける人」（`?talk=1`）のトグルは 2026-10-16 に撤去した（面談OKの撤去） */}


          {/* ★選択中の条件。⚠️★**閉じているときだけ出す。** 開いているときは
                 ピル自身が選択状態を持っているので、同じ語が2回並ぶ
                 （/jobs で 2026-09-09 に同じ判断をしている）。 */}
          {!filtersExpanded && <ActiveFilterChips chips={activeChips} />}

          {/* フィルターチップ群。★入れ物は共通（2026-10-09）。1024px 未満は右からのドロワーで、
                 件数は /api/companies/count から少し待って取り直す（ページの本体と同じ関数で数える） */}
          <DetailSearchPanel
            open={filtersExpanded}
            onClose={() => setFiltersExpanded(false)}
            countUrl={`/api/companies/count?${searchParams.toString()}`}
            unit="社"
            title="絞り込み"
          >

          {/* ★事業ステージ（2026-10-12。旧「フェーズ」を置き換えた）。7つとも出す（段階の梯子が歯抜けに見えないように。フェーズと同じ扱い） */}
          <FilterChip
            label="事業ステージ"
            value={currentStage}
            options={COMPANY_STAGES.map((x) => ({ value: x.value, label: x.label, desc: x.desc }))}
            onSelect={(v) => { updateParam("stage", v); setOpenChip(null); }}
            isOpen={openChip === "stage"}
            onToggle={() => toggleChip("stage")}
            listStyle
          />

          {/* ★会社規模（2026-10-10）。従業員数の帯を4つにまとめて出す（`COMPANY_SIZE_GROUPS`）。
                 ⚠️ 0件のまとまりは出さない（掲載中の企業がある分だけサーバーが渡す） */}
          {sizeChipOptions.length > 0 && (
            <FilterChip
              label="会社規模"
              value={currentSize}
              options={sizeChipOptions}
              onSelect={(v) => { updateParam("size", v); setOpenChip(null); }}
              isOpen={openChip === "size"}
              onToggle={() => toggleChip("size")}
            />
          )}




          {/* ③ 勤務形態フィルター
                 ⚠️ **2026-08-11 に UI から外した（ロジックは残してある）。**
                    `ow_companies.remote_work_status` に値があるのは **76社中2社**だけ
                    （残りは migration が一括投入した 'hybrid' を 2026-07-27 に
                     NULL へ戻したため）。この状態で絞り込みを出すと
                    「リモート可の企業は2社しかない」と誤読される。
                 ⚠️ **消していないのは、充填率が上がったら戻すため。**
                    `SHOW_WORK_STYLE_FILTER` を true にすれば元に戻る。
                    URL の `?workStyle=` も引き続き効く（searchCompanies 側は無変更）。 */}
          {SHOW_WORK_STYLE_FILTER && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              className={`csb-filter-pill${currentWorkStyle ? " active" : ""}`}
              onClick={() => currentWorkStyle ? updateParam("workStyle", null) : toggleChip("workStyle")}
            >
              {currentWorkStyle ? (WORK_STYLE_LABELS[currentWorkStyle] ?? currentWorkStyle) : "勤務形態"}
              {currentWorkStyle
                ? <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>
                : <span style={{ fontSize: 12, marginLeft: 2 }}>▾</span>}
            </button>
            {openChip === "workStyle" && (
              <div className="csb-filter-pill-menu">
                {/* ⚠️ ラベルは workStyle.ts の1箇所で決める。ここに直書きしない。
                       アイコンは 2026-08-08 に削除（ラベルだけで意味は通る）。 */}
                {WORK_STYLE_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" className={`csb-filter-pill-item${currentWorkStyle === value ? " selected" : ""}`}
                    onClick={() => { updateParam("workStyle", value); setOpenChip(null); }}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ⚠️ **年収フィルタは 2026-08-25 に外した。戻さないこと。**
                ① 年収はポジションによって違うので、会社単位の1つの数字では表せない
                ② 実データでも成り立っていなかった。掲載79社のうち求人に年収が入って
                   いるのは**1社だけ**（`ow_companies.avg_salary` は0社）で、
                   どの閾値を選んでも**78社が無条件に落ちていた**
                （2026-08-20 に外した年齢フィルタと同じ形。生年月日が未入力の人を
                  無条件に落としていて、法令以前に機能として壊れていた）
             ⚠️ 旧 URL の `?salaryMin=` は無視される。壊れない。 */}
          {/* 外資系 */}
          <button
            type="button"
            className={`foreign-toggle${currentForeign ? " active" : ""}`}
            onClick={() => updateParam("foreign", currentForeign ? null : "1")}
            aria-pressed={currentForeign}
          >
            外資系{currentForeign && <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>}
          </button>

          {/*
            ⚠️ ラベルは「募集あり」。2026-08-06 まで「面談受付中」と書いていたが、
                 2026-08-08 に「求人あり」→「募集あり」（ナビの「募集」に用語を揃えた）。
               ?hiring=1 が絞っているのは ow_jobs に公開求人があるかどうか
               （lib/search/companies.ts で hiringSet を作る）で、
               面談の可否（accepting_casual_meetings）ではない。
               クエリパラメータ名 hiring と絞り込みロジックは変えていない。
          */}
          <label className={`csb-hiring${currentHiring ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={currentHiring}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: currentHiring ? "#fff" : "#ea580c",
              animation: "pulseDot 1.8s ease-in-out infinite",
              display: "inline-block",
            }} />
            {currentHiring ? (
              <>募集あり <span style={{ fontSize: 12, opacity: 0.85 }}>✕</span></>
            ) : (
              <>募集あり</>
            )}
          </label>

          {/* ⚠️★**「すべてクリア」は廃止した**（2026-09-06 / 柴さんの判断）。
                 絞り込みが1つ付くたびに現れて右端の並びが動くうえ、
                 **すべての条件は個別に外せる** —— チップは ✕、
                 外資系と募集ありはもう一度押せば解除される（元からトグル）。
              ⚠️ 戻すなら、検索欄の ✕ と役割が重ならないようにすること
                 （あちらは検索文字だけを消す）。 */}

          {/* ⚠️ 並び替えは 2026-10-20 に詳細検索の中から件数の右（sortBar）へ移した */}

          </DetailSearchPanel>

          {/* 保存件数 */}
          {bookmarkCount > 0 && (
            <a
              href="/mypage"
              style={{
                /* ⚠️★**並び替えがある行では `marginLeft: "auto"` を付けない**（2026-10-01）。
                      `.sort-bar-row` にも auto があり、**2つあると余白が等分されて
                      並び替えが右端まで行かない。** あるときは並び替えの直後に並ぶ。
                   ⚠️ 並び替えが無いとき（絞り込み中）は**こちらが右端役**。外さないこと。 */
                marginLeft: "auto",
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
        </div>

        {/* ★3行目: 件数（左）と並び替え（右）。⚠️ 出すかどうかと件数はページが決める */}
        {sortBar}

        {/* ⚠️★**「絞り込み中」のサマリー行は廃止した**（2026-09-06 / 柴さんの判断）。
               絞り込みはチップ自体が選択状態（濃紺 + ✕）で示すので、
               同じことを2箇所に出していた。「なくても分かる」。
            ⚠️ 復活させるなら、**チップに出ない絞り込みが画面から消えないか**を
               先に確かめること（ここには `workStyle` も入っていた。
               あれは `SHOW_WORK_STYLE_FILTER = false` でチップ自体が出ていない）。 */}
      </div>
    </>
  );
}
