import { createAdminClient } from "@/lib/supabase/admin";
import { isRegisteredUser } from "@/lib/users/registered";

/**
 * 登録経路（`?ref=`）ごとのファネル。**運営専用。**
 *
 * ⚠️★**条件を画面側に書き写さないこと。** 「企業ページで見える」は
 *    `getCompanyEmployees` の除外条件と `is_published` の組み合わせで、
 *    ずれると**数字が嘘になる**。判定はここ1箇所に置く。
 *
 * ⚠️★**`is_test` / `is_system` / `auth_id IS NULL` を除く。**
 *    実ユーザーの定義は `lib/users/registered.ts` と同じ軸に揃えてある
 *    （CLAUDE.md「本人が登録していない行を出さない」）。
 *    ⚠️ 除外していることは**画面にも書く**（数字の意味が変わるため）。
 *
 * ⚠️ `signup_ref` は列単位 GRANT を配っていないので、**必ず admin クライアント**で引く。
 *    セッションのクライアントで select に混ぜるとクエリごと 403 になる。
 */
export type SignupRefRow = {
  /** `null` は「直接・不明」。⚠️ 「効果が無かった」ではない */
  ref: string | null;
  registered: number;
  onboarded: number;
  hasExperience: number;
  visibleOnCompanyPage: number;
};

export async function getSignupRefFunnel(): Promise<SignupRefRow[] | null> {
  const db = createAdminClient();

  /* ⚠️ `auth_id` / `is_test` / `is_system` / `visibility` を select から落とさないこと。
        落とすと `undefined` になり、**除外が静かに効かなくなる**（型では気づけない）。 */
  const { data: users, error: usersErr } = await db
    .from("ow_users")
    .select("id, auth_id, is_test, is_system, visibility, signup_ref");
  if (usersErr) {
    console.error("[signupRefFunnel] ow_users:", usersErr.message);
    return null;
  }

  const real = (users ?? []).filter(
    (u) => u.is_test !== true && u.is_system !== true && isRegisteredUser(u),
  );
  if (real.length === 0) return [];

  const authIds = real.map((u) => u.auth_id as string);
  const userIds = real.map((u) => u.id as string);

  const [{ data: profiles, error: profErr }, { data: exps, error: expErr }] = await Promise.all([
    db.from("ow_profiles").select("user_id, onboarding_completed").in("user_id", authIds),
    /* 経歴は「あるか」と「公開企業のものがあるか」の2つを知りたいだけなので、
       会社の公開状態を埋め込みで一緒に取る（N+1 にしない）。 */
    db
      .from("ow_experiences")
      .select("user_id, company_id, ow_companies!company_id(is_published)")
      .in("user_id", userIds),
  ]);
  if (profErr) console.error("[signupRefFunnel] ow_profiles:", profErr.message);
  if (expErr) console.error("[signupRefFunnel] ow_experiences:", expErr.message);

  const onboardedAuthIds = new Set(
    (profiles ?? []).filter((p) => p.onboarding_completed === true).map((p) => p.user_id as string),
  );

  const withExperience = new Set<string>();
  const withPublishedCompany = new Set<string>();
  for (const e of exps ?? []) {
    const uid = e.user_id as string;
    withExperience.add(uid);
    const co = e.ow_companies as { is_published?: boolean | null } | null;
    if (e.company_id && co?.is_published === true) withPublishedCompany.add(uid);
  }

  const byRef = new Map<string | null, SignupRefRow>();
  for (const u of real) {
    const ref = (u.signup_ref as string | null) ?? null;
    const row = byRef.get(ref) ?? {
      ref, registered: 0, onboarded: 0, hasExperience: 0, visibleOnCompanyPage: 0,
    };
    row.registered += 1;
    if (onboardedAuthIds.has(u.auth_id as string)) row.onboarded += 1;
    if (withExperience.has(u.id as string)) row.hasExperience += 1;
    /* ★「企業ページで見える」= 公開企業の経歴があり、かつ本人が非公開にしていない。
          ⚠️ `visibility === 'private'` を落とすのは `getCompanyEmployees` と同じ条件。 */
    if (withPublishedCompany.has(u.id as string) && u.visibility !== "private") {
      row.visibleOnCompanyPage += 1;
    }
    byRef.set(ref, row);
  }

  /* 並び: 登録の多い順。⚠️ NULL（直接・不明）は**最後に固定**する
     （数が多くても「経路」ではないので、上に来ると表が読みにくい）。 */
  return Array.from(byRef.values()).sort((a, b) => {
    if (a.ref === null) return 1;
    if (b.ref === null) return -1;
    return b.registered - a.registered || a.ref.localeCompare(b.ref);
  });
}
