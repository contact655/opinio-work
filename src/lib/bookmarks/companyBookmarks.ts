/**
 * 「気になる」企業の一覧を、**ページ内で1回だけ**取りに行くための共有キャッシュ。
 *
 * ── なぜ集めたか（2026-08-09）────────────────────────────────────────────────
 * `/api/bookmarks?target_type=company` を3つのコンポーネントが別々に叩いていた。
 *
 *   CompanyCardCompact  … モジュール変数 `_bookmarkPromise` で自前キャッシュ
 *   CompanyCardList     … `_listBookmarkPromise` で**同じ内容をコピーした**自前キャッシュ
 *   CompanySearchBar    … キャッシュ無しの素の fetch
 *
 * 各自の中では重複を防げていたが、**コンポーネントをまたぐと防げない**。
 * `/companies` の実測で同じリクエストが2本飛んでいた。
 *
 * ⚠️ 呼び出し側で `fetch("/api/bookmarks?target_type=company")` と書かないこと。
 *    書いた瞬間にまた1本増える。必ずこの関数を通す。
 */

export type CompanyBookmarks = { ids: Set<string> };

/** 保持時間。過ぎたら次の呼び出しで取り直す */
const TTL_MS = 60_000;

let inflight: Promise<CompanyBookmarks> | null = null;

/**
 * 「気になる」企業ID の集合。
 *
 * ⚠️ 未ログイン（401）でもエラーにせず**空集合**を返す。
 *    ブックマークは付加機能なので、ログインしていない人の画面を壊さない。
 */
export function fetchCompanyBookmarks(): Promise<CompanyBookmarks> {
  if (inflight) return inflight;

  inflight = fetch("/api/bookmarks?target_type=company")
    .then((r) => {
      if (r.status === 401) return { ids: new Set<string>() };
      return r
        .json()
        .then((d) => ({ ids: new Set<string>(Array.isArray(d.ids) ? d.ids : []) }));
    })
    .catch(() => ({ ids: new Set<string>() }));

  setTimeout(() => {
    inflight = null;
  }, TTL_MS);

  return inflight;
}

/**
 * 追加・削除のあとにキャッシュを捨てる。
 * 次に読む人が新しい状態を取り直す。
 */
export function invalidateCompanyBookmarks(): void {
  inflight = null;
}
