import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// POST /api/mentor-reservations — メンター相談予約申込（要認証）
export async function POST(req: Request) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    mentor_id,
    contact_email,
    themes,
    current_situation,
    questions,
    background,
    preferred_days,
    preferred_times,
    preferred_platform,
  } = body;

  if (!mentor_id || typeof mentor_id !== "string") {
    return NextResponse.json({ error: "mentor_id required" }, { status: 400 });
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return NextResponse.json({ error: "Valid contact_email required" }, { status: 400 });
  }

  // メンター情報を取得（存在確認 + user_id 解決）
  const { data: mentor } = await supabase
    .from("mentors")
    .select("id, name, user_id, is_available")
    .eq("id", mentor_id)
    .maybeSingle();

  if (!mentor) {
    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  }
  if (!mentor.is_available) {
    return NextResponse.json({ error: "Mentor is not currently available" }, { status: 403 });
  }

  const { data: reservation, error } = await supabase
    .from("ow_mentor_reservations")
    .insert({
      user_id: owUserId,
      mentor_id,
      mentor_user_id: mentor.user_id ?? null,
      contact_email: contact_email as string,
      themes: Array.isArray(themes) ? themes : null,
      current_situation: (current_situation as string) || null,
      questions: (questions as string) || null,
      background: (background as string) || null,
      preferred_days: Array.isArray(preferred_days) ? preferred_days : null,
      preferred_times: Array.isArray(preferred_times) ? preferred_times : null,
      preferred_platform: (preferred_platform as string) || null,
      status: "pending_review",
    })
    .select()
    .single();

  if (error) {
    console.error("[mentor-reservations POST]", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // 管理者へ通知メール（best-effort）
  try {
    const adminEmail = process.env.ADMIN_EMAIL ?? "contact@opinio.co.jp";
    await notify({
      to: adminEmail,
      subject: `【OPINIO】メンター相談申込: ${mentor.name}`,
      html: `
        <p>新しいメンター相談申込が届きました。</p>
        <ul>
          <li>メンター: ${mentor.name}</li>
          <li>申込者ID: ${owUserId}</li>
          <li>連絡先: ${contact_email}</li>
          <li>相談テーマ: ${Array.isArray(themes) ? themes.join(", ") : "—"}</li>
          <li>希望日: ${Array.isArray(preferred_days) ? preferred_days.join(", ") : "—"}</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.jp"}/admin">管理画面で確認する →</a></p>
      `,
    });
  } catch (e) {
    console.error("[mentor-reservations] notify failed:", e);
  }

  return NextResponse.json({ id: reservation.id }, { status: 201 });
}

// GET /api/mentor-reservations — 自分の予約一覧
export async function GET() {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ow_mentor_reservations")
    .select(`
      id, mentor_id, status, themes, scheduled_at, created_at,
      mentor:mentors!mentor_id(name, photo_url)
    `)
    .eq("user_id", owUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[mentor-reservations GET]", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
