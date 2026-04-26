import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/business/company";

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

    const companyId = await getCompanyId(supabase, user.id);
    if (!companyId) {
      return Response.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.caption === "string") updates.caption = body.caption;
    if (typeof body.display_order === "number") updates.display_order = body.display_order;

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
      return Response.json({ error: "Update failed", detail: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (e) {
    return Response.json({ error: "Server error", detail: String(e) }, { status: 500 });
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

    const companyId = await getCompanyId(supabase, user.id);
    if (!companyId) {
      return Response.json({ error: "Company not found" }, { status: 404 });
    }

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
      return Response.json({ error: "Delete failed", detail: deleteError.message }, { status: 500 });
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
        await supabase.storage.from("ow-uploads").remove([path]);
      }
    } catch (storageError) {
      console.warn("[DELETE photos] Storage removal failed (orphan accepted):", storageError);
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
