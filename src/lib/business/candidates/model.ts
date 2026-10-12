/**
 * ★候補者検索の「候補者1人の形」と「絞り込み・並び替え」（2026-10-10 / 候補者探し 段1）。
 *
 * ⚠️★**純粋関数だけを置く。** 画面（`CandidatesClient`）と、保存した条件の新着を数える
 *    サーバーの処理（段3の毎朝のお知らせ）の**両方**がこの関数を呼ぶ。
 *    条件を画面にだけ書くと、メールの件数と画面の件数が食い違う。
 * ⚠️ ここで DB を読まない（クライアントからも import される）。データは
 *    `lib/business/candidates/load.ts` が組む。
 * ⚠️ 見せてよいかの判定（`can_send_scout()`）と声かけの判定（`can_send_company_approach()`）は
 *    **ここに書かない**。load.ts が DB 関数を通した結果だけを `Candidate` に入れる。
 */
import { APPROACH_UNAVAILABLE_MESSAGE, approachStatusLine } from "@/lib/constants/companyApproaches";
import type { RecentApproach } from "@/lib/approaches/server";
import type { CandidateStage } from "@/lib/constants/candidateNotes";
import type { SavedCandidateFilters } from "@/lib/business/savedSearch";

/** ★貴社との接点の1件。種類・表示文・根拠の参照先（画面で根拠へ飛べるように） */
import type { FitFact } from "@/lib/evidence/fit";
import { residenceKey } from "@/lib/utils/location";

export type TouchpointKind =
  | "job_role"        // ① 求人の職種 × 経験職種（＋年数）
  | "company_role"    // ② 部門・職種 × 経験職種／関心のある職種
  | "location"        // ③ 求人の勤務地 × 居住地
  | "target_industry" // ④a 顧客の業界 × 職歴の業種
  | "business_domain" // ④b 事業領域 × 前の勤務先の事業領域
  | "alumni"          // ⑤ 社員の前職 × 候補者の前職
  | "position_level"  // ★求人のレベル × 職歴の役職（2026-10-12）
  | "business_stage"; // ★自社の事業ステージ（細かい段）× 前の勤務先（2026-10-12）
export type Touchpoint = {
  kind: TouchpointKind;
  /** 画面に出す1文。⚠️ 社員の名前・候補者が伏せた勤務先は入らない */
  text: string;
  /** 根拠の参照先（自社の求人・部門など）。⚠️ 候補者側の非公開の値は入れない */
  ref: { type: "job" | "company_job_role" | "department" | "industry" | "business_domain" | "company"; id: string } | null;
  /** 強さ（大きいほど上に出す）。並び替えにも使う */
  weight: number;
  /**
   * ★文の元になった事実（2026-10-10）。求人の職種・部門と職種・顧客の業界・事業領域の4種類だけ。
   * ⚠️ 提案の根拠も同じ事実から文を作る（`lib/evidence/fit.ts`）。text を組み立て直さないこと
   */
  fact?: FitFact;
};

/** 自社で接点の材料が揃っているか（空のときの入口を出し分ける。⚠️ クライアントからも読むのでここに置く） */
export type TouchpointMaterials = {
  hasJobs: boolean;
  hasCompanyRoles: boolean;
  hasPublicEmployees: boolean;
  /** ★標準の職種が未選択の自社職種がある（2026-10-12。案内の出し分け） */
  hasUnlinkedCompanyRoles?: boolean;
  /** ★公開中の求人に、経験年数が未入力のものがある（2026-10-12。案内の出し分け） */
  hasJobsWithoutYears?: boolean;
};

export type Candidate = {
  id: string;
  name: string;
  /** ★本人が書いた1行（2026-09-23）。⚠️ `currentRole`（職種マスタ）と別物。混ぜない */
  headline: string | null;
  /** ★プロフィール写真（2026-10-12。表示だけ。並べ替え・絞り込みに使わない）。公開バケットの URL。無ければ null */
  avatarUrl?: string | null;
  location: string | null;
  /** ★「積極的に検討中」（`ow_profiles.career_stance = 'active'`） */
  isActivelyLooking: boolean;
  /** ★転職意欲そのもの。⚠️ 母集合が `no_contact` と未設定を落としている */
  careerStance: string | null;
  /** ★転職意欲を最後に変えた日時。⚠️★null は「未更新」。「古い」ではない */
  careerStanceUpdatedAt: string | null;
  /** 社会人年数（月数）。**職歴が0件なら null＝未算出。0 ではない** */
  tenureMonths: number | null;
  /** ★この会社の「★」（気になる。会社の管理者で共有。2026-10-12）。⚠️ 取れなかったときは false */
  starred?: boolean;
  /** ★この会社が「見送り」にした（一覧から外す。会社の担当者で共有。2026-10-13）。⚠️ 取れなかったときは false。
   *  ⚠️ 候補者本人には伝えない（企業の内部情報） */
  hidden?: boolean;
  /** ★誰がいつ見送ったか（hidden_by の名前と created_at。2026-10-13）。見送っていなければ null。名前が引けなければ name は null */
  hiddenBy?: { name: string | null; at: string } | null;
  /** ★最近の利用（4段階の帯。2026-10-12）。⚠️ 正確な日時は渡さない（activity.ts でサーバーが帯にする）。
   *  undefined = スイッチ（CANDIDATE_ACTIVITY_ENABLED）が無効 ／ null = 記録が無い（不明） */
  activity?: ActivityBand | null;
  /** ★年齢（2026-10-12 / 柴さんの判断で一覧と右欄に出す）。**サーバーで `getUserAge()` を通した数だけ。**
   *  ⚠️★生年月日そのものはブラウザに渡さない（load.ts で読み、ここに数だけ入れる）。生年月日が無ければ null（推測しない） */
  age: number | null;
  /** ★性別の表示用の文字（男性・女性・その他）。表示だけで、絞り込み・並び替え・保存した条件には使わない（均等法5条）。無効・未登録・「回答しない」は null */
  genderLabel?: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  employmentType: string | null;
  startedAt: string | null;
  /** ow_roles の職種名。子階層があれば子、無ければ大分類 */
  roleName: string | null;
  /** ow_roles の大分類名 */
  topRoleName: string | null;
  /** 希望職種。**祖先まで展開済み**の role_id（絞り込み用） */
  desiredRoleIds: string[];
  /** ★経験職種（職歴の職種。現職・前職すべて）。**親まで展開済み**の role_id（絞り込み用・2026-10-13）。
   *  ⚠️ 社名を伏せた職歴の職種も含む（職種は伏せる対象ではない。「できること」・合うところと同じ） */
  expRoleIds?: string[];
  /** 表示用。本人が選んだ職種名（展開前） */
  desiredRoleNames: string[];
  workStyles: string[] | null;
  desiredPrefectures: string[] | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  onboardingCompleted: boolean;
  createdAt: string;
  /** ★本人がプロフィールを最後に編集した日時（段1）。⚠️ 運営の修正・ログインでは動かない。null は「記録なし」 */
  profileEditedAt?: string | null;
  /** ★「できること」（職種 × 年数）。**職歴からの計算**で、本人の入力ではない */
  autoSkills?: { label: string; band: string }[];
  /** ★企業からの「声かけ」。⚠️ 送れるかはサーバーが決める（理由は渡さない） */
  approach?: {
    eligible: boolean; sent: RecentApproach | null;
    /** ★送れない理由（eligible でも送り済みでもないとき。2026-10-11）
     *   test_company … 検証用の会社を実アカウントで見ている ／ not_looking … 「今は考えていない」 ／ other … 区別しない（範囲外・受け取らない企業など） */
    blocked?: "test_company" | "not_looking" | "other";
    /** ★見ている担当者にとって未読のメッセージの通数（2026-10-13。一覧でまとめて1回取る）。0 = 未読なし。undefined = 取れなかった */
    unreadCount?: number;
    /** ★返信があって、まだ自社の誰も開いていない（`unseenRepliedConversationIds`。参加者でなくても立つ）。2026-10-13 */
    unseenReply?: boolean;
  };
  /** ★社内の状態。undefined = 社内メモのフラグがオフ（出さない） */
  stage?: CandidateStage | null;
  /** ★社内メモの件数（2026-10-11）。undefined = 社内メモのフラグがオフか、取れなかった（出さない） */
  noteCount?: number;
  /** ★貴社との接点（段1）。強い順。undefined = 取れなかった（印を出さない） */
  touchpoints?: Touchpoint[];
};

/** 社会人年数の帯（2026-08-20）。**年齢の帯の置き換え** */
export const TENURE_BANDS = [
  { value: "lt1",  label: "1年未満",   minMonths: 0,   maxMonths: 11 },
  { value: "1to3", label: "1〜3年",    minMonths: 12,  maxMonths: 35 },
  { value: "3to5", label: "3〜5年",    minMonths: 36,  maxMonths: 59 },
  { value: "5to10", label: "5〜10年",  minMonths: 60,  maxMonths: 119 },
  { value: "gte10", label: "10年以上", minMonths: 120, maxMonths: Number.MAX_SAFE_INTEGER },
] as const;

/** ★年齢の絞り込みの選択肢（下限・上限。2026-10-12）。⚠️ 使えるのは CANDIDATE_AGE_FILTER_ENABLED のときだけ（ageFilter.ts） */
export const AGE_FILTER_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65] as const;

/** 転職への意向を更新した時期の帯（2026-09-19。2026-10-12 に 7日／30日／90日 にした）。⚠️ 読むのは `career_stance_updated_at` */
export const STANCE_FRESHNESS_BANDS = [
  { value: "7d",  label: "7日以内",  days: 7 },
  { value: "30d", label: "30日以内", days: 30 },
  { value: "90d", label: "90日以内", days: 90 },
] as const;

/** ★最近の利用の帯（2026-10-12）。⚠️ 企業に見せるのはこの4段階だけ（正確な日時は出さない） */
export type ActivityBand = "3d" | "1w" | "1m" | "older";
export const ACTIVITY_LABELS: Record<ActivityBand, string> = { "3d": "3日以内に利用", "1w": "1週間以内に利用", "1m": "1か月以内に利用", older: "それ以前" };
/** 絞り込みの選択肢（その帯「以内」）。⚠️ 「それ以前」で絞る選択肢は置かない */
export const ACTIVITY_FILTER_OPTIONS = [
  { value: "3d", label: "3日以内" },
  { value: "1w", label: "1週間以内" },
  { value: "1m", label: "1か月以内" },
] as const;
const ACTIVITY_RANK: Record<ActivityBand, number> = { "3d": 0, "1w": 1, "1m": 2, older: 3 };

/** ★検索窓の文字列を、含める語と除外する語（先頭が "-" / "－"）に分ける（2026-10-13）。⚠️ "-" だけの語は捨てる */
export function splitQuery(q: string): { include: string[]; exclude: string[] } {
  const include: string[] = [], exclude: string[] = [];
  for (const raw of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    if (raw.startsWith("-") || raw.startsWith("－")) { const w = raw.slice(1); if (w) exclude.push(w); }
    else include.push(raw);
  }
  return { include, exclude };
}

/* フリーワードと除外する語が見る項目。⚠️★**同じ対象**を見る（片方だけ足すと「検索では当たるのに除外できない」語ができる） */
function textHit(c: Candidate, t: string): boolean {
  return c.name.toLowerCase().includes(t) ||
    (c.currentRole ?? "").toLowerCase().includes(t) ||
    (c.currentCompany ?? "").toLowerCase().includes(t) ||
    (c.location ?? "").includes(t) ||
    (c.roleName ?? "").toLowerCase().includes(t) ||
    (c.topRoleName ?? "").toLowerCase().includes(t);
}

/**
 * ★絞り込み。画面と段3の新着メールが**同じ関数**を使う。
 * ⚠️ `currentCompany` は社名を伏せた人では「非公開企業」に置き換え済み（load.ts）。
 *    ここに社名の生値を渡す経路を作らないこと。
 */
export function filterCandidates(candidates: Candidate[], f: SavedCandidateFilters, now: Date = new Date(),
  /** ★年齢の絞り込みを効かせるか（`isCandidateAgeFilterEnabled()`。本番は無効）。無効なら保存された年齢の条件も無視する
   *  ★activity … 最近の利用で絞るか（`isCandidateActivityEnabled()`。本番は無効）。無効なら保存された条件も無視する
   *  ★includeHidden … 見送った人も含めるか（2026-10-13）。**既定は含めない**（画面の「表示する」だけが true を渡す。
   *    保存した条件の新着・メールも同じ関数なので、見送った人は数えない） */
  opts: { ageFilter?: boolean; activity?: boolean; includeHidden?: boolean } = {}): Candidate[] {
  let list = opts.includeHidden ? candidates : candidates.filter((c) => c.hidden !== true);

  /* ★検索窓（2026-10-13 に一本化）。含める語は AND、"-語" は OR（1つでも当たれば落とす） */
  const { include, exclude } = splitQuery(f.q);
  if (include.length > 0) list = list.filter((c) => include.every((t) => textHit(c, t)));
  if (exclude.length > 0) list = list.filter((c) => !exclude.some((t) => textHit(c, t)));
  if (f.employmentTypes.length > 0) {
    list = list.filter((c) => c.employmentType && f.employmentTypes.includes(c.employmentType));
  }
  /* ⚠️ 働き方・希望年収の絞り込みは 2026-10-13 に外した（右欄に出さない値で絞れると、値が間接的に分かるため） */
  /* 希望職種: 候補者側が祖先まで展開済みなので、大分類でも子でも includes() で当たる */
  const wantRole = f.childRoleId ?? f.topRoleId;
  if (wantRole) list = list.filter((c) => c.desiredRoleIds.includes(wantRole));
  /* ★経験職種（2026-10-13）。選んだ中のどれか（OR）。候補者側が親まで展開済みなので、親を選ぶと子の経験も当たる */
  if (f.expRoleIds.length > 0) list = list.filter((c) => (c.expRoleIds ?? []).some((id) => f.expRoleIds.includes(id)));
  /* 社会人年数。⚠️ 未算出（職歴0件）の人は落とさない */
  if (f.tenureBand) {
    const band = TENURE_BANDS.find((b) => b.value === f.tenureBand);
    if (band) {
      list = list.filter((c) => c.tenureMonths == null || (c.tenureMonths >= band.minMonths && c.tenureMonths <= band.maxMonths));
    }
  }
  /* ★年齢（2026-10-12）。⚠️★生年月日が無い人（age が null）は**落とす**（範囲に入るか分からないため。
        社会人年数と逆向き。画面には「生年月日が未登録の N 名は含みません」と人数を出す） */
  if (opts.ageFilter && (f.ageMin > 0 || f.ageMax > 0)) {
    list = list.filter((c) => c.age != null && (f.ageMin <= 0 || c.age >= f.ageMin) && (f.ageMax <= 0 || c.age <= f.ageMax));
  }
  /* ★合うところあり（2026-10-12）。⚠️ 取れなかった人（undefined）は落とす */
  if (f.hasTouchpoints) list = list.filter((c) => (c.touchpoints?.length ?? 0) > 0);
  /* ★★を付けた人だけ（2026-10-12） */
  if (f.starredOnly) list = list.filter((c) => c.starred === true);
  /* ★転職への意向（複数選択は OR。2026-10-12） */
  if (f.careerStances.length > 0) list = list.filter((c) => c.careerStance != null && f.careerStances.includes(c.careerStance));
  /* ★最近の利用（2026-10-12）。⚠️ 記録が無い人（null）は落とす（画面に人数を出す） */
  if (opts.activity && f.activity in ACTIVITY_RANK) {
    const max = ACTIVITY_RANK[f.activity as ActivityBand];
    list = list.filter((c) => c.activity != null && ACTIVITY_RANK[c.activity] <= max);
  }
  /* 転職意欲の更新時期。⚠️★未更新（null）は落とす */
  if (f.stanceFreshness) {
    const band = STANCE_FRESHNESS_BANDS.find((b) => b.value === f.stanceFreshness);
    if (band) {
      const since = now.getTime() - band.days * 24 * 60 * 60 * 1000;
      list = list.filter((c) => {
        if (!c.careerStanceUpdatedAt) return false;
        const t = new Date(c.careerStanceUpdatedAt).getTime();
        return Number.isFinite(t) && t >= since;
      });
    }
  }
  /* 居住地（OR）。★自由入力の値は `residenceKey` で都道府県・「海外」に対応づけて比べる（2026-10-12）。
     ⚠️ 対応づけられない値（「非公開」・未入力・読めない文字）は、居住地で絞ったときだけ落ちる */
  if (f.prefectures.length > 0) {
    list = list.filter((c) => { const k = residenceKey(c.location); return !!k && f.prefectures.includes(k); });
  }
  return list;
}

export const CANDIDATE_SORT_OPTIONS = [
  /* ★2026-10-13 に既定にした（EMPTY_SAVED_FILTERS.sort）。⚠️ 接点が取れなかった（undefined）人は 0 件として扱わず末尾 */
  { value: "touchpoints", label: "合うところが多い順" },
  { value: "new",         label: "新着順" },
  { value: "stance",      label: "意向の更新が新しい順" },
  { value: "tenure",      label: "社会人年数が長い順" },
  /* ★2026-10-12。⚠️ CANDIDATE_AGE_FILTER_ENABLED のときだけ選べる（画面が `AGE_SORTS` を外す）。生年月日が無い人は末尾 */
  { value: "age_young", label: "年齢が若い順" },
  { value: "age_old", label: "年齢が高い順" },
  /* ★2026-10-12。⚠️ CANDIDATE_ACTIVITY_ENABLED のときだけ。帯の単位で並べる（正確な日時は持っていない）。記録が無い人は末尾 */
  { value: "activity", label: "最近利用した順" },
] as const;
export const ACTIVITY_SORTS: readonly string[] = ["activity"];
export const AGE_SORTS: readonly string[] = ["age_young", "age_old"];

/** 並び替え。⚠️ 引数を壊さない（コピーして並べる）。記録の無い人は末尾 */
export function sortCandidates(list: Candidate[], sort: string): Candidate[] {
  const out = [...list];
  const newest = (a: Candidate, b: Candidate) => b.createdAt.localeCompare(a.createdAt);
  if (sort === "stance") {
    return out.sort((a, b) => {
      if (!a.careerStanceUpdatedAt && !b.careerStanceUpdatedAt) return 0;
      if (!a.careerStanceUpdatedAt) return 1;
      if (!b.careerStanceUpdatedAt) return -1;
      return b.careerStanceUpdatedAt.localeCompare(a.careerStanceUpdatedAt);
    });
  }
  if (sort === "tenure") {
    return out.sort((a, b) => {
      if (a.tenureMonths == null && b.tenureMonths == null) return 0;
      if (a.tenureMonths == null) return 1;
      if (b.tenureMonths == null) return -1;
      return b.tenureMonths - a.tenureMonths;
    });
  }
  if (sort === "activity") {
    return out.sort((a, b) => {
      const ra = a.activity ? ACTIVITY_RANK[a.activity] : null, rb = b.activity ? ACTIVITY_RANK[b.activity] : null;
      if (ra === null && rb === null) return newest(a, b);
      if (ra === null) return 1;
      if (rb === null) return -1;
      return ra - rb || newest(a, b);
    });
  }
  if (sort === "age_young" || sort === "age_old") {
    const dir = sort === "age_young" ? 1 : -1;
    return out.sort((a, b) => {
      if (a.age == null && b.age == null) return newest(a, b);
      if (a.age == null) return 1;
      if (b.age == null) return -1;
      return (a.age - b.age) * dir || newest(a, b);
    });
  }
  if (sort === "touchpoints") {
    /* 件数 → 強さの合計 → 新着。⚠️ 取れなかった人（undefined）は末尾 */
    const score = (c: Candidate) => c.touchpoints ? [c.touchpoints.length, c.touchpoints.reduce((s, t) => s + t.weight, 0)] : null;
    return out.sort((a, b) => {
      const sa = score(a), sb = score(b);
      if (!sa && !sb) return newest(a, b);
      if (!sa) return 1;
      if (!sb) return -1;
      return sb[0] - sa[0] || sb[1] - sa[1] || newest(a, b);
    });
  }
  return out.sort(newest);
}

/** 日本時間の「M月D日」。⚠️ サーバーとブラウザで同じ値になるよう Asia/Tokyo に固定する */
export function formatJstMonthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(d);
  const p = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${p("month")}月${p("day")}日`;
}

/** 「10/3」の形（日本時間）。カードの短い表示用 */
export function formatJstSlashMonthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(d);
  const p = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${p("month")}/${p("day")}`;
}

/**
 * ★カードとプレビューに出す「声かけの状態」（段1）。
 * ⚠️★判定は増やさない。`approach.eligible`（`can_send_company_approach()`）と
 *    `approach.sent`（`companyApproachStatus` を通した記録）を言葉にするだけ。
 * ⚠️ 送れない理由は区別しない（`APPROACH_UNAVAILABLE_MESSAGE` の1文。「受け取っていません」と書かない）。
 * ⚠️ 声かけが使えない（undefined）ときは null（何も出さない）。
 */
export function candidateApproachLabel(approach: Candidate["approach"]): { state: "eligible" | "sent" | "not_accepting"; text: string; short: string } | null {
  if (!approach) return null;
  if (approach.sent) {
    const who = approach.sent.senderName ? `${approach.sent.senderName}さん` : "担当者";
    /* ★short はカード用（2026-10-11 / 柴さんの指示）。「リクエスト済み（◯◯さん・10/3）」の形で1行に収める。
          プレビュー（右側）は text（長い文）のまま */
    return {
      state: "sent",
      text: `${who}が${formatJstMonthDay(approach.sent.sentAt) ?? "—"}にメッセージを送りました`,
      /* ★カードは灰色の状態の1行（2026-10-11 / モックに合わせた。/biz/messages の一覧と同じ関数） */
      short: approachStatusLine(approach.sent.state, approach.sent.sentAt),
    };
  }
  if (approach.eligible) return { state: "eligible", text: "メッセージを送れます", short: "メッセージを送れます" };
  /* ★送れない理由は区別しない（2026-10-11 / 柴さんの指示）。受け取らない設定・ブロック・範囲外・転職に興味なし のどれでも同じ一文 */
  return { state: "not_accepting", text: APPROACH_UNAVAILABLE_MESSAGE, short: APPROACH_UNAVAILABLE_MESSAGE };
}

/**
 * ★保存した条件の「新着」（2026-10-10 / 段3 / 柴さんの決めごと）。数えるのは次の2つだけ:
 *   ・`since` より後に新しく登録した人（`createdAt` ＝ ow_users.created_at）
 *   ・`since` より後に本人がプロフィールの中身を編集した人（`profileEditedAt`）
 * ⚠️★転職意欲・声かけの受け取り・ブロック解除などで「見えるようになった」人は数えない
 *    （いつ転職を考え始めたか・いつ声かけを受け取り始めたかが企業に伝わるため）。
 *    ⚠️ ここに条件を足すときは、その日時が**企業に何を伝えるか**を先に考えること。
 */
export function isNewSince(c: Candidate, sinceIso: string): boolean {
  const since = new Date(sinceIso).getTime();
  if (!Number.isFinite(since)) return false;
  const t1 = new Date(c.createdAt).getTime();
  const t2 = c.profileEditedAt ? new Date(c.profileEditedAt).getTime() : NaN;
  return (Number.isFinite(t1) && t1 > since) || (Number.isFinite(t2) && t2 > since);
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "パート・アルバイト",
  freelance: "フリーランス",
  intern: "インターン",
};

/**
 * ★保存した条件をチップの言葉にする（段3。保存した条件の一覧ページで使う）。
 * ⚠️ 検索画面のチップ（`CandidatesClient` の activeChips）と同じ語にする。並べ替えは含めない。
 * @param roleNameById 職種の名前（取れなければ空。そのときは職種のチップを出さない＝uuid を出さない）
 */
export function describeFilters(
  f: SavedCandidateFilters,
  roleNameById: Map<string, string>,
  labels: { careerStances: { value: string; label: string }[] },
  /** ★年齢の絞り込みが使える環境か（`isCandidateAgeFilterEnabled()`）。無効なら年齢の条件を言葉にしない（2026-10-12）。activity も同じ */
  opts: { ageFilter?: boolean; activity?: boolean } = {},
): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`検索: ${f.q.trim()}`);
  const expNames = f.expRoleIds.map((id) => roleNameById.get(id)).filter((n): n is string => !!n);
  if (expNames.length) out.push(`経験職種: ${expNames.join("・")}`);
  const role = f.childRoleId ?? f.topRoleId;
  if (role && roleNameById.get(role)) out.push(`希望職種: ${roleNameById.get(role)!}`);
  const tb = TENURE_BANDS.find((b) => b.value === f.tenureBand);
  if (tb) out.push(`社会人 ${tb.label}`);
  /* ★年齢（2026-10-12）。⚠️ 無効な環境（本番）では出さない（年齢が画面に一切出ない状態にする。柴さんの指示） */
  if (opts.ageFilter && (f.ageMin > 0 || f.ageMax > 0)) out.push(ageRangeLabel(f.ageMin, f.ageMax));
  for (const v of f.employmentTypes) out.push(EMPLOYMENT_TYPE_LABELS[v] ?? v);
  for (const p of f.prefectures) out.push(p);
  if (f.hasTouchpoints) out.push("合うところあり");
  if (f.starredOnly) out.push("気になる");
  for (const v of f.careerStances) { const cs = labels.careerStances.find((o) => o.value === v); if (cs) out.push(cs.label); }
  if (opts.activity) { const a = ACTIVITY_FILTER_OPTIONS.find((o) => o.value === f.activity); if (a) out.push(`利用 ${a.label}`); }
  const fr = STANCE_FRESHNESS_BANDS.find((b) => b.value === f.stanceFreshness);
  if (fr) out.push(`更新 ${fr.label}`);
  return out;
}

/** 「30〜39歳」「30歳〜」「〜39歳」。⚠️ 検索画面のチップと保存した条件の一覧が同じ言葉にする */
export function ageRangeLabel(min: number, max: number): string {
  if (min > 0 && max > 0) return `${min}〜${max}歳`;
  if (min > 0) return `${min}歳〜`;
  return `〜${max}歳`;
}
