"use client";

import { useEffect, useState } from "react";

/**
 * 企業詳細ページの「閲覧者ごとに変わる状態」をクライアント側で取る。
 *
 * ── なぜクライアントで取るか（2026-08-09）──────────────────────────────────
 * 以前はサーバーで引いて props で渡していた。そのために
 * `/companies/[id]` が `auth.getUser()` を呼ぶ必要があり、ページ全体が動的化して
 * `export const revalidate = 60` が効いていなかった。
 *
 * ⚠️ **同じページで複数のボタンが呼ぶ**（ブックマークとフォロー）。
 *    企業IDごとに1本だけ飛ばすよう、モジュール変数でキャッシュする。
 *    ここを素の fetch にすると、ボタンの数だけリクエストが増える。
 */

export type CompanyViewerState = {
  authenticated: boolean;
  bookmarked: boolean;
  following: boolean;
};

const FALLBACK: CompanyViewerState = { authenticated: false, bookmarked: false, following: false };

/** companyId → 取得中/取得済みの Promise。TTL は張らない（1ページ表示の間だけ持てばよい） */
const inflight = new Map<string, Promise<CompanyViewerState>>();

function load(companyId: string): Promise<CompanyViewerState> {
  const hit = inflight.get(companyId);
  if (hit) return hit;

  const p = fetch(`/api/jobseeker/companies/${companyId}/viewer-state`)
    .then((r) => (r.ok ? r.json() : FALLBACK))
    .then((d: Partial<CompanyViewerState>) => ({
      authenticated: !!d.authenticated,
      bookmarked: !!d.bookmarked,
      following: !!d.following,
    }))
    /* ⚠️ 失敗しても throw しない。ブックマークとフォローは付加機能で、
          取れなければ「押していない状態」で画面が成立する。 */
    .catch(() => FALLBACK);

  inflight.set(companyId, p);
  return p;
}

/** 追加・削除のあとに捨てる。次に読む人が取り直す */
export function invalidateCompanyViewerState(companyId: string): void {
  inflight.delete(companyId);
}

/**
 * @returns `ready` が false の間は FALLBACK（未ログイン相当）を返す。
 *          呼び出し側はこの間ボタンを「未押下」で描いてよい
 *          （サーバーHTMLも未押下で出るので、ちらつきが最小になる）。
 */
export function useCompanyViewerState(companyId: string): CompanyViewerState & { ready: boolean } {
  const [state, setState] = useState<CompanyViewerState>(FALLBACK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    load(companyId).then((s) => {
      if (!alive) return;
      setState(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  return { ...state, ready };
}
