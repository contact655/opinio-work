import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA } from "@/lib/constants/companyMembers";
import { getTenantContext } from "@/lib/business/dashboard";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// POST /api/biz/ambassador/self-register
// Body: { role_title: string }
// 管理者が自分自身を面談対応者として登録
// RLS対応: INSERT は display_consent=false → UPDATEで本人として true に変更
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role_title } = body;
  if (!role_title || !role_title.trim()) {
    return NextResponse.json({ error: "role_title required" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // 既に登録済みかチェック
  const { data: existing } = await adminSupabase
    .from("ow_company_members")
    .select("id")
    .eq("company_id", ctx.tenantId)
    .eq("user_id", ctx.currentOwnId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_registered", id: existing.id }, { status: 409 });
  }

  /* ★在籍中の経歴が無ければ登録させない（2026-08-23）。
        面談対応者として**表示される条件**は「`ow_company_members` に公開で載っている」
        ことと「その企業に `is_current = true` の経歴がある」ことの両方
        （`lib/companyMembers/talkable.ts`）。経歴が無いまま行を作ると、
        **登録は成功するのに企業ページに出ない**状態になる。
     ⚠️ 画面側（/biz/members）でも入口を出し分けているが、**そちらは見た目だけ**。
        判定はここが本体。 */
  const { data: currentExp, error: expErr } = await adminSupabase
    .from("ow_experiences")
    .select("id")
    .eq("user_id", ctx.currentOwnId)
    .eq("company_id", ctx.tenantId)
    .eq("is_current", true)
    .limit(1);

  /* ⚠️ 握り潰さない。引けなかったときに「経歴あり」に倒すと、出ない登録を作る。 */
  if (expErr) {
    console.error("[ambassador self-register] ow_experiences:", expErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if ((currentExp ?? []).length === 0) {
    return NextResponse.json(
      { error: "no_current_experience", message: "この会社に在籍中の職歴を登録してください" },
      { status: 409 },
    );
  }

  /* ★1回の INSERT で完結させる（2026-08-23 に作り直した）。
     ── 直す前に何が起きていたか ────────────────────────────────────────────
     `display_consent: false, is_public: true` を入れようとしており、
     **`check_public_requires_consent`（is_public = false OR display_consent = true）に
     必ず違反して 500** になっていた。行は残らないので、押した人には
     「エラーが発生しました」しか出なかった。

     ⚠️ 元のコードは「RLS: INSERT は display_consent=false のみ許可」を理由に
        false を入れていたが、**この経路は service role なので RLS を通らない**。
        守る必要のない制約に合わせて、実在する CHECK を破っていた。

     ⚠️ 2段階（INSERT → 本人セッションで UPDATE）もやめた。UPDATE 側は
        `guard_member_consent` トリガーが `new.user_id`（ow_users.id）と
        `auth.uid()`（auth 空間）を比べているため、**本人が弾かれる**
        （実測 `P0003`）。BEFORE UPDATE のトリガーなので、INSERT 1回なら通らない。
        トリガー自体の修正は別タスク。

     ⚠️ `created_via` は `'self'`（本人の申請）ではなく **`'admin'`**。
        `'self'` にすると `/admin/ambassador-requests`（未承認の申請一覧）に混ざる。
        企業の管理者が自分を登録する経路は、同意と承認が同時に成立している。 */
  const now = new Date().toISOString();
  const { data: member, error: insertError } = await adminSupabase
    .from("ow_company_members")
    .insert({
      company_id: ctx.tenantId,
      user_id: ctx.currentOwnId,
      display_consent: true,   // 本人＝操作している管理者なので、その場で同意
      is_public: true,         // 企業の承認も同時に成立する
      consent_at: now,
      approved_at: now,
      created_via: MEMBER_CREATED_VIA.ADMIN,
      role_title: role_title.trim(),
      invited_at: now,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[ambassador self-register] insert:", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  revalidateCompanyAmbassadors(ctx.tenantId);
  return NextResponse.json({ id: member.id, consented: true });
}
