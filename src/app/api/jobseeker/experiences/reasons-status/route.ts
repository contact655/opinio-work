import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reasonStatusForUser } from "@/lib/experiences/reasonAnswers";

export const dynamic = "force-dynamic";

/**
 * ★本人の職歴ごとの回答の状態（2026-10-16）。`{ status: { [experienceId]: 1 | 2 } }`（未回答は返さない）。
 * ⚠️ 同じ会社の役割はすべて同じ値（回答の単位は会社）。
 * ⚠️ 本人の分だけ。ログインしている人の ow_users.id で絞る。
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: owUser, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) { console.error("[reasons-status] ow_users:", error.message); return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 }); }
  if (!owUser) return NextResponse.json({ status: {} });
  const status = await reasonStatusForUser(owUser.id as string);
  if (!status) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ status });
}
