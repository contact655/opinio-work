"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

const LINE = "var(--line)";
const INK_MUTE = "#94a3b8";

type Props = { totalCount: number };

export default function PostsFilterBar({ totalCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const q = searchParams.get("q") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [searchParams, pathname, router]
  );

  return (
    <div style={{
      position: "sticky", top: 64, zIndex: 50,
      background: "#fff",
      borderBottom: `1px solid ${LINE}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      padding: "20px 0 0",
    }}>
      <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
        <div style={{ padding: "0 0 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* Keyword search */}
          <div role="search" style={{ position: "relative", minWidth: 200, flex: "1 1 240px", maxWidth: 400 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK_MUTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div style={{
              display: "flex", alignItems: "center",
              border: `1.5px solid ${q ? "var(--royal)" : LINE}`,
              borderRadius: 999,
              background: "#fff",
              boxShadow: q ? "0 0 0 3px rgba(0,35,102,0.08)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
              paddingLeft: 36, paddingRight: q ? 32 : 12,
            }}>
              <input
                type="search"
                value={q}
                onChange={(e) => update("q", e.target.value)}
                placeholder="企業名・タイトルで検索"
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 13.5, color: "var(--ink)", padding: "9px 0",
                }}
                aria-label="発信を検索"
              />
              {q && (
                <button type="button" onClick={() => update("q", "")}
                  style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: INK_MUTE, fontSize: 14, lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Count */}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
            {totalCount}件
          </span>

        </div>
      </div>
    </div>
  );
}
