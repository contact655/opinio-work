import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOwnSalaries } from "@/lib/experiences/salary";

export const dynamic = "force-dynamic";

/**
 * ★本人の職歴ごとの年収（2026-10-16 / フェーズ2）。`{ salaries: { [experienceId]: 万円 } }`（値の無い職歴は返さない）。
 * ⚠️★**本人の分だけ。** ログインしている人の ow_users.id で絞る。他人の年収を返す経路を作らないこと。
 * ⚠️ 取得に失敗したら 500。空（{}）と区別する（空に倒すと、保存済みの年収が消えたように見える）。
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: owUser, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) { console.error("[salaries] ow_users:", error.message); return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 }); }
  if (!owUser) return NextResponse.json({ salaries: {} });
  const salaries = await loadOwnSalaries(owUser.id as string);
  if (!salaries) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ salaries });
}
