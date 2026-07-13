import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/mypage/ambassador-invite?token=xxx  — トークン情報取得
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("ow_company_members")
    .select(`
      id,
      display_consent,
      is_public,
      role_title,
      invited_at,
      company:ow_companies!company_id(id, name, brand_name),
      ow_user:ow_users!user_id(id, auth_id)
    `)
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  type Row = typeof data & {
    company: { id: string; name: string | null; brand_name: string | null } | null;
    ow_user: { id: string; auth_id: string | null } | null;
  };
  const row = data as unknown as Row;

  // 本人確認
  if (row.ow_user?.auth_id !== user.id) {
    return NextResponse.json({ error: "この招待はあなた宛ではありません" }, { status: 403 });
  }

  return NextResponse.json({
    id: row.id,
    display_consent: row.display_consent,
    is_public: row.is_public,
    role_title: row.role_title,
    invited_at: row.invited_at,
    company_id: row.company?.id ?? "",
    company_name: row.company?.brand_name ?? row.company?.name ?? "—",
  });
}

// POST /api/mypage/ambassador-invite  — 承認 or 辞退
// Body: { token: string; accept: boolean; role_title?: string }
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { token?: string; accept?: boolean; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, accept, role_title } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const adminSupabase = createAdminClient();

  // 本人のレコードを取得
  const { data: owUser } = await adminSupabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!owUser) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  const { data: member, error: fetchErr } = await adminSupabase
    .from("ow_company_members")
    .select("id, user_id")
    .eq("invite_token", token)
    .eq("user_id", owUser.id)
    .maybeSingle();

  if (fetchErr || !member) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  if (accept) {
    const { error } = await adminSupabase
      .from("ow_company_members")
      .update({
        display_consent: true,
        consent_at: new Date().toISOString(),
        is_public: true,
        role_title: role_title?.trim() || undefined,
      })
      .eq("id", member.id);

    if (error) {
      console.error("[ambassador accept]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, accepted: true });
  } else {
    // 辞退 → レコードを削除
    const { error } = await adminSupabase
      .from("ow_company_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      console.error("[ambassador decline]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, accepted: false });
  }
}
