"use client";

/**
 * 開発用の MOCK 状態を提供する Context。
 * 本番運用では、この Provider を Supabase から ow_users.is_mentor を取得して
 * 値を提供する形に差し替える想定。MOCK バナー自体も本番では非表示になる。
 */

import { createContext, useContext, useState } from "react";

type MypageMockContextValue = {
  isMentor: boolean;
  setIsMentor: (v: boolean) => void;
};

const MypageMockContext = createContext<MypageMockContextValue>({
  isMentor: false,
  setIsMentor: () => {},
});

export function MypageMockProvider({ children }: { children: React.ReactNode }) {
  const [isMentor, setIsMentor] = useState(false);
  return (
    <MypageMockContext.Provider value={{ isMentor, setIsMentor }}>
      {children}
    </MypageMockContext.Provider>
  );
}

export function useMypageMock(): MypageMockContextValue {
  return useContext(MypageMockContext);
}
