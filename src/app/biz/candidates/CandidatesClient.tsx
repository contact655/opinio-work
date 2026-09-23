"use client";

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
/**
 * ★並び替え（2026-09-20 / 柴さんの指示）。**他の3画面と同じ `SortSelect` を使う。**
 *
 * ⚠️★**年齢・性別に関わる軸を足さないこと。** この画面は企業が直接絞る場所で、
 *    年齢は労働施策総合推進法9条、性別は均等法5条の話になる（CLAUDE.md）。
 * ⚠️ 既定は「新着順」。それまで並び替えが無く `created_at DESC` 固定だった。
 */
const SORT_OPTIONS = [
  { value: "new",     label: "新着順" },
  /* ⚠️★読むのは `careerStanceUpdatedAt`。`stance_updated_at` ではない
        （あちらは面談OK の切り替えでも打たれる。冒頭の注記と同じ理由）。
     ⚠️ 記録が無い人（2026-09-19 より前に答えた人）は**末尾に置く**。
        0 扱いにして先頭へ来ると「最近更新した人」として誤って読める。 */
  { value: "stance",  label: "転職意欲の更新が新しい順" },
  { value: "tenure",  label: "社会人年数が長い順" },
] as const;

const STANCE_FRESHNESS_BANDS = [
  { value: "1d",  label: "24時間以内", days: 1 },
  { value: "1w",  label: "1週間以内",  days: 7 },
  { value: "1m",  label: "1ヶ月以内",  days: 30 },
  { value: "3m",  label: "3ヶ月以内",  days: 90 },
] as const;

/**
 * 社会人年数の帯（2026-08-20）。**年齢の帯の置き換え。**
 *
 * ⚠️ 元は `ow_experiences` の最も古い `started_at` から `calcTotalExperience` で
 *    その都度算出している（page.tsx）。列にもトリガーにもしない。
 */
const TENURE_BANDS = [
  { value: "lt1",  label: "1年未満",   minMonths: 0,   maxMonths: 11 },
  { value: "1to3", label: "1〜3年",    minMonths: 12,  maxMonths: 35 },
  { value: "3to5", label: "3〜5年",    minMonths: 36,  maxMonths: 59 },
  { value: "5to10", label: "5〜10年",  minMonths: 60,  maxMonths: 119 },
  { value: "gte10", label: "10年以上", minMonths: 120, maxMonths: Number.MAX_SAFE_INTEGER },
] as const;

/** 月数 → カードに出す1行。未算出（null）は**何も出さない**（「0年」と書かない） */
function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

/* ⚠️ `/dev/preview/candidates` が固定データを作るために export している。
      **この画面は有料プラン0社で誰も実物を見られない**ので、確認はプレビューで行う。 */
export type Candidate = {
  id: string;
  name: string;
  /** ★本人が書いた1行（2026-09-23）。⚠️ `currentRole`（職種マスタ）と別物。混ぜない */
  headline: string | null;
  location: string | null;
  isMentor: boolean;
  /** ★「積極的に検討中」（`ow_profiles.career_stance = 'active'`）。2026-08-26 に改名。
   *  ⚠️ 旧名 `isOpenToWork` は `ow_users.is_open_to_work`（boolean）由来だった。
   *     列を移したので名前も合わせる。**列名で grep したときに残らないようにする。** */
  isActivelyLooking: boolean;
  /** ★転職意欲そのもの（2026-09-19）。⚠️ 母集合が `no_contact` と未設定を落としているので、
   *  ここに来るのは `active` / `open` / `researching` のいずれか */
  careerStance: string | null;
  /** ★転職意欲を最後に変えた日時（2026-09-19）。
   *  ⚠️★**null は「未更新」。「古い」ではない。** 列を入れたのが 2026-09-19 なので、
   *     それ以前に答えた人は全員 null から始まる。**日付を作って埋めないこと。** */
  careerStanceUpdatedAt: string | null;
  /** 社会人年数（月数）。**職歴が0件なら null＝未算出。0 ではない** */
  tenureMonths: number | null;
  currentRole: string | null;
  currentCompany: string | null;
  employmentType: string | null;
  startedAt: string | null;
  /** ow_roles の職種名。子階層があれば子、無ければ大分類 */
  roleName: string | null;
  /** ow_roles の9大分類名 */
  topRoleName: string | null;
  /** 希望職種。**祖先まで展開済み**の role_id（絞り込み用） */
  desiredRoleIds: string[];
  /** 表示用。本人が選んだ職種名（展開前） */
  desiredRoleNames: string[];
  workStyles: string[] | null;
  desiredPrefectures: string[] | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  onboardingCompleted: boolean;
  alreadyScouted: boolean;
  createdAt: string;
  /** ★「できること」（職種 × 年数）。2026-09-20。**職歴からの計算**で、本人の入力ではない。
   *  ⚠️ 事業領域は入らない（社名を伏せた職歴から漏れるため。`buildRoleAutoSkills` の注記）。 */
  autoSkills?: { label: string; band: string }[];
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "パート・アルバイト",
  freelance: "フリーランス",
  intern: "インターン",
};


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


type ScoutQuota = {
  monthlyLimit: number;
  bonusCredits: number;
  usedThisMonth: number;
  remaining: number;
};

type JobOption = { id: string; title: string };

/* ⚠️★`SidebarLabel` と `Pill` は 2026-09-20 に削除した（サイドバーをやめたため）。
      **戻さないこと。** 絞り込みのチップは `components/common/FilterChip.tsx` を使う
      —— `/companies` と `/people` が同じものを使っており、3つ目の実装を作らない。
   ⚠️ `Pill` は `purple` のパレットを持っていたが、ui-conventions は**紫を使わない**
      と決めている。復活させるときに一緒に戻さないこと。 */

export default function CandidatesClient({
  candidates,
  scoutQuota,
  jobOptions = [],
  roleFilterTree = [],
  scoutSendingEnabled = false,
}: {
  candidates: Candidate[];
  scoutQuota?: ScoutQuota;
  jobOptions?: JobOption[];
  /** 職種フィルタの階層（ow_roles の大分類＋子）。サーバーで組む */
  roleFilterTree?: { id: string; name: string; children: { id: string; name: string }[] }[];
  /** スカウト送信が有効か。⚠️ 2026-08-09 時点は停止中（受信側の画面が無いため）。
   *  false のときは送信ボタンを**出さない**。押せてAPIが 503 を返す形にすると、
   *  企業には「失敗した」ようにしか見えない。 */
  scoutSendingEnabled?: boolean;
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

  // ── その他 ──────────────────────────────────────────────────────────
  const [hideAlreadyScouted, setHideAlreadyScouted] = useState(false);

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

  // ── Scout modal ─────────────────────────────────────────────────────
  const [scoutTarget, setScoutTarget] = useState<Candidate | null>(null);
  const [scoutMessage, setScoutMessage] = useState("");
  const [scoutJobId, setScoutJobId] = useState<string>("");
  const [scoutSending, setScoutSending] = useState(false);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutSuccess, setScoutSuccess] = useState(false);

  function openScout(c: Candidate) {
    setScoutTarget(c);
    setScoutMessage("");
    setScoutJobId("");
    setScoutError(null);
    setScoutSuccess(false);
  }

  async function sendScout() {
    if (!scoutTarget || !scoutMessage.trim()) return;
    setScoutSending(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/biz/scouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: scoutTarget.id,
          message: scoutMessage.trim(),
          job_id: scoutJobId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setScoutError(data.error ?? "送信に失敗しました"); return; }
      setScoutSuccess(true);
    } catch {
      setScoutError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setScoutSending(false);
    }
  }

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

  // ── フィルター適用 ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = candidates;

    if (hideAlreadyScouted) list = list.filter((c) => !c.alreadyScouted);

    // フリーワード（スペース区切りAND）
    if (q.trim()) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((c) =>
        terms.every((t) =>
          c.name.toLowerCase().includes(t) ||
          (c.currentRole ?? "").toLowerCase().includes(t) ||
          (c.currentCompany ?? "").toLowerCase().includes(t) ||
          (c.location ?? "").includes(t) ||
          (c.roleName ?? "").toLowerCase().includes(t) ||
          (c.topRoleName ?? "").toLowerCase().includes(t)
        )
      );
    }

    /* ★除外ワード（2026-09-20）。⚠️ 判定の対象はフリーワードと**同じ**。
          片方だけ対象を足すと「検索では当たるのに除外できない」語ができる。 */
    if (excludeQuery.trim()) {
      const ng = excludeQuery.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((c) => !ng.some((t) =>
        c.name.toLowerCase().includes(t) ||
        (c.currentRole ?? "").toLowerCase().includes(t) ||
        (c.currentCompany ?? "").toLowerCase().includes(t) ||
        (c.location ?? "").includes(t) ||
        (c.roleName ?? "").toLowerCase().includes(t) ||
        (c.topRoleName ?? "").toLowerCase().includes(t)
      ));
    }

    // 職種タイトル
    if (roleQuery.trim()) {
      const r = roleQuery.toLowerCase();
      list = list.filter((c) => (c.currentRole ?? "").toLowerCase().includes(r));
    }

    // 会社名
    if (companyQuery.trim()) {
      const co = companyQuery.toLowerCase();
      list = list.filter((c) => (c.currentCompany ?? "").toLowerCase().includes(co));
    }

    // 雇用形態（OR）
    if (selectedEmploymentTypes.length > 0) {
      list = list.filter((c) => c.employmentType && selectedEmploymentTypes.includes(c.employmentType));
    }

    // 勤務スタイル: 複数希望のうち1つでも一致すれば残す
    if (workStyle) list = list.filter((c) => (c.workStyles ?? []).includes(workStyle));

    /* 職種: 候補者側が祖先まで展開済みなので、大分類でも子でも includes() で当たる */
    const wantRole = childRoleId ?? topRoleId;
    if (wantRole) list = list.filter((c) => c.desiredRoleIds.includes(wantRole));


    /* 社会人年数
       ⚠️ **未算出（職歴0件）の人は落とさない。** 落とすと「絞り込んだ瞬間に
          候補者が激減する」という、年齢絞り込みで起きていたのと同じ形になる。
          何名が年数不明のまま残っているかは、一覧の上に注記で出している。 */
    if (tenureBand) {
      const band = TENURE_BANDS.find((b) => b.value === tenureBand);
      if (band) {
        list = list.filter((c) => {
          if (c.tenureMonths == null) return true; // 未算出は通す
          return c.tenureMonths >= band.minMonths && c.tenureMonths <= band.maxMonths;
        });
      }
    }

    /* ★転職意欲（2026-09-19）。単一選択。
       ⚠️ 母集合が `no_contact` と未設定を落としているので、ここで null は出てこない。
          それでも `=== ` で比べる（null が来ても落ちるだけで、既定値に倒さない）。 */
    if (careerStance) {
      list = list.filter((c) => c.careerStance === careerStance);
    }

    /* ★転職意欲の更新時期（2026-09-19）。
       ⚠️★**未更新（null）は落とす。** 「最近更新した人」を探す条件なので、
          いつ更新したか分からない人を通すと条件の意味が無くなる。
          ⚠️ これは `/people` の年代と同じ扱い（値を持たない人は**その項目で絞ったときだけ**
             落ちる）。社会人年数（`tenureBand`）が未算出を**通す**のとは逆で、
             **わざと揃えていない** ——あちらは「経験の長さ」で、未算出でも候補ではある。
       ⚠️★**落とした人数は画面に出す**（下の `droppedNoStanceTs`）。黙って減らすと
          「絞り込んだ瞬間に0件」の理由が読めない。 */
    if (stanceFreshness) {
      const band = STANCE_FRESHNESS_BANDS.find((b) => b.value === stanceFreshness);
      if (band) {
        const since = Date.now() - band.days * 24 * 60 * 60 * 1000;
        list = list.filter((c) => {
          if (!c.careerStanceUpdatedAt) return false;
          const t = new Date(c.careerStanceUpdatedAt).getTime();
          return Number.isFinite(t) && t >= since;
        });
      }
    }

    // 居住地（OR・前方一致）
    if (selectedPrefectures.length > 0) {
      list = list.filter((c) =>
        selectedPrefectures.some((p) => (c.location ?? "").startsWith(p))
      );
    }

    // 希望年収
    if (salaryMin > 0) {
      list = list.filter((c) => {
        const salaryVal = c.desiredSalaryMax ?? c.desiredSalaryMin;
        if (salaryVal === null) return includeNoSalary;
        return salaryVal >= salaryMin;
      });
    }

    return list;
  }, [
    candidates, q, excludeQuery, roleQuery, companyQuery, workStyle, topRoleId, childRoleId,
    hideAlreadyScouted,
    tenureBand, selectedPrefectures,
    careerStance, stanceFreshness,
    selectedEmploymentTypes, salaryMin, includeNoSalary,
  ]);

  /* ★「更新時期」で絞ったときに、更新日時が無くて落ちた人数（2026-09-19）。
        ⚠️ `filtered` の**後**では数えられない（既に落ちている）ので、母集合から数える。
        ⚠️ 0 のときは注記を出さない（出すと常に注記が居座る）。 */
  const droppedNoStanceTs = useMemo(
    () => (stanceFreshness ? candidates.filter((c) => !c.careerStanceUpdatedAt).length : 0),
    [candidates, stanceFreshness]
  );

  /** 絞り込み後に残っている「社会人年数が未算出」の人数。注記に出す */
  const unknownTenureCount = useMemo(
    () => filtered.filter((c) => c.tenureMonths == null).length,
    [filtered]
  );

  /* ★並び替え（2026-09-20）。⚠️ `filtered` を**破壊しない**（`[...]` でコピーする）。 */
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "stance") {
      /* ⚠️★記録の無い人は**末尾**。先頭に来ると「最近更新した人」と誤読される。 */
      return list.sort((a, b) => {
        if (!a.careerStanceUpdatedAt && !b.careerStanceUpdatedAt) return 0;
        if (!a.careerStanceUpdatedAt) return 1;
        if (!b.careerStanceUpdatedAt) return -1;
        return b.careerStanceUpdatedAt.localeCompare(a.careerStanceUpdatedAt);
      });
    }
    if (sort === "tenure") {
      /* ⚠️★未算出（職歴0件）は末尾。**0 にしない**（「社会人0年」と同義になる）。
            絞り込み側が未算出を**落とさない**のと揃えてある。 */
      return list.sort((a, b) => {
        if (a.tenureMonths == null && b.tenureMonths == null) return 0;
        if (a.tenureMonths == null) return 1;
        if (b.tenureMonths == null) return -1;
        return b.tenureMonths - a.tenureMonths;
      });
    }
    /* 新着順。⚠️ サーバーが既に `created_at DESC` で返しているが、
          **ここでも明示する**（他の順から戻したときに元の並びへ戻すため）。 */
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filtered, sort]);

  const jobTypeFilterActive = topRoleId !== null;
  const activeFilterCount = [
    q.trim() ? "x" : "",
    excludeQuery.trim() ? "x" : "",
    roleQuery.trim() ? "x" : "",
    companyQuery.trim() ? "x" : "",
    workStyle,
    jobTypeFilterActive ? "x" : "",
    selectedEmploymentTypes.length ? "x" : "",
    hideAlreadyScouted ? "x" : "",
    tenureBand ? "x" : "",
    careerStance ? "x" : "",
    stanceFreshness ? "x" : "",
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
    if (roleQuery.trim()) chips.push({ key: "roleQuery", label: `役職: ${roleQuery}`, clear: () => setRoleQuery("") });
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
    if (hideAlreadyScouted) chips.push({ key: "scouted", label: "スカウト済みを除く", clear: () => setHideAlreadyScouted(false) });
    return chips;
  }, [excludeQuery, roleQuery, companyQuery, childRoleId, topRoleId, roleFilterTree, selectedEmploymentTypes,
      workStyle, salaryMin, careerStance, stanceFreshness, tenureBand, selectedPrefectures, hideAlreadyScouted]);

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
    hideAlreadyScouted: setHideAlreadyScouted,
    sort: setSort,
  };

  /** いま効いている条件。⚠️ 保存もクリアも比較も、すべてこの形を通す */
  const currentFilters: SavedCandidateFilters = useMemo(() => ({
    q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
    employmentTypes: selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
    tenureBand, prefectures: selectedPrefectures, careerStance, stanceFreshness,
    hideAlreadyScouted, sort,
  }), [q, excludeQuery, roleQuery, companyQuery, topRoleId, childRoleId,
       selectedEmploymentTypes, workStyle, salaryMin, includeNoSalary,
       tenureBand, selectedPrefectures, careerStance, stanceFreshness,
       hideAlreadyScouted, sort]);

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

  /* ⚠️★「クリア」も同じ経路。**空の定義を2つ持たない**
        （持つと「クリアしたのに1つだけ残る」が起きる）。 */
  function clearAllFilters() {
    applyFilters(EMPTY_SAVED_FILTERS);
  }

  /* ── ★保存した条件の読み書き ────────────────────────────────────────────
     ⚠️★**`null` は「まだ取っていない」。`[]`（0件）と区別する。**
        混ぜると、取得に失敗したときに「保存が無い」と表示してしまう
        （CLAUDE.md「0件を読むときは、起きなかった0か起こせなかった0かを分ける」）。 */
  const [savedSearches, setSavedSearches] = useState<SavedSearch[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
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

  const canSaveCurrent = !isEmptyFilters(currentFilters);
  /* ⚠️ 同じ名前は上書き（サーバーの UNIQUE と揃えてある）。押す前に分かるよう文言を変える */
  const willOverwrite = (savedSearches ?? []).some((v) => v.name === saveName.trim());

  async function saveCurrentSearch() {
    const name = saveName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/biz/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: currentFilters }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "保存に失敗しました");
      setSaveName("");
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

  const alreadyScoutedCount = candidates.filter((c) => c.alreadyScouted).length;
  const showQuota = scoutQuota && scoutQuota.usedThisMonth > 0;

  /* ── ★詳細検索パネルの中身（2026-09-20 にサイドバーから移した）──────────
     ⚠️★**チップは `components/common/FilterChip.tsx` を使う。** `/companies` と
        `/people` が同じものを使っており、**同じ名前の別実装を作らない**（3つ目を作らない）。
     ⚠️★**並びは `activeChips` の並びと同じ順**にしてある。片方だけ変えないこと。
     ⚠️ 自由入力（役職・会社名）だけはチップにできないので、先頭に小さな欄として置く。 */
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
        <input type="text" value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)}
          aria-label="現在の役職" placeholder="現在の役職（例：営業マネージャー）" style={inputStyle(!!roleQuery)} />
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
      {(alreadyScoutedCount > 0 || activeFilterCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
          {alreadyScoutedCount > 0 && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: hideAlreadyScouted ? "var(--royal)" : "var(--ink-soft)", fontWeight: hideAlreadyScouted ? 700 : 500 }}>
              <input
                type="checkbox" checked={hideAlreadyScouted}
                onChange={(e) => setHideAlreadyScouted(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: "var(--royal)", cursor: "pointer" }}
              />
              スカウト済みを除く（{alreadyScoutedCount}人）
            </label>
          )}
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
    <div style={{ padding: "16px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* ── ヘッダー ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>候補者を探す</h1>
        {showQuota && (
          <div style={{
            background: scoutQuota.remaining === 0 ? "var(--error-soft)" : "var(--bg-tint)",
            border: `1px solid ${scoutQuota.remaining === 0 ? "#FECACA" : "var(--line)"}`,
            borderRadius: 8, padding: "6px 12px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>残り</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)", color: scoutQuota.remaining === 0 ? "var(--error)" : "var(--ink)" }}>
              {scoutQuota.remaining}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>/ {scoutQuota.monthlyLimit + scoutQuota.bonusCredits} 通</span>
          </div>
        )}
      </div>

      {/* ── ★ツールバー（2026-09-20）─────────────────────────────────────────
             `/companies`・`/jobs`・`/people` と同じ並び：
               検索窓 → 詳細検索 → 並び替え → 件数
             ⚠️★**280px のサイドバーに戻さないこと。** 条件12個を常時開きで縦に
                並べていたのを畳んだ（`/jobs` が 2026-09-09 にやったのと同じ）。 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {/* フリーワード */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
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

        <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} />

        {/* ── ★保存した条件（2026-09-21）────────────────────────────────
               ⚠️★**「詳細検索」の中に入れないこと。** 畳まれている中にあると、
                  保存したこと自体を忘れる。条件そのものではなく
                  「条件の出し入れ」なので、検索窓と同じ高さの行に置く。
               ⚠️ 一覧と保存フォームで**2つのポップオーバーが同時に開かない**ようにしてある
                  （`/companies` のチップと同じ約束）。 */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setSavedOpen((v) => !v)}
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
                {/* ★今の条件を保存（2026-09-21 に「条件を保存」ボタンから移した）。
                       ⚠️ 何も絞っていないときは入力欄を出さず、理由を出す（空の条件を保存しても意味が無い） */}
                <div style={{ padding: "8px 8px 10px", borderBottom: "1px solid var(--line-soft)", marginBottom: 4 }}>
                  {canSaveCurrent ? (
                    <>
                <label style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
                  今の条件を名前を付けて保存
                </label>
                <input
                  type="text" value={saveName} maxLength={MAX_SAVED_SEARCH_NAME}
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
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                      絞り込むと、今の条件をここから保存できます
                    </p>
                  )}
                </div>
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
                        onClick={() => { applyFilters(v.filters); setSavedOpen(false); }}
                        style={{
                          flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none",
                          cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
                          padding: "9px 10px", borderRadius: 8,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                        title={v.name}>
                        {v.name}
                      </button>
                      <button
                        type="button" onClick={() => void deleteSavedSearch(v.id)}
                        aria-label={`${v.name} を削除`}
                        style={{
                          flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                          color: "var(--ink-mute)", fontSize: 13, lineHeight: 1, padding: "8px 8px",
                        }}>
                        ✕
                      </button>
                    </div>
                  ))
                )}
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
          </div>
        )}

        {showAdvanced && advancedPanel}
      </div>

      {/* ── 一覧 ──────────────────────────────────────────────────────── */}
      <div>
        <div style={{ minWidth: 0 }}>
          {/* ⚠️★件数と「選択中の条件」は**ツールバーへ移した**（2026-09-20）。
                 ここに戻さないこと ——以前は件数バーの横に**都道府県のチップだけ**が出ており、
                 残り11条件は選んでも画面のどこにも出ていなかった。 */}

          {/* 候補者リスト */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* ⚠️ 描くのは `sorted`。`filtered` を直接 map しないこと（並び替えが効かなくなる） */}
              {sorted.map((c) => {
                const tenure = formatTenure(c.tenureMonths);
                return (
                  <div key={c.id}
                    style={{
                      background: "#fff",
                      border: c.alreadyScouted ? "1px solid var(--line-soft)" : "1px solid var(--line)",
                      borderRadius: 14,
                      overflow: "hidden",
                      opacity: c.alreadyScouted ? 0.82 : 1,
                      display: "flex",
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,35,102,0.09)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    {/* ⚠️ 左のアクセントバーは撤去した（上の注記）。戻さないこと。 */}

                    {/* カード本体 */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", minWidth: 0 }}>

                      {/* アバター。⚠️ 人によって色を変えない（上の注記）。 */}
                      <div style={neutralAvatarStyle(48, 18)}>
                        {c.name.charAt(0) || "?"}
                      </div>

                      {/* メイン情報 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 名前 + 年齢 + バッジ */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{c.name}</span>
                          {/* ⚠️ **年齢は出さない**（2026-08-20）。一覧に年齢を出さない方針。
                                 出すのは職務要件として意味のある社会人年数だけ。 */}
                          {tenure && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{tenure}</span>
                          )}
                          {/* ⚠️★**緑にしないこと**（2026-09-20 に直した）。ui-conventions の
                                 「色の役割」で**緑は金銭的にプラスの条件のみ**と決まっている
                                 （年収レンジ・退職金・SO/RSU）。状態のバッジには使わない。 */}
                          {c.isActivelyLooking && (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>転職検討中</span>
                          )}
                          {/* ⚠️★「メンター」バッジは 2026-09-20 に削除した。**戻さないこと。**
                                 ① ui-conventions は**紫を使わない**と決めている
                                 ② **メンター機能そのものが無い**（`ow_mentors` は migration 140 で
                                    DROP 済み。CLAUDE.md「メンター機能自体が無い」）
                                 ③ 実測（2026-09-20）: `is_mentor = true` は**全51人中0人**
                                    ＝ このバッジは一度も出たことがない
                                 ⚠️ `isMentor` は型にも `ow_users.is_mentor` にも残っている。
                                    **新しい参照を足さないこと。** */}
                          {c.alreadyScouted && (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>送信済み</span>
                          )}
                        </div>

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

                      {/* 右: アクション
                          ⚠️ scoutSendingEnabled が false のときは送信ボタンを出さない。
                             出したままにすると押せてしまい、API が 503 を返して
                             企業には「失敗した」ようにしか見えない（2026-08-09）。 */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        {scoutSendingEnabled ? (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); openScout(c); }}
                          disabled={(scoutQuota?.remaining ?? 1) === 0}
                          style={{
                            fontSize: 12, padding: "7px 16px", borderRadius: 7, fontWeight: 700,
                            fontFamily: "inherit", whiteSpace: "nowrap" as const, cursor: (scoutQuota?.remaining ?? 1) === 0 ? "default" : "pointer",
                            background: (scoutQuota?.remaining ?? 1) === 0 ? "var(--bg-tint)" : c.alreadyScouted ? "#fff" : "var(--royal)",
                            color: (scoutQuota?.remaining ?? 1) === 0 ? "var(--ink-mute)" : c.alreadyScouted ? "var(--royal)" : "#fff",
                            border: c.alreadyScouted ? "1.5px solid var(--royal)" : "none",
                            boxShadow: !c.alreadyScouted && (scoutQuota?.remaining ?? 1) > 0 ? "0 2px 6px rgba(0,35,102,0.18)" : "none",
                          }}>
                          {c.alreadyScouted ? "再スカウト" : "スカウトを送る"}
                        </button>
                        ) : null}
                        {/* ★送れない間は「スカウト準備中」を出さない（2026-09-21）。
                               ページ上部の案内と同じことを**人数ぶん繰り返していた**。
                               送れない間のカードの操作はこれ1つになるので、ボタンの形にしてある。 */}
                        <a href={`/u/${c.id}`} target="_blank" rel="noopener noreferrer"
                          style={scoutSendingEnabled
                            ? { fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }
                            : { fontSize: 12, color: "var(--royal)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 7, border: "1px solid var(--royal-100)", background: "var(--royal-50)", whiteSpace: "nowrap" }}
                          onClick={(e) => e.stopPropagation()}>
                          {scoutSendingEnabled ? "プロフィール" : "プロフィールを見る"}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── Scout modal ─────────────────────────────────────────────── */}
      {scoutTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setScoutTarget(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            {scoutSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: "linear-gradient(135deg, var(--success), #34D399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>スカウトを送信しました</h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
                  {scoutTarget.name} さんへのスカウトを送信しました。<br />返信があればOPINIOから通知します。
                </p>
                <button type="button" onClick={() => { setScoutTarget(null); window.location.reload(); }}
                  style={{ background: "var(--royal)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{scoutTarget.name} さんにスカウトを送る</h3>
                  <button type="button" onClick={() => setScoutTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-mute)" }}>×</button>
                </div>
                {jobOptions.length > 0 && (
                  <label style={{ display: "block", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>求人を指定（任意）</div>
                    <select value={scoutJobId} onChange={(e) => setScoutJobId(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" }}>
                      <option value="">求人を指定しない（カジュアルな連絡）</option>
                      {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </label>
                )}
                <label style={{ display: "block", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    メッセージ <span style={{ color: "var(--error)" }}>*</span>
                  </div>
                  <textarea value={scoutMessage} onChange={(e) => setScoutMessage(e.target.value)}
                    placeholder={"はじめまして。〇〇株式会社の△△と申します。\nご経歴を拝見し、ぜひ一度お話しできればと思いご連絡しました。"}
                    rows={6}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" as const }}
                  />
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", textAlign: "right", marginTop: 4 }}>{scoutMessage.length} / 2000</div>
                </label>
                {scoutError && (
                  <div style={{ background: "var(--error-soft)", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--error-ink)", marginBottom: 16 }}>
                    {scoutError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setScoutTarget(null)}
                    style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                    キャンセル
                  </button>
                  <button type="button" onClick={sendScout} disabled={scoutSending || !scoutMessage.trim()}
                    style={{
                      background: scoutSending || !scoutMessage.trim() ? "var(--ink-mute)" : "var(--royal)",
                      color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
                      fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                      cursor: scoutSending || !scoutMessage.trim() ? "default" : "pointer",
                    }}>
                    {scoutSending ? "送信中..." : "スカウトを送る"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ⚠️★2026-09-20 に `.candidates-sidebar` / `.candidates-mobile-toggle` を削除した。
             サイドバーをやめ、条件は上部の「詳細検索」に畳んである。
             ⚠️ ツールバーは flex-wrap で折り返すので、狭い画面用の出し分け CSS は要らない。 */}
    </div>
  );
}
