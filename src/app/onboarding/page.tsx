import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OnboardingClient from "./OnboardingClient";

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
  const { data: roleRows, error } = await createAdminClient()
    .from("ow_roles")
    .select("id, name, display_order")
    .is("parent_id", null)
    .is("merged_into_id", null)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) console.error("[onboarding] ow_roles", error.message);

  const roles = (roleRows ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));

  return <OnboardingClient roles={roles} />;
}
