import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows, inChunks } from "@/lib/supabase/paging";
import { companyDisplayName } from "@/lib/companies/displayName";
import { isRegisteredUser } from "@/lib/users/registered";
import type { CareerMovePerson, MoveCompany } from "@/components/people/CareerMovesSection";

/**
 * ★ホームの「◯◯から次に進んだ人」（2026-10-19 / 柴さんの判断。見本は /dev/preview/feed-redesign）。
 *   見ている人（ログイン中）の職歴から2つの欄を作る:
 *     A「〈いまの勤務先〉から次に進んだ人」 … その会社から別の会社へ移った人
 *     B「〈いまの職種〉から次に進んだ人」   … 同じ職種から別の会社へ移った人（A に出た人は除く）
 *
 * ⚠️★出すのは次をすべて満たす人と職歴だけ:
 *   - 本人が登録している（auth_id あり）・システムでない・公開範囲が private でない・見ている人と is_test が同じ
 *     （検証用と実在のあいだはメッセージを送れないので、出しても押せないボタンになる）
 *   - 移る前・移った先の**両方の職歴が「会社名を出す」（visibility_company = 'real'）**
 *     （公開プロフィールで社名が見えるのと同じ範囲。それ以外の社名をここから漏らさない）
 * ⚠️ 人数を「N人」と出さない（1〜2人の組み合わせがほとんどで、件数が個人を指すため）。
 * ⚠️ 失敗したら空（ホームのほかの部分は出す）。ログは出す。
 */
export type CareerMoveBlock = {
  key: "company" | "role";
  title: string;
  sub: string;
  hideFrom: boolean;
  /** メッセージの「会社のこと」のテーマに使う会社（移る前の会社） */
  people: (CareerMovePerson & { aboutCompanyId: string | null })[];
};

const PER_BLOCK = 4;

type Exp = {
  id: string; user_id: string; company_id: string | null; company_text: string | null;
  role_category_id: string | null; role_title: string | null; started_at: string | null; is_current: boolean; visibility_company: string | null;
};

function sameCompany(a: Exp, b: Exp): boolean {
  if (a.company_id && b.company_id) return a.company_id === b.company_id;
  if (!a.company_id && !b.company_id && a.company_text && b.company_text) return a.company_text.trim() === b.company_text.trim();
  return false;
}

export async function getCareerMoveBlocks(viewerOwId: string): Promise<CareerMoveBlock[]> {
  try {
    const db = createAdminClient();
    const [{ data: viewer, error: vErr }, { data: myExps, error: mErr }] = await Promise.all([
      db.from("ow_users").select("is_test").eq("id", viewerOwId).maybeSingle(),
      db.from("ow_experiences").select("company_id, role_category_id, is_current, started_at")
        .eq("user_id", viewerOwId).order("is_current", { ascending: false }).order("started_at", { ascending: false, nullsFirst: false }).limit(1),
    ]);
    if (vErr || mErr) { console.error("[careerMoves] viewer:", vErr?.message ?? mErr?.message); return []; }
    const mine = (myExps ?? [])[0] as { company_id: string | null; role_category_id: string | null; is_current: boolean } | undefined;
    if (!viewer || !mine) return [];
    const myCompanyId = mine.company_id;
    const myRoleId = mine.role_category_id;
    if (!myCompanyId && !myRoleId) return [];

    /* ① 移る前の候補（その会社・その職種にいた職歴）を持つ人 */
    const seeds: string[] = [];
    if (myCompanyId) {
      /* ★件数の上限で黙って切らない（2026-10-19。並びの無い .limit(500) で、誰が入るかが毎回違っていた） */
      const { data, error } = await fetchAllRows((from, to) => db.from("ow_experiences").select("id, user_id").eq("company_id", myCompanyId).eq("visibility_company", "real").order("id").range(from, to), "careerMoves by company");
      if (error) { console.error("[careerMoves] by company:", error); return []; }
      for (const r of data) seeds.push(r.user_id as string);
    }
    if (myRoleId) {
      const { data, error } = await fetchAllRows((from, to) => db.from("ow_experiences").select("id, user_id").eq("role_category_id", myRoleId).eq("visibility_company", "real").order("id").range(from, to), "careerMoves by role");
      if (error) { console.error("[careerMoves] by role:", error); return []; }
      for (const r of data) seeds.push(r.user_id as string);
    }
    const seedIds = Array.from(new Set(seeds)).filter((id) => id !== viewerOwId);
    if (seedIds.length === 0) return [];

    /* ② 人の条件 */
    /* ★id を分けて引く（何百もの id を1回で渡すと URL が長すぎて失敗する） */
    const { data: users, error: uErr } = await inChunks(seedIds, (part, from, to) => db.from("ow_users")
      .select("id, name, avatar_url, auth_id, is_test, is_system, visibility").in("id", part).order("id").range(from, to), "careerMoves users");
    if (uErr) { console.error("[careerMoves] users:", uErr); return []; }
    const okUsers = new Map(users
      .filter((u) => isRegisteredUser(u) && u.is_system !== true && u.visibility !== "private" && (u.is_test === true) === (viewer.is_test === true))
      .map((u) => [u.id as string, u]));
    if (okUsers.size === 0) return [];

    /* ③ その人たちの職歴をすべて引いて、隣り合う2社（移った）を作る */
    const { data: exps, error: eErr } = await inChunks(Array.from(okUsers.keys()), (part, from, to) => db.from("ow_experiences")
      .select("id, user_id, company_id, company_text, role_category_id, role_title, started_at, is_current, visibility_company")
      .in("user_id", part).order("id").range(from, to), "careerMoves experiences");
    if (eErr) { console.error("[careerMoves] experiences:", eErr); return []; }
    const byUser = new Map<string, Exp[]>();
    for (const e of exps as Exp[]) {
      if (!e.started_at) continue;
      byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e]);
    }
    type MoveRow = { userId: string; from: Exp; to: Exp; latest: Exp };
    const moves: MoveRow[] = [];
    byUser.forEach((list, userId) => {
      list.sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""));
      const latest = list.find((e) => e.is_current) ?? list[list.length - 1];
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i], b = list[i + 1];
        if (sameCompany(a, b)) continue;
        if (a.visibility_company !== "real" || b.visibility_company !== "real") continue;
        if (!(a.company_id || a.company_text) || !(b.company_id || b.company_text)) continue;
        moves.push({ userId, from: a, to: b, latest });
      }
    });

    const pickNewest = (rows: MoveRow[]) => {
      const best = new Map<string, MoveRow>();
      for (const m of rows) {
        const cur = best.get(m.userId);
        if (!cur || (m.to.started_at ?? "") > (cur.to.started_at ?? "")) best.set(m.userId, m);
      }
      return Array.from(best.values()).sort((a, b) => (b.to.started_at ?? "").localeCompare(a.to.started_at ?? "")).slice(0, PER_BLOCK);
    };
    const blockA = myCompanyId ? pickNewest(moves.filter((m) => m.from.company_id === myCompanyId)) : [];
    const inA = new Set(blockA.map((m) => m.userId));
    const blockB = myRoleId ? pickNewest(moves.filter((m) => m.from.role_category_id === myRoleId && !inA.has(m.userId))) : [];
    if (blockA.length === 0 && blockB.length === 0) return [];

    /* ④ 会社名・ロゴ・職種名 */
    const all = [...blockA, ...blockB];
    const companyIds = Array.from(new Set(all.flatMap((m) => [m.from.company_id, m.to.company_id, myCompanyId]).filter((x): x is string => !!x)));
    const roleIds = Array.from(new Set([...all.map((m) => m.latest.role_category_id), myRoleId].filter((x): x is string => !!x)));
    const [{ data: cos, error: cErr }, { data: roles, error: rErr }] = await Promise.all([
      inChunks(companyIds, (part, from, to) => db.from("ow_companies").select("id, name, name_en, logo_url").in("id", part).order("id").range(from, to), "careerMoves companies"),
      inChunks(roleIds, (part, from, to) => db.from("ow_roles").select("id, name").in("id", part).order("id").range(from, to), "careerMoves roles"),
    ]);
    if (cErr || rErr) { console.error("[careerMoves] names:", cErr ?? rErr); return []; }
    const coById = new Map(((cos ?? []) as { id: string; name: string; name_en: string | null; logo_url: string | null }[]).map((c) => [c.id, c]));
    const roleById = new Map(((roles ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
    const co = (e: Exp): MoveCompany => {
      const c = e.company_id ? coById.get(e.company_id) : undefined;
      if (c) return { name: companyDisplayName(c.name, c.name_en).displayName, logoUrl: c.logo_url };
      return { name: (e.company_text ?? "").trim(), logoUrl: null };
    };
    const toPerson = (m: MoveRow) => {
      const u = okUsers.get(m.userId)!;
      return {
        id: m.userId,
        href: `/u/${m.userId}`,
        name: (u.name as string | null) ?? "",
        avatarUrl: (u.avatar_url as string | null) ?? null,
        role: (m.latest.role_title ?? "").trim() || (m.latest.role_category_id ? roleById.get(m.latest.role_category_id) ?? null : null),
        from: co(m.from),
        to: co(m.to),
        movedYear: m.to.started_at ? Number(m.to.started_at.slice(0, 4)) : null,
        aboutCompanyId: m.from.company_id,
      };
    };

    const out: CareerMoveBlock[] = [];
    if (blockA.length > 0 && myCompanyId) {
      const c = coById.get(myCompanyId);
      const name = c ? companyDisplayName(c.name, c.name_en).displayName : "いまの勤務先";
      out.push({
        key: "company",
        title: `${name} から次に進んだ人`,
        sub: mine.is_current ? "いまの勤務先にいた人が、次にどこへ進んだか" : "前の勤務先にいた人が、次にどこへ進んだか",
        hideFrom: true,
        people: blockA.map(toPerson),
      });
    }
    if (blockB.length > 0 && myRoleId) {
      out.push({
        key: "role",
        title: `${roleById.get(myRoleId) ?? "同じ職種"}から次に進んだ人`,
        sub: "あなたと同じ職種の人のその後",
        hideFrom: false,
        people: blockB.map(toPerson),
      });
    }
    return out;
  } catch (e) {
    console.error("[careerMoves]", e);
    return [];
  }
}
