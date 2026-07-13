"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || null });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/pv", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/pv", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      // 握りつぶす
    }
  }, [pathname]);

  return null;
}
