"use client";

import { createContext, useContext } from "react";

/**
 * ★`/biz` のサイドバーが使う「いまの企業」の情報（2026-09-21）。
 *
 * `BusinessLayout` は**各ページが自分で描画する**（`/biz` 配下の約30ファイル）ので、
 * サイドバーに新しい値を渡すたびに全ページの props を足すことになる。
 * そこで `app/biz/layout.tsx` がここに1回だけ入れ、サイドバーは useContext で読む。
 *
 * ⚠️★**`hasPublicPage` の判定は `hasPublicCompanyPage` の1箇所**（layout 側で呼ぶ）。
 *    ここで `is_published` を見直さないこと。
 * ⚠️ Provider の外（`/biz/auth` などの除外パス）では既定値になり、
 *    「公開ページを見る」は**出ない**。押すと 404 になるリンクを出さない向きに倒してある。
 */
export type BizShell = {
  tenantId: string | null;
  hasPublicPage: boolean;
};

const BizShellContext = createContext<BizShell>({ tenantId: null, hasPublicPage: false });

export function BizShellProvider({ value, children }: { value: BizShell; children: React.ReactNode }) {
  return <BizShellContext.Provider value={value}>{children}</BizShellContext.Provider>;
}

export function useBizShell(): BizShell {
  return useContext(BizShellContext);
}
