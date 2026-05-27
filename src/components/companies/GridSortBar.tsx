"use client";
import { useRouter, useSearchParams } from "next/navigation";

type Props = { totalCount: number };

export function GridSortBar({ totalCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "newest";

  const setSort = (s: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s === "newest") p.delete("sort");
    else p.set("sort", s);
    router.push(`/companies?${p.toString()}`);
  };

  const options = [
    { value: "newest", label: "新着順" },
    { value: "jobs", label: "求人あり優先" },
    { value: "employees", label: "社員数多い順" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
        <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{totalCount}</strong>社
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setSort(o.value)}
            style={{
              padding: "5px 12px", borderRadius: 100,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1px solid",
              background: current === o.value ? "var(--royal)" : "#fff",
              color: current === o.value ? "#fff" : "var(--ink-mute)",
              borderColor: current === o.value ? "var(--royal)" : "var(--line)",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
