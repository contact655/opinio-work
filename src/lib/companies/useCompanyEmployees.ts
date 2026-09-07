"use client";

import { useEffect, useState } from "react";
import type { EmployeesResponse } from "@/app/(jobseeker)/companies/[id]/CompanyEmployeeSections";

/**
 * 企業詳細ページの「閲覧者ごとに絞られた社員・面談対応者」をクライアント側で取る。
 *
 * ── なぜクライアントで取るか ──────────────────────────────────────────────────
 * `/companies/[id]` は `export const revalidate = 60` ＋ `generateStaticParams` の **ISR ページ**。
 * サーバーで `auth.getUser()` を読むと動的化してキャッシュが効かなくなるため、
 * 閲覧者依存のものは全部この API（`force-dynamic`）に追い出してある（2026-08-09）。
 *
 * ── なぜこのファイルが要るか（2026-09-07）────────────────────────────────────
 * ⚠️★**同じページの2つのコンポーネントが、同じエンドポイントを別々に叩いていた。**
 *      - `CompanyEmployeeSections`（本文の「社員・OB/OG」）
 *      - `AmbassadorWidget`（サイドバーの「カジュアル面談OK」）
 *    実測（**本番** opinio.jp / `/companies/salesforce`）:
 *      viewer-state … 1回（`useCompanyViewerState` が同じ形で束ねているため）
 *      employees    … **2回**（start 489ms / 490ms・所要 133ms / 218ms）
 *    **dev の StrictMode 二重実行ではない。本番ビルドでも2回飛んでいた。**
 *
 * ⚠️ 隣の [useCompanyViewerState](./useCompanyViewerState.ts) には**最初からこの仕組みがあった**
 *    （「同じページで複数のボタンが呼ぶ。企業IDごとに1本だけ飛ばすようモジュール変数で
 *      キャッシュする」）。**employees 側だけ素の fetch のまま残っていた。**
 *    → 2つを**同じディレクトリに並べてある**。新しく閲覧者依存の API を足すときは、
 *      **必ずどちらかと同じ形にすること**（素の `fetch` をコンポーネントに書かない）。
 *
 * ⚠️ 無効化関数（`invalidate...`）は**あえて置いていない**。viewer-state はブックマークと
 *    フォローで自分自身を書き換えるので要るが、社員一覧をこのページから変更する経路は無い。
 *    呼ばれない関数を対称性のためだけに置かない。要るようになったら足すこと。
 */

/** companyId → 取得中/取得済みの Promise。TTL は張らない（1ページ表示の間だけ持てばよい） */
const inflight = new Map<string, Promise<EmployeesResponse | null>>();

function load(companyId: string): Promise<EmployeesResponse | null> {
  const hit = inflight.get(companyId);
  if (hit) return hit;

  const p = fetch(`/api/jobseeker/companies/${companyId}/employees`)
    .then((r) => (r.ok ? (r.json() as Promise<EmployeesResponse>) : null))
    /* ⚠️ 失敗しても throw しない（社員一覧は付加情報で、出なくてもページは成立する）。
          ただし**握り潰さない** —— ログは必ず出す。CLAUDE.md「エラーと失敗を握りつぶさない」。 */
    .catch((e) => {
      console.error("[useCompanyEmployees]", e);
      return null;
    });

  inflight.set(companyId, p);
  return p;
}

/**
 * @returns 取得前は `data === null`。**呼び出し側は取得前に何も描かないこと。**
 *          未ログインには元から0件で「社員セクションが無い」のが正しい表示なので、
 *          空の箱を先に出すと、その人には最後まで空箱が残る。
 */
export function useCompanyEmployees(companyId: string): EmployeesResponse | null {
  const [data, setData] = useState<EmployeesResponse | null>(null);

  useEffect(() => {
    let alive = true;
    load(companyId).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  return data;
}
