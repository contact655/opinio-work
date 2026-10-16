/**
 * ★トップページ「事業領域から探す」のまとめ方（2026-10-16 / 柴さんの判断）。
 *
 * 「**何に使う製品か**」で4つに分ける（2026-10-16 に名前と分け方を見直した）。
 * ⚠️★いまのトップページは**グループの見出しを出していない**（アイコン付きタイルを1つの格子に並べる形にした）。
 *    ここは**並び順**として使っている。見出し（label）を画面に戻すときはこの定義をそのまま使える。キーは事業領域の **slug**（`ow_business_domains.slug`）。
 * ⚠️★「誰の仕事を変えるか」（部門別）で分ける案は採らなかった。AI（OpenAI・Anthropic など）は
 *    全部門が使うので「エンジニア・開発」に入れると誤りになる（柴さんの指摘）。
 *
 * ⚠️ 並び順はここに書いた順（グループ順・グループ内の順）。
 * ⚠️★**ここに無い slug は消さずに「その他」へ入れる。** 掲載企業が増えて新しい事業領域が
 *    トップに出てきたとき、黙って消えないようにするため。「その他」が出てきたら、
 *    ここに足すかどうかを決めること。
 * ⚠️ 0個のグループは出さない（`groupBusinessDomainFacets` が落とす）。
 * ⚠️ 絞り込みの URL（`/companies?industry=<slug>`）は変えていない。見せ方だけの話。
 */
export type BusinessDomainGroupDef = {
  key: string;
  label: string;
  slugs: readonly string[];
};

export const BUSINESS_DOMAIN_GROUPS: readonly BusinessDomainGroupDef[] = [
  { key: "tech", label: "AIとITの仕組み", slugs: ["ai", "infra", "security", "devtools"] },
  { key: "revenue", label: "売上をつくる", slugs: ["crm", "marketing"] },
  { key: "operations", label: "会社を動かす", slugs: ["hr", "finance", "legal", "collab"] },
  { key: "adoption", label: "IT導入の支援", slugs: ["consulting"] },
];

export const OTHER_BUSINESS_DOMAIN_GROUP = { key: "other", label: "その他" } as const;

/**
 * ★各項目の下に出す、ひとことの説明（トップページ用）。名前だけでは中身が分かりにくいため。
 * ⚠️ 事業領域の名前そのものは変えていない（`/companies` のチップなどと揃えるため）。
 * ⚠️ 無い slug は説明なしで出す。
 */
export const BUSINESS_DOMAIN_BLURBS: Readonly<Record<string, string>> = {
  ai: "生成AI・データ分析",
  infra: "サーバー・システム運用",
  security: "認証・不正アクセス対策",
  devtools: "開発・監視の道具",
  crm: "顧客管理・営業の効率化",
  marketing: "集客・メール配信・広告",
  hr: "人事・労務・採用",
  finance: "経理・請求書・経費",
  legal: "契約書・電子署名",
  collab: "タスク管理・資料の共有",
  consulting: "システム導入・ITコンサル",
};

export type GroupedFacets<T> = { key: string; label: string; items: T[] }[];

/** 事業領域のファセットをグループに分ける。⚠️ 入力に無いものは足さない（0件のタイルを作らない） */
export function groupBusinessDomainFacets<T extends { key: string }>(facets: T[]): GroupedFacets<T> {
  const bySlug = new Map(facets.map((f) => [f.key, f]));
  const used = new Set<string>();
  const groups: GroupedFacets<T> = BUSINESS_DOMAIN_GROUPS.map((g) => {
    const items = g.slugs.map((s) => bySlug.get(s)).filter((f): f is T => !!f);
    items.forEach((f) => used.add(f.key));
    return { key: g.key, label: g.label, items };
  });
  const rest = facets.filter((f) => !used.has(f.key));
  if (rest.length > 0) groups.push({ ...OTHER_BUSINESS_DOMAIN_GROUP, items: rest });
  return groups.filter((g) => g.items.length > 0);
}
