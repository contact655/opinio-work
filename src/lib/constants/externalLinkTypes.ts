/**
 * ★企業の外部リンク（ow_company_external_links.type）の種類（2026-11-28 / 柴さんの指示で1か所にまとめた）。
 *   DB の CHECK（ow_company_external_links_type_check）・/admin/posts の入力欄と保存・企業ページの表示が、ここだけを見る。
 *
 * ⚠️★値を足すときは DB の CHECK も同じ migration で張り替えること（UI / API / DB の3つを揃える。CLAUDE.md）。
 *    2026-11-28 まで /admin/posts の保存が別の語彙（news / blog / story …）を許可していて、
 *    記事・動画・音声・SNS が保存できなかった。
 * ⚠️ このファイルは何も import しない（クライアントからも読む）。
 */
export const EXTERNAL_LINK_TYPES = [
  { value: "article", label: "記事" },
  { value: "video", label: "動画" },
  { value: "audio", label: "音声" },
  { value: "social", label: "SNS" },
  { value: "event", label: "イベント" },
  { value: "other", label: "その他" },
] as const;

export type ExternalLinkType = (typeof EXTERNAL_LINK_TYPES)[number]["value"];

const TYPE_SET: ReadonlySet<string> = new Set(EXTERNAL_LINK_TYPES.map((t) => t.value));

export function isExternalLinkType(v: unknown): v is ExternalLinkType {
  return typeof v === "string" && TYPE_SET.has(v);
}

export function externalLinkTypeLabel(v: string | null | undefined): string | null {
  return EXTERNAL_LINK_TYPES.find((t) => t.value === v)?.label ?? null;
}

/** 運営の /admin/posts で選べる種類 */
export const ADMIN_POST_TYPES: readonly ExternalLinkType[] = EXTERNAL_LINK_TYPES.map((t) => t.value);

export function isAdminPostType(v: unknown): v is ExternalLinkType {
  return typeof v === "string" && (ADMIN_POST_TYPES as readonly string[]).includes(v);
}
