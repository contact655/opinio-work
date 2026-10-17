"use client";

import { CandidateFilterDrawer, drawerFilterCount } from "./CandidateFilterDrawer";
import { OVERSEAS, residenceKey } from "@/lib/utils/location";
import { ApproachButton } from "@/components/approaches/ApproachButton";
/* ★候補者の形・絞り込み・並び替えは lib/business/candidates/model.ts の1か所（2026-10-10）。
      段3の新着メールも同じ関数を使う。⚠️ ここに条件を書き戻さないこと。 */
import {
  ACTIVITY_SORTS, AGE_SORTS, CANDIDATE_SORT_OPTIONS, TENURE_BANDS,
  filterCandidates, formatJstSlashMonthDay, isNewSince, sortCandidates,
  type Candidate,
} from "@/lib/business/candidates/model";
import { CandidatePreview } from "./CandidatePreview";
import { StanceBadge } from "@/components/candidates/StanceMeter";
import type { TouchpointMaterials } from "@/lib/business/candidates/model";
import { APPROACH_TEST_COMPANY_MESSAGE } from "@/lib/constants/companyApproaches";
import { CANDIDATE_SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
/* ⚠️★**他の3画面（/companies・/jobs・/people）と同じ部品**（2026-09-20）。
      ここに似た実装を作らないこと ——`FilterChip` は 2026-09-18 に
      「同じ名前の別実装が2つあった」のを1つに畳んだもので、**3つ目を作らない**。 */
import { FilterPopoverChip } from "@/components/common/FilterPopoverChip";
import { ResidenceOptions, RoleTreeOptions, STANCE_OPTIONS, StanceOptions, TenureOptions, computeAxisCounts, residenceChipLabel, roleChipLabel } from "./filterAxes";
import { SortSelect } from "@/components/common/SortSelect";
import { SplitDivider } from "@/components/common/SplitDivider";
import { PersonAvatar } from "@/components/common/PersonAvatar";
/* ★保存した条件（2026-09-21）。⚠️ 型・既定値・上限は
      [lib/business/savedSearch.ts](../../../lib/business/savedSearch.ts) の1箇所。
      **画面にローカル定数を書かないこと**（上限が画面と API で食い違った前例がある）。 */
import {
  EMPTY_SAVED_FILTERS,
  isEmptyFilters,
  MAX_SAVED_SEARCH_NAME,
  type SavedCandidateFilters,
  type SavedSearch,
} from "@/lib/business/savedSearch";

/**
 * ★転職意欲の選択肢（2026-09-19 / 柴さんの指示）。⚠️ 実体は filterAxes.tsx の STANCE_OPTIONS（2026-10-13 に移した）。
 *
 * ⚠️★**ラベルを書き写さないこと。** 正は `lib/constants/careerPreferences.ts` の
 *    `CAREER_STANCES` で、オンボーディングと `/mypage` も同じ定数を見る。
 * ⚠️★**`no_contact` は出さない。** 母集合（page.tsx）が既に落としているので、
 *    選択肢に出すと**必ず0件になる条件**を並べることになる。
 *    ⚠️ 母集合の条件を変えるときは、ここも一緒に見ること。
 */

/**
 * ★転職意欲の更新時期の帯（2026-09-19 / 柴さんの指示）。
 *
 * ⚠️★**読むのは `career_stance_updated_at`。`stance_updated_at` ではない。**
 *    あちらは「転職・面談の状況カードの最終更新」で、**面談OK の登録・公開切替でも打たれる**。
 *    使うと「面談OK を触っただけの人」が「転職意欲を更新した人」として当たる。
 * ⚠️ 3ヶ月を入れてあるのは、プロフィールの鮮度判定（`lib/profile/freshness.ts` の
 *    `STALE_AFTER_MONTHS = 3`）と同じ区切りがこのプロダクトに既にあるため。
 */
/* ★並び替えの選択肢・社会人年数の帯・更新時期の帯は model.ts（2026-10-10 に移した）。
   ⚠️ 年齢・性別に関わる軸を足さないこと（労働施策総合推進法9条・均等法5条）。 */
const SORT_OPTIONS = CANDIDATE_SORT_OPTIONS;

/** 月数 → カードに出す1行。未算出（null）は**何も出さない**（「0年」と書かない） */
function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/* ★一覧と詳細の幅（2026-10-13 ステップ4）。区切り線を自由に動かす */
const CAND_DIVIDER_W = 12;          // 掴める幅（見た目の線は1px）
const CAND_LIST_MIN = 260;
const CAND_PANE_MIN = 380;
const CAND_COLUMNS_MIN_PANE = 680;  // 右欄がこれ以上なら プロフィール｜メッセージ の2列
const CAND_COMPACT_MAX_LIST = 420;  // 一覧がこれ以下なら細いカード
const CAND_KEY_STEP = 40;           // ←→ で動かす量

/* ⚠️ `/dev/preview/candidates` が固定データを作るために export している（実体は model.ts）。 */
export type { Candidate };



/* ⚠️★**アバターに人ごとの色を割り当てないこと**（2026-09-21 に撤去）。
      理由と語彙は [lib/avatarColor.ts](../../../lib/avatarColor.ts)
      に集約してある。**ここに色の配列を書き戻さないこと。**
      それまでは `id` のハッシュから6色を引いて、アバターの丸と
      カード左端の 4px のバーに同じ色を敷いていた。 */


/* ★居住地の表示（2026-10-12）。判定は `residenceKey` の1か所（絞り込みと同じ）。
   「海外（アメリカ）」は国名ごと出す。対応づけられない値はそのまま出す（推測で丸めない） */
function residenceLabel(location: string | null): string | null {
  if (!location) return null;
  const k = residenceKey(location);
  return k === OVERSEAS ? location : (k ?? location);
}



/* ⚠️★`SidebarLabel` と `Pill` は 2026-09-20 に削除した（サイドバーをやめたため）。
      **戻さないこと。** 絞り込みのチップは `components/common/FilterChip.tsx` を使う
      —— `/companies` と `/people` が同じものを使っており、3つ目の実装を作らない。
   ⚠️ `Pill` は `purple` のパレットを持っていたが、ui-conventions は**紫を使わない**
      と決めている。復活させるときに一緒に戻さないこと。 */

export default function CandidatesClient({
  candidates,
  roleFilterTree = [],
  initialSelected = null,
  initialSaved = null,
  companyShortName = null,
  companyLimitLine = null,
  canAct = true,
  ageFilterEnabled = false,
  activityEnabled = false,
  initialFilters = null,
  approachJobs = [],
  touchpointMaterials = null,
  notesEnabled = false,
  limitReached = false,
  viewerName = null,
  stageStorageKey = null,
  columnsStorageKey = null,
}: {
  /** ★段（一覧と詳細の幅）を覚える localStorage のキー（会社・担当者ごと。2026-10-13）。null なら覚えない */
  stageStorageKey?: string | null;
  /** ★右欄の2列表示（プロフィール｜メッセージ）の比率を覚えるキー（会社・担当者ごと。外側とは別。2026-10-13）。null なら覚えない */
  columnsStorageKey?: string | null;
  /** ★取得件数が上限（500名）に達したか（2026-10-13） */
  limitReached?: boolean;
  /** ★見ている担当者の名前（見送った直後の「○○さんが見送り」に使う。2026-10-13） */
  viewerName?: string | null;
  /** ★右欄が使う会社の材料（2026-10-13。page.tsx が loadCompanyCandidates の結果から渡す） */
  approachJobs?: { id: string; title: string }[];
  touchpointMaterials?: TouchpointMaterials | null;
  notesEnabled?: boolean;
  /** ★URL（`?f=`）から復元した条件（2026-10-12）。保存した条件と同じ形（`parseSavedFilters` を通したもの） */
  initialFilters?: SavedCandidateFilters | null;
  /** ★最近の利用の絞り込み・並び替え（`isCandidateActivityEnabled()`。本番は無効） */
  activityEnabled?: boolean;
  /** ★年齢の絞り込み・並び替えを出すか（`isCandidateAgeFilterEnabled()`。本番は無効）。⚠️ 年齢の表示はこれと関係なく出す */
  ageFilterEnabled?: boolean;
  /** ★カードの「〈会社名〉と合うところ（〇）」の会社名。取れなければ null（「貴社」） */
  companyShortName?: string | null;
  /** ★企業側の上限（今月の送信数・返信待ち）に当たっているときの1行。当たっていなければ null */
  companyLimitLine?: string | null;
  /** ★候補者への操作（★・メッセージ・条件の保存）ができるか（2026-10-12 / candidates.search。閲覧のみは false） */
  canAct?: boolean;
  /** ★保存した条件で開いたとき（段3）。newSince があれば「新着だけ」を出す */
  initialSaved?: { id: string; name: string; filters: SavedCandidateFilters; newSince: string | null } | null;
  candidates: Candidate[];
  /** ★`?selected=` で開いている候補者（段1）。リロードしても同じ人を開く */
  initialSelected?: string | null;
  /** 職種フィルタの階層（ow_roles の大分類＋子）。サーバーで組む */
  roleFilterTree?: { id: string; name: string; children: { id: string; name: string }[] }[];
}) {
  /* ★初期値は URL（`?f=`）の条件。無ければ空。⚠️ 保存した条件で開いたとき（`?saved=`）は下の effect が上書きする */
  const init = initialFilters ?? EMPTY_SAVED_FILTERS;
  // ── フリーワード ────────────────────────────────────────────────────
  const [q, setQ] = useState(init.q);
  /* ⚠️★「社内での呼び方」「現在の会社名」「除外するワード」の3欄は 2026-10-13 に検索窓へ一本化した（除外は "-語"）。
        保存した条件・URL の旧キーは `parseSavedFilters` が検索窓の文字列に直す */

  // ── 経歴・雇用形態 ──────────────────────────────────────────────────
  /* ★希望職種（関心のある職種）。複数は OR（2026-10-13 / ステップ5。「すべてのフィルター」の中だけ） */
  const [desiredRoleIds, setDesiredRoleIds] = useState<string[]>(init.desiredRoleIds);
  /* ★経験職種（職歴の職種・複数は OR。2026-10-13）。よく使う行の先頭 */
  const [expRoleIds, setExpRoleIds] = useState<string[]>(init.expRoleIds);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(init.employmentTypes);

  // ── 希望条件 ────────────────────────────────────────────────────────
  /* ⚠️ 働き方・希望年収の絞り込みは 2026-10-13 に外した（右欄に出さない値で絞れると、値が間接的に分かるため） */

  // ── 属性 ────────────────────────────────────────────────────────────
  /* ★★年齢（2026-10-12 / 柴さんの判断で方針を変えた。CLAUDE.md「年齢」の節）。
        表示は一覧と右欄に出す。**絞り込み・並び替えは `ageFilterEnabled` のときだけ**（本番は無効。弁護士の確認待ち）。
     ⚠️ 2026-08-20 に撤去した理由（労働施策総合推進法9条。企業自身が年齢で絞る形になる）は今も残っている。
        本番で有効にする前に、確認の結果を CLAUDE.md に書くこと。
     ⚠️ 年齢は**サーバーで計算した数**（Candidate.age）。生年月日はブラウザに来ない。
     ⚠️ 生年月日が無い人は年齢で絞ると**落ちる**（人数を下に出す）。社会人年数は落とさない。向きが逆なのは意図的 */
  const [ageMin, setAgeMin] = useState(init.ageMin);
  const [ageMax, setAgeMax] = useState(init.ageMax);
  const [tenureBand, setTenureBand] = useState(init.tenureBand);
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>(init.prefectures);

  /* ── ★転職意欲と、その更新時期（2026-09-19 / 柴さんの指示）────────────────
     ⚠️★**この2つは対で使う。** 更新時期だけだと「意欲は問わないが最近更新した人」に
        なり、単独では使いどころが限られる（YOUTRUST も2つ並べている）。
     ⚠️ 年齢・性別と違い、**本人が自分で選んで公開している項目**なので絞り込みに出してよい
        （年齢を出さない理由は労働施策総合推進法9条、性別は均等法5条。**軸が違う**）。 */
  /* ★転職への意向は複数選択（2026-10-12）。⚠️「今は考えていない」は選択肢に無い（その人は一覧に出ない） */
  const [careerStances, setCareerStances] = useState<string[]>(init.careerStances);
  const [stanceFreshness, setStanceFreshness] = useState(init.stanceFreshness);
  /* ★最近の利用（2026-10-12。`activityEnabled` のときだけ） */
  const [activity, setActivity] = useState(init.activity);
  /* ★「合うところあり」と「気になる」（2026-10-12）。どちらも ON/OFF */
  const [hasTouchpoints, setHasTouchpoints] = useState(init.hasTouchpoints);
  const [starredOnly, setStarredOnly] = useState(init.starredOnly);
  /* ★★（気になる）。サーバーの値より、この画面で押した値を優先する（押した直後に一覧と数を合わせる） */
  const [starOverride, setStarOverride] = useState<Record<string, boolean>>({});
  /* ★見送り（2026-10-13）。★と同じく、この画面で押した値を優先する。⚠️ 候補者本人には何も届かない */
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, { hidden: boolean; at: string }>>({});
  /* ★右欄で既読にした人（2026-10-13）。一覧の「返信あり・未読」と右欄の点を消す */
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});
  /* ★見送った人も一覧に出すか（末尾の「表示する」）。出すときは薄く表示し、その場で解除できる */
  const [showHidden, setShowHidden] = useState(false);
  /* ★見送った直後の「元に戻す」（右下の小さな知らせ）。⚠️ 6秒で消える */
  const [undoHidden, setUndoHidden] = useState<{ id: string; name: string } | null>(null);
  /* ⚠️★「メッセージを受け取る方のみ」の切り替えは 2026-10-11 に外した（柴さんの指示）。
        全員が最初から受け取る形にし、止める方法は「転職について」の「今は考えていない」で兼ねる
        （その人はそもそもこの一覧に出ない）。送れるかどうかは今までどおりボタンの有無だけで示す。
     ★送れる人が0人のときだけ一文を出す。⚠️ 判定は `c.approach.eligible`（`can_send_company_approach()`）だけ */
  /* ★一覧の上の灰色の1行（2026-10-11 / 柴さんの指示）。「いま、メッセージを送れる候補者はいません。」は外した。
        検証用の会社を実アカウントで見ているとき → その旨。企業側の上限に当たっているとき → 上限の文言。それ以外は出さない */
  const topNotice = candidates.some((c) => c.approach?.blocked === "test_company") ? APPROACH_TEST_COMPANY_MESSAGE : companyLimitLine;

  /* ⚠️ 「スカウト済みを除く」は 2026-10-08 にスカウトごと廃止した（提案に一本化）。
        保存済み検索に残っている `hideAlreadyScouted` は `parseSavedFilters` が捨てる。 */

  /* ⚠️★280px の常時開きサイドバーに戻さないこと（2026-09-20 に畳んだ）。
     ⚠️★条件は、チップの値表示（よく使う行）と「すべてのフィルター（N）」の数字で分かる。 */
  /* ★「すべてのフィルター」の右ドロワー（2026-10-13 / ステップ5。それまでの「詳細検索」パネルを置き換えた）。
        ⚠️ 中の変更は下書き。「結果を表示」で反映、閉じたら捨てる（CandidateFilterDrawer） */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerBtnRef = useRef<HTMLButtonElement | null>(null);
  const [sort, setSort] = useState<string>(init.sort);
  /* ⚠️ 開いているチップは1つだけ。**チップごとに開閉 state を持たせないこと**
        （`/companies` と同じ形）。2つ同時に開くとメニューが重なる。 */
  const [openChip, setOpenChip] = useState<string | null>(null);

  /* ── ★右のプレビュー（2026-10-10 / 段1・キャンバス1）──────────────────────────
     ⚠️ 1280px 以上だけ（`CANDIDATE_SPLIT_MIN_WIDTH`。2026-10-11 に /companies・/jobs と同じ 1280px に揃えた）。
     ⚠️★URL（`?selected=`）は `history.replaceState` で書き換える。**履歴を積まない**（柴さんの指示）。
        router.replace にしないのは、このページが force-dynamic で**一覧を丸ごと取り直す**ため。
     ⚠️ 1280px 未満では横取りしない ——カードのリンクがそのまま /u/[id] を**同じタブ**で開く。 */
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const updateSelected = useCallback((id: string | null) => {
    setSelected(id);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("selected", id); else url.searchParams.delete("selected");
      /* ★別の人を選んだら右欄のタブ（`?tab=`）は外す＝その人の既定のタブで開く（2026-10-13。CandidatePreview） */
      url.searchParams.delete("tab");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* URL を書けなくても表示は続ける */ }
  }, []);
  /* ★1280px 以上で開いたときは、先頭の候補者を選んだ状態にする（2026-10-11 / 柴さんの指示）。
        ⚠️ URL には書かない（`?selected=` が無ければ毎回先頭を出す）。明示的に選んだ人だけを URL に残す。
        ⚠️ 1280px 未満は従来どおり（プレビューは CSS で隠れている）。幅が分かるまでは null（SSR では選ばない）。
        ⚠️ プレビューを閉じたら先頭に戻さない（`autoPick` を落とす）。空の案内が出るのはこのときと0件のときだけ。 */
  const [isWide, setIsWide] = useState<boolean | null>(null);
  const [autoPick, setAutoPick] = useState(true);

  /* ── ★一覧と詳細の幅（2026-10-13 ステップ4 / 柴さんの指示「Claude の画面と同じように線をずらせる」）──────────
     区切り線をドラッグした位置でそのまま止まる（段への吸い付きはやめた）。範囲は 一覧 最低260px・右欄 最低380px。
     幅は**割合**で覚える（画面の大きさが変わっても比率を保つ）。localStorage（会社・担当者ごとのキー）。読めなければ半々。
     ⚠️ 既存の3段の保存値（"1"/"2"/"3"）は近い割合に読み替える（段1＝一覧2/3・段2＝半々・段3＝一覧2割）。
     ⚠️ 右欄の中身は右欄の幅で切り替える（680px 以上で2列）。一覧が 420px 以下なら細いカード。
     ⚠️ 1280px 未満は分割しない（区切り線も出さない）。 */
  const [ratio, setRatio] = useState(0.5);
  const saveRatio = useCallback((r: number) => {
    if (!stageStorageKey) return;
    try { window.localStorage.setItem(stageStorageKey, r.toFixed(4)); } catch { /* 覚えられなくても続ける */ }
  }, [stageStorageKey]);
  useEffect(() => {
    if (!stageStorageKey) return;
    try {
      const raw = window.localStorage.getItem(stageStorageKey);
      const legacy: Record<string, number> = { "1": 2 / 3, "2": 0.5, "3": 0.2 };
      const v = raw == null ? NaN : raw in legacy ? legacy[raw] : Number(raw);
      if (Number.isFinite(v) && v > 0 && v < 1) setRatio(v);
    } catch { /* 半々のまま */ }
  }, [stageStorageKey]);
  /* 一覧＋右欄の幅（ResizeObserver）。null = まだ測っていない */
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [splitW, setSplitW] = useState<number | null>(null);
  useEffect(() => {
    const el = splitRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSplitW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    /* ⚠️ 画面の幅が変わったときも測る（ResizeObserver は描画されていないタブでは通知が遅れることがある） */
    window.addEventListener("resize", measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  /** 割合 → 一覧の幅（px）。最小幅で止める。⚠️ 両方の最小を満たせない狭さでは一覧を優先しない（右欄 380 を守る） */
  const clampList = useCallback((px: number, w: number) => Math.max(CAND_LIST_MIN, Math.min(w - CAND_DIVIDER_W - CAND_PANE_MIN, px)), []);
  const listPx = splitW !== null ? clampList(Math.round(ratio * (splitW - CAND_DIVIDER_W)), splitW) : null;
  const panePx = splitW !== null && listPx !== null ? splitW - CAND_DIVIDER_W - listPx : null;
  const paneColumns = panePx !== null && panePx >= CAND_COLUMNS_MIN_PANE;
  const compactCards = listPx !== null && listPx <= CAND_COMPACT_MAX_LIST;
  /** 一覧の幅（px）を決めて割合にする（ドラッグ・キー・ダブルクリック） */
  const setListPx = useCallback((px: number, save: boolean) => {
    if (splitW === null) return;
    const inner = splitW - CAND_DIVIDER_W;
    const r = clampList(px, splitW) / inner;
    setRatio(r);
    if (save) saveRatio(r);
  }, [splitW, clampList, saveRatio]);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CANDIDATE_SPLIT_MIN_WIDTH}px)`);
    const on = () => setIsWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const onCardLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    /* ⌘・中クリック・新しいタブは素通し（ブラウザに任せる） */
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    /* ★1280px 未満も企業の画面の中で開く（2026-10-18 / 柴さんの指示）。それまでは求職者側の /u/ へ移り、
          求職者のタブバーに切り替わって、一覧・条件から外れていた。いまは右欄を画面いっぱいに重ねて出す（CSS の .cand-split[data-overlay=yes]） */
    e.preventDefault();
    updateSelected(id);
  }, [updateSelected]);
  /* ★狭い画面で詳細を重ねているあいだは、下の一覧をスクロールさせない */
  const overlayOpen = isWide === false && !!selected;
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") updateSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [overlayOpen, updateSelected]);


  /* ⚠️ 落ちる人数の注記（更新時期・年齢・最近の利用・社会人年数）は 2026-10-13 にドロワーの中へ移した（CandidateFilterDrawer） */

  const activeFilterCount = (q.trim() ? 1 : 0) + drawerFilterCount(
    { ...EMPTY_SAVED_FILTERS, expRoleIds, desiredRoleIds, careerStances, tenureBand, prefectures: selectedPrefectures,
      hasTouchpoints, starredOnly, stanceFreshness, employmentTypes: selectedEmploymentTypes, ageMin, ageMax, activity },
    { ageFilter: ageFilterEnabled, activity: activityEnabled });

  /* ⚠️★「絞り込み中：…」の行（activeChips）は 2026-10-13 に外した（柴さんの指示）。
        代わりに**各チップが選択中の値を出し**（「経験職種: 営業 +2」）、右端の ✕ でその軸だけ外せる。
        「すべて解除」は件数の横。ドロワーの中の条件は「すべてのフィルター（N）」の数字で分かる */

  /* ── ★保存した条件（2026-09-21）────────────────────────────────────────
     ⚠️★**この表がこの機能の歯止め。** マップ型なので、
        `SavedCandidateFilters` にキーを足すと**ここが型エラーになる。**
        ＝ 条件を1つ足したときに「保存だけ対応を忘れる」ことができない。
        **`Record<string, ...>` に緩めないこと**（緩めた瞬間に歯止めが消える）。
     ⚠️ `sort` も入れてある。並び替えまで戻さないと「その画面」の再現にならない。 */
  const FILTER_SETTERS: { [K in keyof SavedCandidateFilters]: (v: SavedCandidateFilters[K]) => void } = {
    q: setQ,
    desiredRoleIds: setDesiredRoleIds,
    expRoleIds: setExpRoleIds,
    employmentTypes: setSelectedEmploymentTypes,
    tenureBand: setTenureBand,
    ageMin: setAgeMin,
    ageMax: setAgeMax,
    prefectures: setSelectedPrefectures,
    careerStances: setCareerStances,
    activity: setActivity,
    stanceFreshness: setStanceFreshness,
    hasTouchpoints: setHasTouchpoints,
    starredOnly: setStarredOnly,
    sort: setSort,
  };

  /** いま効いている条件。⚠️ 保存もクリアも比較も、すべてこの形を通す */
  const currentFilters: SavedCandidateFilters = useMemo(() => ({
    q, desiredRoleIds, expRoleIds,
    employmentTypes: selectedEmploymentTypes,
    tenureBand, ageMin, ageMax, prefectures: selectedPrefectures, careerStances, stanceFreshness, activity,
    hasTouchpoints, starredOnly,
    sort,
  }), [q, desiredRoleIds, expRoleIds,
       selectedEmploymentTypes,
       tenureBand, ageMin, ageMax, selectedPrefectures, careerStances, stanceFreshness, activity,
       hasTouchpoints, starredOnly,
       sort]);

  /* ★★の状態を重ねた候補者（2026-10-12）。⚠️ 絞り込み（「気になる」）も数も、すべてこちらを通す */
  const withStars = useMemo(
    () => (Object.keys(starOverride).length === 0 && Object.keys(hiddenOverride).length === 0 && Object.keys(readOverride).length === 0 ? candidates
      : candidates.map((c) => (c.id in starOverride || c.id in hiddenOverride || c.id in readOverride
        ? { ...c, ...(c.id in starOverride ? { starred: starOverride[c.id] } : {}),
            /* ⚠️ この画面で見送ったときは「見ている人・いま」を入れる（サーバーの hidden_by / created_at と同じ意味） */
            ...(c.id in hiddenOverride ? { hidden: hiddenOverride[c.id].hidden, hiddenBy: hiddenOverride[c.id].hidden ? { name: viewerName, at: hiddenOverride[c.id].at } : null } : {}),
            ...(c.id in readOverride && c.approach ? { approach: { ...c.approach, unreadCount: 0, unseenReply: false } } : {}) }
        : c))),
    [candidates, starOverride, hiddenOverride, readOverride, viewerName]
  );
  const starredCount = useMemo(() => withStars.filter((c) => c.starred).length, [withStars]);
  const toggleStar = useCallback(async (id: string, next: boolean) => {
    setStarOverride((prev) => ({ ...prev, [id]: next }));
    try {
      const res = await fetch(`/api/biz/candidates/${id}/star`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch (e) {
      /* ⚠️ 失敗したら戻す（押したのに保存されていない状態を残さない） */
      console.error("[candidates] star:", e);
      setStarOverride((prev) => ({ ...prev, [id]: !next }));
    }
  }, []);

  /* ★条件を URL に持つ（2026-10-12）。保存した条件と同じ形の JSON を `?f=` に入れる。
     ⚠️ 履歴は積まない（replaceState）。⚠️ 空なら外す。`?selected=` は残す */
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (isEmptyFilters(currentFilters)) url.searchParams.delete("f");
      else {
        /* ⚠️ 既定値のキーは省く（URL を短くするため）。読む側は `parseSavedFilters` が既定値で埋めるので同じ条件に戻る */
        const diff = Object.fromEntries(Object.entries(currentFilters).filter(([k, v]) =>
          JSON.stringify(v) !== JSON.stringify(EMPTY_SAVED_FILTERS[k as keyof SavedCandidateFilters])));
        url.searchParams.set("f", JSON.stringify(diff));
      }
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* URL を書けなくても表示は続ける */ }
  }, [currentFilters]);

  /* ★絞り込みと並び替え（model.ts。段3の新着メールと同じ関数）。⚠️ 描くのは `sorted` */
  /* ★新着だけ（段3）。⚠️ 判定は `isNewSince`（登録日と本人の編集日だけ）。×で全員に戻せる */
  const [newSince, setNewSince] = useState<string | null>(initialSaved?.newSince ?? null);
  const [openedSaved, setOpenedSaved] = useState<{ id: string; name: string } | null>(initialSaved ? { id: initialSaved.id, name: initialSaved.name } : null);
  /* ★見送った人も含めて絞った結果（2026-10-13）。⚠️ 既定（showHidden=false）では見送った人を外したものを描く */
  const filteredWithHidden = useMemo(() => {
    const list = filterCandidates(withStars, currentFilters, new Date(), { ageFilter: ageFilterEnabled, activity: activityEnabled, includeHidden: true });
    return newSince ? list.filter((c) => isNewSince(c, newSince)) : list;
  }, [withStars, currentFilters, newSince, ageFilterEnabled, activityEnabled]);
  const filtered = useMemo(() => (showHidden ? filteredWithHidden : filteredWithHidden.filter((c) => c.hidden !== true)), [filteredWithHidden, showHidden]);
  /* ★一次チップ（経験職種・転職への意向・社会人年数・居住地）の件数（2026-10-13 / 柴さんの指示でドロワーと揃えた）。
        「その軸以外の条件をすべて掛けたあとの人数」。0件は灰色で選べない（選択中なら外せる）。
     ⚠️★数え方は filterAxes.tsx の computeAxisCounts の1つ（ドロワーと同じ関数）。ここに条件を書き写さないこと */
  const chipCounts = useMemo(() => computeAxisCounts(
    withStars, currentFilters, new Date(),
    { ageFilter: ageFilterEnabled, activity: activityEnabled, includeHidden: showHidden, newSince }, roleFilterTree,
  ), [withStars, currentFilters, ageFilterEnabled, activityEnabled, showHidden, newSince, roleFilterTree]);
  /** いまの条件に合う人のうち、見送った人数（末尾の「見送った○名は非表示」） */
  const hiddenCount = useMemo(() => filteredWithHidden.filter((c) => c.hidden === true).length, [filteredWithHidden]);
  /* ⚠️ 見送った人が0人になったら「表示する」を戻す。戻さないと切り替えが画面から消えたまま表示中が残り、
        次に見送った人が一覧から消えず、次の人へも移らない（2026-10-13 に検証で踏んだ） */
  useEffect(() => { if (hiddenCount === 0 && showHidden) setShowHidden(false); }, [hiddenCount, showHidden]);
  /** 見送った人を除いた全体（「〇名 / 全〇名」の分母） */
  const populationCount = useMemo(() => withStars.filter((c) => c.hidden !== true).length, [withStars]);
  /* ⚠️ 年齢の並び替えは無効な環境では使わない（保存した条件に残っていても新着順に戻す） */
  const effectiveSort = (!ageFilterEnabled && AGE_SORTS.includes(sort)) || (!activityEnabled && ACTIVITY_SORTS.includes(sort)) ? "new" : sort;
  const sorted = useMemo(() => sortCandidates(filtered, effectiveSort), [filtered, effectiveSort]);
  /* ★プレビューに出す人。明示的に選んだ人 → 無ければ（1280px 以上で、閉じていなければ）先頭の人 */
  const shownId: string | null = selected ?? (isWide && autoPick ? sorted[0]?.id ?? null : null);
  /* ★右欄に渡す候補者（2026-10-13）。一覧が持っている値をそのまま渡す（右欄で取り直さない）。
        ⚠️ 見送った人も探す（URL で直接開いた・見送った直後に右欄に残っている場合） */
  const shownCandidate = useMemo(() => (shownId ? withStars.find((c) => c.id === shownId) ?? null : null), [shownId, withStars]);
  /* ★キーボードで候補者を移る（2026-10-12 / 柴さんの指示）。↑↓ と J/K。
     ⚠️ 入力中（input・textarea・select・contenteditable）と修飾キー付きは何もしない。
     ⚠️ 1280px 以上（右欄が出ているとき）だけ。それ未満は右欄が無いので、選んでも何も変わらない。
     ⚠️ 選んだカードが見えるように一覧をスクロールする（`block: "nearest"`。ヘッダーの下に隠れないよう scroll-margin を CSS で持つ）。
        ⚠️ `behavior: "instant"`。html が scroll-behavior: smooth なので、既定だとキーを続けて押したときに前のスクロールが途中で止まり、選んだカードが画面外に残る */
  /* ★前後の候補者へ移る（J/K・↑↓ と、右欄の ‹ › が同じ関数。2026-10-13 に1つにまとめた） */
  const shownIndex = shownId ? sorted.findIndex((c) => c.id === shownId) : -1;
  const moveSelection = useCallback((dir: 1 | -1) => {
    if (sorted.length === 0) return;
    const nextIdx = shownIndex < 0 ? 0 : Math.min(sorted.length - 1, Math.max(0, shownIndex + dir));
    const next = sorted[nextIdx];
    if (!next || next.id === shownId) return;
    setAutoPick(true);
    updateSelected(next.id);
    document.querySelector(`[data-candidate-card="${next.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [sorted, shownIndex, shownId, updateSelected]);
  useEffect(() => {
    /* ⚠️ ドロワーが開いている間は一覧を動かさない（背景の候補者が切り替わるのを防ぐ） */
    if (!isWide || drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const k = e.key;
      const dir = k === "ArrowDown" || k === "j" || k === "J" ? 1 : k === "ArrowUp" || k === "k" || k === "K" ? -1 : 0;
      if (!dir || sorted.length === 0) return;
      e.preventDefault();
      moveSelection(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isWide, drawerOpen, sorted.length, moveSelection]);

  /* ★見送り（2026-10-13）。付ける・外す。⚠️ 失敗したら戻す。⚠️ 候補者本人には何も届かない
        付けたとき、その人を右欄で見ていて見送った人を隠しているなら、次の人（無ければ前の人）を選ぶ */
  const toggleHidden = useCallback(async (id: string, next: boolean, opts: { advance?: boolean } = {}) => {
    if (next && opts.advance && !showHidden && shownId === id) {
      const idx = sorted.findIndex((c) => c.id === id);
      const after = sorted[idx + 1] ?? sorted[idx - 1] ?? null;
      setAutoPick(!!after);
      updateSelected(after ? after.id : null);
    }
    setHiddenOverride((prev) => ({ ...prev, [id]: { hidden: next, at: new Date().toISOString() } }));
    if (next) setUndoHidden({ id, name: withStars.find((c) => c.id === id)?.name ?? "" });
    else setUndoHidden((u) => (u?.id === id ? null : u));
    try {
      const res = await fetch(`/api/biz/candidates/${id}/hide`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch (e) {
      console.error("[candidates] hide:", e);
      setHiddenOverride((prev) => { const rest = { ...prev }; delete rest[id]; return rest; });
      setUndoHidden(null);
    }
  }, [showHidden, shownId, sorted, updateSelected, withStars]);
  useEffect(() => {
    if (!undoHidden) return;
    const t = setTimeout(() => setUndoHidden(null), 6000);
    return () => clearTimeout(t);
  }, [undoHidden]);

  /* ── ★まとめて☆・見送り（2026-10-18 / 柴さんの指示）────────────────────────
     チェックした人に、まとめて☆（気になる）を付ける／見送る。1人ずつの操作と同じ API を1人ずつ呼ぶ（同時に4件まで）。
     ⚠️ まとめてメッセージは作らない（理由を1人ずつ書く前提。一斉送信にしない）。
     ⚠️ 選択は「いま一覧に見えている人」だけに効く（条件を変えて見えなくなった人には何もしない）。 */
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [undoBulk, setUndoBulk] = useState<string[] | null>(null);
  const visibleIds = useMemo(() => sorted.map((c) => c.id), [sorted]);
  const checkedVisible = useMemo(() => visibleIds.filter((id) => checked.has(id)), [visibleIds, checked]);
  const allChecked = visibleIds.length > 0 && checkedVisible.length === visibleIds.length;
  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const runBulk = useCallback(async (ids: string[], call: (id: string) => Promise<boolean>) => {
    let failed = 0;
    for (let i = 0; i < ids.length; i += 4) {
      const r = await Promise.all(ids.slice(i, i + 4).map((id) => call(id).catch(() => false)));
      failed += r.filter((ok) => !ok).length;
    }
    return failed;
  }, []);
  const bulkStar = useCallback(async () => {
    const ids = checkedVisible.filter((id) => !withStars.find((c) => c.id === id)?.starred);
    if (ids.length === 0) { setBulkNote("選んだ方は、すでに☆が付いています"); return; }
    setBulkBusy(true); setBulkNote(null);
    setStarOverride((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) }));
    const failedIds: string[] = [];
    const failed = await runBulk(ids, async (id) => {
      const res = await fetch(`/api/biz/candidates/${id}/star`, { method: "POST" });
      if (!res.ok) failedIds.push(id);
      return res.ok;
    });
    /* ⚠️ 失敗した人は戻す（押したのに保存されていない状態を残さない） */
    if (failedIds.length) setStarOverride((prev) => ({ ...prev, ...Object.fromEntries(failedIds.map((id) => [id, false])) }));
    setBulkBusy(false);
    setChecked(new Set());
    setBulkNote(failed ? `${ids.length - failed}名に☆を付けました（${failed}名は保存できませんでした）` : `${ids.length}名に☆を付けました`);
  }, [checkedVisible, withStars, runBulk]);
  const bulkHide = useCallback(async () => {
    const ids = checkedVisible.filter((id) => !withStars.find((c) => c.id === id)?.hidden);
    if (ids.length === 0) { setBulkNote("選んだ方は、すでに見送っています"); return; }
    setBulkBusy(true); setBulkNote(null);
    /* 右欄で見ている人を見送ったら、右欄は閉じる（次の人へ移るのは1人ずつのときだけ） */
    if (shownId && ids.includes(shownId) && !showHidden) { setAutoPick(false); updateSelected(null); }
    const at = new Date().toISOString();
    setHiddenOverride((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { hidden: true, at }])) }));
    const failedIds: string[] = [];
    await runBulk(ids, async (id) => {
      const res = await fetch(`/api/biz/candidates/${id}/hide`, { method: "POST" });
      if (!res.ok) failedIds.push(id);
      return res.ok;
    });
    if (failedIds.length) setHiddenOverride((prev) => { const rest = { ...prev }; failedIds.forEach((id) => delete rest[id]); return rest; });
    const done = ids.filter((id) => !failedIds.includes(id));
    setBulkBusy(false);
    setChecked(new Set());
    setUndoHidden(null);
    setUndoBulk(done.length ? done : null);
    setBulkNote(failedIds.length ? `${failedIds.length}名は見送れませんでした` : null);
  }, [checkedVisible, withStars, runBulk, shownId, showHidden, updateSelected]);
  const undoBulkHide = useCallback(async () => {
    const ids = undoBulk ?? [];
    setUndoBulk(null);
    setHiddenOverride((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { hidden: false, at: new Date().toISOString() }])) }));
    const failed = await runBulk(ids, async (id) => (await fetch(`/api/biz/candidates/${id}/hide`, { method: "DELETE" })).ok);
    if (failed) setBulkNote(`${failed}名は元に戻せませんでした。画面を読み込み直してください`);
  }, [undoBulk, runBulk]);
  useEffect(() => {
    if (!undoBulk) return;
    const t = setTimeout(() => setUndoBulk(null), 6000);
    return () => clearTimeout(t);
  }, [undoBulk]);
  useEffect(() => {
    if (!bulkNote) return;
    const t = setTimeout(() => setBulkNote(null), 5000);
    return () => clearTimeout(t);
  }, [bulkNote]);

  const applyFilters = useCallback((f: SavedCandidateFilters) => {
    /* ⚠️ キーを列挙せず表から回す。列挙すると、ここだけ足し忘れる余地が戻る。 */
    (Object.keys(FILTER_SETTERS) as (keyof SavedCandidateFilters)[]).forEach((k) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (FILTER_SETTERS[k] as (v: any) => void)(f[k]);
    });
    /* ⚠️ 開いているチップは閉じる。開いたまま中身が変わると、
          どの条件のメニューを見ているのか分からなくなる。 */
    setOpenChip(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ★保存した条件で開いたら、その条件を当てて、前回見た日時を今にする（段3）。
        ⚠️ 新着の基準（newSince）はサーバーが**開く前の値**で渡している。ここで更新しても数え直さない */
  useEffect(() => {
    if (!initialSaved) return;
    applyFilters(initialSaved.filters);
    void fetch(`/api/biz/saved-searches/${initialSaved.id}/view`, { method: "POST" }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ⚠️★「クリア」も同じ経路。**空の定義を2つ持たない**
        （持つと「クリアしたのに1つだけ残る」が起きる）。 */
  /* ★役割の分担（2026-10-13 / 柴さんの判断）:
        件数の横の「すべて解除」… 検索窓も含めて全部消す。**並び替えは残す**
        ドロワーの「すべてクリア」… ドロワーに出ている条件だけ（下書き）。検索窓と並び替えは残す（CandidateFilterDrawer）
     ⚠️ 空の定義は EMPTY_SAVED_FILTERS の1つだけ（並び替えだけ今の値で上書きする） */
  function clearAllFilters() {
    applyFilters({ ...EMPTY_SAVED_FILTERS, sort });
    setNewSince(null);
    setOpenedSaved(null);
  }

  /* ── ★保存した条件の読み書き ────────────────────────────────────────────
     ⚠️★**`null` は「まだ取っていない」。`[]`（0件）と区別する。**
        混ぜると、取得に失敗したときに「保存が無い」と表示してしまう
        （CLAUDE.md「0件を読むときは、起きなかった0か起こせなかった0かを分ける」）。 */
  const [savedSearches, setSavedSearches] = useState<SavedSearch[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  /** ★「この条件を保存」の小窓（段2）。⚠️ 「保存した条件」と同時に開かない */
  const [saveOpen, setSaveOpen] = useState(false);
  /* ★保存するときに選ぶもの（段3）。⚠️ お知らせの既定は「受け取らない」（選ばずに保存した人にメールを送り始めない） */
  const [saveNotify, setSaveNotify] = useState<"daily" | "weekly" | "none">("none");
  const [saveShared, setSaveShared] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/biz/saved-searches");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "取得に失敗しました");
      setSavedSearches(json.searches ?? []);
      setSavedError(null);
    } catch (e) {
      /* ⚠️ 握り潰さない。取れなかったことを画面に出す。 */
      console.error("[saved-searches] GET:", e);
      setSavedError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  // 右の欄の高さを「いま見えている上端から画面の下端まで」に合わせる。
  // ⚠️ CSS の calc だけだと、ページ先頭（sticky で固定される前）は欄の下端が画面の外にはみ出し、
  //    中をいちばん下までスクロールしても最後の数十 px が見えない（2026-10-11 に実測: 46px）。
  const paneRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const fit = () => {
      const el = paneRef.current;
      if (!el || getComputedStyle(el).position !== "sticky") return;
      /* ⚠️★下限は 0 ではなく sticky の top（ヘッダーの下）。0 にすると、一覧の終わりで欄が押し上げられた瞬間に
            top が負になって欄が伸び、さらに押し上げられて名前の段がヘッダーの裏に隠れる（2026-10-12 に実測: top -30px） */
      const stickyTop = parseFloat(getComputedStyle(el).top) || 0;
      const top = Math.max(el.getBoundingClientRect().top, stickyTop);
      /* ⚠️★下の余白は「一覧の下にあるページの余白」以上にする。16px だけ空けると、いちばん下までスクロールしたとき
            一覧の枠（.cand-split）の下端が欄の下端より上に来て、sticky の欄がその差だけ押し上げられる（実測: 76px 上へずれた） */
      const split = el.parentElement;
      const below = split ? Math.max(document.documentElement.scrollHeight - (split.getBoundingClientRect().bottom + window.scrollY), 0) : 0;
      el.style.setProperty("--cand-pane-h", `${Math.max(window.innerHeight - top - Math.max(16, below), 240)}px`);
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("scroll", fit); window.removeEventListener("resize", fit); };
  }, []);

  /** ★条件を選んでいるか（段2）。⚠️ 並び替えだけ変えた状態は「条件」に数えない（保存ボタンを出さない） */
  const hasConditions = !isEmptyFilters({ ...currentFilters, sort: EMPTY_SAVED_FILTERS.sort });
  /* ⚠️ 同じ名前は上書き（サーバーの UNIQUE と揃えてある）。押す前に分かるよう文言を変える */
  /* ⚠️ 上書きになるのは**自分の**同じ名前だけ（他の人が共有した条件とは別の行になる） */
  const willOverwrite = (savedSearches ?? []).some((v) => v.isMine !== false && v.name === saveName.trim());

  async function saveCurrentSearch() {
    const name = saveName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/biz/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: currentFilters, notifyFrequency: saveNotify, isShared: saveShared }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "保存に失敗しました");
      setSaveName("");
      setSaveOpen(false);
      setSavedError(null);
      await refreshSaved();
    } catch (e) {
      console.error("[saved-searches] POST:", e);
      setSavedError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSavedSearch(id: string) {
    try {
      const res = await fetch(`/api/biz/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "削除に失敗しました");
      }
      /* ⚠️ 画面から先に消さない。**サーバーが消せたことを確かめてから**引き直す
            （0行削除を成功にしない、と同じ向き）。 */
      await refreshSaved();
    } catch (e) {
      console.error("[saved-searches] DELETE:", e);
      setSavedError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  function toggleMulti<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }


  /* ── ★よく使う条件の行（2026-10-12 / 柴さんの指示）──────────────────────────
     検索窓の下に1行：経験職種／転職への意向／社会人年数／居住地／合うところあり／気になる（n）／すべてのフィルター。
     ⚠️ 希望職種・意向を更新した時期・雇用形態・年齢・最近の利用はドロワーの中だけ（年齢・最近の利用はスイッチがオンのとき）。
     ⚠️★一次チップとドロワーは同じ state（currentFilters）を見る。ドロワーは開いた時点の値から下書きを作る
     ⚠️ 画面のラベルは「居住地」（指示は「勤務地」だったが、見ているのは本人のお住まい `ow_users.location`。
        希望勤務地とは別の列なので「勤務地」と書くと別のもので絞っているように読める） */
  const toggleStyle = (on: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999,
    border: `1.5px solid ${on ? "var(--royal)" : "#e2e8f0"}`, background: on ? "var(--royal)" : "#fff",
    color: on ? "#fff" : "var(--ink-soft)", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  });
  const quickRow = (
    /* ★スマホ（767px 以下）では横に1行でスクロールする（2026-10-18 / 柴さんの指示）。それまで3行に折り返し、
          1人目の候補者が画面の下3分の1まで押し出されていた。⚠️ 折り返し・並びは CSS（.cand-quick）。インラインに戻さないこと */
    <div data-state="quick-filters" className="cand-quick">
        {/* ★一次チップのドロップダウンは、ドロワーと同じ軸の部品（filterAxes.tsx）を使う（2026-10-13 / 柴さんの指示）。
               件数・0件の灰色・畳み方・職種の検索窓がドロワーと同じ。⚠️ 選択はその場で効く（ドロワーと違い下書きを持たない） */}
        {/* ★経験職種（職歴の職種。現職・前職すべて）。複数選ぶと OR。親を選ぶと子の経験も含む（候補者側が親まで展開済み） */}
        <FilterPopoverChip label="経験職種" active={expRoleIds.length > 0} activeLabel={roleChipLabel("経験職種", roleFilterTree, expRoleIds)}
          onClear={() => setExpRoleIds([])} clearLabel="経験職種の条件を外す" state="chip-exp-role"
          isOpen={openChip === "expRole"} onToggle={() => setOpenChip(openChip === "expRole" ? null : "expRole")}>
          <RoleTreeOptions tree={roleFilterTree} selected={expRoleIds} counts={chipCounts.exp} onToggle={(id) => setExpRoleIds(toggleMulti(expRoleIds, id))} stateKey="chip-exp" />
        </FilterPopoverChip>
        <FilterPopoverChip label="転職への意向" active={careerStances.length > 0}
          activeLabel={(() => { const p = STANCE_OPTIONS.filter((o) => careerStances.includes(o.value)); return p.length ? `転職への意向: ${p[0].label}${p.length > 1 ? ` +${p.length - 1}` : ""}` : "転職への意向"; })()}
          onClear={() => setCareerStances([])} clearLabel="転職への意向の条件を外す" state="chip-stance" width={280}
          isOpen={openChip === "stance"} onToggle={() => setOpenChip(openChip === "stance" ? null : "stance")}>
          <StanceOptions selected={careerStances} counts={chipCounts.stance} onToggle={(v) => setCareerStances(toggleMulti(careerStances, v))} />
        </FilterPopoverChip>
        <FilterPopoverChip label="社会人年数" active={!!tenureBand}
          activeLabel={`社会人年数: ${TENURE_BANDS.find((b) => b.value === tenureBand)?.label ?? tenureBand}`}
          onClear={() => setTenureBand("")} clearLabel="社会人年数の条件を外す" state="chip-tenure" width={240}
          isOpen={openChip === "tenure"} onToggle={() => setOpenChip(openChip === "tenure" ? null : "tenure")}>
          <TenureOptions name="chip-tenure" value={tenureBand} counts={chipCounts.tenure} onChange={setTenureBand} />
        </FilterPopoverChip>
        {/* ★居住地。地方（親）→ 都道府県（子）。件数のある地方を上に、0名は畳む（ドロワーと同じ部品）。⚠️ 2026-10-13 に「適用」ボタンの形をやめ、その場で効く形にした */}
        <FilterPopoverChip label="居住地" active={selectedPrefectures.length > 0}
          activeLabel={residenceChipLabel(selectedPrefectures)}
          onClear={() => setSelectedPrefectures([])} clearLabel="居住地の絞り込みを外す" state="residence-chip" width={300}
          isOpen={openChip === "pref"} onToggle={() => setOpenChip(openChip === "pref" ? null : "pref")}>
          <ResidenceOptions selected={selectedPrefectures} counts={chipCounts.pref} regionCounts={chipCounts.region} onChange={setSelectedPrefectures} />
        </FilterPopoverChip>
      <button type="button" aria-pressed={hasTouchpoints} data-state="toggle-touchpoints" onClick={() => setHasTouchpoints((v) => !v)} style={toggleStyle(hasTouchpoints)}>
        合うところあり
      </button>
      {/* ★気になる（会社の管理者で共有の★）。⚠️ 0人でも出す（押すと0件になるが、入口があることを示す） */}
      <button type="button" aria-pressed={starredOnly} data-state="toggle-starred" onClick={() => setStarredOnly((v) => !v)} style={toggleStyle(starredOnly)}>
        <StarIcon filled={starredOnly} />気になる（{starredCount}）
      </button>
      {/* ★すべてのフィルター（2026-10-13 / ステップ5）。右のドロワーに全部の軸。⚠️ 効いている条件の数をボタンに出す（検索窓は数えない） */}
      {(() => {
        const n = drawerFilterCount(currentFilters, { ageFilter: ageFilterEnabled, activity: activityEnabled });
        return (
          <button ref={drawerBtnRef} type="button" className="cand-quick-all" onClick={() => { setOpenChip(null); setDrawerOpen(true); }}
            aria-haspopup="dialog" aria-expanded={drawerOpen} data-state="open-all-filters"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
              height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: n > 0 ? 700 : 500,
              border: `1px solid ${n > 0 ? "var(--royal)" : "var(--line)"}`,
              background: n > 0 ? "var(--royal-50)" : "#fff", color: n > 0 ? "var(--royal)" : "var(--ink-soft)",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
            {n > 0 ? `すべてのフィルター（${n}）` : "すべてのフィルター"}
          </button>
        );
      })()}

    </div>
  );

  return (
    <div className="cand-wrap">

      {/* ── ★ツールバー（2026-09-20）─────────────────────────────────────────
             `/companies`・`/jobs`・`/people` と同じ並び：
               検索窓 → 並び替え → 件数（「すべてのフィルター」は次の行の末尾。2026-10-13）
             ⚠️★**280px のサイドバーに戻さないこと。** 条件12個を常時開きで縦に
                並べていたのを畳んだ（`/jobs` が 2026-09-09 にやったのと同じ）。 */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {/* ── 見出し ─────────────────────────────────────────────────────
               ★上部を詰めた（2026-10-11 / 柴さんの指示。1300×800 で最初から8〜9人）。見出しもツールバーと同じ行に置く。
               ⚠️ 見出しの下の説明文は外し、「？」に入れた。説明を見出しの下に戻さないこと */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, marginRight: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: "38px", whiteSpace: "nowrap" }}>候補者を探す</h1>
          <HelpToggle label="候補者を探すについて">
            {/* ⚠️「現職・過去の在籍企業とそのグループ会社には表示されません」は `can_send_scout()` の在籍企業の除外の言い換え。判定は変えていない */}
            理由を添えて、候補者に貴社としてメッセージを送れます。現職・過去の在籍企業とそのグループ会社には表示されません。
            「転職意欲」で「今は考えていない」を選んでいる方は表示されません。
            <br />★を付けた方は「気になる」で絞り込めます（社内の担当者で共有。ご本人には通知されません）。
            <br />キーボード：↑↓ または J／K で候補者を移れます（入力中は効きません）。
          </HelpToggle>
        </div>
        {/* ★送れない理由の1行（検証用の会社／企業側の上限）。⚠️ 灰色の文字（バッジにしない）。order で行の最後に回す */}
        {topNotice && candidates.length > 0 && (
          <p data-state="approach-top-notice" style={{ order: 10, flexBasis: "100%", margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            {topNotice}
          </p>
        )}

        {/* フリーワード。★ボタン類と同じ行に置く（2026-10-11）。幅が足りなければ折り返して2行になる */}
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="名前・職種・会社・居住地で検索（除外は -語）"
            aria-label="名前・職種・会社・居住地で検索。先頭に - を付けた語は除外"
            style={{
              width: "100%", height: 38, padding: "0 32px 0 34px",
              border: "1px solid var(--line)", borderRadius: 999,
              fontSize: 13, outline: "none", fontFamily: "inherit",
              color: "var(--ink)", background: "#fff", boxSizing: "border-box",
            }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="検索語を消す"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 15, lineHeight: 1, padding: 2 }}>
              ✕
            </button>
          )}
        </div>

        {/* ⚠️★「メッセージを受け取る方のみ（〇名）」の切り替えは 2026-10-11 に外した。戻さないこと */}
        <SortSelect value={effectiveSort} options={SORT_OPTIONS.filter((o) => (ageFilterEnabled || !AGE_SORTS.includes(o.value)) && (activityEnabled || !ACTIVITY_SORTS.includes(o.value)))} onChange={setSort} />

        {/* ★「この条件を保存」（2026-10-10 / 段2）。**条件を選んでいるときだけ**出す。
               ⚠️ 保存の入口はここ1つ（「保存した条件」の中から保存フォームを外した。入口を2つにしない）。 */}
        {hasConditions && canAct && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button type="button" onClick={() => { setSaveOpen((v) => !v); setSavedOpen(false); }} aria-expanded={saveOpen}
              data-state="save-current"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                border: "1px solid var(--royal)", background: "#fff", color: "var(--royal)",
              }}>
              この条件を保存
            </button>
            {saveOpen && (
              <>
                <button type="button" aria-label="閉じる" onClick={() => setSaveOpen(false)}
                  style={{ position: "fixed", inset: 0, background: "transparent", border: "none", cursor: "default", zIndex: 40 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 41, width: 280, maxWidth: "calc(100vw - 32px)",
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                  boxShadow: "0 8px 28px rgba(0,35,102,0.12)", padding: 12,
                }}>
                  <label htmlFor="save-search-name" style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
                    名前を付けて保存
                  </label>
                  <input
                    id="save-search-name" type="text" value={saveName} maxLength={MAX_SAVED_SEARCH_NAME} autoFocus
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveCurrentSearch(); }}
                    placeholder="例：AE・東京・積極的"
                    style={{
                      width: "100%", height: 34, padding: "0 10px", boxSizing: "border-box",
                      border: "1px solid var(--line)", borderRadius: 8, fontSize: 13,
                      fontFamily: "inherit", color: "var(--ink)", outline: "none",
                    }}
                  />
                  {/* ⚠️ 上書きになることは**押す前に**伝える。黙って上書きしない */}
                  {willOverwrite && (
                    <p style={{ margin: "6px 0 0", fontSize: 11.5, fontWeight: 600, color: "var(--warm-ink)" }}>
                      同じ名前があります。上書きされます
                    </p>
                  )}
                  {/* ★新着のお知らせ（段3）。⚠️ 選択肢は savedSearchServer の NOTIFY_FREQUENCIES と同じ3つ */}
                  <fieldset style={{ border: "none", margin: "10px 0 0", padding: 0 }}>
                    <legend style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>新着のお知らせ（メール）</legend>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                      {([["daily", "毎朝"], ["weekly", "毎週月曜"], ["none", "受け取らない"]] as const).map(([v, l]) => (
                        <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input type="radio" name="save-notify" value={v} checked={saveNotify === v} onChange={() => setSaveNotify(v)} />{l}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset style={{ border: "none", margin: "8px 0 0", padding: 0 }}>
                    <legend style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>公開範囲</legend>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" name="save-share" checked={!saveShared} onChange={() => setSaveShared(false)} />自分だけ
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" name="save-share" checked={saveShared} onChange={() => setSaveShared(true)} />チームで共有
                      </label>
                    </div>
                  </fieldset>
                  <button
                    type="button" onClick={() => void saveCurrentSearch()}
                    disabled={!saveName.trim() || saving}
                    className="btn-fixed-size"
                    style={{
                      marginTop: 10, width: "100%", height: 34, borderRadius: 8, border: "none",
                      background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700,
                      fontFamily: "inherit", cursor: !saveName.trim() || saving ? "default" : "pointer",
                      opacity: !saveName.trim() || saving ? 0.6 : 1,
                    }}>
                    {saving ? "保存中…" : willOverwrite ? "上書きする" : "保存する"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ★保存した条件（2026-09-21）────────────────────────────────
               ⚠️★**「詳細検索」の中に入れないこと。** 畳まれている中にあると、
                  保存したこと自体を忘れる。条件そのものではなく
                  「条件の出し入れ」なので、検索窓と同じ高さの行に置く。
               ⚠️ 一覧と保存フォームで**2つのポップオーバーが同時に開かない**ようにしてある
                  （`/companies` のチップと同じ約束）。 */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => { setSavedOpen((v) => !v); setSaveOpen(false); }}
            aria-expanded={savedOpen}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            保存した条件
            {/* ⚠️ 未取得（null）のあいだは件数を出さない。0件と区別する */}
            {savedSearches !== null && savedSearches.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
                background: "var(--line-soft)", color: "var(--ink-mute)", fontSize: 12, fontWeight: 700,
              }}>{savedSearches.length}</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden style={{ transform: savedOpen ? "rotate(180deg)" : "none" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {savedOpen && (
            <>
              {/* 外側を押したら閉じる */}
              <button type="button" aria-label="閉じる" onClick={() => setSavedOpen(false)}
                style={{ position: "fixed", inset: 0, background: "transparent", border: "none", cursor: "default", zIndex: 40 }} />
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 41,
                minWidth: 260, maxWidth: 340, maxHeight: 320, overflowY: "auto",
                background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
                boxShadow: "0 8px 28px rgba(0,35,102,0.12)", padding: 6,
              }}>
                {/* ⚠️ 保存フォームは「この条件を保存」ボタンへ移した（2026-10-10 / 段2）。ここは一覧だけ */}
                {savedSearches === null ? (
                  /* ⚠️ 取得に失敗したときは「読み込み中…」のまま止めない（エラーはツールバーの下に出る） */
                  <p style={{ margin: 0, padding: "12px 10px", fontSize: 12.5, color: "var(--ink-mute)" }}>{savedError ? "保存した条件を読み込めませんでした" : "読み込み中…"}</p>
                ) : savedSearches.length === 0 ? (
                  /* ⚠️ 保存の入口はこの上（同じポップオーバーの中）にあるので、ここは事実だけ書く */
                  <p style={{ margin: 0, padding: "12px 10px", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                    保存した条件はまだありません。
                  </p>
                ) : (
                  savedSearches.map((v) => (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          applyFilters(v.filters); setSavedOpen(false);
                          /* ★その条件で開いた＝前回見た日時を今に（段3） */
                          setOpenedSaved({ id: v.id, name: v.name }); setNewSince(null);
                          void fetch(`/api/biz/saved-searches/${v.id}/view`, { method: "POST" }).catch(() => {});
                        }}
                        style={{
                          flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none",
                          cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
                          padding: "9px 10px", borderRadius: 8,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                        title={v.name}>
                        {v.name}
                        {/* ★共有された他の人の条件は、作った人を小さく添える（段3） */}
                        {v.isMine === false && <span style={{ marginLeft: 6, fontSize: 11.5, color: "var(--ink-mute)" }}>{v.ownerName ?? "担当者"}さん・共有</span>}
                      </button>
                      {v.canDelete !== false && <button
                        type="button" onClick={() => void deleteSavedSearch(v.id)}
                        aria-label={`${v.name} を削除`}
                        style={{
                          flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                          color: "var(--ink-mute)", fontSize: 13, lineHeight: 1, padding: "8px 8px",
                        }}>
                        ✕
                      </button>}
                    </div>
                  ))
                )}
                {/* ★保存した条件の一覧ページ（段3）。新着の人数・お知らせ・共有はそちらで */}
                <a href="/biz/candidates/saved" style={{ display: "block", padding: "10px 10px 6px", borderTop: "1px solid var(--line-soft)", marginTop: 4, fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
                  保存した条件の一覧へ →
                </a>
              </div>
            </>
          )}
        </div>

        <span style={{ fontSize: 13, color: "var(--ink-soft)", flexShrink: 0, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>
            <strong style={{ fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)", color: "var(--royal)" }}>{filtered.length}</strong>
            {" "}名<span className="cand-count-total"> / 全{populationCount}名</span>
          </span>
          {/* ★取得の上限（500名）に達したとき（2026-10-13）。⚠️ 達していれば古い登録の人が一覧に出ていない */}
          {limitReached && <span data-state="load-limit-note" style={{ fontSize: 12, color: "var(--ink-mute)" }}>最新の500名を表示しています</span>}
          {/* ★すべて解除（2026-10-13 に「絞り込み中」の行から件数の横へ移した）。条件があるときだけ */}
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearAllFilters} data-state="clear-conditions" className="btn-fixed-size"
              style={{ height: 26, padding: "0 2px", border: "none", background: "none", fontSize: 12.5, fontWeight: 600, color: "var(--royal)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              すべて解除
            </button>
          )}
        </span>

        {/* ⚠️ 取得・保存・削除の失敗を画面に出す。握り潰さない（CLAUDE.md） */}
        {savedError && (
          <p style={{ flexBasis: "100%", margin: 0, fontSize: 12.5, color: "var(--error)" }}>
            保存した条件：{savedError}
          </p>
        )}

        {quickRow}

        {/* ⚠️ 「絞り込み中：…」の行は 2026-10-13 に外した。チップが値と ✕ を持ち、「すべて解除」は件数の横 */}

        {/* ★保存した条件で開いているとき（段3）。新着だけのときは「全員を表示」で戻せる */}
        {openedSaved && (
          <div data-state={newSince ? "saved-new-only" : "saved-opened"} style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-soft)" }}>
            <span>保存した条件「{openedSaved.name}」{newSince ? "の新着だけを表示しています" : "で表示しています"}</span>
            {newSince && (
              <button type="button" onClick={() => setNewSince(null)}
                style={{ border: "none", background: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                全員を表示
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── 一覧＋右のプレビュー（2026-10-10 / 段1）──────────────────────────────
             ⚠️★分割は 1280px 以上（CSS の @media と `CANDIDATE_SPLIT_MIN_WIDTH` を手で合わせている）。一覧とプレビューは 1：1。
             ⚠️ 1024〜1279px 用の「カードを詰める・2行目以降を隠す」作りは 2026-10-11 に外した（1279px 以下では分割しないので不要）。 */}
      <div ref={splitRef} className="cand-split" data-overlay={overlayOpen ? "yes" : "no"} data-selected={shownId ? "1" : "0"} data-list-px={listPx ?? ""} data-pane-columns={paneColumns ? "1" : "0"}
        style={isWide && listPx !== null ? { gridTemplateColumns: `${listPx}px ${CAND_DIVIDER_W}px minmax(0, 1fr)` } : undefined}>
        <div className="cand-list-col" style={{ minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "72px 0", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>条件に合う候補者が見つかりませんでした</p>
              <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                {candidates.length === 0
                  /* ⚠️★文言を母集合と合わせる（2026-09-20 に直した）。
                        2026-08-27 に母集合を `scout_enabled` から `career_stance` へ
                        付け替えたのに、**文言だけ古いまま**だった。
                        いまの条件は「転職について」に答えていて `no_contact` でないこと。 */
                  ? "「転職意欲」に答えている求職者がまだいません"
                  : "フィルター条件を変えてみてください"}
              </p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAllFilters}
                  style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "var(--ink-soft)" }}>
                  フィルターをクリア
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* ★まとめて操作の帯（2026-10-18）。⚠️ 操作できる人（canAct）だけ */}
              {canAct && (
                <div className="cand-bulk" data-state={checkedVisible.length > 0 ? "bulk-active" : "bulk-idle"}>
                  <label className="cand-bulk-all">
                    <input type="checkbox" checked={allChecked} disabled={bulkBusy}
                      ref={(el) => { if (el) el.indeterminate = checkedVisible.length > 0 && !allChecked; }}
                      onChange={() => setChecked(allChecked ? new Set() : new Set(visibleIds))}
                      aria-label="表示中の候補者をすべて選ぶ" />
                    <span>{checkedVisible.length > 0 ? `${checkedVisible.length}名を選択中` : "すべて選択"}</span>
                  </label>
                  {checkedVisible.length > 0 && (
                    <div className="cand-bulk-actions">
                      <button type="button" className="cand-bulk-btn btn-fixed-size" disabled={bulkBusy} onClick={() => void bulkStar()} data-state="bulk-star">
                        <StarIcon filled={false} />気になるに追加
                      </button>
                      <button type="button" className="cand-bulk-btn btn-fixed-size" disabled={bulkBusy} onClick={() => void bulkHide()} data-state="bulk-hide">
                        見送る
                      </button>
                      <button type="button" className="cand-bulk-clear btn-fixed-size" disabled={bulkBusy} onClick={() => setChecked(new Set())}>
                        選択を解除
                      </button>
                    </div>
                  )}
                  {bulkNote && <span role="status" className="cand-bulk-note" data-state="bulk-note">{bulkNote}</span>}
                </div>
              )}
              {/* ⚠️ 描くのは `sorted`。`filtered` を直接 map しないこと（並び替えが効かなくなる） */}
              {sorted.map((c) => {
                const tenure = formatTenure(c.tenureMonths);
                const isSel = shownId === c.id;
                /* ★メッセージの状態の小さなラベル（2026-10-13）。送信済み ／ 返信あり ／ 返信あり・未読（数字は出さない）。
                      ⚠️ 灰色の文字（バッジにしない） */
                const sentState = c.approach?.sent?.state ?? null;
                const hasUnread = (c.approach?.unreadCount ?? 0) > 0 || c.approach?.unseenReply === true;
                const msgLabel = !c.approach?.sent ? null
                  : sentState === "accepted" ? (hasUnread ? "返信あり・未読" : "返信あり")
                  : "送信済み";
                /* ★カード（2026-10-13 ステップ4 / モックに合わせた）:
                      1行目 氏名・意向バッジ・状態ラベル（送信済み／返信あり／返信あり・未読）・右端に★
                      2行目 職種 @ 会社
                      3行目 年齢・性別・社会人年数・居住地・経験職種と年数（小さい灰色）
                      4行目 合う理由の1行「✓ 職種　営業 ↔ インサイドセールス」＋「ほか○件」（一番重い理由1つ）
                   ⚠️ 一覧が 420px 以下（`compactCards`）では 1・2行目だけ（意向は短い表記）。
                   ★状態ラベルは細い枠線の小さな札（2026-10-13 / 柴さんの指示。意向の塗りの札と見分けるため）。意向だけが色の札（StanceBadge） */
                const pref = residenceLabel(c.location);
                const ageText = c.age != null ? `${c.age}歳` : null;
                const roleText = c.currentRole || (!c.currentCompany && c.desiredRoleNames.length > 0 ? `希望: ${c.desiredRoleNames.join("・")}` : null);
                const roleCo = [roleText, c.currentCompany].filter(Boolean).join(" @ ");
                const topSkill = (c.autoSkills ?? [])[0];
                const subItems = [ageText, c.genderLabel ?? null, tenure, pref, topSkill ? `${topSkill.label} ${topSkill.band}` : null].filter((x): x is string => !!x);
                const tps = c.touchpoints;
                const topTp = tps && tps.length > 0 ? tps[0] : null;
                return (
                  <div key={c.id} data-candidate-card={c.id} data-selected={isSel ? "1" : "0"} data-hidden={c.hidden ? "1" : "0"} data-compact={compactCards && isWide ? "1" : "0"}
                    /* ⚠️ 枠線と背景は CSS（.cand-card / .is-selected）。選択中とフォーカスで同じ枠1本を使う（二重にしない） */
                    className={["cand-card", compactCards && isWide ? "is-compact" : "", isSel ? "is-selected" : "", c.hidden ? "is-hidden" : ""].filter(Boolean).join(" ")}
                  >
                    {/* ⚠️ ボタン類（★・メッセージ）はリンクの外に置く（リンクの中にボタンを入れない） */}
                    <a className="cand-card-link" href={`/u/${c.id}`} onClick={(e) => onCardLinkClick(e, c.id)} aria-label={`${c.name}のプロフィール`} />
                    {/* ★まとめて操作のチェック（2026-10-18）。⚠️ リンクの外・リンクより上（z-index）に置く。押しても詳細は開かない */}
                    {canAct && (
                      <label className="cand-card-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleChecked(c.id)} disabled={bulkBusy}
                          aria-label={`${c.name}を選ぶ`} data-state="card-check" />
                      </label>
                    )}
                    {!(compactCards && isWide) && (
                      <div className="cand-card-avatar" aria-hidden="true">
                        <PersonAvatar name={c.name} url={c.avatarUrl} size={32} fontSize={13} colorByName />
                      </div>
                    )}
                    <div className="cand-card-main">
                      <div className="cand-card-row1">
                        <span className="cand-card-name" title={c.name}>{c.name}</span>
                        {/* ★カードは常に短い表記・枠線なしの札（2026-10-13 / 柴さんの指示）。右欄は長い表記 */}
                        <StanceBadge stance={c.careerStance} short plain />
                        {msgLabel && <span className="cand-card-msg" data-state={sentState === "accepted" ? "card-replied" : "card-sent"}>{msgLabel}</span>}
                        <span className="cand-card-star">
                          {canAct && <StarButton starred={!!c.starred} onToggle={() => void toggleStar(c.id, !c.starred)} size={26} />}
                        </span>
                      </div>
                      {/* ★値が無くても行の高さは残す（2026-10-18 / 柴さんの指示。カードの高さを揃えるため）。
                            ⚠️ 空の行に「未登録」などの文字を入れないこと（値が無いことを、ある値に置き換えない） */}
                      {roleCo
                        ? <div className="cand-card-roleco" data-state="card-roleco" title={roleCo}>{roleCo}</div>
                        : <div className="cand-card-roleco" aria-hidden="true" />}
                      {!(compactCards && isWide) && (subItems.length > 0
                        ? <div className="cand-card-sub3" data-state="card-age-tenure" title={subItems.join("・")}>{subItems.join("・")}</div>
                        : <div className="cand-card-sub3" aria-hidden="true" />)}
                      {/* ★合う理由の1行（2026-10-13）。⚠️ 0件は何も書かない（2026-10-18 / 柴さんの指示。「合うところ：なし」でも強すぎた）。カードの高さを揃えるため、同じ高さの空きだけ残す（.is-empty は見えない）。取れなかった（undefined）ときは出さない */}
                      {!(compactCards && isWide) && (topTp ? (
                        <div className="cand-card-reason" data-state="card-reason"
                          title={topTp.row ? `${topTp.row.item}：${topTp.row.summary ?? `${topTp.row.person} ↔ ${topTp.row.ours}`}` : topTp.text}>
                          <span aria-hidden="true" className="cand-card-reason-check">✓</span>
                          <span className="cand-card-reason-item">{topTp.row?.item ?? "合うところ"}</span>
                          <span className="cand-card-reason-text">{topTp.row ? (topTp.row.summary ?? `${topTp.row.person} ↔ ${topTp.row.ours}`) : topTp.text}</span>
                          {tps && tps.length > 1 && <span className="cand-card-reason-more">ほか{tps.length - 1}件</span>}
                        </div>
                      ) : tps ? (
                        <div className="cand-card-reason is-empty" data-state="card-reason-empty" aria-hidden="true">{"\u00a0"}</div>
                      ) : null)}
                      {/* ★見送った人（「表示する」のときだけ出る）。誰がいつ見送ったか＋その場で解除 */}
                      {c.hidden && (
                        <div className="cand-card-hidden-row">
                          <span className="cand-card-hidden-by" data-state="card-hidden-by">
                            {[c.hiddenBy?.name ? `${c.hiddenBy.name}さんが見送り` : "見送り", formatJstSlashMonthDay(c.hiddenBy?.at ?? null)].filter(Boolean).join("・")}
                          </span>
                          {canAct && (
                            <button type="button" className="cand-card-unhide btn-fixed-size" data-state="card-unhide"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggleHidden(c.id, false); }}>
                              解除
                            </button>
                          )}
                        </div>
                      )}
                      {/* ★メッセージのボタン。⚠️ 1280px 以上はプレビューに任せて隠す（同じ入口を2つ並べない） */}
                      {canAct && c.approach && (c.approach.eligible || c.approach.sent) && (
                        <div className="cand-card-actions">
                          <ApproachButton candidateUserId={c.id} sent={c.approach.sent} eligible={c.approach.eligible} compact hideUnavailable />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ★見送った人（2026-10-13）。いまの条件に合う人のうち見送った人数と、出し入れ */}
          {hiddenCount > 0 && (
            <div data-state={showHidden ? "hidden-shown" : "hidden-collapsed"} style={{ marginTop: 10, padding: "8px 4px", fontSize: 12.5, color: "var(--ink-mute)" }}>
              {showHidden ? `見送った${hiddenCount}名を表示しています` : `見送った${hiddenCount}名は非表示`}
              <span aria-hidden="true" style={{ margin: "0 6px" }}>／</span>
              <button type="button" onClick={() => setShowHidden((v) => !v)} data-state="toggle-show-hidden" className="btn-fixed-size"
                style={{ border: "none", background: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                {showHidden ? "隠す" : "表示する"}
              </button>
            </div>
          )}
        </div>

        {/* ★区切り線（2026-10-13 ステップ4）。どこを掴んでもドラッグでき、離した位置で止まる（段への吸い付きはやめた）。
               ダブルクリックで 50:50、←→ で 40px。⚠️ 1280px 未満では CSS で隠す */}
        <SplitDivider containerRef={splitRef} firstPx={listPx} totalPx={splitW !== null ? splitW - CAND_DIVIDER_W : null}
          width={CAND_DIVIDER_W} step={CAND_KEY_STEP} grip="sticky" className="cand-divider" dataState="cand-divider"
          ariaLabel="一覧と詳細の幅" valueLabel="一覧" title="ドラッグで幅を変える（ダブルクリックで半々に戻す）"
          onMove={setListPx} onReset={() => { if (splitW !== null) setListPx(Math.round((splitW - CAND_DIVIDER_W) / 2), true); }} />

        {/* 右のプレビュー。⚠️ 1280px 未満では CSS で隠す */}
        <aside ref={paneRef} className="cand-pane" aria-live="polite" aria-label="候補者のプレビュー">
          {shownCandidate ? (
            <CandidatePreview key={shownCandidate.id} candidate={shownCandidate} companyLimitLine={companyLimitLine} canAct={canAct}
              layout={isWide && paneColumns ? "columns" : "tabs"} columnsStorageKey={columnsStorageKey}
              onMessagesRead={() => setReadOverride((prev) => ({ ...prev, [shownCandidate.id]: true }))}
              companyShortName={companyShortName} touchpointMaterials={touchpointMaterials} approachJobs={approachJobs} notesEnabled={notesEnabled}
              onClose={() => { setAutoPick(false); updateSelected(null); }}
              actions={{
                starred: !!shownCandidate.starred,
                onToggleStar: () => void toggleStar(shownCandidate.id, !shownCandidate.starred),
                hidden: !!shownCandidate.hidden,
                onToggleHidden: () => void toggleHidden(shownCandidate.id, !shownCandidate.hidden, { advance: true }),
                index: shownIndex, total: sorted.length,
                onPrev: () => moveSelection(-1), onNext: () => moveSelection(1),
              }} />
          ) : shownId ? (
            /* ⚠️ 一覧に居ない人（URL の ?selected= が古い・見せられない人）は開かない */
            <div data-state="preview-error" style={{ padding: 20, fontSize: 13, color: "var(--ink-soft)" }}>この方は表示できません。</div>
          ) : isWide === null ? null : (
            <div data-state="preview-empty" style={{ padding: "28px 20px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              候補者を選ぶと、ここにプロフィールと貴社と合うところが表示されます。
            </div>
          )}
        </aside>
      </div>

      {/* ★すべてのフィルター（2026-10-13 / ステップ5）。⚠️ body に出る（一覧の幅・右欄に影響させない）。
             件数・下書き・反映は CandidateFilterDrawer。一次チップと同じ state（currentFilters）を共有する */}
      <CandidateFilterDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        applied={currentFilters} onApply={applyFilters}
        candidates={withStars} newSince={newSince} includeHidden={showHidden}
        ageFilterEnabled={ageFilterEnabled} activityEnabled={activityEnabled}
        roleFilterTree={roleFilterTree} returnFocusRef={drawerBtnRef}
      />

      {/* ★まとめて見送った直後の「元に戻す」（2026-10-18）。⚠️ 6秒で消える */}
      {undoBulk && (
        <div role="status" data-state="bulk-undo-toast" style={{
          position: "fixed", left: "50%", bottom: "calc(24px + var(--biz-tabbar-h, 0px))", transform: "translateX(-50%)", zIndex: 60,
          display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderRadius: 10,
          background: "#0F172A", color: "#fff", fontSize: 13, boxShadow: "0 6px 24px rgba(0,0,0,0.22)", maxWidth: "calc(100vw - 32px)",
        }}>
          <span>{undoBulk.length}名を見送りました</span>
          <button type="button" data-state="bulk-undo" className="btn-fixed-size" onClick={() => void undoBulkHide()}
            style={{ border: "none", background: "none", padding: 0, color: "#93C5FD", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            元に戻す
          </button>
        </div>
      )}

      {/* ★見送った直後の「元に戻す」（2026-10-13）。⚠️ 6秒で消える。押すと DELETE を呼ぶ */}
      {undoHidden && (
        <div role="status" data-state="hidden-undo-toast" style={{
          position: "fixed", left: "50%", bottom: "calc(24px + var(--biz-tabbar-h, 0px))", transform: "translateX(-50%)", zIndex: 60,
          display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderRadius: 10,
          background: "#0F172A", color: "#fff", fontSize: 13, boxShadow: "0 6px 24px rgba(0,0,0,0.22)", maxWidth: "calc(100vw - 32px)",
        }}>
          <span>{undoHidden.name ? `${undoHidden.name}さんを見送りました` : "見送りました"}</span>
          <button type="button" data-state="hidden-undo" className="btn-fixed-size"
            onClick={() => { const id = undoHidden.id; setUndoHidden(null); void toggleHidden(id, false); }}
            style={{ border: "none", background: "none", padding: 0, color: "#93C5FD", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            元に戻す
          </button>
        </div>
      )}

      {/* ⚠️ style タグの中に山かっこや引用符を書かないこと（ハイドレーションが壊れる） */}
      <style>{`
        .cand-wrap { padding: 0 32px 16px; max-width: 1400px; margin: 0 auto; }
        .cand-card { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 6px 12px 6px 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; transition: border-color 0.15s, background 0.15s; }
        .cand-card { scroll-margin-top: calc(var(--biz-header-h, 64px) + 12px); scroll-margin-bottom: 12px; }
        /* ★選択中は白のまま、紺の 2px の枠だけ（2026-10-13 / 柴さんの指示。青い要素を減らす）。
              ⚠️ 枠を 2px にすると中身が 1px ずれるので、1px の枠＋内側の影 1px で 2px に見せる */
        .cand-card.is-selected { border-color: var(--royal); background: #fff; box-shadow: inset 0 0 0 1px var(--royal); }
        .cand-card .cand-card-link:focus-visible { outline: none !important; }
        .cand-card:has(.cand-card-link:focus-visible) { border-color: var(--royal); }
        .cand-card:hover { border-color: var(--royal-100); }
        .cand-card.is-selected:hover { border-color: var(--royal); }
        .cand-pane { display: none; }
        /* カード全体をリンクにする（中のボタンは z-index で上に出す） */
        .cand-card-link { position: absolute; inset: 0; border-radius: 12px; z-index: 0; }
        /* ★まとめて操作（2026-10-18）。チェックはリンクより上（押しても詳細を開かない） */
        .cand-card-check { position: relative; z-index: 1; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 20px; height: 32px; margin-right: -2px; cursor: pointer; }
        .cand-card-check input, .cand-bulk-all input { width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: var(--royal); }
        .cand-bulk { position: sticky; top: calc(var(--biz-header-h) + 4px); z-index: 5; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 40px; padding: 4px 12px 4px 14px; margin-bottom: 2px; background: var(--bg-tint); border-radius: 10px; }
        .cand-bulk[data-state=bulk-active] { background: var(--royal-50); box-shadow: inset 0 0 0 1px var(--royal-100); }
        .cand-bulk-all { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
        .cand-bulk-actions { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cand-bulk-btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .cand-bulk-btn:hover { border-color: var(--royal); color: var(--royal); }
        .cand-bulk-clear { height: 30px; padding: 0 6px; border: none; background: none; color: var(--ink-mute); font: inherit; font-size: 12.5px; text-decoration: underline; cursor: pointer; }
        .cand-bulk-note { font-size: 12.5px; color: var(--ink-soft); }
        .cand-card-avatar { flex-shrink: 0; }
        .cand-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; justify-content: center; min-height: 32px; }
        /* 1行目: 氏名・意向バッジ・状態ラベル・右端に★。縮む順番は 状態ラベル → 氏名（バッジと★は縮めない） */
        .cand-card-row1 { display: flex; align-items: center; gap: 6px; min-width: 0; height: 22px; }
        .cand-card-name { font-size: 15px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 2em; flex: 0 1 auto; }
        /* ★状態ラベル（送信済み・返信あり…）は細い枠線の小さな札（2026-10-13）。意向の塗りの札と見分ける */
        .cand-card-msg { flex: 0 100 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; line-height: 16px; color: var(--ink-mute); white-space: nowrap; border: 1px solid #CBD5E1; border-radius: 4px; padding: 0 6px; background: #fff; }
        .cand-card-star { margin-left: auto; margin-right: -4px; height: 22px; display: flex; align-items: center; position: relative; z-index: 1; flex-shrink: 0; }
        /* 2行目: 職種 @ 会社 ／ 3行目: 年齢・性別・社会人年数・居住地・経験職種と年数 */
        .cand-card-roleco { min-height: 19px; font-size: 13px; line-height: 19px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .cand-card-sub3 { min-height: 17px; font-size: 12px; line-height: 17px; color: var(--ink-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        /* 4行目: 合う理由の札（2026-10-13 / 柴さんの指示で改修モックに合わせた）。
           ★帯をやめ、文字の長さだけの札（最大はカード幅）。「ほか○件」も札の中。
           ★色は淡い緑に濃い緑（UIルールの変更: 緑＝プラスの一致。.claude/skills/ui-conventions）。
           文字 #14532D on #ECF6EF = 8.24 ／ ほか○件 #3F6B4E = 5.55 ／ チェックも #14532D */
        .cand-card-reason { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; width: fit-content; max-width: 100%; box-sizing: border-box; margin-top: 4px; padding: 3px 8px; border-radius: 6px; background: #ECF6EF; color: #14532D; font-size: 12px; line-height: 18px; min-width: 0; }
        .cand-card-reason.is-empty { visibility: hidden; }
        .cand-card-reason-check { flex-shrink: 0; font-weight: 700; color: #14532D; }
        .cand-card-reason-item { flex-shrink: 0; font-weight: 700; }
        .cand-card-reason-text { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cand-card-reason-more { flex-shrink: 0; padding-left: 4px; color: #3F6B4E; white-space: nowrap; }
        .cand-card.is-hidden { opacity: 0.55; }
        .cand-card.is-hidden:hover { opacity: 0.8; }
        .cand-card-hidden-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .cand-card-hidden-by { font-size: 11.5px; line-height: 17px; color: var(--ink-mute); white-space: nowrap; }
        .cand-card-unhide { position: relative; z-index: 1; flex-shrink: 0; height: 19px; padding: 0 6px; border: none; background: none; font-size: 11.5px; font-weight: 700; color: var(--royal); text-decoration: underline; cursor: pointer; font-family: inherit; }
        .cand-card-actions { position: relative; z-index: 1; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 3px; }
        .cand-card.is-compact { padding: 6px 10px 6px 12px; }
        .cand-card.is-compact .cand-card-main { min-height: 0; }
        @media (max-width: 640px) {
          .cand-wrap { padding: 0 0 12px; }
        }
        .cand-quick { flex-basis: 100%; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
        @media (max-width: 767px) {
          .cand-quick { flex-wrap: nowrap; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 4px; scrollbar-width: none; }
          .cand-quick::-webkit-scrollbar { display: none; }
          .cand-quick-all { order: -1; }
          /* 件数は「22 名」だけにして、並び替え・保存した条件と同じ行に収める（全体の人数は PC と詳細で分かる） */
          .cand-count-total { display: none; }
        }
        /* カードの詰め方は一覧の幅で決める（コンテナクエリ）。スマホでは3行目を折り返してよい */
        .cand-list-col { container-type: inline-size; container-name: candlist; }
        @container candlist (max-width: 420px) {
          .cand-card { gap: 10px; }
          .cand-card-sub3 { white-space: normal; }
        }
        /* 右欄が狭いときは、操作の帯のボタンをアイコンだけにする（1行に収める） */
        .cand-pane { container-type: inline-size; container-name: candpane; }
        .cand-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @container candpane (max-width: 560px) {
          .cand-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        /* ★操作の帯（2026-10-13 / 柴さんの指示）。⚠️ コンテナの幅は右欄の枠線の内側（右欄の幅 − 2px）。
              右欄 510px 未満で「気になる」だけ ☆ のみ、462px 未満で余白を詰める、420px 未満で全部アイコンだけ。
              ⚠️ 「メッセージを送る」「見送り」の文字は 420px 以上では消さない（実測: 文字をすべて出すと 468px 要る） */
        .cand-bar { gap: 6px; }
        .cand-bar-btn { padding: 0 12px; }
        .cand-bar-pos { min-width: 48px; }
        @container candpane (max-width: 507.98px) {
          .cand-bar-label-star { display: none; }
        }
        @container candpane (max-width: 459.98px) {
          .cand-bar { gap: 4px; }
          .cand-bar-btn { padding: 0 8px; }
          .cand-bar-pos { min-width: 0; }
        }
        @container candpane (max-width: 417.98px) {
          .cand-bar-label { display: none; }
        }
        .cand-divider { display: none; }
        /* ★1280px 未満で候補者を選んだら、詳細を画面いっぱいに重ねる（2026-10-18）。ヘッダーと下のタブバーは残す。
              ⚠️ 1280px 以上の分割表示とは別の規則。境界は CANDIDATE_SPLIT_MIN_WIDTH と手で合わせている */
        @media (max-width: 1279.98px) {
          .cand-split[data-overlay=yes] .cand-pane { display: block; position: fixed; z-index: 70; left: 0; right: 0;
            top: var(--biz-header-h); bottom: var(--biz-tabbar-h, 0px); overflow-y: auto; overscroll-behavior: contain; background: #fff; }
        }
        @media (min-width: 1280px) {
          .cand-split { display: grid; grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr); gap: 0; align-items: start; }
          /* 区切り線（見た目と操作は components/common/SplitDivider.tsx。右欄の2列表示の線と同じ部品）。ここは出す・出さないだけ */
          .cand-divider { display: block; }
          .cand-wrap { max-width: none; }
          /* プレビューはヘッダーの下に固定する。ヘッダーの高さは BusinessLayout の --biz-header-h（数字で書かないこと）。
             ★2026-10-11: 高さを決めて外側はスクロールさせず、中（CandidateProfilePanel）の本文だけをスクロールさせる（名前とボタンの段を固定するため） */
          .cand-pane { display: block; position: sticky; top: calc(var(--biz-header-h) + 16px); height: var(--cand-pane-h, calc(100vh - var(--biz-header-h) - 32px)); overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
          .cand-card-actions { display: none; }
        }
      `}</style>

      {/* ⚠️★2026-09-20 に `.candidates-sidebar` / `.candidates-mobile-toggle` を削除した。
             サイドバーをやめ、条件は右のドロワー「すべてのフィルター」に畳んである（2026-10-13）。
             ⚠️ ツールバーは flex-wrap で折り返すので、狭い画面用の出し分け CSS は要らない。 */}
    </div>
  );
}

/**
 * ★見出し横の「？」（2026-10-11）。押すと説明が開く。⚠️ hover だけにしない（タッチで開けない）。
 */
function HelpToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    /* ⚠️ この span に position を付けない。説明は見出しの行（親の relative）の左端から開く（375px で右にはみ出さないため） */
    <span style={{ display: "inline-flex" }}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        data-state="candidates-help"
        className="btn-fixed-size"
        style={{
          width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--line)", background: "#fff",
          color: "var(--ink-mute)", fontSize: 12, fontWeight: 700, lineHeight: 1, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", padding: 0,
        }}>?</button>
      {open && (
        <>
          <button type="button" aria-label="閉じる" onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "transparent", border: "none", cursor: "default", zIndex: 40 }} />
          <span role="note" style={{
            position: "absolute", top: 42, left: 0, zIndex: 41, width: 360, maxWidth: "calc(100vw - 32px)",
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,35,102,0.12)",
            padding: "10px 12px", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-soft)", fontWeight: 400,
          }}>{children}</span>
        </>
      )}
    </span>
  );
}

/** ★（気になる）のアイコン。⚠️ 色は塗り（royal）と線だけ。状態を色付きのバッジにしない */
function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

/** ★カードと右欄の★ボタン。⚠️ 押しても候補者本人には何も届かない（会社の中だけ） */
export function StarButton({ starred, onToggle, size = 28 }: { starred: boolean; onToggle: () => void; size?: number }) {
  return (
    <button type="button" aria-pressed={starred} aria-label={starred ? "気になるから外す" : "気になるに保存"} title={starred ? "気になるから外す" : "気になる（社内で共有・本人には通知されません）"}
      data-state={starred ? "star-on" : "star-off"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className="btn-fixed-size"
      style={{ width: size, height: size, borderRadius: "50%", border: "none", background: "none", padding: 0, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: starred ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
      <StarIcon filled={starred} size={Math.round(size * 0.6)} />
    </button>
  );
}

