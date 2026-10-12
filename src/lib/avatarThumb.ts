/**
 * ★プロフィール写真の小さい版の URL（2026-10-12）。一覧で元の大きな画像を読み込まないため。
 *   Supabase Storage の公開 URL（/storage/v1/object/public/…）なら、画像変換の URL（/storage/v1/render/image/public/…）に
 *   置き換えて、表示の2倍の大きさに縮める（実測: 338KB → 16KB）。それ以外の URL はそのまま返す。
 * ⚠️ `ow-uploads` は公開のバケット。期限付きの URL は要らない（/u/[id] で同じ写真をログインした人に見せている）。
 * ⚠️ クライアントからも読む。`@/` の import を置かないこと（node --test が直接読む）。
 */
export function avatarThumbUrl(url: string | null | undefined, displayPx: number): string | null {
  if (!url) return null;
  const clean = url.trim();
  if (!clean.startsWith("https://")) return null;
  const marker = "/storage/v1/object/public/";
  const i = clean.indexOf(marker);
  if (i < 0) return clean;
  const base = clean.slice(0, i) + "/storage/v1/render/image/public/" + clean.slice(i + marker.length).split("?")[0];
  const px = Math.max(16, Math.round(displayPx * 2));
  return `${base}?width=${px}&height=${px}&resize=cover&quality=70`;
}
