"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export function usePageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window.gtag === "undefined") return;
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId) return;

    window.gtag("config", gaId, {
      page_path: pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
    });
  }, [pathname, searchParams]);
}
