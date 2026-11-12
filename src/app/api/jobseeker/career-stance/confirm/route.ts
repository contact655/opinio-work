import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";
import { VALID_CAREER_STANCES } from "@/lib/constants/careerPreferences";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobseeker/career-stance/confirm — 転職意欲が「変わりない」ことを確かめた（2026-11-12）
 *
 * ★`career_stance_updated_at` を今にする。意味は「本人が最後に確かめた日時」（lib/profile/stanceReconfirm.ts）。
 * ⚠️ 値を変えるのは PUT /api/jobseeker/career-preferences。ここは値を変えない。
 *    PUT の「同じ値を選び直しても打たない」は残してある（年収を直しただけの人が新しくならないように）。
 * ⚠️ `stance_updated_at`（転職・面談の状況カード）はここでは打たない。
 * ⚠️ body の career_stance は「本人が画面で見た値」。いまの値と違えば 409（別のタブで変えた等。古い値を確かめたことにしない）。
 * ⚠️ ow_profiles.user_id は auth 空間。RLS（本人だけ UPDATE）の内側で書く。
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stance = body.career_stance;
  if (typeof stance !== "string" || !VALID_CAREER_STANCES.has(stance)) {
    return NextResponse.json({ error: "career_stance に不正な値が指定されました" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const r = await mutateOne(
    supabase.from("ow_profiles")
      .update({ career_stance_updated_at: now })
      .eq("user_id", user.id)
      .eq("career_stance", stance),
    "career-stance confirm",
    { returning: "user_id" },
  );
  if (!r.ok) {
    if (r.count === 0 && r.status === 404) {
      return NextResponse.json({ error: "転職についての答えが変わっています。画面を読み込み直してください。" }, { status: 409 });
    }
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, confirmedAt: now });
}
