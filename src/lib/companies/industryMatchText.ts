/**
 * 「あなたの◯◯の経験が活きる会社」の**ブラウザでも読んでよい部分**（2026-10-09 に切り出した）。
 *   型・定数・見出しと理由の文言・年数のマージ。**どれも DB に触らない純粋な関数。**
 *
 * ── なぜ分けたか ─────────────────────────────────────────────────────────────
 * `IndustryMatchSection`（クライアントの `MypageClient` の中で描かれる）が
 * 見出しと理由の文言のためだけに `industryMatch.ts` を import しており、
 * **同じファイルが読んでいた admin クライアントと `ownCompany.ts` まで
 * `/mypage` のブラウザ向けファイルに入っていた**（2026-10-09 にビルド成果物で確認。
 * 環境変数の名前とエラー文が入っていた。キーの値は入っていない）。
 * `ownCompany.ts` は読み込み時に `unstable_cache(...)` を評価するので、それもブラウザで走っていた。
 *
 * ⚠️★**このファイルに `@/lib/supabase/*` や `ownCompany` を import しないこと。**
 *    `industryMatch.ts`（サーバー専用）は `import "server-only"` が入った
 *    admin クライアントを読むので、クライアントから import するとビルドが落ちる。
 *    クライアント側はこのファイルだけを読む。
 * ⚠️ サーバー側の呼び出し元は今までどおり `industryMatch.ts` から読んでよい（再 export している）。
 */

/** 一致した「企業側の対象業界」の名前。⚠️ 見出しではなく**理由文**に使う */
export type IndustryMatchCompany = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  /**
   * ★この会社が**どの対象業界で**当たったかの表示名（2026-09-05）。
   *
   * ⚠️ 見出し（`industryName`）とは**別物**。祖先展開を入れたので、
   *    「電機・機械」出身の人が「製造業向け」の会社に当たる。
   *    見出しは**本人が申告した業種**、理由文は**会社が言っている対象業界**。
   * ⚠️ 同じ業種のときは見出しと同じ文字列になる（それでよい）。
   */
  matchedIndustryName: string;
};

export type IndustryMatchBlock = {
  industryId: string;
  /** ⚠️ `ow_industries` の表示名をそのまま使う。**「業界」を付け足さないこと**（下記） */
  industryName: string;
  /** 経験年数。⚠️ 期間をマージしてから**年単位に丸めた**値（0年はありうる） */
  years: number;
  companies: IndustryMatchCompany[];
};

/** 1画面に出すブロックの上限。⚠️ 3業界以上ある人に画面いっぱい並べない */
export const MAX_INDUSTRY_BLOCKS = 2;
/** このブロックを出す最低社数。⚠️ **除外した後**に数える */
export const MIN_COMPANIES_PER_BLOCK = 2;

/**
 * ★見出しの文言。
 *
 * ⚠️★**`ow_industries` の名前に「業界」を付け足さないこと。**
 *    全22件を実際に並べて確かめたところ、**2件で破綻する**（2026-09-04 実測）:
 *      「**公共・団体業界**での経験が活きます」… 公共・団体は業界ではない
 *      「**その他サービス業界**での経験が活きます」… 「その他」に「業界」が付く
 *    付けない形なら22件すべて自然に読める。
 */
export function industryMatchHeading(industryName: string): string {
  return `${industryName}の経験が活きる会社`;
}

/**
 * 理由文。⚠️ 会社ごとに手書きしない。対象業界データだけで書ける形にする。
 *
 * ⚠️★渡すのは**会社が言っている対象業界**（`matchedIndustryName`）であって、
 *    見出しの業種ではない。2026-09-05 に業種を2階層にしたので、
 *    「電機・機械の経験が活きる会社」という見出しの下に
 *    「**製造業**向けにサービスを提供しています」と出る組み合わせがある。
 *    **これが繋がりの説明になっている。**
 */
export function industryMatchReason(matchedIndustryName: string): string {
  return `${matchedIndustryName}向けにサービスを提供しています`;
}

/**
 * 期間をマージして年数を出す。
 *
 * ⚠️★**単純合算しない。** 同一業界で期間が重なると二重に数える。
 *    実測（2026-09-04）では差が出たのは1人・0.1年だが、出向・兼務・グループ内異動が
 *    入れば年単位でずれる。
 * ⚠️ `started_at` は `YYYY-MM` の精度しか無い（オンボーディングは月まで）。
 *    **小数で出さない。** ここで年単位に丸める。
 */
export function mergedYears(spans: { start: Date; end: Date }[]): number {
  if (spans.length === 0) return 0;
  const sorted = [...spans].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start.getTime() <= curEnd.getTime()) {
      if (s.end.getTime() > curEnd.getTime()) curEnd = s.end;
    } else {
      total += curEnd.getTime() - curStart.getTime();
      curStart = s.start;
      curEnd = s.end;
    }
  }
  total += curEnd.getTime() - curStart.getTime();
  return Math.round(total / (365 * 24 * 60 * 60 * 1000));
}
