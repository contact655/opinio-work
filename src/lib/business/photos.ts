import type { SupabaseClient } from "@supabase/supabase-js";

export type PhotoCategory = "workspace" | "meeting" | "welfare" | "event";

export type DbOfficePhoto = {
  id: string;
  company_id: string;
  category: PhotoCategory;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
  tagged_user_id: string | null;
};

export type OfficePhoto = {
  id: string;
  url: string;
  caption: string;
  category: PhotoCategory;
  tagged_user_id: string | null;
};

export const MAX_PHOTOS_PER_CATEGORY = 5;

export function dbPhotoToForm(db: DbOfficePhoto): OfficePhoto {
  return {
    id: db.id,
    url: db.image_url,
    caption: db.caption ?? "",
    category: db.category,
    tagged_user_id: db.tagged_user_id ?? null,
  };
}

export async function fetchOfficePhotosForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<OfficePhoto[]> {
  const { data, error } = await supabase
    .from("ow_company_office_photos")
    .select("*")
    .eq("company_id", companyId)
    .order("category")
    .order("display_order");

  if (error) {
    console.error("[fetchOfficePhotosForCompany]", error);
    return [];
  }
  return (data ?? []).map((row) => dbPhotoToForm(row as DbOfficePhoto));
}

export type CompanyMember = {
  userId: string;
  name: string;
  roleTitle: string | null;
};

export function buildStoragePath(companyId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return `companies/office-photos/${companyId}/${Date.now()}.${ext}`;
}

export function buildLogoStoragePath(
  companyId: string,
  filename: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  return `companies/logos/${companyId}/${Date.now()}.${ext}`;
}
