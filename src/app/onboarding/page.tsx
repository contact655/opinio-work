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
    .select("id, name, parent_id, display_order")
    .is("merged_into_id", null)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) console.error("[onboarding] ow_roles", error.message);

  const roles = (roleRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    parent_id: (r.parent_id as string | null) ?? null,
  }));

  return <OnboardingClient roles={roles} />;
}
