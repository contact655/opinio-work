import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OnboardingClient from "./OnboardingClient";
import { EXPERIENCE_EDITOR_COLS } from "@/lib/experiences/columns";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/onboarding");
  }

  /* 職種の選択肢。**トップレベルだけ**を出す。
     ⚠️ `ow_experiences.role_category_id` には親カテゴリの UUID をそのまま入れてよい
        （CLAUDE.md「オンボーディングの現状」）。求人ページ側の突き合わせも
        親↔子の両方向に対応済みなので、ここで細かい子職種まで選ばせる必要はない。
        入口の摩擦を増やすと、そもそも登録されない。
     ⚠️ `merged_into_id` がある行は統合済み、`is_active = false` は停止中。
        どちらも選択肢に出さない。 */
  /* ★子職種も渡す（2026-08-29 / 柴さんの判断）。**トップレベルだけに戻さないこと。**

     ── なぜ変えたか ────────────────────────────────────────────────────────
     職歴から「職種 × 年数」を自動で出すようにしたが、**その集計は子職種だけを見る**
     （親と子が並ぶと重複に見えるため）。ここが親しか出していないと、
     **新規登録した人は職種スキルが1件も出ない。**
     実測（2026-08-29）: `ow_experiences` 24件のうち **親職種が10件**。

     ⚠️ 入口の摩擦を増やさない形にしてある —— **親チップを押すとその子だけが開く。**
        子を選ばずに親のまま進んでもよい（保存は通る）。
     ⚠️ **154件をフラットに並べない。** 2026-08-06 に職歴エディタで
        「105件を目視で探させるUIが機能していなかった」と分かっている。 */
  const { data: roleRows, error } = await createAdminClient()
    .from("ow_roles")
    .select("id, name, parent_id, display_order, is_it_saas")
    .is("merged_into_id", null)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) console.error("[onboarding] ow_roles", error.message);

  /* ★職種の別名（2026-09-11）。**検索で当てるために要る。**
     ⚠️ 「法人営業」で フィールドセールス に当たらないと、標準職種の名前を知らない人が
        辿り着けない（`RoleSearchSelect` の冒頭コメント）。**全件渡す。**
     ⚠️ `/mypage` も同じ取り方をしている。片方だけ落とすと、同じ検索欄なのに
        オンボーディングだけ別名が効かない形になる。 */
  const { data: aliasRows, error: aliasErr } = await createAdminClient()
    .from("ow_role_aliases")
    .select("role_id, alias");
  if (aliasErr) console.error("[onboarding] ow_role_aliases", aliasErr.message);

  const roleAliases: Record<string, string[]> = {};
  for (const r of (aliasRows ?? []) as { role_id: string; alias: string }[]) {
    if (!roleAliases[r.role_id]) roleAliases[r.role_id] = [];
    roleAliases[r.role_id].push(r.alias);
  }

  /* ★大分類は IT/SaaS のビジネス職を前に出す（2026-09-11 / 柴さんの指示）。
     ⚠️★**DB の `display_order` は触らない。** 触ると職歴エディタ・求人フォーム・
        `/admin`・企業の組織図の並びが**全部**変わる。並べ替えはここ（UI 側）だけ。
     ⚠️ 区別は **`ow_roles.is_it_saas`**。新しい列も定数も作らない ——
        この列が引く線は「医療・建設・製造・教育・販売・金融・物流・公務」の8件と
        **完全に一致する**（2026-09-11 実測）。`/biz/candidates` も同じ列で絞っている。
     ⚠️★**外さないこと。並べ替えるだけ。** 配列から落とすと検索でも出なくなり、
        非IT職の経歴を持つ人が自分の職種に辿り着けない。
     ⚠️ 子の順序は触らない（親ごとの相対順。CLAUDE.md「2階層マスタの display_order」）。 */
  const rows = roleRows ?? [];
  const roots = rows.filter((r) => !r.parent_id);
  const children = rows.filter((r) => r.parent_id);
  const sortedRoots = [
    ...roots.filter((r) => r.is_it_saas === true),
    ...roots.filter((r) => r.is_it_saas !== true),
  ];

  const roles = [...sortedRoots, ...children].map((r) => ({
    id: r.id as string,
    name: r.name as string,
    parent_id: (r.parent_id as string | null) ?? null,
  }));

  /* ★★2回目に来た人のために、既存の「現職」を1件読む（2026-09-11）。
     ── なぜ飛ばさないか（柴さんの判断）────────────────────────────────────
     飛ばすと、**自分が何を入れたか分からないまま2画面目に立たされる。**
     読み込めば確認して直せる。

     ⚠️★**対象は「`is_current` のうち `started_at` が最新の1件」。**
        ⚠️ 実測（2026-09-11 / 本番）で**一意に決まらない人が1人いた**
           （相川 隆二・`is_test`。同じ `started_at` の現職が2件＝副業のような並行在籍）。
           **実ユーザーには0人。** それでも決まらない日が来るので、
           `created_at` の新しい順、最後に `id` で**必ず1件に定める**。
           ⚠️★**タイブレークを外さないこと。** 同着のまま `limit(1)` を掛けると、
              **どちらが返るかが実行ごとに変わりうる**（Postgres は順序を保証しない）。
              2回目に来るたび読み込まれる職歴が入れ替わり、**更新先まで入れ替わる。**
              ⚠️ 並び順に決定的なタイブレークが無くて順序が揺れる問題は 2026-08 に踏んでいる。
        ⚠️ 並行在籍のもう1件は**触らない**。読み込んだ1件だけを更新する。
     ⚠️ `EXPERIENCE_EDITOR_COLS` を使う（列を足したときに4箇所を揃える規約）。 */
  const { data: owUser } = await createAdminClient()
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();

  let currentExperience: Record<string, unknown> | null = null;
  if (owUser?.id) {
    const { data: rows, error: expErr } = await createAdminClient()
      .from("ow_experiences")
      .select(EXPERIENCE_EDITOR_COLS)
      .eq("user_id", owUser.id as string)
      .eq("is_current", true)
      .order("started_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    if (expErr) console.error("[onboarding] ow_experiences", expErr.message);
    currentExperience = (rows?.[0] as Record<string, unknown> | undefined) ?? null;

    /* ★★マスタ紐づけの会社は**名前と掲載状態も渡す**（2026-09-11）。
       ⚠️★これが無いと、2回目に来た人の会社欄が**空のまま**になる
          （`company_id` しか無いので画面に出せない）。しかも1画面目は
          会社が決まるまで職種・入社年月を出さないので、**全部が空に見える。**
       ⚠️ `CompanyLookupResult` と同じ形（`id` / `name` / `isListed`）にする。
          ⚠️ 形を変えると `CompanyPicker` が受け取れない。 */
    const cid = currentExperience?.company_id;
    if (typeof cid === "string") {
      const { data: co } = await createAdminClient()
        .from("ow_companies").select("id, name, listing_status").eq("id", cid).maybeSingle();
      if (co) {
        currentExperience = {
          ...currentExperience,
          __company: { id: co.id, name: co.name, isListed: co.listing_status === "listed" },
        };
      }
    }
  }

  /* ★★2画面目（転職について・関心のある職種）の初期値（2026-09-11）。
     ⚠️★**2回目に来た人に空を見せないため。** 1画面目と同じ扱いにする。
     ⚠️ `ow_profiles.user_id` と `ow_profile_desired_roles.user_id` は
        どちらも **auth.users.id**（`ow_users.id` ではない）。混ぜると常に0件になる。
     ⚠️ 取得に失敗したら null / 空で進める（**誘導であって同意の記録ではない**）。
        ただし握り潰さずログに出す。 */
  let initialStance: string | null = null;
  let initialDesiredRoleIds: string[] = [];
  {
    const admin = createAdminClient();
    const [{ data: prof, error: profErr }, { data: dRoles, error: dErr }] = await Promise.all([
      admin.from("ow_profiles").select("career_stance").eq("user_id", user.id).maybeSingle(),
      admin.from("ow_profile_desired_roles").select("role_id").eq("user_id", user.id),
    ]);
    if (profErr) console.error("[onboarding] ow_profiles", profErr.message);
    if (dErr) console.error("[onboarding] ow_profile_desired_roles", dErr.message);
    initialStance = (prof?.career_stance as string | null) ?? null;
    initialDesiredRoleIds = (dRoles ?? []).map((r) => r.role_id as string);
  }

  return (
    <OnboardingClient
      roles={roles}
      roleAliases={roleAliases}
      currentExperience={currentExperience}
      initialStance={initialStance}
      initialDesiredRoleIds={initialDesiredRoleIds}
    />
  );
}
