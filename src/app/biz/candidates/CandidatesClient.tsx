"use client";

import { ApproachButton } from "@/components/approaches/ApproachButton";
/* ★候補者の形・絞り込み・並び替えは lib/business/candidates/model.ts の1か所（2026-10-10）。
      段3の新着メールも同じ関数を使う。⚠️ ここに条件を書き戻さないこと。 */
import {
  CANDIDATE_SORT_OPTIONS, EMPLOYMENT_TYPE_LABELS, STANCE_FRESHNESS_BANDS, TENURE_BANDS,
  candidateApproachLabel, filterCandidates, formatJstMonthDay, isNewSince, sortCandidates,
  type Candidate,
} from "@/lib/business/candidates/model";
import { CandidatePreview } from "./CandidatePreview";
import { CANDIDATE_SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";
import { InterestToggle } from "@/components/candidateNotes/InterestToggle";
import { useState, useMemo, useEffect, useCallback } from "react";
import { DESIRED_WORK_STYLE_LABELS, CAREER_STANCES } from "@/lib/constants/careerPreferences";
/* ⚠️★**他の3画面（/companies・/jobs・/people）と同じ部品**（2026-09-20）。
      ここに似た実装を作らないこと ——`FilterChip` は 2026-09-18 に
      「同じ名前の別実装が2つあった」のを1つに畳んだもので、**3つ目を作らない**。 */
import { FilterChip } from "@/components/common/FilterChip";
import { SortSelect } from "@/components/common/SortSelect";
import { neutralAvatarStyle } from "@/lib/avatarColor";
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


// 都道府県を location 文字列から抽出（先頭の都道府県部分）
function extractPrefecture(location: string | null): string | null {
  if (!location) return null;
  const PREFS = [
    "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
    "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
    "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
    "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
    "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
    "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
    "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
  ];
  return PREFS.find((p) => location.startsWith(p)) ?? null;
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
  initialApproachOnly = false,
}: {
  /** ★保存した条件で開いたとき（段3）。newSince があれば「新着だけ」を出す */
  initialSaved?: { id: string; name: string; filters: SavedCandidateFilters; newSince: string | null } | null;
  candidates: Candidate[];
  /** ★`?selected=` で開いている候補者（段1）。リロードしても同じ人を開く */
  initialSelected?: string | null;
  /** ★`?approach=1` で開いたとき（/biz/approaches の「声かけを受け取る方だけを見る」。2026-10-11）。トグルをオンにして開く */
  initialApproachOnly?: boolean;
  /** 職種フィルタの階層（ow_roles の大分類＋子）。サーバーで組む */
  roleFilterTree?: { id: string; name: string; children: { id: string; name: string }[] }[];
}) {
  // ── フリーワード ────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  /* ★除外ワード（2026-09-20）。⚠️ フリーワードと**同じ対象**を見て、当たったら落とす。
     ⚠️ スペース区切りは **OR**（1つでも当たれば落とす）。フリーワードの AND とは逆だが、
        「除外」は1つ当たれば除外したいのが自然なのでこうしてある。 */
  const [excludeQuery, setExcludeQuery] = useState("");

  // ── 経歴・雇用形態 ──────────────────────────────────────────────────
  const [topRoleId, setTopRoleId] = useState<string | null>(null);
  const [childRoleId, setChildRoleId] = useState<string | null>(null);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);

  // ── 希望条件 ────────────────────────────────────────────────────────
  const [workStyle, setWorkStyle] = useState("");
  // 0 = 指定なし（万円単位）
  const [salaryMin, setSalaryMin] = useState(0);
  // デフォルトON: 年収未設定の候補者も通す
  const [includeNoSalary, setIncludeNoSalary] = useState(true);

  // ── 属性 ────────────────────────────────────────────────────────────
  /* ★年齢の絞り込みは 2026-08-20 に撤去した。社会人年数に置き換えている。
     ⚠️ **年齢の select や birthYear をここに戻さないこと。**
        労働施策総合推進法9条で募集・採用時の年齢制限は原則禁止で、
        **年齢で絞り込む機能**は禁止行為を直接手助けする形になる。
        ⚠️★**「有料職業紹介の許可事業者だから」とは書かないこと**（2026-09-15 に削除）。
           OPINIO は募集情報等提供（職安法4条6項）で職業紹介ではない。
           ⚠️★**理由はむしろ強い。** 絞り込むのは**この画面を使う企業自身**なので、
              禁止行為の手段をそのまま渡すことになる。
        「経験年数で絞る」は職務要件なので性質が違う。
     ⚠️ 撤去前の実装は `if (!c.birthYear) return false` で、
        生年月日が未入力の10人（実ユーザー14人中）を**無条件に落としていた**。
        同じ失敗を繰り返さないため、未算出の人は落とさない（下の tenureBand）。 */
  const [tenureBand, setTenureBand] = useState("");
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([]);

  /* ── ★転職意欲と、その更新時期（2026-09-19 / 柴さんの指示）────────────────
     ⚠️★**この2つは対で使う。** 更新時期だけだと「意欲は問わないが最近更新した人」に
        なり、単独では使いどころが限られる（YOUTRUST も2つ並べている）。
     ⚠️ 年齢・性別と違い、**本人が自分で選んで公開している項目**なので絞り込みに出してよい
        （年齢を出さない理由は労働施策総合推進法9条、性別は均等法5条。**軸が違う**）。 */
  const [careerStance, setCareerStance] = useState("");
  const [stanceFreshness, setStanceFreshness] = useState("");
  /* ★「声かけを受け取る方のみ」（2026-10-10 / 段2）。⚠️★判定はサーバーで
        `can_send_company_approach()` を通した `c.approach.eligible` だけを見る（ボタンと同じ値）。
        ここで条件を組み立てないこと。 */
  const [approachOnly, setApproachOnly] = useState(initialApproachOnly);
  const approachEnabled = candidates.some((c) => c.approach !== undefined);

  /* ⚠️ 「スカウト済みを除く」は 2026-10-08 にスカウトごと廃止した（提案に一本化）。
        保存済み検索に残っている `hideAlreadyScouted` は `parseSavedFilters` が捨てる。 */

  /* ── ★詳細検索の開閉（2026-09-20）───────────────────────────────────
     ⚠️★**280px の常時開きサイドバーに戻さないこと。** 条件12個を縦に並べていたが、
        `/jobs` が 2026-09-09 に同じ形を畳んでおり、この画面だけ旧型で残っていた。
     ⚠️★**閉じていても `activeChips` を外に出す。** 消すと
        「絞り込んだ結果を見ている最中に、絞った理由が画面から消える」。 */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sort, setSort] = useState<string>("new");
  /* ⚠️ 開いているチップは1つだけ。**チップごとに開閉 state を持たせないこと**
        （`/companies` と同じ形）。2つ同時に開くとメニューが重なる。 */
  const [openChip, setOpenChip] = useState<string | null>(null);

  /* ── ★右のプレビュー（2026-10-10 / 段1・キャンバス1）──────────────────────────
     ⚠️ 1024px 以上だけ（`CANDIDATE_SPLIT_MIN_WIDTH`。/companies の 1280px とは別の定数）。
     ⚠️★URL（`?selected=`）は `history.replaceState` で書き換える。**履歴を積まない**（柴さんの指示）。
        router.replace にしないのは、このページが force-dynamic で**一覧を丸ごと取り直す**ため。
     ⚠️ 1024px 未満では横取りしない ——カードのリンクがそのまま /u/[id] を**同じタブ**で開く。 */
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const updateSelected = useCallback((id: string | null) => {
    setSelected(id);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("selected", id); else url.searchParams.delete("selected");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch { /* URL を書けなくても表示は続ける */ }
  }, []);
  const onCardLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    /* ⌘・中クリック・新しいタブは素通し（ブラウザに任せる） */
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.innerWidth < CANDIDATE_SPLIT_MIN_WIDTH) return;
    e.preventDefault();
    updateSelected(id);
  }, [updateSelected]);

  // ── 都道府県・スキルタグを candidates から動的生成 ───────────────────
  const uniquePrefectures = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      const p = extractPrefecture(c.location);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
  }, [candidates]);

  /* ★「更新時期」で絞ったときに、更新日時が無くて落ちた人数（2026-09-19）。
        ⚠️ `filtered` の**後**では数えられない（既に落ちている）ので、母集合から数える。
        ⚠️ 0 のときは注記を出さない（出すと常に注記が居座る）。 */
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
    careerStance ? "x" : "",
    stanceFreshness ? "x" : "",
    approachOnly ? "x" : "",
    selectedPrefectures.length ? "x" : "",
    salaryMin > 0 ? "x" : "",
  ].filter(Boolean).length;

  /* ★いま効いている条件のチップ（2026-09-20）。**詳細検索を閉じていても外に出す。**
     ⚠️★**消さないこと。** 12条件を1つのパネルに畳んだので、これが無いと
        「なぜこの件数なのか」が画面から消える（`/jobs` と同じ理由）。
     ⚠️ 解除の手段をチップの ✕ だけにしない。パネルを開けば元のチップからも外せる。
     ⚠️ 並びは詳細検索パネルの並びと**同じ順**にする。片方だけ変えないこと。 */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    /* ⚠️ ラベルは入力欄と同じ語にする（「役職」に戻さない。下の入力欄の注記を読むこと）。 */
    if (roleQuery.trim()) chips.push({ key: "roleQuery", label: `社内での呼び方: ${roleQuery}`, clear: () => setRoleQuery("") });
    if (companyQuery.trim()) chips.push({ key: "companyQuery", label: `会社: ${companyQuery}`, clear: () => setCompanyQuery("") });
    if (excludeQuery.trim()) chips.push({ key: "exclude", label: `除外: ${excludeQuery}`, clear: () => setExcludeQuery("") });
    const wantRole = childRoleId ?? topRoleId;
    if (wantRole) {
      /* ⚠️ 名前が引けない id は出さない（生の uuid を画面に出さないため） */
      const name = childRoleId
        ? roleFilterTree.flatMap((t) => t.children).find((c) => c.id === childRoleId)?.name
        : roleFilterTree.find((t) => t.id === topRoleId)?.name;
      if (name) chips.push({ key: "role", label: name, clear: () => { setTopRoleId(null); setChildRoleId(null); } });
    }
    if (tenureBand) {
      const label = TENURE_BANDS.find((b) => b.value === tenureBand)?.label;
      if (label) chips.push({ key: "tenure", label: `社会人 ${label}`, clear: () => setTenureBand("") });
    }
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
    selectedPrefectures.forEach((pref) => chips.push({
      key: `pref:${pref}`, label: pref,
      clear: () => setSelectedPrefectures(selectedPrefectures.filter((x) => x !== pref)),
    }));
    if (careerStance) {
      const label = CAREER_STANCE_FILTER_OPTIONS.find((o) => o.value === careerStance)?.label;
      if (label) chips.push({ key: "stance", label, clear: () => setCareerStance("") });
    }
    if (stanceFreshness) {
      const label = STANCE_FRESHNESS_BANDS.find((b) => b.value === stanceFreshness)?.label;
      if (label) chips.push({ key: "fresh", label: `更新 ${label}`, clear: () => setStanceFreshness("") });
    }
    /* ⚠️ 「声かけを受け取る方のみ」はチップにしない（1段目のトグルが状態を示す。同じ語を2回並べない） */
    return chips;
  }, [excludeQuery, roleQuery, companyQuery, childRoleId, topRoleId, roleFilterTree, selectedEmploymentTypes,
      workStyle, salaryMin, careerStance, stanceFreshness, tenureBand, selectedPrefectures]);

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
    prefectures: setSelectedPrefectures,
    careerStance: setCareerStance,
    stanceFreshness: setStanceFreshness,
    approachOnly: setApproachOnly,
    sort: setSort,
  };

  /** いま効いている条件。⚠️ 保存もクリアも比較も、すべてこの形を通す */
  const currentFilters: SavedCandidateFilters = useMemo(() => ({
    q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
    employmentTypes: selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
    tenureBand, prefectures: selectedPrefectures, careerStance, stanceFreshness, approachOnly,
    sort,
  }), [q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
       selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
       tenureBand, selectedPrefectures, careerStance, stanceFreshness, approachOnly,
       sort]);

  /* ★絞り込みと並び替え（model.ts。段3の新着メールと同じ関数）。⚠️ 描くのは `sorted` */
  /* ★新着だけ（段3）。⚠️ 判定は `isNewSince`（登録日と本人の編集日だけ）。×で全員に戻せる */
  const [newSince, setNewSince] = useState<string | null>(initialSaved?.newSince ?? null);
  const [openedSaved, setOpenedSaved] = useState<{ id: string; name: string } | null>(initialSaved ? { id: initialSaved.id, name: initialSaved.name } : null);
  const filtered = useMemo(() => {
    const list = filterCandidates(candidates, currentFilters);
    return newSince ? list.filter((c) => isNewSince(c, newSince)) : list;
  }, [candidates, currentFilters, newSince]);
  /* ★「声かけを受け取る方のみ」で0名になったか（トグル以外の条件では人がいる）。⚠️ 文言を出し分けるためだけ */
  const zeroByApproachOnly = useMemo(
    () => currentFilters.approachOnly && filtered.length === 0
      && filterCandidates(candidates, { ...currentFilters, approachOnly: false }).length > 0,
    [candidates, currentFilters, filtered.length]);
  const sorted = useMemo(() => sortCandidates(filtered, sort), [filtered, sort]);
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
          label="社会人年数" value={tenureBand}
          options={TENURE_BANDS.map((b) => ({ value: b.value, label: b.label }))}
          onSelect={(v) => setTenureBand(v ?? "")}
          isOpen={openChip === "tenure"} onToggle={() => setOpenChip(openChip === "tenure" ? null : "tenure")}
        />
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
        {uniquePrefectures.length > 0 && (
          <FilterChip
            label="居住地" value="" values={selectedPrefectures}
            options={uniquePrefectures.map((pref) => ({ value: pref, label: pref }))}
            onSelect={() => {}}
            onToggleValue={(v) => setSelectedPrefectures(toggleMulti(selectedPrefectures, v))}
            isOpen={openChip === "pref"} onToggle={() => setOpenChip(openChip === "pref" ? null : "pref")}
          />
        )}
      </>)}

      {/* ★転職意欲と更新時期。⚠️★**2つは対。片方だけ外さないこと**（更新時期だけだと
             「意欲は問わないが最近更新した人」になり、条件として成立しない）。 */}
      {filterRow("転職意欲", <>
        <FilterChip
          label="転職意欲" value={careerStance}
          options={CAREER_STANCE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onSelect={(v) => setCareerStance(v ?? "")}
          isOpen={openChip === "stance"} onToggle={() => setOpenChip(openChip === "stance" ? null : "stance")}
        />
        <FilterChip
          label="意欲の更新" value={stanceFreshness}
          options={STANCE_FRESHNESS_BANDS.map((b) => ({ value: b.value, label: b.label }))}
          onSelect={(v) => setStanceFreshness(v ?? "")}
          isOpen={openChip === "fresh"} onToggle={() => setOpenChip(openChip === "fresh" ? null : "fresh")}
        />
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

  return (
    <div className="cand-wrap">

      {/* ── ヘッダー ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>候補者を探す</h1>
      </div>

      {/* ── ★ツールバー（2026-09-20）─────────────────────────────────────────
             `/companies`・`/jobs`・`/people` と同じ並び：
               検索窓 → 詳細検索 → 並び替え → 件数
             ⚠️★**280px のサイドバーに戻さないこと。** 条件12個を常時開きで縦に
                並べていたのを畳んだ（`/jobs` が 2026-09-09 にやったのと同じ）。 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {/* フリーワード */}
        <div style={{ position: "relative", flex: "1 1 100%", minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="名前・職種・会社で検索（スペース区切りでAND）"
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

        {/* 詳細検索。⚠️ 効いている条件の数をボタンに出す（閉じていても分かるように） */}
        <button
          type="button" onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
            height: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13,
            fontWeight: showAdvanced || activeChips.length > 0 ? 700 : 500,
            border: `1px solid ${showAdvanced || activeChips.length > 0 ? "var(--royal)" : "var(--line)"}`,
            background: showAdvanced || activeChips.length > 0 ? "var(--royal-50)" : "#fff",
            color: showAdvanced || activeChips.length > 0 ? "var(--royal)" : "var(--ink-soft)",
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          詳細検索
          {activeChips.length > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
              background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 800,
            }}>{activeChips.length}</span>
          )}
        </button>

        {/* ★「声かけを受け取る方のみ」（2026-10-10 / 段2）。詳細検索の中から1段目へ出した。
               ⚠️★判定は `c.approach.eligible`（`can_send_company_approach()`）だけ。ここで条件を組み立てない。
               ⚠️ 声かけが使えない（プランで閉じている・判定を取れなかった）ときは出さない */}
        {approachEnabled && (
          <button type="button" aria-pressed={approachOnly} data-state={approachOnly ? "approach-only-on" : "approach-only-off"}
            onClick={() => setApproachOnly((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
              height: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: approachOnly ? 700 : 500,
              border: `1px solid ${approachOnly ? "var(--royal)" : "var(--line)"}`,
              background: approachOnly ? "var(--royal-50)" : "#fff",
              color: approachOnly ? "var(--royal)" : "var(--ink-soft)",
            }}>
            <span aria-hidden="true" style={{
              display: "inline-block", width: 28, height: 16, borderRadius: 999, position: "relative",
              background: approachOnly ? "var(--royal)" : "var(--line)", transition: "background 0.15s",
            }}>
              <span style={{ position: "absolute", top: 2, left: approachOnly ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
            </span>
            声かけを受け取る方のみ
          </button>
        )}

        <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} />

        {/* ★「この条件を保存」（2026-10-10 / 段2）。**条件を選んでいるときだけ**出す。
               ⚠️ 保存の入口はここ1つ（「保存した条件」の中から保存フォームを外した。入口を2つにしない）。 */}
        {hasConditions && (
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

        {/* ⚠️★**開いているときは出さない**（チップ自身が選択状態を持つので、
               同じ語が2回並ぶ）。⚠️ `flexBasis: 100%` で必ず行を折る
               ——同じ行に置くと開閉のたびに「詳細検索」ボタンが左右に動く。 */}
        {!showAdvanced && activeChips.length > 0 && (
          <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {activeChips.map((c) => (
              <button
                key={c.key} type="button" onClick={c.clear}
                aria-label={`${c.label} の絞り込みを外す`}
                style={{
                  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                  height: 30, padding: "0 10px 0 12px", borderRadius: 999,
                  fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)", whiteSpace: "nowrap",
                }}>
                {c.label}
                <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.75 }}>✕</span>
              </button>
            ))}
            {/* ★条件をクリア（段2）。⚠️ 外すのは全部（検索窓の語・声かけのトグルも）。「詳細検索」の中の「条件をすべて外す」と同じ経路 */}
            <button type="button" onClick={clearAllFilters} data-state="clear-conditions"
              style={{ flexShrink: 0, height: 30, padding: "0 10px", borderRadius: 999, border: "none", background: "none", fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              条件をクリア
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
             ⚠️★分割は 1024px 以上（CSS の @media と `CANDIDATE_SPLIT_MIN_WIDTH` を手で合わせている）。
             ⚠️ 1024〜1279px は 一覧4：プレビュー6、それ以上は 1：1。 */}
      <div className="cand-split" data-selected={selected ? "1" : "0"}>
        <div style={{ minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "72px 0", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              {/* ★「声かけを受け取る方のみ」で0名になったとき（段3 / 柴さんの文言）。⚠️ トグル以外の条件で0名なら今までの表示 */}
              {zeroByApproachOnly ? (
                <div data-state="approach-only-empty">
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 auto 12px", maxWidth: 460, padding: "0 16px" }}>
                    声かけを受け取る設定の方は、まだいません。条件に合う方には、OPINIO から提案としてお届けすることがあります。
                  </p>
                  <a href="/biz/proposals" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>提案を見る →</a>
                </div>
              ) : (<>
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
              </>)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* ⚠️ 描くのは `sorted`。`filtered` を直接 map しないこと（並び替えが効かなくなる） */}
              {sorted.map((c) => {
                const tenure = formatTenure(c.tenureMonths);
                const isSel = selected === c.id;
                return (
                  <div key={c.id} data-candidate-card={c.id} data-selected={isSel ? "1" : "0"}
                    /* ⚠️ 枠線は CSS（.cand-card / .is-selected）。選択中とフォーカスで同じ枠1本を使う（二重にしない） */
                    className={isSel ? "cand-card is-selected" : "cand-card"}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      overflow: "hidden",
                      display: "flex",
                      transition: "box-shadow 0.15s",
                    }}
                  >
                    {/* ★カード本体はプロフィールへのリンク（同じタブ）。1024px 以上ではクリックを横取りして右に出す。
                           ⚠️ ボタン類（声かけ・気になる）はリンクの外に置く（リンクの中にボタンを入れない） */}
                    {/* ⚠️ 余白・間隔・折り返しは CSS のクラス側（下の style）。1024〜1279px で詰めるため、ここに書かない */}
                    <div className="cand-card-body">
                      <a className="cand-card-link" href={`/u/${c.id}`} onClick={(e) => onCardLinkClick(e, c.id)}>
                        {/* アバター。⚠️ 人によって色を変えない（上の注記）。 */}
                      {/* ⚠️ 隠すのは外側の箱（アイコン自身は style に display を持つので、クラスで隠せない） */}
                      <div className="cand-card-avatar">
                        <div style={neutralAvatarStyle(48, 18)}>
                          {c.name.charAt(0) || "?"}
                        </div>
                      </div>

                      {/* メイン情報 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 名前 + 年齢 + バッジ */}
                        <div className="cand-card-namerow">
                          <span className="cand-card-name" title={c.name}>{c.name}</span>
                          {/* ⚠️ **年齢は出さない**（2026-08-20）。一覧に年齢を出さない方針。
                                 出すのは職務要件として意味のある社会人年数だけ。 */}
                          {tenure && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{tenure}</span>
                          )}
                          {/* ⚠️★**緑にしないこと**（2026-09-20 に直した）。ui-conventions の
                                 「色の役割」で**緑は金銭的にプラスの条件のみ**と決まっている
                                 （年収レンジ・退職金・SO/RSU）。状態のバッジには使わない。 */}
                          {/* ★接点の数（段1）。⚠️ 0件・取れなかったときは出さない */}
                          {c.touchpoints && c.touchpoints.length > 0 && (
                            <span data-state="touchpoint-count" style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>接点 {c.touchpoints.length}件</span>
                          )}
                          {c.isActivelyLooking && (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>転職検討中</span>
                          )}
                          {/* ⚠️★「メンター」バッジは 2026-09-20 に削除した。**戻さないこと。**
                                 ① ui-conventions は**紫を使わない**と決めている
                                 ② **メンター機能そのものが無い**（`ow_mentors` は migration 140 で
                                    DROP 済み。CLAUDE.md「メンター機能自体が無い」）
                                 ③ 実測（2026-09-20）: `is_mentor = true` は**全51人中0人**
                                    ＝ このバッジは一度も出たことがない
                              ⚠️★**`ow_users.is_mentor` の列ごと 2026-09-27 に DROP した。**
                                 `isMentor` は型からも消えている。**足し直さないこと。** */}
                        </div>

                        {/* ★2行目以降。⚠️ 1024〜1279px（一覧が4割）では省く（`.cand-card-extra`） */}
                        <div className="cand-card-extra">
                        {/* ★声かけの状態とプロフィールの更新日（段1）。⚠️ 判定は増やさない（`candidateApproachLabel`） */}
                        {(() => {
                          /* ⚠️ カードには「受け取る」「声かけ済み」だけ。「受け取っていません」はプレビューの中だけ（柴さんの指示） */
                          const raw = candidateApproachLabel(c.approach);
                          const label = raw && raw.state !== "not_accepting" ? raw : null;
                          const edited = formatJstMonthDay(c.profileEditedAt);
                          if (!label && !edited) return null;
                          return (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--ink-mute)", marginBottom: 6 }}>
                              {label && <span data-approach-state={label.state} style={{ fontWeight: 600, color: label.state === "eligible" ? "var(--royal)" : "var(--ink-mute)" }}>{label.text}</span>}
                              {edited && <span>プロフィール更新 {edited}</span>}
                            </div>
                          );
                        })()}
                        {/* ★★本人が書いた1行（2026-09-23 / 柴さんの指示）。
                               ⚠️★**氏名の直下・職種より上**に置く。本人側の入力欄が
                                  「名前の直下の1行」として説明しているのがこれで、
                                  `completion.ts` もその前提で配点を動かしている。
                               ⚠️★**職種・会社名の行に混ぜないこと。** あちらはマスタ由来の
                                  機械的な属性で、自由記述を同じ行に入れると読み分けられない。
                               ⚠️ 無い人には行ごと出さない。「—」で埋めない。 */}
                        {c.headline && (
                          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                            {c.headline}
                          </div>
                        )}

                        {/* 職種 · 会社名 */}
                        {(c.currentRole || c.currentCompany || c.desiredRoleNames.length > 0) && (
                          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.4 }}>
                            {c.currentRole && <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.currentRole}</span>}
                            {c.currentRole && c.currentCompany && <span style={{ color: "var(--ink-mute)" }}> · </span>}
                            {c.currentCompany && <span>{c.currentCompany}</span>}
                            {/* 現職が分からないときだけ希望職種を出す。複数あれば並べる */}
                            {!c.currentRole && !c.currentCompany && c.desiredRoleNames.length > 0 && (
                              <span style={{ color: "var(--ink-mute)" }}>
                                希望: {c.desiredRoleNames.join("・")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* ★できること（職種 × 年数）。2026-09-20。
                               ⚠️ **本人が選んだスキルではなく職歴からの計算。**
                                  ラベルは付けない（`/u/[id]` も手動スキルと混ぜて出す）。
                               ⚠️ 空なら行ごと出さない。「なし」と書かない。
                               ⚠️★事業領域は入っていない（社名を伏せた職歴から
                                  企業側へ漏れるため。`buildRoleAutoSkills` の注記）。 */}
                        {c.autoSkills && c.autoSkills.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                            {c.autoSkills.map((sk) => (
                              <span key={sk.label} style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 100,
                                background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)",
                              }}>
                                {sk.label}
                                <span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>{sk.band}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 希望勤務地。⚠️ 表示のみ（絞り込みは別タスク）。
                            ⚠️ 空なら行ごと出さない。「未設定」とも書かない。 */}
                        {c.desiredPrefectures && c.desiredPrefectures.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.5 }}>
                            希望勤務地: {c.desiredPrefectures.join("・")}
                          </div>
                        )}

                        {/* ⚠️★「転職検討時期」の表示は 2026-08-27 に削除した。
                               ⚠️ **同日に本人側の入力欄を消した**ので、残すと
                                  「企業には見えるのに本人は直せない」状態になる。
                                  列（`transfer_timing`）と値は残してある。
                               ⚠️ 入力欄を戻すなら、ここも一緒に戻すこと。 */}

                        {/* タグ行: 職種・居住地。
                            職種は ow_roles 由来（2026-08-04）。
                            以前は自由記述のスキルタグを検索対象にしていたが、
                            表記揺れで絞り込みの精度が出ないためマスタの職種に置き換えた。
                            旧スキルタグはカードに表示していなかったので、ここは新規表示。 */}
                        {/* ⚠️★職種チップは「できること」に**同じ名前が無いときだけ**出す
                               （2026-09-20）。出し分けないと、同じカードに
                               「アカウントエグゼクティブ 10年以上」と
                               「アカウントエグゼクティブ」が並んで**同じ語が2回**出る。
                            ⚠️ 消してしまわないのは、職歴に開始日が無いなどで
                               「できること」が空になる人がいるため（現職の職種は出したい）。 */}
                        {((c.roleName && !(c.autoSkills ?? []).some((sk) => sk.label === c.roleName)) || c.location) && (
                          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                            {c.roleName && !(c.autoSkills ?? []).some((sk) => sk.label === c.roleName) && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)" }}>
                                {c.roleName}
                              </span>
                            )}
                            {c.location && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {extractPrefecture(c.location) ?? c.location}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      </div>

                      </a>

                      {/* 右: アクション。⚠️ 分割表示のときは声かけとプロフィールのボタンをプレビューに任せる（同じ入口を2つ並べない） */}
                      <div className="cand-card-side">
                        {c.stage !== undefined && <InterestToggle candidateUserId={c.id} initialStage={c.stage} />}
                        <div className="cand-card-actions">
                          {c.approach && (c.approach.eligible || c.approach.sent) && (
                            <ApproachButton candidateUserId={c.id} sent={c.approach.sent} compact />
                          )}
                          {/* ⚠️★別タブにしない（2026-10-10 / 柴さんの指示）。同じタブで /u/[id] */}
                          <a href={`/u/${c.id}`}
                            style={{ fontSize: 12, color: "var(--royal)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 7, border: "1px solid var(--royal-100)", background: "var(--royal-50)", whiteSpace: "nowrap" }}>
                            プロフィールを見る
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右のプレビュー。⚠️ 1024px 未満では CSS で隠す */}
        <aside className="cand-pane" aria-live="polite" aria-label="候補者のプレビュー">
          {selected ? (
            <CandidatePreview key={selected} userId={selected} onClose={() => updateSelected(null)} />
          ) : (
            <div data-state="preview-empty" style={{ padding: "28px 20px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              候補者を選ぶと、ここにプロフィールと貴社との接点が表示されます。
            </div>
          )}
        </aside>
      </div>

      {/* ⚠️ style タグの中に山かっこや引用符を書かないこと（ハイドレーションが壊れる） */}
      <style>{`
        .cand-wrap { padding: 16px 32px; max-width: 1400px; margin: 0 auto; }
        .cand-card { border: 1px solid var(--line); }
        .cand-card.is-selected { border-color: var(--royal); }
        .cand-card .cand-card-link:focus-visible { outline: none !important; }
        .cand-card:has(.cand-card-link:focus-visible) { border-color: var(--royal); }
        .cand-pane { display: none; }
        .cand-card-body { flex: 1; display: flex; align-items: center; gap: 16px; padding: 14px 18px; min-width: 0; }
        .cand-card-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 16px; color: inherit; text-decoration: none; }
        .cand-card-namerow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .cand-card-name { font-size: 15px; font-weight: 700; color: var(--ink); }
        .cand-card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .cand-card-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        @media (max-width: 640px) {
          .cand-wrap { padding: 12px 16px; }
          .cand-card-body { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 14px; }
          .cand-card-link { gap: 12px; }
          .cand-card-side { flex-direction: row; justify-content: flex-end; flex-wrap: wrap; }
          .cand-card-actions { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; }
        }
        @media (min-width: 1024px) {
          .cand-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
          .cand-wrap { max-width: none; }
          /* プレビューはヘッダーの下に固定する。ヘッダーの高さは BusinessLayout の --biz-header-h（数字で書かないこと） */
          .cand-pane { display: block; position: sticky; top: calc(var(--biz-header-h) + 16px); max-height: calc(100vh - var(--biz-header-h) - 32px); overflow-y: auto; overscroll-behavior: contain; background: #fff; border: 1px solid var(--line); border-radius: 14px; }
          .cand-card-actions { display: none; }
          .cand-card a:hover { cursor: pointer; }
        }
        @media (min-width: 1024px) and (max-width: 1279px) {
          .cand-split { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
          .cand-card-extra { display: none; }
          .cand-card-avatar { display: none; }
          .cand-card-body { padding: 10px 12px; gap: 8px; }
          .cand-card-link { gap: 8px; }
          .cand-card-namerow { flex-wrap: nowrap; margin-bottom: 0; }
          .cand-card-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .cand-wrap { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>

      {/* ⚠️★2026-09-20 に `.candidates-sidebar` / `.candidates-mobile-toggle` を削除した。
             サイドバーをやめ、条件は上部の「詳細検索」に畳んである。
             ⚠️ ツールバーは flex-wrap で折り返すので、狭い画面用の出し分け CSS は要らない。 */}
    </div>
  );
}
