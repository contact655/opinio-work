"use client";

import { useEffect, useState } from "react";

/**
 * ブックマーク状態を種別ごとに1回だけ取ってきて、各ボタンで共有する。
 *
 * ── なぜクライアントで取るか（2026-08-09）──────────────────────────────────
 * 以前は詳細ページがサーバーで引いて props で渡していた。
 * そのためにページが `auth.getUser()` を呼ぶ必要があり、ルートが動的化して
 * `export const revalidate` が効かなくなっていた。
 *
 * ⚠️ 取得は **target_type ごとに1本**。同じページに同種のボタンが何個あっても
 *    リクエストは増えない。`/api/bookmarks` は一覧を返すのでこれで足りる。
 *
 * ⚠️ 既に一覧を持っている画面（`/jobs` の JobsClient など）は
 *    このフックを使わず props で渡してよい。二重取得になるため。
 */

export type BookmarkTargetType = "company" | "job" | "mentor" | "article";

type Snapshot = { ids: Set<string>; authenticated: boolean };

const EMPTY: Snapshot = { ids: new Set(), authenticated: false };

/** target_type → 取得中/取得済みの Promise */
const inflight = new Map<string, Promise<Snapshot>>();

function load(targetType: BookmarkTargetType): Promise<Snapshot> {
  const hit = inflight.get(targetType);
  if (hit) return hit;

  const p = fetch(`/api/bookmarks?target_type=${targetType}`)
    .then((r) => (r.ok ? r.json() : { ids: [], authenticated: false }))
    .then((d: { ids?: string[]; authenticated?: boolean }) => ({
      ids: new Set(Array.isArray(d.ids) ? d.ids : []),
      authenticated: !!d.authenticated,
    }))
    /* ⚠️ 失敗しても throw しない。ブックマークは付加機能で、
          取れなければ「押していない状態」で画面が成立する。 */
    .catch(() => EMPTY);

  inflight.set(targetType, p);
  return p;
}

/** 追加・削除のあとに捨てる。次に読む人が取り直す */
export function invalidateBookmarks(targetType: BookmarkTargetType): void {
  inflight.delete(targetType);
}

/**
 * @returns `ready` が false の間は「未ログイン・未ブックマーク」を返す。
 *          サーバーHTMLもその状態で出るので、ちらつきが最小になる。
 */
export function useBookmarkState(
  targetType: BookmarkTargetType,
  targetId: string,
): { bookmarked: boolean; authenticated: boolean; ready: boolean } {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    load(targetType).then((s) => {
      if (!alive) return;
      setSnap(s);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [targetType]);

  return { bookmarked: snap.ids.has(targetId), authenticated: snap.authenticated, ready };
}
