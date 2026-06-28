import type { Metadata } from "next";
import { MypageMockProvider } from "./_components/MypageMockContext";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /mypage 配下の全ページを包むサブレイアウト。
 * MypageMockProvider により isMentor 状態を全サブページで共有する。
 * ヘッダー・フッターは (jobseeker)/layout.tsx で提供済みのため重複させない。
 */
export default function MypageSubLayout({ children }: { children: React.ReactNode }) {
  return (
    <MypageMockProvider>
      {children}
    </MypageMockProvider>
  );
}
