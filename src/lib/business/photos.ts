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
  is_draft?: boolean;
};

export type OfficePhoto = {
  id: string;
  url: string;
  caption: string;
  category: PhotoCategory;
  tagged_user_id: string | null;
  /** ★未公開（「公開する」を押すまで求職者に見えない。2026-10-12） */
  isDraft: boolean;
};

/**
 * ★写真は1つの枠にまとめ、カテゴリは写真ごとに選ぶ（2026-10-12）。上限は**合計20枚**。
 * ⚠️ それまでは4カテゴリ×5枚だった。求職者側の表示（getCompanyPhotos）も limit 20。
 * ⚠️ カテゴリの語彙は DB の CHECK（ow_company_office_photos_category_check）と同じ4つ。
 */
export const MAX_PHOTOS_TOTAL = 20;

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  /* ⚠️ 求職者側（PhotoCarousel の CATEGORY_LABEL）と同じ語にする */
  { value: "workspace", label: "オフィス" },
  { value: "meeting", label: "働く様子" },
  { value: "welfare", label: "休憩・食事スペース" },
  { value: "event", label: "チーム・イベント" },
];
export const isPhotoCategory = (v: unknown): v is PhotoCategory =>
  typeof v === "string" && PHOTO_CATEGORIES.some((c) => c.value === v);

export function dbPhotoToForm(db: DbOfficePhoto): OfficePhoto {
  return {
    id: db.id,
    url: db.image_url,
    caption: db.caption ?? "",
    category: db.category,
    tagged_user_id: db.tagged_user_id ?? null,
    isDraft: db.is_draft === true,
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
    .order("display_order")
    .order("created_at");

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

/**
 * 企業ロゴを Storage に入れて、`logo_url`（下書き）に入れる公開URLを返す。
 *
 * ★**アップロードのたびに別のファイル名**（`logo-{日時}.{拡張子}`）にする（2026-10-12 / 柴さんの指示）。
 *   それまでは固定名（`logo.{拡張子}`）を上書きしていたため、**企業がロゴを選んだ瞬間に
 *   公開ページのロゴが変わっていた**（URL は下書きに入るのに、ファイルの中身が先に入れ替わる）。
 *   別名なら公開中のファイルは「公開する」まで触られない。
 * ★不要になったファイル（公開した後の古いロゴ・公開しないまま差し替えたロゴ）は
 *   `lib/companies/logoFiles.ts` の cleanupCompanyLogoFiles が消す（反映の後・運営の保存の後）。
 * ⚠️ URL に `?v=` は付けない（ファイル名が毎回違うので、キャッシュで古い画像が出ることは無い）。
 * ⚠️ アップロードとURLの組み立てはこの関数の内側。呼び出し側で path を組み立てない。
 *
 * @throws upload に失敗したら投げる。呼び出し側で捕まえて画面に出すこと
 */
export async function uploadCompanyLogo(
  supabase: SupabaseClient,
  companyId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  /* ⚠️ 名前の形式を変えるなら logoFiles.ts の GENERATED_LOGO_RE も揃えること（後片付けの対象を決めている） */
  const path = `companies/logos/${companyId}/logo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("ow-uploads")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("ow-uploads").getPublicUrl(path);
  return data.publicUrl;
}
