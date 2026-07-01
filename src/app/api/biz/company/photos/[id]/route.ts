import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(params.id)) return Response.json({ error: "Invalid id" }, { status: 400 });

    const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
    const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
    if (!ctx) {
      return Response.json({ error: "Company context not found" }, { status: 404 });
    }
    const { companyId } = ctx;

    try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.caption === "string") updates.caption = body.caption.slice(0, 500);
    if (typeof body.display_order === "number") {
      const ord = body.display_order;
      if (Number.isInteger(ord) && ord >= 0 && ord <= 9999) {
        updates.display_order = ord;
      }
    }
    if ('tagged_user_id' in body) {
      updates.tagged_user_id = body.tagged_user_id ?? null; // allow null to clear
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid updates" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ow_company_office_photos")
      .update(updates)
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json({ data });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
    const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
    if (!ctx) {
      return Response.json({ error: "Company context not found" }, { status: 404 });
    }
    const { companyId } = ctx;

    try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

    // 1. DB から該当行を取得して image_url を取り出す（Storage パス推定用）
    const { data: photo, error: fetchError } = await supabase
      .from("ow_company_office_photos")
      .select("image_url")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !photo) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    // 2. DB から削除
    const { error: deleteError } = await supabase
      .from("ow_company_office_photos")
      .delete()
      .eq("id", params.id)
      .eq("company_id", companyId);

    if (deleteError) {
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    // 3. Storage から削除（best-effort — 失敗しても DB 削除は完了済みなので orphan 容認）
    try {
      // image_url から Storage path を抽出
      // 例: https://xxx.supabase.co/storage/v1/object/public/ow-uploads/companies/office-photos/xxx/yyy.jpg
      //   → companies/office-photos/xxx/yyy.jpg
      const url = new URL(photo.image_url);
      const match = url.pathname.match(/\/ow-uploads\/(.+)$/);
      if (match) {
        const path = match[1];
        // companies/office-photos/{companyId}/... の第1セグメントは "companies" であり
        // ow_uploads_owner_delete の foldername[1] = auth.uid() 条件に合致しない。
        // 業務ロジック認可は getCompanyContext で完結済みのため、Storage 操作のみ service role を使用。
        // （allow_all_storage 削除（migration 095）の事前対応）
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.storage.from("ow-uploads").remove([path]);
      }
    } catch (storageError) {
      console.warn("[DELETE photos] Storage removal failed (orphan accepted):", storageError);
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
