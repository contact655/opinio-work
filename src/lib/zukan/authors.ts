/**
 * 社長図鑑の書き手（記事末尾「この記事を書いた人」）。
 *
 * ⚠️ frontmatter の `author` はここのキーと**完全一致**させる（"柴 久人" / "松本"）。
 *    一致しない記事は読み込み時に弾かれる（`lib/zukan/articles.ts`）。
 *
 * ⚠️ `title`（肩書き）と `bio`（紹介文）は空なら画面に出ない（名前だけが出る）。推測で埋めないこと。
 *    柴さんのぶんは 2026-10-04 に本人から受け取った文面。松本さんのぶんは未設定（後で入る）。
 */
export interface ZukanAuthor {
  name: string;
  /** 肩書き。空なら出さない */
  title: string;
  /** 短い紹介文（2〜3行）。空なら出さない */
  bio: string;
}

export const ZUKAN_AUTHORS = {
  "柴 久人": {
    name: "柴 久人",
    title: "株式会社Opinio 代表取締役／Opinio Agent エージェント",
    bio: "会計コンサルティングを経て、リクルートで法人営業と転職支援に4年、セールスフォース・ジャパンでインサイドセールスとフィールドセールスに約6年。2023年に株式会社Opinioを創業。国家資格キャリアコンサルタント。",
  },
  "松本": { name: "松本", title: "", bio: "" },
} as const satisfies Record<string, ZukanAuthor>;

export type ZukanAuthorKey = keyof typeof ZUKAN_AUTHORS;

export function isZukanAuthorKey(v: unknown): v is ZukanAuthorKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ZUKAN_AUTHORS, v);
}
