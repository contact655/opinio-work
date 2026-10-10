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
import type { RecentApproach } from "@/lib/approaches/server";
import type { CandidateStage } from "@/lib/constants/candidateNotes";
import type { SavedCandidateFilters } from "@/lib/business/savedSearch";

/** ★貴社との接点の1件。種類・表示文・根拠の参照先（画面で根拠へ飛べるように） */
export type TouchpointKind =
  | "job_role"        // ① 求人の職種 × 経験職種（＋年数）
  | "company_role"    // ② 部門・職種 × 経験職種／関心のある職種
  | "location"        // ③ 求人の勤務地 × 居住地
  | "target_industry" // ④a 顧客の業界 × 職歴の業種
  | "business_domain" // ④b 事業領域 × 前の勤務先の事業領域
  | "alumni";         // ⑤ 社員の前職 × 候補者の前職
export type Touchpoint = {
  kind: TouchpointKind;
  /** 画面に出す1文。⚠️ 社員の名前・候補者が伏せた勤務先は入らない */
  text: string;
  /** 根拠の参照先（自社の求人・部門など）。⚠️ 候補者側の非公開の値は入れない */
  ref: { type: "job" | "company_job_role" | "department" | "industry" | "business_domain" | "company"; id: string } | null;
  /** 強さ（大きいほど上に出す）。並び替えにも使う */
  weight: number;
};

/** 自社で接点の材料が揃っているか（空のときの入口を出し分ける。⚠️ クライアントからも読むのでここに置く） */
export type TouchpointMaterials = {
  hasJobs: boolean;
  hasCompanyRoles: boolean;
  hasPublicEmployees: boolean;
};

export type Candidate = {
  id: string;
  name: string;
  /** ★本人が書いた1行（2026-09-23）。⚠️ `currentRole`（職種マスタ）と別物。混ぜない */
  headline: string | null;
  location: string | null;
  /** ★「積極的に検討中」（`ow_profiles.career_stance = 'active'`） */
  isActivelyLooking: boolean;
  /** ★転職意欲そのもの。⚠️ 母集合が `no_contact` と未設定を落としている */
  careerStance: string | null;
  /** ★転職意欲を最後に変えた日時。⚠️★null は「未更新」。「古い」ではない */
  careerStanceUpdatedAt: string | null;
  /** 社会人年数（月数）。**職歴が0件なら null＝未算出。0 ではない** */
  tenureMonths: number | null;
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
  approach?: { eligible: boolean; sent: RecentApproach | null };
  /** ★社内の状態。undefined = 社内メモのフラグがオフ（出さない） */
  stage?: CandidateStage | null;
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

/** 転職意欲の更新時期の帯（2026-09-19）。⚠️ 読むのは `career_stance_updated_at` */
export const STANCE_FRESHNESS_BANDS = [
  { value: "1d",  label: "24時間以内", days: 1 },
  { value: "1w",  label: "1週間以内",  days: 7 },
  { value: "1m",  label: "1ヶ月以内",  days: 30 },
  { value: "3m",  label: "3ヶ月以内",  days: 90 },
] as const;

/* フリーワードと除外ワードが見る項目。⚠️★**同じ対象**を見る（片方だけ足すと「検索では当たるのに除外できない」語ができる） */
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
export function filterCandidates(candidates: Candidate[], f: SavedCandidateFilters, now: Date = new Date()): Candidate[] {
  let list = candidates;

  if (f.q.trim()) {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((c) => terms.every((t) => textHit(c, t)));
  }
  /* 除外ワード: スペース区切りは OR（1つでも当たれば落とす） */
  if (f.excludeQuery.trim()) {
    const ng = f.excludeQuery.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((c) => !ng.some((t) => textHit(c, t)));
  }
  if (f.roleQuery.trim()) {
    const r = f.roleQuery.toLowerCase();
    list = list.filter((c) => (c.currentRole ?? "").toLowerCase().includes(r));
  }
  if (f.companyQuery.trim()) {
    const co = f.companyQuery.toLowerCase();
    list = list.filter((c) => (c.currentCompany ?? "").toLowerCase().includes(co));
  }
  if (f.employmentTypes.length > 0) {
    list = list.filter((c) => c.employmentType && f.employmentTypes.includes(c.employmentType));
  }
  if (f.workStyle) list = list.filter((c) => (c.workStyles ?? []).includes(f.workStyle));
  /* 職種: 候補者側が祖先まで展開済みなので、大分類でも子でも includes() で当たる */
  const wantRole = f.childRoleId ?? f.topRoleId;
  if (wantRole) list = list.filter((c) => c.desiredRoleIds.includes(wantRole));
  /* 社会人年数。⚠️ 未算出（職歴0件）の人は落とさない */
  if (f.tenureBand) {
    const band = TENURE_BANDS.find((b) => b.value === f.tenureBand);
    if (band) {
      list = list.filter((c) => c.tenureMonths == null || (c.tenureMonths >= band.minMonths && c.tenureMonths <= band.maxMonths));
    }
  }
  if (f.careerStance) list = list.filter((c) => c.careerStance === f.careerStance);
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
  /* 居住地（OR・前方一致） */
  if (f.prefectures.length > 0) {
    list = list.filter((c) => f.prefectures.some((p) => (c.location ?? "").startsWith(p)));
  }
  if (f.salaryMin > 0) {
    list = list.filter((c) => {
      const v = c.desiredSalaryMax ?? c.desiredSalaryMin;
      if (v === null) return f.includeNoSalary;
      return v >= f.salaryMin;
    });
  }
  /* ⚠️★判定はサーバーで `can_send_company_approach()` を通した値だけを見る（ボタンと同じ値） */
  if (f.approachOnly) list = list.filter((c) => c.approach?.eligible === true);
  return list;
}

export const CANDIDATE_SORT_OPTIONS = [
  { value: "new",         label: "新着順" },
  { value: "stance",      label: "転職意欲の更新が新しい順" },
  { value: "tenure",      label: "社会人年数が長い順" },
  /* ★段1。⚠️ 接点が取れなかった（undefined）人は 0 件として扱わず末尾 */
  { value: "touchpoints", label: "接点が多い順" },
] as const;

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

/**
 * ★カードとプレビューに出す「声かけの状態」（段1）。
 * ⚠️★判定は増やさない。`approach.eligible`（`can_send_company_approach()`）と
 *    `approach.sent`（`companyApproachStatus` を通した記録）を言葉にするだけ。
 * ⚠️ 「受け取っていません」は理由を区別しない（範囲外・受け取らない企業・未設定を企業に見分けさせない）。
 * ⚠️ 声かけが使えない（undefined）ときは null（何も出さない）。
 */
export function candidateApproachLabel(approach: Candidate["approach"]): { state: "eligible" | "sent" | "not_accepting"; text: string } | null {
  if (!approach) return null;
  if (approach.sent) {
    const who = approach.sent.senderName ? `${approach.sent.senderName}さん` : "担当者";
    return { state: "sent", text: `${who}が${formatJstMonthDay(approach.sent.sentAt) ?? "—"}に声かけ済み` };
  }
  if (approach.eligible) return { state: "eligible", text: "声かけを受け取る" };
  return { state: "not_accepting", text: "声かけは受け取っていません" };
}
