/**
 * 企業の可視性を2軸に分ける（2026-08-12 確立）
 *
 * ── なぜ分けたか ───────────────────────────────────────────────────────────
 * `is_published` が「詳細ページが見えるか」と「一覧・検索に出るか」を**同時に**
 * 制御していた。経歴に出てくる企業は前者だけ必要で、後者は要らない。
 * ユーザーが経歴を入れれば非IT企業も入ってくるので、この分離が要る。
 *
 * 実際、経歴に出る6社のうち4社が `is_published = false` で、
 * **経歴のリンクの3分の2が404の行き止まり**になっていた。
 *
 * ── 3つの列の意味 ──────────────────────────────────────────────────────────
 *   is_approved     … 運営が内容を確認した。`check_published_requires_approval`
 *                     （is_published = false OR is_approved = true）の前提
 *   is_published    … **詳細ページが見えるか**（404ゲート）
 *   listing_status  … **ディレクトリに載るか**（'listed' / 'draft'）
 *   is_test         … **検証用か**（2026-08-12 追加。公開側からは常に除外）
 *
 * `listing_status` は baseline から存在していた列で、COMMENT も
 * 「draft=非掲載, listed=事実情報として掲載（ディレクトリ）」と書かれていたが、
 * **一度も絞り込みに使われていなかった**（85社すべて 'listed'、参照は /admin の表示2箇所のみ）。
 * 新しい列を足さず、この列に本来の役割を持たせる。
 *
 * ── ⚠️ 使い分け ────────────────────────────────────────────────────────────
 *   一覧・検索・サジェスト・sitemap・LP → `filterListedCompanies`
 *   詳細ページ・詳細ページへのリンク生成 → `filterVisibleCompanies`
 *
 * ⚠️ **運営画面（/admin 配下）はこのヘルパーの対象外。**（2026-08-12 追記）
 *    ここは求職者に何を見せるかの判定で、運営の作業管理はそれとは別の軸。
 *    例: `/admin/companies/coverage`（充填状況）は `is_published` で拾う。
 *    ディレクトリ非掲載の企業こそデータを埋める対象なので、通すと対象が消える。
 *
 * ⚠️ **`.eq("is_published", true)` を新しく直書きしないこと。**
 *    1箇所忘れると非掲載企業がディレクトリに漏れる。必ずこのヘルパーを通す。
 *    2026-08-12 時点の適用先は ディレクトリ15箇所 / 詳細4箇所（運営画面4箇所は対象外）。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ディレクトリ（一覧・検索・サジェスト・sitemap・LP）に出す企業だけに絞る。
 *
 * ⚠️ **dev でも必ず絞る。** 詳細ゲート側（下）と違って例外を設けない。
 *    「一覧に出ないこと」は dev で確認できなければ検証にならないし、
 *    CLAUDE.md が「dev で見えた = 本番で同じ挙動」と判断するなと警告しているのは
 *    まさにこの取り違えのこと。ディレクトリの軸では dev と本番を一致させる。
 */
export function filterListedCompanies<T>(query: T): T {
  return (query as any)
    .eq("is_published", true)
    .eq("listing_status", "listed")
    /* ⚠️ 検証用の企業を公開側に出さない（2026-08-12 追加）。
          `ow_companies` を引く箇所は運営画面を除いても60以上あるので、
          個別に足さずこの2関数（と Strict）に集約する。 */
    .eq("is_test", false) as T;
}

/**
 * 詳細ページが見える企業だけに絞る。**ディレクトリ非掲載でも見える。**
 *
 * ⚠️ dev では絞らない。非公開企業の詳細ページを確認できるようにするための
 *    既存の分岐をそのまま維持している（queries.ts:682 のコメント参照）。
 *    ⚠️ **リンクを生成する側は env に関係なく絞ること。**
 *       dev でリンクが出て本番で404になると、開発中には気づけない。
 *       そのため `resolvePublishedCompanyHref` は下の `strict` を使う。
 */
export function filterVisibleCompanies<T>(query: T): T {
  if (process.env.NODE_ENV === "development") return query;
  /* ⚠️ 検証用の企業は詳細ページも出さない（2026-08-12 追加） */
  return (query as any).eq("is_published", true).eq("is_test", false) as T;
}

/**
 * 詳細ページが見える企業だけに絞る（**dev でも絞る**）。
 * リンク生成のように「本番で404になるものを出してはいけない」箇所で使う。
 */
export function filterVisibleCompaniesStrict<T>(query: T): T {
  /* ⚠️ 検証用の企業へのリンクを生成しない（2026-08-12 追加） */
  return (query as any).eq("is_published", true).eq("is_test", false) as T;
}
