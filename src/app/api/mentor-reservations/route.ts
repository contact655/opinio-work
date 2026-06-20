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

// POST /api/mentor-reservations — 「話せる人」相談予約申込（要認証）
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
    ambassador_id,
    contact_email,
    themes,
    current_situation,
    questions,
    background,
    preferred_days,
    preferred_times,
    preferred_platform,
  } = body;

  if (!ambassador_id || typeof ambassador_id !== "string") {
    return NextResponse.json({ error: "ambassador_id required" }, { status: 400 });
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return NextResponse.json({ error: "Valid contact_email required" }, { status: 400 });
  }

  // 「話せる人」情報を取得（ambassador = ow_company_admins.is_ambassador=true）
  const { data: ambassador } = await supabase
    .from("ow_company_admins")
    .select("id, user_id, is_ambassador, ow_users!user_id(name)")
    .eq("id", ambassador_id)
    .maybeSingle();

  if (!ambassador) {
    return NextResponse.json({ error: "Ambassador not found" }, { status: 404 });
  }
  if (!ambassador.is_ambassador) {
    return NextResponse.json({ error: "This person is not currently accepting requests" }, { status: 403 });
  }

  const ambassadorUser = ambassador.ow_users as { name: string } | null;
  const ambassadorName = ambassadorUser?.name ?? "担当者";

  const { data: reservation, error } = await supabase
    .from("ow_mentor_reservations")
    .insert({
      user_id: owUserId,
      ambassador_id,
      ambassador_user_id: ambassador.user_id ?? null,
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
      subject: `【OPINIO】話せる人への相談申込: ${ambassadorName}`,
      html: `
        <p>新しい相談申込が届きました。</p>
        <ul>
          <li>相手: ${ambassadorName}</li>
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
      id, ambassador_id, status, themes, scheduled_at, created_at,
      ambassador:ow_company_admins!ambassador_id(
        user_id,
        ow_users!user_id(name)
      )
    `)
    .eq("user_id", owUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[mentor-reservations GET]", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
