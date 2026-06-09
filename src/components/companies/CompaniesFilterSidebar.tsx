"use client";

// #4: サイドバーフィルター（デスクトップ専用・lg以上で表示）
// Link ベースのナビゲーション（useSearchParams で現在値を読む）

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PHASES = [
  "シード",
  "シリーズA",
  "シリーズB-C",
  "レイターステージ",
  "上場(東証グロース)",
  "上場(東証プライム)",
  "上場(東証スタンダード)",
];

const WORK_STYLES = [
  { value: "full_remote", label: "フルリモート可" },
  { value: "hybrid",      label: "ハイブリッド" },
  { value: "on_site",     label: "原則出社" },
];

type Props = {
  industries: string[];
  locations: string[];
};

function FilterOption({
  href, active, label, count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 0",
        fontSize: 13,
        color: active ? "var(--royal)" : "var(--ink-soft)",
        fontWeight: active ? 700 : 400,
        textDecoration: "none",
        transition: "color 0.15s",
      }}
    >
      {/* チェックボックス風アイコン */}
      <span style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: active ? "none" : "1.5px solid var(--line)",
        background: active ? "var(--royal)" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {active && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>{count}</span>
      )}
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
        textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: 8, paddingBottom: 6,
        borderBottom: "1px solid var(--line)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SidebarInner({ industries, locations }: Props) {
  const searchParams = useSearchParams();
  const currentPhase = searchParams.get("phase");
  const currentWorkStyle = searchParams.get("workStyle");
  const currentLocation = searchParams.get("location");
  const currentIndustry = searchParams.get("industry");
  const currentHiring = searchParams.get("hiring");

  const hasFilters = currentPhase || currentWorkStyle || currentLocation || currentIndustry || currentHiring;

  // URL を組み立てる（toggleパラメータ）
  const buildUrl = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (p.get(key) === value) {
      p.delete(key);
    } else {
      p.set(key, value);
    }
    // ページリセット
    p.delete("page");
    const qs = p.toString();
    return `/companies${qs ? `?${qs}` : ""}`;
  };

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      position: "sticky",
      top: 120,
      maxHeight: "calc(100vh - 140px)",
      overflowY: "auto",
      paddingRight: 4,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" style={{ marginRight: 5, verticalAlign: "middle" }}>
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="20" y2="12"/>
            <line x1="12" y1="18" x2="20" y2="18"/>
          </svg>
          絞り込む
        </span>
        {hasFilters && (
          <Link href="/companies" style={{
            fontSize: 11, color: "var(--royal)", textDecoration: "none",
            fontWeight: 600, padding: "2px 8px", borderRadius: 100,
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          }}>
            リセット
          </Link>
        )}
      </div>

      {/* 面談受付中 */}
      <FilterGroup title="ステータス">
        <FilterOption
          href={buildUrl("hiring", "1")}
          active={currentHiring === "1"}
          label="面談受付中のみ"
        />
      </FilterGroup>

      {/* フェーズ */}
      <FilterGroup title="フェーズ">
        {PHASES.map((phase) => (
          <FilterOption
            key={phase}
            href={buildUrl("phase", phase)}
            active={currentPhase === phase}
            label={phase}
          />
        ))}
      </FilterGroup>

      {/* 勤務形態 */}
      <FilterGroup title="勤務形態">
        {WORK_STYLES.map((ws) => (
          <FilterOption
            key={ws.value}
            href={buildUrl("workStyle", ws.value)}
            active={currentWorkStyle === ws.value}
            label={ws.label}
          />
        ))}
      </FilterGroup>

      {/* 業種 */}
      {industries.length > 0 && (
        <FilterGroup title="業種">
          {industries.map((ind) => (
            <FilterOption
              key={ind}
              href={buildUrl("industry", ind)}
              active={currentIndustry === ind}
              label={ind}
            />
          ))}
        </FilterGroup>
      )}

      {/* 所在地 */}
      {locations.length > 0 && (
        <FilterGroup title="所在地">
          {locations.map((loc) => (
            <FilterOption
              key={loc}
              href={buildUrl("location", loc)}
              active={currentLocation === loc}
              label={loc}
            />
          ))}
        </FilterGroup>
      )}
    </aside>
  );
}

export function CompaniesFilterSidebar(props: Props) {
  return (
    <Suspense fallback={
      <aside style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>絞り込む</div>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 24, background: "#f1f5f9", borderRadius: 6, marginBottom: 8 }} />
        ))}
      </aside>
    }>
      <SidebarInner {...props} />
    </Suspense>
  );
}
