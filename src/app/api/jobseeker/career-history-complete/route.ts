import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mutateOne } from "@/lib/supabase/mutate";

export const dynamic = "force-dynamic";

/**
 * ★「これ以上の経歴はない」（2026-10-16）。`ow_profiles.career_history_complete_at` に現在時刻を書く。
 *
 * ⚠️ 呼ぶのは /mypage の職歴の促しカード（`CareerPromptCard`）だけ。
 * ⚠️ 値は**消さない・戻さない**（柴さんの指示）。職歴を後から足しても残す。
 *    ⇒ このルートは「書く」だけで、取り消しの口を持たない。
 * ⚠️ 既に値がある人がもう一度押しても上書きしない（最初に答えた日時を残す）。
 * ⚠️ `ow_profiles.user_id` は **auth 空間**。session クライアントで書く（RLS の own_update が auth.uid() で効く）。
 * ⚠️ 行はオンボーディング完了時に必ずできている。無ければ 404（ここで作らない）。
 */
export async function PUT() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: existing, error: selError } = await supabase
    .from("ow_profiles")
    .select("id, career_history_complete_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (selError) {
    console.error("[PUT /api/jobseeker/career-history-complete] select", selError.message);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "プロフィールが見つかりません" }, { status: 404 });
  if (existing.career_history_complete_at) {
    return NextResponse.json({ career_history_complete_at: existing.career_history_complete_at });
  }

  const now = new Date().toISOString();
  const r = await mutateOne(
    supabase
      .from("ow_profiles")
      .update({ career_history_complete_at: now, updated_at: now })
      .eq("user_id", user.id),
    "career-history-complete",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ career_history_complete_at: now });
}
