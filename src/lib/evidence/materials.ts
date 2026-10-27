/* ★サーバー専用。admin クライアントを使う */
import { readAll } from "@/lib/supabase/paging";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMoves, countMovesInto } from "@/lib/evidence/transitions";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";

/**
 * ★1社ぶんの「提案の根拠の材料」を数える（2026-10-10）。/biz/proposals の空状態に出す。
 *
 * | 数 | 何を数えるか | 提案（`lib/evidence/fetch.ts`）での扱い |
 * |---|---|---|
 * | `path` | 御社に移ってきた方（隣接する職歴で会社が変わった人。職種で絞らない） | 同じ関数 `countMovesInto`。提案では候補者の職種で絞る |
 * | `motive` | 入社の決め手を答えた職歴（**在籍中と退職済みの両方**） | 同じ条件（`join_reasons` が1件以上） |
 * | `jobs` | 公開中の求人（2026-10-10） | 「求人の職種」の材料。★`getCompanyCandidateTouchpoints` と同じ条件（公開中・検証用かどうかが企業と同じ） |
 * | `roles` | 職種マスタに紐づいた部門・職種（2026-10-10） | 「部門と職種」の材料。★同じく touchpoints と同じ条件（削除していない・`standard_role_id` あり） |
 *
 * ★数えてよい人の判定は `lib/aggregate/population.ts` の `isAggregatableUser`（2026-10-26 に3か所の写しをまとめた）
 *    ＋ 職歴を「非表示」にしていない。
 * ⚠️ 企業資料の項目は数えない（いまは提案の根拠に使われていない。AI で読むのは規約の改定が施行されてから。docs/proposals-fit-20261010.md）。
 * ⚠️ 取得に失敗したら null（画面は「—」。0 と出さない）。
 */
export type EvidenceMaterials = { path: number; motive: number; jobs: number; roles: number };

type ExpRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  role_category_id: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  join_reasons: string[] | null;
  visibility_company: string | null;
  ow_users: AggregateUser | null;
};

/* ★数えてよい人は `isAggregatableUser`（統計利用を停止した人も外す。2026-10-26） */
function visible(e: ExpRow): boolean {
  return isAggregatableUser(e.ow_users) && e.visibility_company === "real" /* ★2026-10-27: 会社名を伏せた行（masked）も外す。出してよいのは 'real' だけ（hidden だけ外していた） */;
}

export async function getEvidenceMaterials(companyId: string): Promise<EvidenceMaterials | null> {
  const db = createAdminClient();
  const { data: co, error: coErr } = await db.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle();
  if (coErr || !co) {
    console.error("[evidence/materials] ow_companies:", coErr?.message ?? "not found");
    return null;
  }
  const [{ data: expRows, error: expErr }, { count: jobs, error: jobErr }, { count: roles, error: roleErr }] = await Promise.all([
    /* ⚠️ 移ってきた方は「前の会社 → 御社」の隣接ペアなので、御社以外の職歴も要る（全件を引く。
          `/admin/evidence-gaps` と同じ。2026-10-10 時点で数十行） */
    /* ★1,000行ずつ最後まで読む（2026-10-22。1,000行で黙って切れるため） */
    readAll("evidence/materials experiences", (f, t) => db.from("ow_experiences")
      .select(`id, user_id, company_id, company_text, role_category_id, started_at, ended_at, is_current, join_reasons, visibility_company, ow_users!user_id(${AGGREGATE_USER_COLUMNS})` as const)
      .order("id")
      .range(f, t)),
    db.from("ow_jobs").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "published").eq("is_test", co.is_test === true),
    db.from("ow_company_job_roles").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null).not("standard_role_id", "is", null),
  ]);
  if (expErr || jobErr || roleErr || jobs == null || roles == null) {
    console.error("[evidence/materials]", expErr?.message ?? jobErr?.message ?? roleErr?.message ?? "count is null");
    return null;
  }
  const exps = ((expRows ?? []) as unknown as ExpRow[]).filter(visible);

  const moves = buildMoves(exps.map((e) => ({
    id: e.id,
    user_id: e.user_id,
    company_id: e.company_id,
    company_text: e.company_text,
    role_category_id: e.role_category_id,
    started_at: e.started_at,
    ended_at: e.ended_at,
    is_current: e.is_current,
  })));
  const path = countMovesInto(moves, companyId).total;

  const atCompany = exps.filter((e) => e.company_id === companyId);
  const motive = atCompany.filter((e) => (e.join_reasons?.length ?? 0) > 0).length;
  return { path, motive, jobs, roles };
}
