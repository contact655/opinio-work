import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { MAX_PHOTOS_PER_CATEGORY, type PhotoCategory } from "@/lib/business/photos";

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

    const body = await request.json();
    const { category, image_url, caption, display_order } = body;

    if (!VALID_CATEGORIES.includes(category)) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!image_url || typeof image_url !== "string") {
      return Response.json({ error: "image_url is required" }, { status: 400 });
    }

    // Check existing count for this category
    const { count, error: countError } = await supabase
      .from("ow_company_office_photos")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("category", category);

    if (countError) {
      return Response.json({ error: "Count check failed", detail: countError.message }, { status: 500 });
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
      return Response.json({
        error: "Insert failed",
        detail: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return Response.json({ data }, { status: 201 });
  } catch (e) {
    return Response.json({ error: "Server error", detail: String(e) }, { status: 500 });
  }
}
