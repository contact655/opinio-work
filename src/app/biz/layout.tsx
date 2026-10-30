import type { Metadata } from "next";

/**
 * ★/biz 全体のレイアウト（2026-10-30 に2つのまとまりに分けた / 柴さんの指示）。
 *
 *   (public)/ … ログイン・会社の選択・会社の作成（会社の担当者でなくても開ける画面）。枠は描かない
 *   (app)/    … それ以外。枠（ヘッダー・サイドバー）と、会社の担当者かどうかの確認は (app)/layout.tsx
 *
 * ⚠️★2つに分けたのは、App Router がクライアントの遷移で共通のレイアウトを描き直さないため。
 *    それまでは1つのレイアウトがパスを見て枠を出し分けていたので、ログインの画面から /biz の中へ
 *    router で移ると「枠なし」で描いたレイアウトが残り、サイドバーが空・「管理者」が出なかった。
 *    まとまりをまたぐと (app)/layout.tsx が新しく描かれるので、どこから来ても枠が出る。
 * ⚠️ 新しい画面を足すときは、担当者でなくても開ける画面なら (public)、それ以外は (app) に置くこと。
 */
export const metadata: Metadata = {
  /* ★題名を持たない /biz の画面（ログインなど）の既定（2026-10-18）。それまで求職者向けの「OPINIO | IT業界の転職・求人情報」が出ていた */
  title: { absolute: "OPINIO Business" },
  robots: { index: false, follow: false },
};

export default function BizRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
