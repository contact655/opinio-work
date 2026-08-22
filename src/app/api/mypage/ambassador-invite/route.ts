import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

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
    /* ⚠️ company_id も取る。承認・辞退のあとにキャッシュを捨てるのに要る
          （辞退は行ごと消えるので、あとからでは分からない）。 */
    .select("id, user_id, company_id")
    .eq("invite_token", token)
    .eq("user_id", owUser.id)
    .maybeSingle();

  if (fetchErr || !member) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }

  if (accept) {
    /* ★承認できたら invite_token を作り直す（2026-08-22）。
       これで**使用済みの URL は二度と通らない**。

       ⚠️ 以前は期限も使い切りも無く、同じリンクを何度でも開けて accept が通り、
          そのたび consent_at が上書きされていた。列を足さずに使い切りにできるのは、
          トークンが「どの招待か」を指すだけで本人性はセッションが担保しているため
          （本人確認は上の .eq("user_id", owUser.id) と GET 側の auth_id 照合）。

       ⚠️ 承認後に同じリンクをもう一度開くと 404「招待が見つかりません」になる。
          これは意図した挙動。承認済みの状態は /mypage から確認・解除できる。

       ⚠️ 辞退（else 側）は行ごと DELETE するのでトークンも一緒に消える。作り直さない。

       ⚠️ 有効期限（invited_at から N 日）は**入れていない**。列の追加が要るうえ、
          期限切れの招待をどう見せるかの判断が要るため別タスク。 */
    const { error } = await adminSupabase
      .from("ow_company_members")
      .update({
        display_consent: true,
        consent_at: new Date().toISOString(),
        is_public: true,
        role_title: role_title?.trim() || undefined,
        invite_token: crypto.randomUUID(),
      })
      .eq("id", member.id);

    if (error) {
      console.error("[ambassador accept]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    revalidateCompanyAmbassadors(member.company_id as string);
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
    revalidateCompanyAmbassadors(member.company_id as string);
    return NextResponse.json({ ok: true, accepted: false });
  }
}
