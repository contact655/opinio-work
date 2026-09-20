/**
 * `computeAutoSkills` にサーバー側で材料を集める入口（2026-08-29）。
 *
 * ⚠️★**呼び出し側でこの組み立てを書き写さないこと。** `/u/[id]` と `/mypage` の
 *    2画面が同じ値を出す必要があり、片方だけ職種の親フォールバックを忘れると
 *    **同じ人のプロフィールが画面によって違うスキルを出す。**
 *
 * ⚠️ 事業領域は `is_primary` の1件だけを使う（複数持つ企業がある）。
 *    主が無ければその企業は業界の集計に入れない —— **「その他」で埋めない。**
 */
import { computeAutoSkills, type AutoSkill, type AutoSkillExperience } from "./autoSkills";
import { fetchBusinessDomainsByCompany } from "@/lib/supabase/queries";

/** 職歴の行のうち、ここで使う分だけ。⚠️ 呼び出し側の型に依存させない */
export type AutoSkillSourceRow = {
  company_id?: string | null;
  role_category_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

/** 職種マスタ。`/u/[id]` が既に作っている `roleInfoById` と同じ形 */
export type RoleInfo = { name: string; parent_name: string | null };

export async function buildAutoSkills(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  rows: AutoSkillSourceRow[],
  roleInfoById: Map<string, RoleInfo>,
  label: string,
): Promise<AutoSkill[]> {
  const companyIds = Array.from(
    new Set(rows.map((r) => r.company_id).filter((v): v is string => !!v)),
  );
  /* ⚠️ 失敗しても空 Map が返る（`fetchBusinessDomainsByCompany` が error をログに出す）。
        その場合は業界スキルが出ないだけで、職種スキルは出る。**握りつぶしていない。** */
  const domainsByCompany = await fetchBusinessDomainsByCompany(db, companyIds, label);

  const input: AutoSkillExperience[] = rows.map((r) => {
    const role = r.role_category_id ? roleInfoById.get(r.role_category_id) : undefined;
    const primary = r.company_id
      ? (domainsByCompany.get(r.company_id) ?? []).find((d) => d.is_primary)
      : undefined;
    return {
      started_at: r.started_at ?? null,
      ended_at: r.ended_at ?? null,
      roleName: role?.name ?? null,
      roleParentName: role?.parent_name ?? null,
      domainName: primary?.name ?? null,
    };
  });
  return computeAutoSkills(input);
}

/**
 * ★職種ぶんだけを出す版（2026-09-20 / `/biz/candidates` のカード用）。
 *
 * ── ⚠️★なぜ事業領域を出さないか ───────────────────────────────────────────
 * 事業領域は **`company_id` から引く**ので、**本人が社名を伏せた職歴**
 * （`visibility_company` が `masked` / `hidden`）についても
 * 「AI・データ：3年以上」のような形で**隠した会社の属性が企業側に漏れる。**
 * 2026-09-10 に `/biz` 向けの3画面で同じ漏れを直したばかりなので、
 * **企業に見せる面では職種だけにする。**
 * ⚠️★**`domainName` を渡す形に変えないこと。** 渡すと上の漏れが復活する。
 *
 * ⚠️ `/u/[id]` と `/mypage`（本人と公開プロフィール）は `buildAutoSkills` のまま。
 *    **同じ人でも面によって出る内容が違う**が、これは意図した差。
 *
 * ⚠️ DB を引かないので**同期**。候補者N人ぶんをループで呼んでよい
 *    （`buildAutoSkills` は企業の事業領域を引くため N+1 になる）。
 */
export function buildRoleAutoSkills(
  rows: AutoSkillSourceRow[],
  roleInfoById: Map<string, RoleInfo>,
): AutoSkill[] {
  const input: AutoSkillExperience[] = rows.map((r) => {
    const role = r.role_category_id ? roleInfoById.get(r.role_category_id) : undefined;
    return {
      started_at: r.started_at ?? null,
      ended_at: r.ended_at ?? null,
      roleName: role?.name ?? null,
      roleParentName: role?.parent_name ?? null,
      /* ⚠️★ここを埋めないこと（上の注記）。 */
      domainName: null,
    };
  });
  return computeAutoSkills(input);
}
