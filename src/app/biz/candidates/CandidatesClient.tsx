"use client";

import { ResidenceFilter } from "./ResidenceFilter";
import { OVERSEAS, residenceKey } from "@/lib/utils/location";
import { ApproachButton } from "@/components/approaches/ApproachButton";
/* ★候補者の形・絞り込み・並び替えは lib/business/candidates/model.ts の1か所（2026-10-10）。
      段3の新着メールも同じ関数を使う。⚠️ ここに条件を書き戻さないこと。 */
import {
  ACTIVITY_FILTER_OPTIONS, ACTIVITY_SORTS, AGE_FILTER_OPTIONS, AGE_SORTS, CANDIDATE_SORT_OPTIONS, EMPLOYMENT_TYPE_LABELS, STANCE_FRESHNESS_BANDS, TENURE_BANDS, ageRangeLabel,
  filterCandidates, isNewSince, sortCandidates,
  type Candidate,
} from "@/lib/business/candidates/model";
import { CandidatePreview } from "./CandidatePreview";
import { StanceDot } from "@/components/candidates/StanceMeter";
import { APPROACH_TEST_COMPANY_MESSAGE } from "@/lib/constants/companyApproaches";
import { CANDIDATE_SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { DESIRED_WORK_STYLE_LABELS, CAREER_STANCES, CAREER_STANCE_LABELS } from "@/lib/constants/careerPreferences";
/* ⚠️★**他の3画面（/companies・/jobs・/people）と同じ部品**（2026-09-20）。
      ここに似た実装を作らないこと ——`FilterChip` は 2026-09-18 に
      「同じ名前の別実装が2つあった」のを1つに畳んだもので、**3つ目を作らない**。 */
import { FilterChip } from "@/components/common/FilterChip";
import { SortSelect } from "@/components/common/SortSelect";
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
 * ★転職意欲の選択肢（2026-09-19 / 柴さんの指示）。
 *
 * ⚠️★**ラベルを書き写さないこと。** 正は `lib/constants/careerPreferences.ts` の
 *    `CAREER_STANCES` で、オンボーディングと `/mypage` も同じ定数を見る。
 * ⚠️★**`no_contact` は出さない。** 母集合（page.tsx）が既に落としているので、
 *    選択肢に出すと**必ず0件になる条件**を並べることになる。
 *    ⚠️ 母集合の条件を変えるときは、ここも一緒に見ること。
 */
const CAREER_STANCE_FILTER_OPTIONS = CAREER_STANCES.filter((o) => o.value !== "no_contact");

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
/** ★カードの2行目に出す「できること」の上限（2026-10-12） */
const CARD_SKILLS_MAX = 2;

/** 月数 → カードに出す1行。未算出（null）は**何も出さない**（「0年」と書かない） */
function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

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
}: {
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
  const [roleQuery, setRoleQuery] = useState(init.roleQuery);
  const [companyQuery, setCompanyQuery] = useState(init.companyQuery);
  /* ★除外ワード（2026-09-20）。⚠️ フリーワードと**同じ対象**を見て、当たったら落とす。
     ⚠️ スペース区切りは **OR**（1つでも当たれば落とす）。フリーワードの AND とは逆だが、
        「除外」は1つ当たれば除外したいのが自然なのでこうしてある。 */
  const [excludeQuery, setExcludeQuery] = useState(init.excludeQuery);

  // ── 経歴・雇用形態 ──────────────────────────────────────────────────
  const [topRoleId, setTopRoleId] = useState<string | null>(init.topRoleId);
  const [childRoleId, setChildRoleId] = useState<string | null>(init.childRoleId);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(init.employmentTypes);

  // ── 希望条件 ────────────────────────────────────────────────────────
  const [workStyle, setWorkStyle] = useState(init.workStyle);
  // 0 = 指定なし（万円単位）
  const [salaryMin, setSalaryMin] = useState(init.salaryMin);
  // デフォルトON: 年収未設定の候補者も通す
  const [includeNoSalary, setIncludeNoSalary] = useState(init.includeNoSalary);

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
  /* ⚠️★「メッセージを受け取る方のみ」の切り替えは 2026-10-11 に外した（柴さんの指示）。
        全員が最初から受け取る形にし、止める方法は「転職について」の「今は考えていない」で兼ねる
        （その人はそもそもこの一覧に出ない）。送れるかどうかは今までどおりボタンの有無だけで示す。
     ★送れる人が0人のときだけ一文を出す。⚠️ 判定は `c.approach.eligible`（`can_send_company_approach()`）だけ */
  /* ★一覧の上の灰色の1行（2026-10-11 / 柴さんの指示）。「いま、メッセージを送れる候補者はいません。」は外した。
        検証用の会社を実アカウントで見ているとき → その旨。企業側の上限に当たっているとき → 上限の文言。それ以外は出さない */
  const topNotice = candidates.some((c) => c.approach?.blocked === "test_company") ? APPROACH_TEST_COMPANY_MESSAGE : companyLimitLine;

  /* ⚠️ 「スカウト済みを除く」は 2026-10-08 にスカウトごと廃止した（提案に一本化）。
        保存済み検索に残っている `hideAlreadyScouted` は `parseSavedFilters` が捨てる。 */

  /* ── ★詳細検索の開閉（2026-09-20）───────────────────────────────────
     ⚠️★**280px の常時開きサイドバーに戻さないこと。** 条件12個を縦に並べていたが、
        `/jobs` が 2026-09-09 に同じ形を畳んでおり、この画面だけ旧型で残っていた。
     ⚠️★**閉じていても `activeChips` を外に出す。** 消すと
        「絞り込んだ結果を見ている最中に、絞った理由が画面から消える」。 */
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    if (window.innerWidth < CANDIDATE_SPLIT_MIN_WIDTH) return;
    e.preventDefault();
    updateSelected(id);
  }, [updateSelected]);

  // ── 都道府県・スキルタグを candidates から動的生成 ───────────────────
  /* ★居住地ごとの人数（2026-10-12）。母集合（絞り込み前）で数える。⚠️ 選択肢は人数に関わらず47＋海外を全部出す */
  const residenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      const k = residenceKey(c.location);
      if (k) counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [candidates]);

  /* ★「更新時期」で絞ったときに、更新日時が無くて落ちた人数（2026-09-19）。
        ⚠️ `filtered` の**後**では数えられない（既に落ちている）ので、母集合から数える。
        ⚠️ 0 のときは注記を出さない（出すと常に注記が居座る）。 */
  /* ★年齢で絞ったときに、生年月日が無くて落ちた人数（2026-10-12）。母集合から数える */
  const droppedNoAge = useMemo(
    () => (ageFilterEnabled && (ageMin > 0 || ageMax > 0) ? candidates.filter((c) => c.age == null).length : 0),
    [candidates, ageFilterEnabled, ageMin, ageMax]
  );
  /* ★最近の利用で絞ったときに、記録が無くて落ちた人数（2026-10-12） */
  const droppedNoActivity = useMemo(
    () => (activityEnabled && activity ? candidates.filter((c) => c.activity == null).length : 0),
    [candidates, activityEnabled, activity]
  );
  const droppedNoStanceTs = useMemo(
    () => (stanceFreshness ? candidates.filter((c) => !c.careerStanceUpdatedAt).length : 0),
    [candidates, stanceFreshness]
  );

  const jobTypeFilterActive = topRoleId !== null;
  const activeFilterCount = [
    q.trim() ? "x" : "",
    excludeQuery.trim() ? "x" : "",
    roleQuery.trim() ? "x" : "",
    companyQuery.trim() ? "x" : "",
    workStyle,
    jobTypeFilterActive ? "x" : "",
    selectedEmploymentTypes.length ? "x" : "",
    tenureBand ? "x" : "",
    ageFilterEnabled && (ageMin > 0 || ageMax > 0) ? "x" : "",
    careerStances.length ? "x" : "",
    activityEnabled && activity ? "x" : "",
    stanceFreshness ? "x" : "",
    selectedPrefectures.length ? "x" : "",
    salaryMin > 0 ? "x" : "",
    hasTouchpoints ? "x" : "",
    starredOnly ? "x" : "",
  ].filter(Boolean).length;
  /** ★詳細検索の中にある条件の数（ボタンに出す）。⚠️ よく使う行に出ている条件は数えない（同じものを2か所で数えない） */
  const advancedCount = [
    roleQuery.trim(), companyQuery.trim(), excludeQuery.trim(),
    ageFilterEnabled && (ageMin > 0 || ageMax > 0) ? "x" : "",
    selectedEmploymentTypes.length ? "x" : "", workStyle, salaryMin > 0 ? "x" : "",
    stanceFreshness, activityEnabled && activity ? "x" : "",
  ].filter(Boolean).length;

  /* ★いま効いている条件のチップ（2026-09-20）。**詳細検索を閉じていても外に出す。**
     ⚠️★**消さないこと。** 12条件を1つのパネルに畳んだので、これが無いと
        「なぜこの件数なのか」が画面から消える（`/jobs` と同じ理由）。
     ⚠️ 解除の手段をチップの ✕ だけにしない。パネルを開けば元のチップからも外せる。
     ⚠️ 並びは詳細検索パネルの並びと**同じ順**にする。片方だけ変えないこと。 */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    const wantRole = childRoleId ?? topRoleId;
    if (wantRole) {
      /* ⚠️ 名前が引けない id は出さない（生の uuid を画面に出さないため） */
      const name = childRoleId
        ? roleFilterTree.flatMap((t) => t.children).find((c) => c.id === childRoleId)?.name
        : roleFilterTree.find((t) => t.id === topRoleId)?.name;
      if (name) chips.push({ key: "role", label: name, clear: () => { setTopRoleId(null); setChildRoleId(null); } });
    }
    careerStances.forEach((v) => {
      const label = CAREER_STANCE_FILTER_OPTIONS.find((o) => o.value === v)?.label;
      if (label) chips.push({ key: `stance:${v}`, label, clear: () => setCareerStances(careerStances.filter((x) => x !== v)) });
    });
    if (tenureBand) {
      const label = TENURE_BANDS.find((b) => b.value === tenureBand)?.label;
      if (label) chips.push({ key: "tenure", label: `社会人 ${label}`, clear: () => setTenureBand("") });
    }
    selectedPrefectures.forEach((pref) => chips.push({
      key: `pref:${pref}`, label: pref,
      clear: () => setSelectedPrefectures(selectedPrefectures.filter((x) => x !== pref)),
    }));
    if (hasTouchpoints) chips.push({ key: "touch", label: "合うところあり", clear: () => setHasTouchpoints(false) });
    if (starredOnly) chips.push({ key: "starred", label: "気になる", clear: () => setStarredOnly(false) });
    /* ★ここまでがよく使う行（2026-10-12）と同じ並び。以下は検索窓と詳細検索の中の条件 */
    if (q.trim()) chips.push({ key: "q", label: `キーワード: ${q.trim()}`, clear: () => setQ("") });
    /* ⚠️ ラベルは入力欄と同じ語にする（「役職」に戻さない。下の入力欄の注記を読むこと）。 */
    if (roleQuery.trim()) chips.push({ key: "roleQuery", label: `社内での呼び方: ${roleQuery}`, clear: () => setRoleQuery("") });
    if (companyQuery.trim()) chips.push({ key: "companyQuery", label: `会社: ${companyQuery}`, clear: () => setCompanyQuery("") });
    if (excludeQuery.trim()) chips.push({ key: "exclude", label: `除外: ${excludeQuery}`, clear: () => setExcludeQuery("") });
    if (ageFilterEnabled && (ageMin > 0 || ageMax > 0)) chips.push({ key: "age", label: ageRangeLabel(ageMin, ageMax), clear: () => { setAgeMin(0); setAgeMax(0); } });
    selectedEmploymentTypes.forEach((v) => chips.push({
      key: `et:${v}`,
      label: EMPLOYMENT_TYPE_LABELS[v] ?? v,
      clear: () => setSelectedEmploymentTypes(selectedEmploymentTypes.filter((x) => x !== v)),
    }));
    if (workStyle) chips.push({
      key: "ws",
      label: (DESIRED_WORK_STYLE_LABELS as Record<string, string>)[workStyle] ?? workStyle,
      clear: () => setWorkStyle(""),
    });
    if (salaryMin > 0) chips.push({ key: "salary", label: `${salaryMin}万〜`, clear: () => setSalaryMin(0) });
    if (activityEnabled && activity) {
      const label = ACTIVITY_FILTER_OPTIONS.find((o) => o.value === activity)?.label;
      if (label) chips.push({ key: "activity", label: `利用 ${label}`, clear: () => setActivity("") });
    }
    if (stanceFreshness) {
      const label = STANCE_FRESHNESS_BANDS.find((b) => b.value === stanceFreshness)?.label;
      if (label) chips.push({ key: "fresh", label: `更新 ${label}`, clear: () => setStanceFreshness("") });
    }
    return chips;
  }, [excludeQuery, roleQuery, companyQuery, childRoleId, topRoleId, roleFilterTree, selectedEmploymentTypes,
      workStyle, salaryMin, careerStances, stanceFreshness, tenureBand, selectedPrefectures, ageFilterEnabled, ageMin, ageMax, activityEnabled, activity,
      hasTouchpoints, starredOnly, q]);

  /* ── ★保存した条件（2026-09-21）────────────────────────────────────────
     ⚠️★**この表がこの機能の歯止め。** マップ型なので、
        `SavedCandidateFilters` にキーを足すと**ここが型エラーになる。**
        ＝ 条件を1つ足したときに「保存だけ対応を忘れる」ことができない。
        **`Record<string, ...>` に緩めないこと**（緩めた瞬間に歯止めが消える）。
     ⚠️ `sort` も入れてある。並び替えまで戻さないと「その画面」の再現にならない。 */
  const FILTER_SETTERS: { [K in keyof SavedCandidateFilters]: (v: SavedCandidateFilters[K]) => void } = {
    q: setQ,
    excludeQuery: setExcludeQuery,
    roleQuery: setRoleQuery,
    companyQuery: setCompanyQuery,
    topRoleId: setTopRoleId,
    childRoleId: setChildRoleId,
    employmentTypes: setSelectedEmploymentTypes,
    workStyle: setWorkStyle,
    salaryMin: setSalaryMin,
    includeNoSalary: setIncludeNoSalary,
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
    q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
    employmentTypes: selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
    tenureBand, ageMin, ageMax, prefectures: selectedPrefectures, careerStances, stanceFreshness, activity,
    hasTouchpoints, starredOnly,
    sort,
  }), [q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
       selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
       tenureBand, ageMin, ageMax, selectedPrefectures, careerStances, stanceFreshness, activity,
       hasTouchpoints, starredOnly,
       sort]);

  /* ★★の状態を重ねた候補者（2026-10-12）。⚠️ 絞り込み（「気になる」）も数も、すべてこちらを通す */
  const withStars = useMemo(
    () => (Object.keys(starOverride).length === 0 ? candidates : candidates.map((c) => (c.id in starOverride ? { ...c, starred: starOverride[c.id] } : c))),
    [candidates, starOverride]
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
  const filtered = useMemo(() => {
    const list = filterCandidates(withStars, currentFilters, new Date(), { ageFilter: ageFilterEnabled, activity: activityEnabled });
    return newSince ? list.filter((c) => isNewSince(c, newSince)) : list;
  }, [withStars, currentFilters, newSince, ageFilterEnabled, activityEnabled]);
  /* ⚠️ 年齢の並び替えは無効な環境では使わない（保存した条件に残っていても新着順に戻す） */
  const effectiveSort = (!ageFilterEnabled && AGE_SORTS.includes(sort)) || (!activityEnabled && ACTIVITY_SORTS.includes(sort)) ? "new" : sort;
  const sorted = useMemo(() => sortCandidates(filtered, effectiveSort), [filtered, effectiveSort]);
  /* ★プレビューに出す人。明示的に選んだ人 → 無ければ（1280px 以上で、閉じていなければ）先頭の人 */
  const shownId: string | null = selected ?? (isWide && autoPick ? sorted[0]?.id ?? null : null);
  /* ★キーボードで候補者を移る（2026-10-12 / 柴さんの指示）。↑↓ と J/K。
     ⚠️ 入力中（input・textarea・select・contenteditable）と修飾キー付きは何もしない。
     ⚠️ 1280px 以上（右欄が出ているとき）だけ。それ未満は右欄が無いので、選んでも何も変わらない。
     ⚠️ 選んだカードが見えるように一覧をスクロールする（`block: "nearest"`。ヘッダーの下に隠れないよう scroll-margin を CSS で持つ）。
        ⚠️ `behavior: "instant"`。html が scroll-behavior: smooth なので、既定だとキーを続けて押したときに前のスクロールが途中で止まり、選んだカードが画面外に残る */
  useEffect(() => {
    if (!isWide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const k = e.key;
      const dir = k === "ArrowDown" || k === "j" || k === "J" ? 1 : k === "ArrowUp" || k === "k" || k === "K" ? -1 : 0;
      if (!dir || sorted.length === 0) return;
      e.preventDefault();
      const idx = shownId ? sorted.findIndex((c) => c.id === shownId) : -1;
      const nextIdx = idx < 0 ? 0 : Math.min(sorted.length - 1, Math.max(0, idx + dir));
      const next = sorted[nextIdx];
      if (!next || next.id === shownId) return;
      setAutoPick(true);
      updateSelected(next.id);
      document.querySelector(`[data-candidate-card="${next.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "instant" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isWide, sorted, shownId, updateSelected]);

  /** 絞り込み後に残っている「社会人年数が未算出」の人数。注記に出す */
  const unknownTenureCount = useMemo(() => filtered.filter((c) => c.tenureMonths == null).length, [filtered]);

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
  function clearAllFilters() {
    applyFilters(EMPTY_SAVED_FILTERS);
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


  /* ── ★詳細検索パネルの中身（2026-09-20 にサイドバーから移した）──────────
     ⚠️★**チップは `components/common/FilterChip.tsx` を使う。** `/companies` と
        `/people` が同じものを使っており、**同じ名前の別実装を作らない**（3つ目を作らない）。
     ⚠️★**並びは `activeChips` の並びと同じ順**にしてある。片方だけ変えないこと。
     ⚠️ 自由入力（社内での呼び方・会社名）だけはチップにできないので、先頭に小さな欄として置く。 */
  const roleChipOptions = roleFilterTree.flatMap((top) => [
    { value: top.id, label: top.name },
    /* ⚠️ 子は `parent` を付けて親の直下にぶら下げる（フェーズと同じ形）。
          **18の親チップ＋子パネル**という旧実装に戻さないこと。 */
    ...top.children.map((child) => ({ value: child.id, label: child.name, parent: top.id })),
  ]);

  /* ── ★詳細検索パネルは「項目の種類ごとの行」に分けた（2026-09-21 / 柴さん）────
     それまでは入力欄3つとチップ9つが**見出しなしで1つの塊に折り返して**並んでおり、
     どれが経歴の条件でどれが希望の条件か読めなかった（YOUTRUST の絞り込みを参考に整理）。
     ⚠️★**280px の常時開きサイドバーには戻していない**（2026-09-20 の判断はそのまま）。
        変えたのは「畳んだパネルの中の並べ方」だけ。
     ⚠️★行の順と行の中の順は `activeChips` と**同じ**。片方だけ変えないこと。 */
  const inputStyle = (active: boolean, danger = false): React.CSSProperties => ({
    height: 34, flex: "1 1 180px", minWidth: 0, padding: "0 12px",
    border: `1px solid ${active ? (danger ? "#FCA5A5" : "var(--royal)") : "var(--line)"}`, borderRadius: 999,
    fontSize: 12.5, outline: "none", fontFamily: "inherit", color: "var(--ink)",
    background: "#fff", boxSizing: "border-box",
  });

  const filterRow = (label: string, children: React.ReactNode) => (
    <div className="cand-filter-row" style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>{children}</div>
    </div>
  );

  const advancedPanel = (
    <div style={{
      flexBasis: "100%", display: "flex", flexDirection: "column", gap: 12,
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 12, padding: "16px 18px",
    }}>
      {/* 自由入力。⚠️ 上の検索窓とは別物（あちらは名前・職種・会社を横断） */}
      {filterRow("キーワード", <>
        {/* ⚠️★**「役職」と書かないこと**（2026-10-01 に直した）。この欄が見ているのは
               `ow_experiences.role_title`＝**本人が自由入力した「社内での呼び方」**で、
               5択の役職（`ow_experiences.rank`）**ではない**。
               2026-10-01 まで「現在の役職」と書いてあり、**5択の役職で絞っているように読めた。**
               ⚠️ 2つは別の列（オンボーディングにも「混ぜないこと」と書いてある）。
                  **ここで両方を見る形にもしないこと** ——自由入力とラベルが1つの欄に混ざる。
               ⚠️ `rank` で絞る欄は**作っていない**。実データが実ユーザーの職歴36件中
                  **4件**（係長3 / 課長1。他は「役職なし」15・未入力17）しかなく、
                  選択肢の大半が必ず0件になる（「0件の選択肢を出さない」）。
               ⚠️ **state とクエリのキー（`roleQuery`）は変えていない。** 保存した検索条件
                  （`lib/business/savedSearch.ts`）に入っている名前で、変えると復元できなくなる。 */}
        <input type="text" value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)}
          aria-label="社内での呼び方" placeholder="社内での呼び方（例：営業マネージャー）" style={inputStyle(!!roleQuery)} />
        <input type="text" value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)}
          aria-label="現在の会社名" placeholder="現在の会社名（例：Salesforce）" style={inputStyle(!!companyQuery)} />
        {/* ★除外ワード（2026-09-20）。⚠️ 「絞る」ではなく「落とす」なので、
               入力されたら**赤系の枠**にして他と見分ける。 */}
        <input type="text" value={excludeQuery} onChange={(e) => setExcludeQuery(e.target.value)}
          aria-label="除外するワード" placeholder="除外するワード（スペース区切り）" style={inputStyle(!!excludeQuery, true)} />
      </>)}

      {filterRow("経歴", <>
        {/* ★年齢（下限・上限）。⚠️ CANDIDATE_AGE_FILTER_ENABLED のときだけ出す（本番は無効） */}
        {ageFilterEnabled && (<>
          <FilterChip
            label="年齢（下限）" value={ageMin ? String(ageMin) : ""}
            options={AGE_FILTER_OPTIONS.filter((a) => !ageMax || a <= ageMax).map((a) => ({ value: String(a), label: `${a}歳以上` }))}
            onSelect={(v) => setAgeMin(v ? Number(v) : 0)}
            isOpen={openChip === "ageMin"} onToggle={() => setOpenChip(openChip === "ageMin" ? null : "ageMin")}
          />
          <FilterChip
            label="年齢（上限）" value={ageMax ? String(ageMax) : ""}
            options={AGE_FILTER_OPTIONS.filter((a) => !ageMin || a >= ageMin).map((a) => ({ value: String(a), label: `${a}歳以下` }))}
            onSelect={(v) => setAgeMax(v ? Number(v) : 0)}
            isOpen={openChip === "ageMax"} onToggle={() => setOpenChip(openChip === "ageMax" ? null : "ageMax")}
          />
        </>)}
        <FilterChip
          label="雇用形態" value="" values={selectedEmploymentTypes}
          options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          onSelect={() => {}}
          onToggleValue={(v) => setSelectedEmploymentTypes(toggleMulti(selectedEmploymentTypes, v))}
          isOpen={openChip === "emp"} onToggle={() => setOpenChip(openChip === "emp" ? null : "emp")}
        />
      </>)}

      {filterRow("希望条件", <>
        <FilterChip
          label="働き方" value={workStyle}
          /* ⚠️ ラベルは careerPreferences.ts の1箇所で決める。ここに直書きしない。
                求人の勤務形態（workStyle.ts）とは意味が違うので混ぜない。 */
          options={Object.entries(DESIRED_WORK_STYLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          onSelect={(v) => setWorkStyle(v ?? "")}
          isOpen={openChip === "ws"} onToggle={() => setOpenChip(openChip === "ws" ? null : "ws")}
        />
        <FilterChip
          label="希望年収" value={salaryMin > 0 ? String(salaryMin) : ""}
          options={[400, 600, 800, 1000, 1200].map((v) => ({ value: String(v), label: `${v}万〜` }))}
          onSelect={(v) => setSalaryMin(v ? Number(v) : 0)}
          isOpen={openChip === "salary"} onToggle={() => setOpenChip(openChip === "salary" ? null : "salary")}
        />
      </>)}

      {/* ★転職意欲と更新時期。⚠️★**2つは対。片方だけ外さないこと**（更新時期だけだと
             「意欲は問わないが最近更新した人」になり、条件として成立しない）。 */}
      {filterRow("意向の更新・利用", <>
        <FilterChip
          label="意向を更新した時期" value={stanceFreshness}
          options={STANCE_FRESHNESS_BANDS.map((b) => ({ value: b.value, label: b.label }))}
          onSelect={(v) => setStanceFreshness(v ?? "")}
          isOpen={openChip === "fresh"} onToggle={() => setOpenChip(openChip === "fresh" ? null : "fresh")}
        />
        {/* ★最近の利用（2026-10-12）。⚠️ CANDIDATE_ACTIVITY_ENABLED のときだけ（本番は無効） */}
        {activityEnabled && (
          <FilterChip
            label="最近の利用" value={activity}
            options={ACTIVITY_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onSelect={(v) => setActivity(v ?? "")}
            isOpen={openChip === "activity"} onToggle={() => setOpenChip(openChip === "activity" ? null : "activity")}
          />
        )}
        {/* ⚠️★「声かけを受け取る方のみ」は 2026-10-10（段2）に1段目のトグルへ移した。ここに戻さないこと（入口を2つにしない） */}
      </>)}

      {/* ⚠️★黙って減らさない／黙って混ぜない。**理由と人数を画面に出す。**
             ⚠️ 2つは向きが逆（更新時期は落とす・社会人年数は通す）。**揃えていないのは意図的。** */}
      {stanceFreshness && droppedNoStanceTs > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          更新日時が記録されていない {droppedNoStanceTs} 名は含みません。
          この記録は 2026-09-19 から取り始めたため、それ以前に答えた方は対象外です。
        </div>
      )}
      {droppedNoAge > 0 && (
        <div data-state="age-dropped-note" style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          生年月日が未登録の {droppedNoAge} 名は含みません。
        </div>
      )}
      {droppedNoActivity > 0 && (
        <div data-state="activity-dropped-note" style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          利用の記録が無い {droppedNoActivity} 名は含みません。この記録は 2026-10-12 から取り始めました。
        </div>
      )}
      {tenureBand && unknownTenureCount > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          職歴が未登録の {unknownTenureCount} 名は年数を算出できないため、そのまま表示しています。
        </div>
      )}

      {/* フッター：その他の条件と、まとめて外す */}
      {activeFilterCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearAllFilters}
              style={{
                marginLeft: "auto", height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid var(--line)",
                background: "#fff", fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 600, flexShrink: 0,
              }}>
              条件をすべて外す（{activeFilterCount}）
            </button>
          )}
        </div>
      )}

      {/* ⚠️ 狭い画面では見出しを上に積む（96px の列を取ると入力欄が潰れる） */}
      <style>{`
        @media (max-width: 640px) {
          .cand-filter-row { grid-template-columns: 1fr !important; gap: 6px !important; }
        }
      `}</style>
    </div>
  );


  /* ── ★よく使う条件の行（2026-10-12 / 柴さんの指示）──────────────────────────
     検索窓の下に1行：職種／転職への意向／社会人年数／居住地／合うところあり／気になる（n）／詳細検索。
     ⚠️ 年齢・最近の利用は詳細検索の中（スイッチがオンのときだけ）。
     ⚠️ 画面のラベルは「居住地」（指示は「勤務地」だったが、見ているのは本人のお住まい `ow_users.location`。
        希望勤務地とは別の列なので「勤務地」と書くと別のもので絞っているように読める） */
  const toggleStyle = (on: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999,
    border: `1.5px solid ${on ? "var(--royal)" : "#e2e8f0"}`, background: on ? "var(--royal)" : "#fff",
    color: on ? "#fff" : "var(--ink-soft)", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  });
  const quickRow = (
    <div data-state="quick-filters" style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <FilterChip
        label="職種" value={childRoleId ?? topRoleId ?? ""}
        options={roleChipOptions} searchable
        onSelect={(v) => {
          if (!v) { setTopRoleId(null); setChildRoleId(null); return; }
          const parent = roleFilterTree.find((t) => t.id === v);
          if (parent) { setTopRoleId(v); setChildRoleId(null); return; }
          /* 子を選んだら、親も一緒に立てる。⚠️ 絞り込みは `childRoleId ?? topRoleId` を見るので
                親を立てなくても効くが、**チップの表示と解除の経路を1つにする**ため揃える。 */
          const owner = roleFilterTree.find((t) => t.children.some((c) => c.id === v));
          setTopRoleId(owner?.id ?? null); setChildRoleId(v);
        }}
        isOpen={openChip === "role"} onToggle={() => setOpenChip(openChip === "role" ? null : "role")}
      />
        <FilterChip
        label="転職への意向" value="" values={careerStances}
        options={CAREER_STANCE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onSelect={() => {}}
        onToggleValue={(v) => setCareerStances(toggleMulti(careerStances, v))}
        isOpen={openChip === "stance"} onToggle={() => setOpenChip(openChip === "stance" ? null : "stance")}
      />
        <FilterChip
        label="社会人年数" value={tenureBand}
        options={TENURE_BANDS.map((b) => ({ value: b.value, label: b.label }))}
        onSelect={(v) => setTenureBand(v ?? "")}
        isOpen={openChip === "tenure"} onToggle={() => setOpenChip(openChip === "tenure" ? null : "tenure")}
      />
        {/* ★居住地（2026-10-12）。47都道府県を地方ごとに常に全部＋海外。複数選択・地方ごとの「すべて」・クリア／適用 */}
        <ResidenceFilter selected={selectedPrefectures} counts={residenceCounts} onApply={setSelectedPrefectures}
          isOpen={openChip === "pref"} onToggle={() => setOpenChip(openChip === "pref" ? null : "pref")} />
      <button type="button" aria-pressed={hasTouchpoints} data-state="toggle-touchpoints" onClick={() => setHasTouchpoints((v) => !v)} style={toggleStyle(hasTouchpoints)}>
        合うところあり
      </button>
      {/* ★気になる（会社の管理者で共有の★）。⚠️ 0人でも出す（押すと0件になるが、入口があることを示す） */}
      <button type="button" aria-pressed={starredOnly} data-state="toggle-starred" onClick={() => setStarredOnly((v) => !v)} style={toggleStyle(starredOnly)}>
        <StarIcon filled={starredOnly} />気になる（{starredCount}）
      </button>
        {/* 詳細検索。⚠️ 効いている条件の数をボタンに出す（閉じていても分かるように） */}
      <button
        type="button" onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
          height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13,
          fontWeight: showAdvanced || advancedCount > 0 ? 700 : 500,
          border: `1px solid ${showAdvanced || advancedCount > 0 ? "var(--royal)" : "var(--line)"}`,
          background: showAdvanced || advancedCount > 0 ? "var(--royal-50)" : "#fff",
          color: showAdvanced || advancedCount > 0 ? "var(--royal)" : "var(--ink-soft)",
        }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
        </svg>
        詳細検索
        {advancedCount > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
            background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 800,
          }}>{advancedCount}</span>
        )}
      </button>

    </div>
  );

  return (
    <div className="cand-wrap">

      {/* ── ★ツールバー（2026-09-20）─────────────────────────────────────────
             `/companies`・`/jobs`・`/people` と同じ並び：
               検索窓 → 詳細検索 → 並び替え → 件数
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
            「転職について」で「今は考えていない」を選んでいる方は表示されません。
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
            placeholder="名前・職種・会社で検索"
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

        <span style={{ fontSize: 13, color: "var(--ink-soft)", flexShrink: 0, marginLeft: "auto" }}>
          <strong style={{ fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)", color: "var(--royal)" }}>{filtered.length}</strong>
          {" "}名 / 全{candidates.length}名
        </span>

        {/* ⚠️ 取得・保存・削除の失敗を画面に出す。握り潰さない（CLAUDE.md） */}
        {savedError && (
          <p style={{ flexBasis: "100%", margin: 0, fontSize: 12.5, color: "var(--error)" }}>
            保存した条件：{savedError}
          </p>
        )}

        {quickRow}

        {/* ★絞り込み中（2026-10-12 / 柴さんの指示）。**絞っているあいだは常に出す**（詳細検索の開閉と関係なく）。
               ⚠️ 消さないこと。条件を畳んだので、これが無いと「なぜこの人数か」が画面から消える。
               ⚠️ 解除の手段はここの ✕ と「すべて解除」。元のチップからも外せる */}
        {activeChips.length > 0 && (
          <div data-state="active-filters" style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-soft)" }}>
            <span style={{ fontWeight: 700, marginRight: 4 }}>絞り込み中：</span>
            {activeChips.map((c, idx) => (
              <span key={c.key} style={{ display: "inline-flex", alignItems: "center" }}>
                {idx > 0 && <span aria-hidden="true" style={{ margin: "0 4px", color: "var(--ink-mute)" }}>・</span>}
                <button type="button" onClick={c.clear} aria-label={`${c.label} の絞り込みを外す`} data-state="active-filter"
                  className="btn-fixed-size"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 26, padding: "0 4px", border: "none", background: "none", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  {c.label}<span aria-hidden="true" style={{ fontSize: 12, color: "var(--ink-mute)" }}>✕</span>
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAllFilters} data-state="clear-conditions" className="btn-fixed-size"
              style={{ marginLeft: 10, height: 26, padding: "0 4px", border: "none", background: "none", fontSize: 12.5, fontWeight: 600, color: "var(--royal)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              すべて解除
            </button>
          </div>
        )}

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

        {showAdvanced && advancedPanel}
      </div>

      {/* ── 一覧＋右のプレビュー（2026-10-10 / 段1）──────────────────────────────
             ⚠️★分割は 1280px 以上（CSS の @media と `CANDIDATE_SPLIT_MIN_WIDTH` を手で合わせている）。一覧とプレビューは 1：1。
             ⚠️ 1024〜1279px 用の「カードを詰める・2行目以降を隠す」作りは 2026-10-11 に外した（1279px 以下では分割しないので不要）。 */}
      <div className="cand-split" data-selected={shownId ? "1" : "0"}>
        <div style={{ minWidth: 0 }}>
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
                  ? "「転職について」に答えている求職者がまだいません"
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
              {/* ⚠️ 描くのは `sorted`。`filtered` を直接 map しないこと（並び替えが効かなくなる） */}
              {sorted.map((c) => {
                const tenure = formatTenure(c.tenureMonths);
                const isSel = shownId === c.id;
                return (
                  <div key={c.id} data-candidate-card={c.id} data-selected={isSel ? "1" : "0"}
                    /* ⚠️ 枠線と背景は CSS（.cand-card / .is-selected）。選択中とフォーカスで同じ枠1本を使う（二重にしない） */
                    className={isSel ? "cand-card is-selected" : "cand-card"}
                  >
                    {/* ★2行のカード（2026-10-12 / 柴さんの指示で整理。1280px で14人前後）:
                           1行目 名前（太字）・年齢（スイッチがオンのとき）・社会人〇年・職種・会社・都道府県・転職への意向（灰色・末尾）／右端に★
                                 ⚠️ 幅が足りないときは 都道府県 → 会社 → 職種 の順に縮めて「…」。意向は縮めない
                           2行目 できること（最大2つ）と「〈会社名〉と合うところ（〇）」だけ
                        ⚠️ 状態をバッジにしない（「転職検討中」のチップは外した。意向は1行目の灰色の文字で全員に出す）。
                        ⚠️ ボタン類（★・メッセージ）はリンクの外に置く（リンクの中にボタンを入れない） */}
                    <a className="cand-card-link" href={`/u/${c.id}`} onClick={(e) => onCardLinkClick(e, c.id)} aria-label={`${c.name}のプロフィール`} />
                    {/* アバター（32px）。⚠️ 人によって色を変えない */}
                    <div className="cand-card-avatar" aria-hidden="true">
                      <PersonAvatar name={c.name} url={c.avatarUrl} size={32} fontSize={13} />
                    </div>
                    <div className="cand-card-main">
                      {(() => {
                        const pref = residenceLabel(c.location);
                        const role = c.currentRole || c.currentCompany
                          ? c.currentRole
                          : (c.desiredRoleNames.length > 0 ? `希望: ${c.desiredRoleNames.join("・")}` : null);
                        const ageText = c.age != null ? `${c.age}歳` : null;
                        const stanceText = c.careerStance ? CAREER_STANCE_LABELS[c.careerStance] ?? null : null;
                        const title = [c.name, ageText, c.genderLabel, tenure, role, c.currentCompany, pref, stanceText].filter(Boolean).join(" ・ ");
                        return (
                          <div className="cand-card-row1" title={title}>
                            <span className="cand-card-name">{c.name}</span>
                            {/* ★年齢・性別（どちらもサーバーで表示用にしたもの。性別は表示だけで絞り込みには使わない）・社会人年数 */}
                            {(ageText || c.genderLabel || tenure) && <span className="cand-card-sub" data-state="card-age-tenure">{[ageText, c.genderLabel, tenure].filter(Boolean).join("・")}</span>}
                            {/* ⚠️ 640px 以下では、この3つを名前の下の行に回す（1行に収めると職種まで切れて読めない） */}
                            <span className="cand-card-metas">
                            {role && <span className="cand-card-meta cand-card-role">{role}</span>}
                            {/* 区切りの「・」は項目の中に入れる（縮んで消えるときに区切りも一緒に消える） */}
                            {c.currentCompany && <span className={role ? "cand-card-meta cand-card-company has-sep" : "cand-card-meta cand-card-company"}>{role ? "・" : ""}{c.currentCompany}</span>}
                            {pref && <span className={role || c.currentCompany ? "cand-card-meta cand-card-pref has-sep" : "cand-card-meta cand-card-pref"}>{role || c.currentCompany ? "・" : ""}{pref}</span>}
                            </span>
                            {/* ★意向の文字の前に同じ色の小さな点（StanceMeter と同じ色）。文字はグレーのまま */}
                            {stanceText && <span className="cand-card-stance" data-state="card-stance"><StanceDot stance={c.careerStance} size={7} /><span className="cand-card-stance-text">{stanceText}</span></span>}
                            <span className="cand-card-star">
                              {canAct && <StarButton starred={!!c.starred} onToggle={() => void toggleStar(c.id, !c.starred)} size={26} />}
                            </span>
                          </div>
                        );
                      })()}
                      {/* 2行目。⚠️ できることは最大2つ（`CARD_SKILLS_MAX`） */}
                      {(() => {
                        const skills = (c.autoSkills ?? []).slice(0, CARD_SKILLS_MAX);
                        const tp = c.touchpoints?.length ?? 0;
                        if (skills.length === 0 && !tp) return null;
                        return (
                          <div className="cand-card-row2">
                            <div className="cand-card-chips">
                              {/* ★できること（職種 × 年数）。⚠️ 職歴からの計算（本人の入力ではない） */}
                              {skills.map((sk) => (
                                <span key={sk.label} className="cand-chip">{sk.label}<span className="cand-chip-sub">{sk.band}</span></span>
                              ))}
                              {tp > 0 && <span data-state="touchpoint-count" className="cand-chip">{companyShortName ?? "貴社"}と合うところ（{tp}）</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {/* ★メッセージのボタン。⚠️ 1280px 以上はプレビューに任せて隠す（同じ入口を2つ並べない）。
                             送れない人には何も出さない。「プロフィールを見る」はカード自体がリンクなので外した */}
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
        </div>

        {/* 右のプレビュー。⚠️ 1280px 未満では CSS で隠す */}
        <aside ref={paneRef} className="cand-pane" aria-live="polite" aria-label="候補者のプレビュー">
          {shownId ? (
            <CandidatePreview key={shownId} userId={shownId} companyLimitLine={companyLimitLine} canAct={canAct} onClose={() => { setAutoPick(false); updateSelected(null); }}
              nameAction={!canAct ? undefined : <StarButton starred={!!withStars.find((x) => x.id === shownId)?.starred} onToggle={() => { const cur = !!withStars.find((x) => x.id === shownId)?.starred; void toggleStar(shownId, !cur); }} size={28} />} />
          ) : isWide === null ? null : (
            <div data-state="preview-empty" style={{ padding: "28px 20px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              候補者を選ぶと、ここにプロフィールと貴社と合うところが表示されます。
            </div>
          )}
        </aside>
      </div>

      {/* ⚠️ style タグの中に山かっこや引用符を書かないこと（ハイドレーションが壊れる） */}
      <style>{`
        .cand-wrap { padding: 0 32px 16px; max-width: 1400px; margin: 0 auto; }
        .cand-card { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 6px 12px 6px 14px; background: #fff; border: 1px solid var(--line); border-radius: 12px; transition: border-color 0.15s, background 0.15s; }
        .cand-card { scroll-margin-top: calc(var(--biz-header-h, 64px) + 12px); scroll-margin-bottom: 12px; }
        .cand-card.is-selected { border-color: var(--royal); background: var(--royal-50); }
        .cand-card .cand-card-link:focus-visible { outline: none !important; }
        .cand-card:has(.cand-card-link:focus-visible) { border-color: var(--royal); }
        .cand-card:hover { border-color: var(--royal-100); }
        .cand-card.is-selected:hover { border-color: var(--royal); }
        .cand-pane { display: none; }
        /* カード全体をリンクにする（中のボタンは z-index で上に出す） */
        .cand-card-link { position: absolute; inset: 0; border-radius: 12px; z-index: 0; }
        .cand-card-avatar { flex-shrink: 0; }
        .cand-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; justify-content: center; min-height: 32px; }
        .cand-card-row1 { display: flex; align-items: center; gap: 6px; min-width: 0; height: 20px; line-height: 20px; }
        .cand-card-name { font-size: 15px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 0; max-width: 40%; }
        .cand-card-sub { font-size: 12px; color: var(--ink-mute); white-space: nowrap; flex-shrink: 0; }
        /* 職種・会社・勤務地。縮む順番は 勤務地 → 会社 → 職種（倍率の差で作る。数字の大小だけが意味を持つ） */
        .cand-card-metas { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 0 1 auto; overflow: hidden; }
        .cand-card-meta { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .cand-card-role { color: var(--ink-soft); flex-shrink: 1; }
        .cand-card-company { color: var(--ink-mute); flex-shrink: 100; }
        .cand-card-pref { color: var(--ink-mute); flex-shrink: 10000; }
        .cand-card-meta.has-sep { margin-left: -6px; }
        .cand-card-stance { font-size: 12px; color: var(--ink-mute); white-space: nowrap; min-width: 3em; flex: 0 3 auto; display: inline-flex; align-items: center; gap: 5px; overflow: hidden; }
        .cand-card-stance-text { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .cand-card-star { margin-left: auto; margin-right: -4px; height: 20px; display: flex; align-items: center; position: relative; z-index: 1; flex-shrink: 0; }
        .cand-card-row2 { display: flex; align-items: center; gap: 8px; min-width: 0; height: 19px; }
        /* チップは1行に収まるぶんだけ（折り返した2行目は高さで切る） */
        .cand-card-chips { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; flex: 1; height: 19px; overflow: hidden; }
        .cand-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; line-height: 17px; font-weight: 600; padding: 0 8px; border-radius: 100px; background: var(--bg-tint); border: 1px solid var(--line); color: var(--ink-soft); white-space: nowrap; }
        .cand-chip-sub { font-weight: 500; color: var(--ink-mute); }
        .cand-card-actions { position: relative; z-index: 1; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 3px; }
        @media (max-width: 640px) {
          .cand-wrap { padding: 0 16px 12px; }
          .cand-card { padding: 12px 14px; gap: 10px; }
          .cand-card-row1 { flex-wrap: wrap; height: auto; row-gap: 2px; }
          .cand-card-metas { order: 3; flex-basis: 100%; line-height: 18px; }
          .cand-card-star { order: 2; }
          .cand-card-stance { order: 4; }
        }
        @media (min-width: 1280px) {
          .cand-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
          .cand-wrap { max-width: none; }
          /* プレビューはヘッダーの下に固定する。ヘッダーの高さは BusinessLayout の --biz-header-h（数字で書かないこと）。
             ★2026-10-11: 高さを決めて外側はスクロールさせず、中（CandidateProfilePanel）の本文だけをスクロールさせる（名前とボタンの段を固定するため） */
          .cand-pane { display: block; position: sticky; top: calc(var(--biz-header-h) + 16px); height: var(--cand-pane-h, calc(100vh - var(--biz-header-h) - 32px)); overflow: hidden; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
          .cand-card-actions { display: none; }
        }
      `}</style>

      {/* ⚠️★2026-09-20 に `.candidates-sidebar` / `.candidates-mobile-toggle` を削除した。
             サイドバーをやめ、条件は上部の「詳細検索」に畳んである。
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
