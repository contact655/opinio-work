/**
 * 企業 slug の導出。
 *
 * ── 原則：作れないなら NULL のままにする（2026-08-12 確立）────────────────
 * ⚠️ **日本語社名を機械的にローマ字変換しない。**
 *    「株式会社データプール」を `datapool` にするのは**推測**であり、
 *    CLAUDE.md「値が無いことを、ある値に置き換えない」「推測値を投入しない」に反する。
 *    過去に migration で企業情報が創作された事例と同じ性質になる。
 *    slug が要る企業は、運営が掲載企業に昇格させるときに人が付ける。
 *
 * ⚠️ `ow_companies_slug_idx` は `WHERE slug IS NOT NULL` の**部分 UNIQUE**なので、
 *    NULL は何件でも共存できる。作らない選択にコストは無い。
 *
 * ── 導出の優先順位 ─────────────────────────────────────────────────────────
 *   ① URL のドメイン   … 最も安全。smartcamp.co.jp → smartcamp
 *   ② name_en          … 企業自身が名乗っている英語表記
 *   ③ name の中の ASCII … 「HubSpot Japan株式会社」→ hubspot-japan
 *   ④ どれも取れない   → **null**
 *
 * ③ は「名前に実在する ASCII を抜き出す」だけで、変換も補完もしない。
 */

/**
 * 英語の法人格トークン。**slug に残さない。**
 *
 * ⚠️ 2026-08-12 に「ケンショウダミー甲 Co., Ltd.」から `co-ltd` という slug が
 *    生成された。会社を識別しないうえ、他社と衝突しかねない汎用語だった。
 *    法人格だけが残るなら slug は作らない（＝ null）のが正しい。
 */
const LEGAL_TOKENS = new Set([
  "co", "ltd", "inc", "corp", "corporation", "company", "llc",
  "incorporated", "kk", "gk", "kabushiki", "kaisha", "gmbh", "sa", "bv", "plc",
]);

/** slug に使える形へ整える。ASCII 英数字とハイフンのみ。法人格だけなら null。 */
function toSlug(raw: string): string | null {
  const parts = raw
    .normalize("NFKC")        // 全角英数を半角に寄せる
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((p) => !LEGAL_TOKENS.has(p));
  // 法人格を落としたら何も残らない → slug を作らない
  if (parts.length === 0) return null;
  const s = parts.join("-");
  // 1文字だと衝突しやすく、意味も持たない
  if (s.length < 2 || s.length > 60) return null;
  // 数字だけの slug は UUID と紛らわしく、URL としても意味が無い
  if (/^[0-9-]+$/.test(s)) return null;
  return s;
}

/** URL のホスト名から先頭ラベルを取る。https://www.smartcamp.co.jp/ → smartcamp */
function fromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const label = host.replace(/^www\./i, "").split(".")[0];
  if (!label) return null;
  return toSlug(label);
}

/**
 * ASCII を含まない（＝日本語だけの）社名かどうか。
 * 法人格は ASCII 判定の対象から外す（「株式会社」に ASCII は無いので実質そのまま）。
 */
function fromAsciiInName(name: string): string | null {
  const stripped = name
    .replace(/(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲)/g, " ")
    .normalize("NFKC");
  // ASCII 英字が1文字も無ければ導出しない（数字だけの名前も弾く）
  if (!/[A-Za-z]/.test(stripped)) return null;
  // ASCII 英数字の連なりだけを拾う。日本語部分は落とす（変換しない）
  const parts = stripped.match(/[A-Za-z0-9]+/g);
  if (!parts) return null;
  // ⚠️ toSlug が法人格トークン（co / ltd / inc …）を落とす。
  //    「ケンショウダミー甲 Co., Ltd.」のように法人格しか ASCII が無い場合は null になる。
  return toSlug(parts.join("-"));
}

/**
 * slug の候補を1つ返す。作れなければ null。
 * ⚠️ 衝突解決は行わない。呼び出し側が `resolveSlugCollision` を通すこと。
 */
export function deriveCompanySlug(input: {
  name: string;
  nameEn?: string | null;
  url?: string | null;
}): string | null {
  return (
    fromUrl(input.url) ??
    (input.nameEn ? toSlug(input.nameEn) : null) ??
    fromAsciiInName(input.name)
  );
}

/**
 * 既存 slug と衝突したら連番を付ける。`taken` は既に使われている slug の集合。
 * ⚠️ 呼び出し側は DB から取った実データを渡すこと。
 */
export function resolveSlugCollision(base: string, taken: Set<string>): string | null {
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  // 50個も同名があるのは異常。推測で伸ばさず NULL に倒す
  return null;
}
