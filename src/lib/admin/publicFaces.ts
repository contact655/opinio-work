import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyEmployees, getPublicAmbassadorsCached } from "@/lib/supabase/queries";
import { getDirectoryPeople } from "@/lib/people/directory";
import { filterVisibleCompaniesStrict } from "@/lib/companies/visibility";

/**
 * 「いま公開面に出ている人」を1つの表にまとめる（2026-08-26）。
 *
 * ── なぜ作ったか ────────────────────────────────────────────────────────────
 * 2026-08-26 に、社内の検証用アカウント12件が `is_test = false` のまま残っていて、
 * **セールスフォース・ジャパンの企業ページに3件が実在の人物として出ていた**
 * （山田 三郎 / 山田 25 / 相川 隆二。うち1件は面談対応者として「話を聞ける人」）。
 * 2週間気づかれなかった。理由は単純で、**「いま誰が公開面に出ているか」を
 * 見られる場所が無かった**ため。
 *
 * ⚠️★**`is_test` を条件にした自動チェックでは、この事故は原理的に検出できない。**
 *    事故の中身は「テストなのにフラグが立っていない」であって、
 *    フラグを信じる検査は必ず素通りする。**だから人が目で見る一覧にする。**
 *    メールと登録日を出しているのはそのため —— `contact+17@opinio.co.jp` が
 *    並んでいれば、名前を見なくても1秒で分かる。
 *
 * ⚠️ **判定を書き写さない。** 公開ページが実際に使っている関数
 *    （`getCompanyEmployees` / `getPublicAmbassadorsCached` / `getDirectoryPeople`）を
 *    そのまま呼ぶ。ここに条件を書くと、公開側を直したときにこの一覧だけ古くなり、
 *    **「一覧はきれいなのに実際は出ている」**という最悪の形になる。
 *    （CLAUDE.md「判定は `findPublishBlockers`（ゲートと同じ条件関数）を呼ぶ」と同じ考え方）
 *
 * ⚠️ **失敗したら `null` を返す。空配列に倒さない。**
 *    0件と「取得できていない」は別物で、後者を0件として見せると
 *    **壊れているのに正常に見える**（CLAUDE.md「403 は『0件』として静かに素通りする」）。
 */

export type PublicFacePlace = {
  /** どこに出ているか。企業名 or "/people" */
  where: string;
  /** 現役社員 / OB・OG / 面談対応者 / ユーザー一覧 */
  as: string;
};

export type PublicFace = {
  userId: string;
  name: string;
  /** ⚠️ 運営が「見覚えのないアカウントか」を判断する主材料。**落とさないこと。** */
  email: string | null;
  createdAt: string | null;
  isTest: boolean;
  visibility: string | null;
  places: PublicFacePlace[];
};

export async function getPublicFaces(): Promise<PublicFace[] | null> {
  const admin = createAdminClient();

  /* ① 対象の企業。**「詳細ページが見えるか」で絞る。`listing_status` ではない。**
        ⚠️ 一度 `listing_status = 'listed'` で絞って間違えた。CLAUDE.md のとおり
           **企業ページは作られた時点で見え、運営が決めるのは一覧掲載だけ**なので、
           `draft` の企業のページにも人は出る（大塚さんの海光電業がまさにこれ）。
           `listed` で絞ると**その人たちが一覧から抜け落ちる**。
        ⚠️ **`filterVisibleCompaniesStrict` を使う**（`.eq("is_published", true)` を直書きしない）。
           `filterVisibleCompanies` のほうは **dev で素通りする**ので、
           ローカルと本番で違う結果になり、確認にならない。
        ⚠️ 79社すべてを回さない。人が紐づいている企業だけで足りる。 */
  const [{ data: companies, error: cErr }, { data: expRows, error: eErr }, { data: memRows, error: mErr }] =
    await Promise.all([
      filterVisibleCompaniesStrict(admin.from("ow_companies").select("id, name")),
      admin.from("ow_experiences").select("company_id").not("company_id", "is", null),
      admin.from("ow_company_members").select("company_id").eq("is_public", true).eq("display_consent", true),
    ]);

  if (cErr || eErr || mErr) {
    console.error("[getPublicFaces]", (cErr ?? eErr ?? mErr)!.message);
    return null;
  }

  const nameById = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  const targets = new Set<string>();
  for (const r of [...(expRows ?? []), ...(memRows ?? [])]) {
    const id = (r as { company_id: string | null }).company_id;
    if (id && nameById.has(id)) targets.add(id);
  }

  const byUser = new Map<string, PublicFacePlace[]>();
  const add = (userId: string, place: PublicFacePlace) => {
    const list = byUser.get(userId) ?? [];
    if (!list.some((p) => p.where === place.where && p.as === place.as)) list.push(place);
    byUser.set(userId, list);
  };

  /* ② 企業ページ。**公開ページと同じ関数**を呼ぶ（条件を書き写さない） */
  try {
    for (const companyId of Array.from(targets)) {
      const where = nameById.get(companyId)!;
      const [emps, ambassadors] = await Promise.all([
        getCompanyEmployees(companyId),
        getPublicAmbassadorsCached(companyId),
      ]);
      for (const e of emps.current) add(e.userId, { where, as: "現役社員" });
      for (const e of emps.alumni) add(e.userId, { where, as: "OB・OG" });
      for (const a of ambassadors) add(a.user_id, { where, as: "面談対応者" });
    }

    /* ③ ユーザー一覧（/people）。ここも同じ関数を呼ぶ。
          ⚠️ 引数は「ログインしているか」。**未ログインで見える人は必ずログインでも見える**ので、
             広いほう（true）で取る。狭いほうで取ると「一覧に出ているのに一覧に出ていない」
             と読める表になる。 */
    const people = await getDirectoryPeople(true);
    for (const p of people) add(p.userId, { where: "/people", as: "ユーザー一覧" });
  } catch (err) {
    console.error("[getPublicFaces] 公開側の関数で失敗:", err);
    return null;
  }

  const userIds = Array.from(byUser.keys());
  if (userIds.length === 0) return [];

  const { data: users, error: uErr } = await admin
    .from("ow_users")
    .select("id, name, email, created_at, is_test, visibility")
    .in("id", userIds);

  if (uErr) {
    console.error("[getPublicFaces] ow_users:", uErr.message);
    return null;
  }

  const faces: PublicFace[] = (users ?? []).map((u) => ({
    userId: u.id as string,
    name: (u.name as string | null) ?? "(名前なし)",
    email: (u.email as string | null) ?? null,
    createdAt: (u.created_at as string | null) ?? null,
    isTest: (u.is_test as boolean | null) === true,
    visibility: (u.visibility as string | null) ?? null,
    places: byUser.get(u.id as string) ?? [],
  }));

  /* 出ている場所が多い順 → 新しい順。**新しく現れた人が上に来る**ようにする
     （今日の事故は「昨日いきなり面談対応者に載った」形だった） */
  faces.sort(
    (a, b) =>
      b.places.length - a.places.length ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  return faces;
}
