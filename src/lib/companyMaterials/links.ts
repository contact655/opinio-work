/**
 * ★企業資料のリンクの種類（2026-10-12 / 柴さんの指示）。**URL の形だけで見分ける。**
 * ⚠️ リンク先の中身は取りに行かない（タイトルは URL か入力した資料名）。
 * ⚠️ このファイルはクライアントからも読む。`@/` の import や server-only のものを置かないこと
 *    （node --test が直接読むため、相対パスだけにしてある）。
 */
export type MaterialLinkKind =
  | "gdrive" | "gdoc" | "gslides" | "gsheets" | "gforms" | "notion" | "youtube" | "other";

export const MATERIAL_LINK_KIND_LABELS: Record<MaterialLinkKind, string> = {
  gdrive: "Google ドライブ",
  gdoc: "Google ドキュメント",
  gslides: "Google スライド",
  gsheets: "Google スプレッドシート",
  gforms: "Google フォーム",
  notion: "Notion",
  youtube: "YouTube",
  other: "リンク",
};

/** Google ドライブの mimeType（Picker で選んだとき mime_type に入る）→ 種類 */
const DRIVE_MIME_KIND: Record<string, MaterialLinkKind> = {
  "application/vnd.google-apps.document": "gdoc",
  "application/vnd.google-apps.presentation": "gslides",
  "application/vnd.google-apps.spreadsheet": "gsheets",
  "application/vnd.google-apps.form": "gforms",
};

export function materialLinkKind(url: string, driveMime?: string | null): MaterialLinkKind {
  if (driveMime && DRIVE_MIME_KIND[driveMime]) return DRIVE_MIME_KIND[driveMime];
  let u: URL;
  try { u = new URL(url); } catch { return "other"; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname;
  if (host === "docs.google.com") {
    if (path.startsWith("/document")) return "gdoc";
    if (path.startsWith("/presentation")) return "gslides";
    if (path.startsWith("/spreadsheets")) return "gsheets";
    if (path.startsWith("/forms")) return "gforms";
    return "gdrive";
  }
  if (host === "forms.gle") return "gforms";
  if (host === "drive.google.com") return "gdrive";
  if (host === "notion.so" || host.endsWith(".notion.so") || host.endsWith(".notion.site")) return "notion";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
  return "other";
}

/** URL は http / https だけ。⚠️ `isAllowedMaterialUrl`（constants）と同じ判定 */
function isHttpUrl(raw: string): boolean {
  if (/\s/.test(raw)) return false;
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * ★複数行の貼り付けを1行1件に分ける。空行は捨てる。
 *   valid … 登録するもの（貼り付けの中の重複と、登録済みの URL は除く）
 *   invalid … http / https でない行 ／ duplicate … 重複で除いた行
 */
export function parseMaterialUrlLines(text: string, existing: readonly string[] = []): {
  valid: string[]; invalid: string[]; duplicate: string[];
} {
  const seen = new Set(existing.map((s) => s.trim()));
  const valid: string[] = [], invalid: string[] = [], duplicate: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!isHttpUrl(line)) { invalid.push(line); continue; }
    if (seen.has(line)) { duplicate.push(line); continue; }
    seen.add(line);
    valid.push(line);
  }
  return { valid, invalid, duplicate };
}
