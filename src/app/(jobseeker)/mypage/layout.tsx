import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /mypage 配下の全ページを包むサブレイアウト。
 * ヘッダー・フッターは (jobseeker)/layout.tsx で提供済みのため重複させない。
 *
 * ⚠️ 2026-09-09 に `MypageMockProvider`（`_components/MypageMockContext.tsx`）を外した。
 *    `isMentor` を配っていたが、**読む側が1箇所も無かった**（`useMypageMock` の参照0件）。
 *    メンター機能そのものが存在しない（CLAUDE.md「メンター機能自体が無い。`ow_mentors` は
 *    migration 132 で作られ 140 で DROP 済み」）ので、値を配る意味も無い。
 *    ⚠️ これでこのレイアウトはサーバーコンポーネントだけになった。
 *       クライアント境界を戻すときは、**読む側があるか**を先に確かめること。
 */
export default function MypageSubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
