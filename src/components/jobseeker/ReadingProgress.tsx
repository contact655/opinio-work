"use client";

import { useEffect, useState } from "react";

/**
 * Thin reading-progress bar fixed to the top of the viewport.
 * Fills from 0% → 100% as the user scrolls to the bottom of the page.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };

    window.addEventListener("scroll", update, { passive: true });
    update(); // initialise
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 200,
        background: "var(--line-soft)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--royal) 0%, var(--accent) 100%)",
          transition: "width 0.1s linear",
          willChange: "width",
        }}
      />
    </div>
  );
}
