import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { MAX_PHOTOS_PER_CATEGORY, type PhotoCategory } from "@/lib/business/photos";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

const VALID_CATEGORIES: PhotoCategory[] = ["workspace", "meeting", "welfare", "event"];

export async function POST(request: Request) {
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

    const body = await request.json();
    const { category, image_url, caption, display_order } = body;

    if (!VALID_CATEGORIES.includes(category)) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!image_url || typeof image_url !== "string") {
      return Response.json({ error: "image_url is required" }, { status: 400 });
    }
    // Only allow Supabase Storage URLs to prevent javascript: URI injection
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const isStorageUrl = image_url.startsWith(`${SUPABASE_URL}/storage/`);
    if (!isStorageUrl) {
      return Response.json({ error: "image_url must be a valid storage URL" }, { status: 400 });
    }

    // Check existing count for this category
    const { count, error: countError } = await supabase
      .from("ow_company_office_photos")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("category", category);

    if (countError) {
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    if ((count ?? 0) >= MAX_PHOTOS_PER_CATEGORY) {
      return Response.json({
        error: `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos per category`,
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ow_company_office_photos")
      .insert({
        company_id: companyId,
        category,
        image_url,
        caption: caption ?? null,
        display_order: display_order ?? (count ?? 0),
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json({ data }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("id");
    if (!photoId) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    // 所有権確認: companyId が一致する行のみ削除
    const { error } = await supabase
      .from("ow_company_office_photos")
      .delete()
      .eq("id", photoId)
      .eq("company_id", companyId);

    if (error) {
      console.error("[DELETE /api/biz/company/photos]", error.message);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
