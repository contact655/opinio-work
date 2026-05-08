import { MypageMockProvider } from "./_components/MypageMockContext";

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
