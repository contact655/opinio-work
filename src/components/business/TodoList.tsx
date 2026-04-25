import type { TodoCounts } from "@/lib/business/dashboard";

const ITEMS: { key: keyof TodoCounts; label: string; emoji: string; urgent?: boolean }[] = [
  { key: "reply_overdue",     label: "返信期限超過",         emoji: "⏰", urgent: true },
  { key: "new_applications",  label: "24時間以内の新規面談申込", emoji: "📩" },
  { key: "interviews_today",  label: "今日の面談",           emoji: "📅" },
];

export function TodoList({ counts }: { counts: TodoCounts }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
        今日のTo-Do
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ITEMS.map((item) => {
          const value = counts[item.key];
          const isAlert = item.urgent && value > 0;
          return (
            <div
              key={item.key}
              style={{
                background: isAlert ? "#fef2f2" : "#fff",
                border: `0.5px solid ${isAlert ? "#fca5a5" : "#e5e7eb"}`,
                borderRadius: 8,
                padding: "16px 14px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{item.emoji}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: isAlert ? "#dc2626" : "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>件</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{item.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
