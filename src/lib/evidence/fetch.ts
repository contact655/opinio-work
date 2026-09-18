/**
 * 根拠エンジンの**取得層**。DB から「事実」を集めて [engine.ts](./engine.ts) に渡す。
 *
 * ⚠️★**文を作らないこと。** ここは数を数えるだけ。ラベルの組み立ては engine 側。
 *    両方でやると、②と⑨で文言が割れる。
 *
 * ⚠️★**admin クライアントで引く。** 他人の職歴・遷移・面談対応者を横断して数えるので
 *    セッションのクライアントでは RLS に落とされる（**403 ではなく 200 + 0件**で
 *    返るため、気づけない）。そのぶん**除外条件は手で書く**:
 *      `is_test` / `is_system` / `visibility='private'` / `auth_id IS NULL`
 *    ＝ `getCompanyEmployees` の `isSeedRow` と同じ集合。
 *
 * ⚠️★**N+1 にしない。** 企業ごとに引かず、company_id の配列でまとめて引いて
 *    メモリで畳む。掲載22社ぶんを1社ずつ引くと1提案あたり 88 クエリになる。
 *
 * ⚠️ `error` を握り潰さない。0件と失敗を区別できなくなる（CLAUDE.md）。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";
import { companyDisplayName } from "@/lib/companies/displayName";
import { JOIN_REASON_LABELS } from "@/lib/constants/careerReasons";
import { matchCompanyPreference } from "@/lib/matching/scoreJob";
import { getRoleNameMap } from "@/lib/supabase/queries";
import type {
  CounterFacts,
  EvidenceFacts,
  EvidenceOptions,
} from "./engine";

/** 1社ぶんの事実。engine にそのまま渡す */
export type CompanyFacts = {
  companyId: string;
  companyName: string;
  /**
   * 反証（年収・勤務形態）の材料に使った公開求人。無ければ null。
   * ⚠️★**提案行の `job_id` にはこの値を入れること。** 求人の年収でスナップショットを
   *    作りながら `job_id` を null にすると、**どの求人で判定したのか後から辿れない。**
   */
  jobId: string | null;
  evidence: EvidenceFacts;
  counter: CounterFacts;
};

/**
 * engine に渡すオプションを1箇所で作る。★しきい値をここ以外で決めないこと。
 * ⚠️★**`audience` は取らない。** 根拠のラベルに人称を入れない決まり
 *    （`engine.ts` の `Audience` の注記）。誰の話かは画面側が示す。
 */
export function evidenceOptions(): EvidenceOptions {
  return { minAggregate: MIN_AGGREGATE_COUNT };
}

/* ── 表示してよいユーザーか ────────────────────────────────────────────────
   ⚠️ `getCompanyEmployees` の `isSeedRow` と同じ条件。**片方だけ変えないこと。** */
type UserRow = {
  id: string;
  auth_id: string | null;
  is_test: boolean | null;
  is_system: boolean | null;
  visibility: string | null;
};
function isVisibleUser(u: UserRow | null | undefined): boolean {
  if (!u) return false;
  if (u.auth_id == null) return false;      // 本人が登録していない
  if (u.is_test === true) return false;
  if (u.is_system === true) return false;
  if (u.visibility === "private") return false;
  return true;
}

/**
 * 候補者1人 × 企業N社ぶんの事実を集める。
 *
 * @param candidateOwUserId ★**ow_users.id 空間**（`auth.uid()` ではない）
 * @param companyIds        掲載中の企業に絞ってから渡すこと（ここでは絞らない）
 */
export async function gatherCompanyFacts(
  candidateOwUserId: string,
  companyIds: readonly string[],
): Promise<CompanyFacts[]> {
  if (companyIds.length === 0) return [];
  const db = createAdminClient();
  /* ⚠️ `[...new Set()]` にしないこと。tsconfig の target では TS2802
     （downlevelIteration が要る）になる。設定は触らない。 */
  const ids = Array.from(new Set(companyIds));

  // ── 0. 候補者自身 ─────────────────────────────────────────────────────────
  const [{ data: myExp, error: myExpErr }, { data: me, error: meErr }, roleMap] = await Promise.all([
    db.from("ow_experiences")
      .select("company_id, role_category_id, join_reasons")
      .eq("user_id", candidateOwUserId),
    db.from("ow_users").select("auth_id").eq("id", candidateOwUserId).maybeSingle(),
    /* 職種名の解決。★企業ごとに引かない（中身は企業に依存しないので共通キャッシュ） */
    getRoleNameMap(),
  ]);
  if (myExpErr) console.error("[evidence/fetch] 候補者の職歴:", myExpErr.message);
  if (meErr) console.error("[evidence/fetch] 候補者:", meErr.message);

  const myRoleIds = new Set(
    (myExp ?? []).map((r) => r.role_category_id as string | null).filter(Boolean) as string[],
  );
  /* ★候補者の「重視するもの」＝ 自分が過去に挙げた入社の決め手。
     ⚠️ 希望条件（`ow_profiles.desired_*`）とは別物。混ぜないこと。 */
  const myReasons = new Set(
    (myExp ?? []).flatMap((r) => (r.join_reasons as string[] | null) ?? []),
  );
  // ── 1. 企業の基本情報 ─────────────────────────────────────────────────────
  const { data: companies, error: coErr } = await db
    .from("ow_companies")
    .select("id, name, name_en, phase, remote_work_status")
    .in("id", ids);
  if (coErr) console.error("[evidence/fetch] ow_companies:", coErr.message);

  // ── 2. 遷移（same_path）──────────────────────────────────────────────────
  /* ⚠️ `ow_transitions` は**導出テーブルで、洗い替えが手動**。
        古いままだと件数が実態より少なく出る（2026-09-18 時点で最終 2026-08-26）。
        ここでは「あるものを数える」だけ。鮮度は運用の話。 */
  const { data: transitions, error: trErr } = await db
    .from("ow_transitions")
    .select("user_id, to_company_id, from_role_category_id, from_industry, ow_users!user_id(id, auth_id, is_test, is_system, visibility)")
    .in("to_company_id", ids);
  if (trErr) console.error("[evidence/fetch] ow_transitions:", trErr.message);

  // ── 3. 在籍者の職歴（shared_motive / talkable / short_tenure）─────────────
  const { data: exps, error: expErr } = await db
    .from("ow_experiences")
    .select("id, user_id, company_id, is_current, started_at, ended_at, join_reasons, visibility_company, ow_users!user_id(id, auth_id, is_test, is_system, visibility)")
    .in("company_id", ids);
  if (expErr) console.error("[evidence/fetch] 在籍者の職歴:", expErr.message);

  const visibleExps = (exps ?? []).filter(
    (e) =>
      isVisibleUser(e.ow_users as unknown as UserRow) &&
      e.visibility_company !== "hidden",
  );

  // ── 4. 面談対応者（talkable）──────────────────────────────────────────────
  const { data: members, error: memErr } = await db
    .from("ow_company_members")
    .select("user_id, company_id, display_consent, is_public")
    .in("company_id", ids)
    .eq("display_consent", true)
    .eq("is_public", true);
  if (memErr) console.error("[evidence/fetch] ow_company_members:", memErr.message);

  // ── 5. 候補者の希望条件（preference / salary / work style）────────────────
  const authId = (me?.auth_id as string | null) ?? null;
  const { data: profile, error: profErr } = authId
    ? await db
        .from("ow_profiles")
        .select("desired_phase, desired_work_styles, desired_salary_min, desired_salary_max")
        .eq("user_id", authId)
        .maybeSingle()
    : { data: null, error: null };
  if (profErr) console.error("[evidence/fetch] ow_profiles:", profErr.message);

  // ── 6. 公開求人（salary_gap の材料）───────────────────────────────────────
  const { data: jobs, error: jobErr } = await db
    .from("ow_jobs")
    .select("id, company_id, salary_min, salary_max, remote_work_status")
    .in("company_id", ids)
    .eq("status", "published")
    .eq("is_test", false);
  if (jobErr) console.error("[evidence/fetch] ow_jobs:", jobErr.message);

  // ── 畳む ──────────────────────────────────────────────────────────────────
  return (companies ?? []).map((co) => {
    const cid = co.id as string;
    const { displayName } = companyDisplayName(co.name as string, co.name_en as string | null);

    /* ① same_path … 候補者と同じ職種から、この会社へ移った人 */
    const rows = (transitions ?? []).filter(
      (t) =>
        t.to_company_id === cid &&
        isVisibleUser(t.ow_users as unknown as UserRow) &&
        (myRoleIds.size === 0 ||
          (t.from_role_category_id != null && myRoleIds.has(t.from_role_category_id as string))),
    );
    const samePathUsers = new Set(rows.map((t) => t.user_id as string));
    /* ⚠️ 職種名は `getRoleNameMap()` で解決する。**解決できなければ null のまま。**
          「営業」などの既定値で埋めないこと（engine 側が null を見て文を変える）。 */
    const fromRoleId = rows[0]?.from_role_category_id as string | null | undefined;
    const samePath =
      rows.length > 0
        ? {
            n: samePathUsers.size,
            fromRoleName: (fromRoleId ? roleMap.get(fromRoleId)?.name : null) ?? null,
            fromIndustryName: (rows[0].from_industry as string | null) ?? null,
          }
        : { n: 0, fromRoleName: null, fromIndustryName: null };

    /* ② shared_motive … 在籍者が挙げた決め手と、候補者が挙げた決め手の一致 */
    const withReasons = visibleExps.filter(
      (e) => e.company_id === cid && ((e.join_reasons as string[] | null) ?? []).length > 0,
    );
    let sharedMotive: EvidenceFacts["sharedMotive"] = null;
    if (withReasons.length > 0) {
      const hits = withReasons.filter((e) =>
        ((e.join_reasons as string[]) ?? []).some((r) => myReasons.has(r)),
      );
      /* 一致した決め手のうち、最も多く挙がっているものを1つ選ぶ */
      const tally = new Map<string, number>();
      for (const e of hits) {
        for (const r of (e.join_reasons as string[]) ?? []) {
          if (myReasons.has(r)) tally.set(r, (tally.get(r) ?? 0) + 1);
        }
      }
      const top = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
      sharedMotive = {
        n: withReasons.length,
        k: hits.length,
        /* ⚠️ ラベルは `JOIN_REASON_LABELS` を通す。生のスラッグを画面に出さない */
        reasonLabel: top ? (JOIN_REASON_LABELS[top[0]] ?? top[0]) : "",
      };
    }

    /* ③ talkable … 公開中の面談対応者のうち、その会社に現職の経歴がある人 */
    const currentUserIds = new Set(
      visibleExps.filter((e) => e.company_id === cid && e.is_current).map((e) => e.user_id as string),
    );
    const talkableN = (members ?? []).filter(
      (m) => m.company_id === cid && currentUserIds.has(m.user_id as string),
    ).length;

    /* ④ preference_match … 求人があれば求人の勤務形態、無ければ企業の値 */
    const job = (jobs ?? []).find((j) => j.company_id === cid) ?? null;
    const workStyle =
      (job?.remote_work_status as string | null) ?? (co.remote_work_status as string | null);
    const matchedLabels = profile
      ? matchCompanyPreference(co.phase as string | null, workStyle, {
          desired_phase: (profile.desired_phase as string[] | null) ?? null,
          desired_work_styles: (profile.desired_work_styles as string[] | null) ?? null,
        })
      : [];

    /* ── 反証 ───────────────────────────────────────────────────────────── */
    const left = visibleExps.filter(
      (e) => e.company_id === cid && !e.is_current && e.ended_at != null && e.started_at != null,
    );
    const short = left.filter((e) => {
      const s = new Date(e.started_at as string).getTime();
      const t = new Date(e.ended_at as string).getTime();
      return Number.isFinite(s) && Number.isFinite(t) && t - s < 365 * 24 * 60 * 60 * 1000;
    });

    return {
      companyId: cid,
      companyName: displayName,
      jobId: (job?.id as string | null) ?? null,
      evidence: {
        companyName: displayName,
        samePath: samePath.n > 0 ? samePath : null,
        sharedMotive,
        talkable: talkableN > 0 ? { n: talkableN } : null,
        preference: matchedLabels.length > 0 ? { matchedLabels } : null,
      },
      counter: {
        /* ⚠️ 退職者が0人なら `null`（測れない）。`{n:0,total:0}` にしない */
        shortTenure: left.length > 0 ? { n: short.length, total: left.length } : null,
        /* ⚠️★**現年収は使わない**（`salary_man` は実ユーザー0件・GRANT も無い）。
              ここは**希望年収**との比較。engine 側のコメントも参照。 */
        salaryGap:
          job && profile
            ? {
                jobMin: (job.salary_min as number | null) ?? null,
                jobMax: (job.salary_max as number | null) ?? null,
                wantMin: (profile.desired_salary_min as number | null) ?? null,
                wantMax: (profile.desired_salary_max as number | null) ?? null,
              }
            : null,
        workStyleGap:
          workStyle && (profile?.desired_work_styles as string[] | null)?.length
            ? { actual: workStyle, wanted: profile!.desired_work_styles as string[] }
            : null,
      },
    };
  });
}

/** 候補者が既に在籍した（している）会社の id。★提案から外すのに使う */
export async function companiesToExclude(candidateOwUserId: string): Promise<Set<string>> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("ow_experiences")
    .select("company_id")
    .eq("user_id", candidateOwUserId)
    .not("company_id", "is", null);
  if (error) console.error("[evidence/fetch] companiesToExclude:", error.message);
  return new Set((data ?? []).map((r) => r.company_id as string));
}
