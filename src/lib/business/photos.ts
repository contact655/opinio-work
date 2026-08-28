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

/**
 * 企業ロゴを Storage に入れて、`logo_url` に入れる公開URLを返す。
 *
 * ⚠️★**アップロードとURLの組み立てをこの関数の内側に閉じてある。**
 *    2026-08-28 まで `buildLogoStoragePath()`（パスを作るだけ）を2箇所が呼び、
 *    その後の upload と getPublicUrl を**各自で書いていた**。片方だけ直る形だった。
 *
 * ── ★なぜ固定名なのか（2026-08-28 に変更）──────────────────────────────────
 * 以前は **`{Date.now()}.{ext}`** で毎回新しい名前を作っており、**古いファイルを
 * 消していなかった**。そのため**ロゴを差し替えるたびに Storage に孤児が1件増えていた**
 * （実測: `companies/logos/` の 92ファイル中15件が未参照。うち6件がこの経路由来）。
 *
 * 固定名（`logo.{ext}`）＋ `upsert` にすれば**同じキーを上書きする**ので、
 * 孤児が原理的に生まれない。一括投入スクリプト（`upload-logos-*.mjs`）も同じ命名。
 *
 * ⚠️ **削除で解決していない。** 「新しいのを上げたら古いのを消す」も考えたが、
 *    Storage は Supabase の日次バックアップに含まれず、消すと戻せない。
 *    上書きなら消す操作が要らない。
 *
 * ⚠️ 拡張子が変わる差し替え（png → jpg）だけは1件残る。**稀なので許容する。**
 *    ここで「他の拡張子を消す」処理を足さないこと。削除を持ち込むことになる。
 *
 * ── ★URL に `?v=` を付ける理由 ──────────────────────────────────────────────
 * 固定名にすると**URLが変わらない**ので、`cache-control: public, max-age=3600` の
 * まま**最大1時間、閲覧者に古い画像が出る**（2026-08-28 に実際に観測した）。
 * 保存するURLに `?v={アップロード時刻}` を付けて、URL自体を変える。
 *
 * ⚠️ `logo_url` を**末尾一致で判定しないこと**。`?v=` が付く。
 *    2026-08-28 時点で src にそういう判定は無い（`usableLogoUrl` はホスト名で見る）。
 *
 * @throws upload に失敗したら投げる。呼び出し側で捕まえて画面に出すこと
 */
export async function uploadCompanyLogo(
  supabase: SupabaseClient,
  companyId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `companies/logos/${companyId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from("ow-uploads")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("ow-uploads").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
