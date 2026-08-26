// src/lib/search/runSearch.ts
/**
 * `/search`（横断検索）専用の取得層。**サーバー専用。**
 *
 * ── ★なぜ既存の関数を使わないか ─────────────────────────────────────────────
 *
 * `lib/search/companies.ts` の `searchCompanies` は **変更しない**（`/companies` の
 * 一覧が乗っているので、引数を足すと一覧側の挙動まで動く）。
 * `/jobs` と `/people` はそもそも「条件を渡して引く関数」を持っておらず、
 * 絞り込みが丸ごとクライアントの `useMemo` の中にある。
 *
 * ⚠️ **`getDirectoryPeople()` をここから呼ばないこと。**
 *    あれは `unstable_cache`（revalidate 1800）で、検索語ごとに結果が変わる
 *    `/search` とは寿命が合わない。加えて、あの関数の戻り値に列を足したとき
 *    「キャッシュに古い形の配列が残って `undefined` になる」を実際に踏んでいる
 *    （2026-08-26 / `roleIds`）。**同じ問題を横断検索に持ち込まない。**
 *
 * ⚠️ **ここ自体もキャッシュしない。** 検索語ごとに結果が変わるので
 *    `unstable_cache` に載せる意味が無い。`/search` は `force-dynamic`。
 *    語彙（`getRoleAliases` / `getBusinessDomainOptions` / `getRoleTree`）は
 *    それぞれ既にキャッシュ済みなので、往復は増えない。
 *
 * ── 条件の当て方 ────────────────────────────────────────────────────────────
 * 条件どうしは **AND**。ある条件がその対象に当てられないとき（`appliesTo` に
 * 入っていないとき）は**その条件を無視する**。⚠️ 黙って無視するのではなく、
 * 画面側が `appliesTo` を読んでチップに「求人にのみ効く」と出す。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { companyDisplayName } from "@/lib/companies/displayName";
import { getRoleTree } from "@/lib/supabase/queries";
import { expandWithAncestors } from "@/lib/roles/jobRoles";
import {
  resolveExperienceCompanyLabel,
  EXPERIENCE_COMPANY_COLS,
} from "@/lib/experiences/companyName";
import type { Condition, SearchKind } from "./interpretQuery";

// ── 結果の型（★1つの型に潰さない。判別可能ユニオン）──────────────────────────

export type CompanyHit = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  isForeign: boolean;
  /** 主の事業領域名。無ければ null（「—」で埋めない） */
  domain: string | null;
  jobCount: number;
};

export type JobHit = {
  id: string;
  slug: string | null;
  title: string;
  companyName: string;
  companySlug: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  workStyle: string | null;
  location: string | null;
};

export type PersonHit = {
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  /** 現在の所属ラベル。`visibility_company` を尊重した結果（hidden なら null） */
  currentLabel: string | null;
  /**
   * ★「なぜこの人が出たか」を1行で。例:「電設資材 → フィールドセールス」
   * ⚠️ **カードに出す職種と、検索でヒットした職種がずれるのを防ぐための行。**
   *    `/search` は全職歴を対象にするので、現職だけを出すと
   *    「営業で引いたのにカードはコーポレート」が起きる。
   */
  matchReason: string | null;
};

export type SearchHit =
  | { kind: "company"; item: CompanyHit }
  | { kind: "job"; item: JobHit }
  | { kind: "person"; item: PersonHit };

export type KindResult<T> = {
  /** 表示する件数。人は未ログインだと空になるが total は返る */
  items: T[];
  total: number;
};

export type SearchResults = {
  company: KindResult<CompanyHit>;
  job: KindResult<JobHit>;
  person: KindResult<PersonHit>;
};

/** 一覧に出す上限。**超えた分は total に出す**（黙って切らない） */
const HIT_LIMIT = 24;

/**
 * ★集計を出してよい下限（未ログインの人検索）。
 * n=1 や n=2 の「1人います」は本人の特定に繋がるため、件数すら出さない。
 * ⚠️ 遷移データの集計方針と同じしきい値。片方だけ動かさないこと。
 */
export const MIN_AGGREGATE_COUNT = 3;

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

function pick(conditions: Condition[], kind: SearchKind): Condition[] {
  return conditions.filter((c) => c.appliesTo.includes(kind));
}

/**
 * 条件ごとに作った id 集合の**積**。条件が無ければ null（＝絞り込まない）。
 *
 * ⚠️ `let acc: Set<string> | null = null` を書き換えていく形にしないこと。
 *    TypeScript は初期化子で const を絞るので、後から `!== null` で分岐しても
 *    `never` になり `.size` が型エラーになる（実際に踏んだ）。
 */
function intersectAll(sets: Set<string>[]): Set<string> | null {
  if (sets.length === 0) return null;
  return sets.reduce((acc, s) => new Set(Array.from(acc).filter((x) => s.has(x))));
}

/**
 * ⚠️ **空配列を `.in()` に渡さない。** PostgREST は「絞り込み無し」と解釈して
 *    **全件返す**（0件のはずが全件になる）。ダミーの id を1件渡す。
 */
function inList(ids: Set<string> | string[]): string[] {
  const arr = Array.isArray(ids) ? ids : Array.from(ids);
  return arr.length > 0 ? arr : [ZERO_UUID];
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

// ── 企業 ─────────────────────────────────────────────────────────────────────

export async function searchCompanyHits(conditions: Condition[]): Promise<KindResult<CompanyHit>> {
  const cond = pick(conditions, "company");
  const db = createPublicClient();

  /* 事業領域と職種は company_id の集合に解決してから `.in("id", …)` に載せる。
     ⚠️ **ユーザーの文字列を `ilike` に流さない**（interpretQuery の②）。 */
  const idSets: Set<string>[] = [];
  for (const c of cond) {
    /* 社名は既に ow_companies.id に解決済み（interpretQuery）。ここでは id で絞るだけ。
       ⚠️ 入力文字列を ilike に流す経路をここに作らないこと。 */
    if (c.kind === "company") idSets.push(new Set([c.companyId]));
    if (c.kind === "domain") {
      const { data, error } = await db
        .from("ow_company_business_domains")
        .select("company_id")
        .eq("domain_id", c.domainId);
      if (error) console.error("[searchCompanyHits] domain:", error.message);
      idSets.push(new Set((data ?? []).map((r) => r.company_id as string)));
    }
    if (c.kind === "role") {
      /* 「その職種の人がいる」または「その職種を募集している」企業。
         ⚠️ どちらか片方にすると、求人0件の企業（79社中78社）か
            在籍者0名の企業のどちらかが丸ごと落ちる。 */
      idSets.push(new Set(await companyIdsByRole(c.roleIds)));
    }
  }
  const idFilter = intersectAll(idSets);

  let q = filterListedCompanies(
    db.from("ow_companies").select(
      "id, slug, name, name_en, tagline, logo_url, logo_letter, logo_gradient, is_foreign",
      { count: "exact" },
    ),
  );
  const foreign = cond.find((c) => c.kind === "foreign");
  if (foreign && foreign.kind === "foreign") q = q.eq("is_foreign", foreign.isForeign);
  if (idFilter !== null) q = q.in("id", inList(idFilter));

  const { data, count, error } = await q.order("updated_at", { ascending: false }).limit(HIT_LIMIT);
  if (error) {
    console.error("[searchCompanyHits]", error.message);
    return { items: [], total: 0 };
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((r) => r.id as string);
  const [domains, jobCounts] = await Promise.all([primaryDomainByCompany(ids), jobCountByCompany(ids)]);

  return {
    items: rows.map((r) => ({
      id: r.id as string,
      slug: (r.slug as string | null) ?? null,
      name: companyDisplayName(r.name as string, r.name_en as string | null).displayName,
      tagline: (r.tagline as string | null) ?? null,
      logoUrl: (r.logo_url as string | null) ?? null,
      logoLetter: (r.logo_letter as string | null) ?? null,
      logoGradient: (r.logo_gradient as string | null) ?? null,
      isForeign: (r.is_foreign as boolean | null) === true,
      domain: domains.get(r.id as string) ?? null,
      jobCount: jobCounts.get(r.id as string) ?? 0,
    })),
    total: count ?? rows.length,
  };
}

/** その職種の在籍者がいる、または公開求人がある企業の id */
async function companyIdsByRole(roleIds: string[]): Promise<string[]> {
  const admin = createAdminClient();
  const tree = await getRoleTree();
  const want = new Set(roleIds);

  const [expRes, jobRoleRes] = await Promise.all([
    /* 在籍者。⚠️ admin で引くのは `login_only` の人の在籍も企業の絞り込みには
          使ってよいため（人そのものは出さない。企業が出るだけ）。 */
    admin.from("ow_experiences").select("company_id, role_category_id"),
    admin.from("ow_job_roles").select("job_id, role_id"),
  ]);
  if (expRes.error) console.error("[companyIdsByRole] experiences:", expRes.error.message);
  if (jobRoleRes.error) console.error("[companyIdsByRole] job_roles:", jobRoleRes.error.message);

  const out = new Set<string>();
  for (const e of expRes.data ?? []) {
    const cid = e.company_id as string | null;
    if (!cid) continue;
    const ids = expandWithAncestors(tree, e.role_category_id ? [e.role_category_id as string] : []);
    if (ids.some((id) => want.has(id))) out.add(cid);
  }

  const jobIds = new Set<string>();
  for (const jr of jobRoleRes.data ?? []) {
    const ids = expandWithAncestors(tree, [jr.role_id as string]);
    if (ids.some((id) => want.has(id))) jobIds.add(jr.job_id as string);
  }
  if (jobIds.size > 0) {
    const { data, error } = await admin
      .from("ow_jobs")
      .select("company_id")
      .in("id", Array.from(jobIds))
      .eq("status", "published")
      .eq("is_test", false);
    if (error) console.error("[companyIdsByRole] jobs:", error.message);
    for (const j of data ?? []) if (j.company_id) out.add(j.company_id as string);
  }
  return Array.from(out);
}

async function primaryDomainByCompany(companyIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (companyIds.length === 0) return out;
  const { data, error } = await createPublicClient()
    .from("ow_company_business_domains")
    .select("company_id, is_primary, ow_business_domains(name)")
    .in("company_id", companyIds)
    .order("display_order", { ascending: true });
  if (error) {
    console.error("[primaryDomainByCompany]", error.message);
    return out;
  }
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const cid = row.company_id as string;
    if (out.has(cid)) continue;
    const rel = row.ow_business_domains as { name?: string } | { name?: string }[] | null;
    const name = (Array.isArray(rel) ? rel[0] : rel)?.name;
    if (name) out.set(cid, name);
  }
  return out;
}

async function jobCountByCompany(companyIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (companyIds.length === 0) return out;
  const { data, error } = await createPublicClient()
    .from("ow_jobs")
    .select("company_id")
    .in("company_id", companyIds)
    .eq("status", "published")
    .eq("is_test", false);
  if (error) {
    console.error("[jobCountByCompany]", error.message);
    return out;
  }
  for (const j of data ?? []) {
    const cid = j.company_id as string;
    out.set(cid, (out.get(cid) ?? 0) + 1);
  }
  return out;
}

// ── 求人 ─────────────────────────────────────────────────────────────────────

export async function searchJobHits(conditions: Condition[]): Promise<KindResult<JobHit>> {
  const cond = pick(conditions, "job");
  const admin = createAdminClient();
  const tree = await getRoleTree();

  /* 掲載中の企業に限る。⚠️ 求人が published でも企業が非掲載なら出さない。 */
  const { data: compRows, error: compErr } = await filterListedCompanies(
    admin.from("ow_companies").select("id, slug, name, name_en, is_foreign"),
  );
  if (compErr) console.error("[searchJobHits] companies:", compErr.message);
  const companies = new Map(
    ((compRows ?? []) as Record<string, unknown>[]).map((c) => [c.id as string, c]),
  );

  const companySets: Set<string>[] = [];
  for (const c of cond) {
    if (c.kind === "company") companySets.push(new Set([c.companyId]));
    if (c.kind === "foreign") {
      companySets.push(
        new Set(
          Array.from(companies.values())
            .filter((r) => ((r.is_foreign as boolean | null) === true) === c.isForeign)
            .map((r) => r.id as string),
        ),
      );
    }
    if (c.kind === "domain") {
      const { data, error } = await admin
        .from("ow_company_business_domains")
        .select("company_id")
        .eq("domain_id", c.domainId);
      if (error) console.error("[searchJobHits] domain:", error.message);
      companySets.push(new Set((data ?? []).map((r) => r.company_id as string)));
    }
  }
  const allowedCompanies = intersectAll(companySets);

  const roleConds = cond.filter((c) => c.kind === "role") as Extract<Condition, { kind: "role" }>[];
  const roleJobSets: Set<string>[] = [];
  if (roleConds.length > 0) {
    const { data, error } = await admin.from("ow_job_roles").select("job_id, role_id");
    if (error) console.error("[searchJobHits] job_roles:", error.message);
    const byJob = new Map<string, string[]>();
    for (const r of data ?? []) {
      const jid = r.job_id as string;
      byJob.set(jid, [...(byJob.get(jid) ?? []), r.role_id as string]);
    }
    for (const rc of roleConds) {
      const want = new Set(rc.roleIds);
      const matched = new Set<string>();
      byJob.forEach((ids, jid) => {
        if (expandWithAncestors(tree, ids).some((id) => want.has(id))) matched.add(jid);
      });
      roleJobSets.push(matched);
    }
  }
  const roleJobIds = intersectAll(roleJobSets);

  let q = admin
    .from("ow_jobs")
    .select("id, slug, title, company_id, salary_min, salary_max, work_style, location", {
      count: "exact",
    })
    .eq("status", "published")
    .eq("is_test", false);

  const salary = cond.find((c) => c.kind === "salaryMin");
  if (salary && salary.kind === "salaryMin") q = q.gte("salary_min", salary.man);
  if (roleJobIds !== null) q = q.in("id", inList(roleJobIds));
  /* 掲載中の企業に限る。条件で更に絞られていればその積を使う。 */
  q = q.in("company_id", inList(allowedCompanies ?? new Set(companies.keys())));

  const { data, count, error } = await q.order("updated_at", { ascending: false }).limit(HIT_LIMIT);
  if (error) {
    console.error("[searchJobHits]", error.message);
    return { items: [], total: 0 };
  }
  const items: JobHit[] = ((data ?? []) as Record<string, unknown>[]).map((j) => {
    const c = companies.get(j.company_id as string);
    return {
      id: j.id as string,
      slug: (j.slug as string | null) ?? null,
      title: j.title as string,
      companyName: c
        ? companyDisplayName(c.name as string, c.name_en as string | null).displayName
        : "—",
      companySlug: (c?.slug as string | null) ?? null,
      salaryMin: (j.salary_min as number | null) ?? null,
      salaryMax: (j.salary_max as number | null) ?? null,
      workStyle: (j.work_style as string | null) ?? null,
      location: (j.location as string | null) ?? null,
    };
  });
  return { items, total: count ?? items.length };
}

// ── 人 ───────────────────────────────────────────────────────────────────────

type ExpRow = {
  user_id: string;
  is_current: boolean | null;
  started_at: string | null;
  role_category_id: string | null;
  visibility_company: string | null;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  ow_companies: { name: string | null; name_en: string | null } | null;
};

/**
 * 人を引く。**★対象は全職歴**（`/people` は現職1件だけだが、こちらは違う）。
 *
 * ⚠️ 「未経験でIT営業やった人」のような問いは**前職が条件に入る**ので、
 *    現職1件では定義上引けない。だから `/search` は `ow_experiences` を全件見る。
 *    そのぶんカードに出す職種と検索でヒットした職種がずれるので、
 *    `matchReason`（「◯◯ → フィールドセールス」）で必ず理由を1行出す。
 *
 * ── 未ログインの扱い ────────────────────────────────────────────────────────
 * `isLoggedIn === false` のとき **個票は返さない**（`items` は空）。
 * `total` は返すが、**画面側が `MIN_AGGREGATE_COUNT` 未満なら件数も出さない。**
 *
 * ⚠️ `total` には `login_only` の人も含める。含めないと未ログインでは
 *    常に 0 になり（実測: 38人中37人が `login_only`）、
 *    「ログインすると見られる」という案内が成立しない。
 *    個票を出さないこと＋下限3件でプライバシーを担保する。
 * ⚠️ `private` / `is_test` / `is_system` は**ログイン有無に関わらず常に除外**。
 */
export async function searchPersonHits(
  conditions: Condition[],
  isLoggedIn: boolean,
): Promise<KindResult<PersonHit>> {
  const cond = pick(conditions, "person");
  const db = createAdminClient();
  const tree = await getRoleTree();

  const [userRes, expRes, foreignRes, domainRes] = await Promise.all([
    db.from("ow_users").select("id, name, avatar_color, avatar_url, visibility, is_test, is_system"),
    db
      .from("ow_experiences")
      .select(
        `user_id, is_current, started_at, role_category_id, visibility_company, ${EXPERIENCE_COMPANY_COLS}`,
      ),
    db.from("ow_companies").select("id, is_foreign"),
    db.from("ow_company_business_domains").select("company_id, domain_id"),
  ]);
  for (const [label, res] of Object.entries({
    users: userRes, experiences: expRes, companies: foreignRes, domains: domainRes,
  })) {
    if (res.error) console.error(`[searchPersonHits] ${label}:`, res.error.message);
  }

  const foreignById = new Map(
    ((foreignRes.data ?? []) as { id: string; is_foreign: boolean | null }[]).map((c) => [
      c.id,
      c.is_foreign === true,
    ]),
  );
  const domainsByCompany = new Map<string, Set<string>>();
  for (const d of (domainRes.data ?? []) as { company_id: string; domain_id: string }[]) {
    const s = domainsByCompany.get(d.company_id) ?? new Set<string>();
    s.add(d.domain_id);
    domainsByCompany.set(d.company_id, s);
  }

  const expsByUser = new Map<string, ExpRow[]>();
  for (const e of (expRes.data ?? []) as unknown as ExpRow[]) {
    expsByUser.set(e.user_id, [...(expsByUser.get(e.user_id) ?? []), e]);
  }

  type UserRow = {
    id: string; name: string | null; avatar_color: string | null; avatar_url: string | null;
    visibility: string | null; is_test: boolean | null; is_system: boolean | null;
  };
  const candidates = ((userRes.data ?? []) as UserRow[]).filter(
    (u) => u.name && !u.is_test && !u.is_system && u.visibility !== "private",
  );

  const hits: PersonHit[] = [];
  for (const u of candidates) {
    const exps = [...(expsByUser.get(u.id) ?? [])].sort((a, b) =>
      (a.started_at ?? "").localeCompare(b.started_at ?? ""),
    );
    /* ── ★AND は2段。**意味が違うので混ぜないこと** ───────────────────────────

       ① 職歴側（`matchOn: "experience"`）
            **1つの職歴が、職歴側の条件を全部満たすこと。**
            「CTC で**インサイドセールスをしていた**人」の意味になる。

          ⚠️ 「条件ごとに、それを満たす職歴がどれか1つある」ではない。
             それだと「CTC にいたことがあり、かつ**どこかで**インサイドセールスを
             した人」になる。2026-08-27 まではこちらだった。
             実測で `ctcのインサイドセールスの人` に木村さんが1件出ていたが、
             あの人の IS は Salesforce で、CTC では ES。**誤った1件**だった。

       ② 人側（`matchOn: "person"`）
            **その人自身が満たすこと。職歴とは無関係。**
            スキルのように「いつ・どこで」に紐づかないものがここに来る。

       ⚠️ ①を②と同じ「その人のどこかが満たす」に緩めないこと。
          職歴は「いつ・どこで」を持つので、束ねて判定すると上のような誤りが出る
          （同じ人の別々の時期をつなぎ合わせてしまう）。 */
    const expConds = cond.filter((c) => c.matchOn === "experience");
    const personConds = cond.filter((c) => c.matchOn === "person");

    /* ① 職歴側。⚠️ 条件が無いときは空にしておく。`[].every()` は true なので、
          そのまま filter すると**全職歴が「マッチした職歴」になり**、
          下のマッチ理由が的外れな職歴から作られる。 */
    const matchedExps =
      expConds.length > 0
        ? exps.filter((e) =>
            expConds.every((c) => experienceMatches(e, c, tree, foreignById, domainsByCompany)),
          )
        : [];
    if (expConds.length > 0 && matchedExps.length === 0) continue;

    // ② 人側
    if (!personConds.every((c) => personMatches(u.id, c))) continue;

    /* `exps` は started_at 昇順なので `matchedExps` もその順序を保つ */
    const earliestMatch: ExpRow | null = matchedExps[0] ?? null;
    const latestMatch: ExpRow | null =
      matchedExps.length > 0 ? matchedExps[matchedExps.length - 1] : null;
    /* 条件が1つも無い（全部 unresolved だった）ときは、職歴を持つ人だけを出す。
       ⚠️ 全員返すと「検索した意味が無い一覧」になる。 */
    if (cond.length === 0 && exps.length === 0) continue;

    hits.push({
      userId: u.id,
      name: u.name as string,
      initial: (u.name as string).charAt(0),
      gradient: u.avatar_color?.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT,
      avatarUrl: u.avatar_url,
      currentLabel: resolveExperienceCompanyLabel(exps.find((e) => e.is_current) ?? null),
      matchReason: buildMatchReason(exps, earliestMatch, latestMatch, tree, personConds),
    });
  }

  return {
    items: isLoggedIn ? hits.slice(0, HIT_LIMIT) : [],
    total: hits.length,
  };
}

/**
 * ★人に当てる条件（`matchOn: "person"`）。**職歴とは無関係に、その人自身を見る。**
 *
 * ⚠️ **いまは該当する条件が1つも無い**（既存5種はすべて `matchOn: "experience"`）。
 *    2026-08-27 に構造だけ用意した。スキルを入れるときにここが埋まる
 *    （docs/phase0-skills-20260827.md）。
 *
 * ⚠️ **未知の条件は false（＝その人を落とす）。** true に倒すと、
 *    実装し忘れた条件が「全員が満たしている」ことになって静かに素通りする。
 *    0件になれば気づけるが、全件返ると気づけない。
 */
function personMatches(_owUserId: string, c: Condition): boolean {
  switch (c.kind) {
    /* 職歴に当てる条件がここへ来るのは呼び出し側の分け方の誤り。
       黙って通さずに落とす。 */
    case "company":
    case "role":
    case "domain":
    case "foreign":
    case "salaryMin":
      return false;
    default:
      return false;
  }
}

function experienceMatches(
  e: ExpRow,
  c: Condition,
  tree: Awaited<ReturnType<typeof getRoleTree>>,
  foreignById: Map<string, boolean>,
  domainsByCompany: Map<string, Set<string>>,
): boolean {
  if (c.kind === "role") {
    const ids = expandWithAncestors(tree, e.role_category_id ? [e.role_category_id] : []);
    return ids.some((id) => c.roleIds.includes(id));
  }
  if (c.kind === "foreign") {
    /* ⚠️ 社名を伏せている経歴（hidden）は判定から外す。
          伏せた経歴から在籍企業が推測できてしまうため（directory.ts と同じ扱い）。 */
    if (e.visibility_company === "hidden") return false;
    if (!e.company_id) return false;
    return (foreignById.get(e.company_id) ?? false) === c.isForeign;
  }
  if (c.kind === "domain") {
    if (e.visibility_company === "hidden") return false;
    if (!e.company_id) return false;
    return domainsByCompany.get(e.company_id)?.has(c.domainId) ?? false;
  }
  if (c.kind === "company") {
    /* ⚠️ 社名を伏せている経歴（hidden）は判定から外す。
          「Salesforce で働いている人」で出てしまうと、伏せた在籍が露見する。 */
    if (e.visibility_company === "hidden") return false;
    return e.company_id === c.companyId;
  }
  return false; // salaryMin は appliesTo で除外済み
}

/**
 * ★「なぜこの人が出たか」の1行。
 *
 *   条件が2つ以上の職歴に当たった  → 「美容師 → フィールドセールス」（古い→新しい）
 *   1つだけ当たった                → 「{直前の在籍先} → {その職種}」
 *   直前が無い（最初の職歴）        → 「新卒 → {その職種}」
 *
 * ⚠️ 会社名は `resolveExperienceCompanyLabel` を通す。`visibility_company` が
 *    hidden の職歴の社名をここで漏らさないため（masked は「非公開」になる）。
 */
function buildMatchReason(
  exps: ExpRow[],
  earliest: ExpRow | null,
  latest: ExpRow | null,
  tree: Awaited<ReturnType<typeof getRoleTree>>,
  personConds: Condition[],
): string | null {
  /* ★職歴側の条件が1つも当たっていないとき（人側の条件だけで出た人）。
     ⚠️ 職歴から理由を作れないので、**当たった条件そのもの**を並べる。
        例: スキルだけで引いたら「Salesforce・MEDDIC」。
     ⚠️ ここを null に倒さないこと。理由の無いカードは、なぜ出たのか分からない
        （`/search` の人カードは理由の1行が要るという前提で作ってある）。
     ⚠️ ラベルはマスタ由来（`Condition.label`）。入力文字列は出さない。 */
  if (!earliest) {
    if (personConds.length > 0) return personConds.map((c) => c.label).join("・");
    return null;
  }
  const roleName = (e: ExpRow) =>
    (e.role_category_id ? tree.byId.get(e.role_category_id)?.name : null) ?? null;

  if (latest && latest !== earliest) {
    const a = roleName(earliest);
    const b = roleName(latest);
    if (a && b && a !== b) return `${a} → ${b}`;
  }
  const to = roleName(earliest);
  if (!to) return null;
  const idx = exps.indexOf(earliest);
  const prev = idx > 0 ? exps[idx - 1] : null;
  const from = prev ? resolveExperienceCompanyLabel(prev) : "新卒";
  return from ? `${from} → ${to}` : to;
}

// ── まとめて引く ─────────────────────────────────────────────────────────────

export async function runSearch(
  conditions: Condition[],
  isLoggedIn: boolean,
): Promise<SearchResults> {
  const [company, job, person] = await Promise.all([
    searchCompanyHits(conditions),
    searchJobHits(conditions),
    searchPersonHits(conditions, isLoggedIn),
  ]);
  return { company, job, person };
}
