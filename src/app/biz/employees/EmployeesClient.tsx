"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BizEmployee } from "./page";

type Props = {
  current: BizEmployee[];
  alumni: BizEmployee[];
  hidden: BizEmployee[];
  companyName: string;
};

type Tab = "current" | "alumni" | "hidden";

function formatPeriod(startedAt: string, endedAt: string | null, isCurrent: boolean): string {
  const start = startedAt.slice(0, 7).replace("-", ".");
  if (isCurrent) return `${start} 〜 現在`;
  const end = endedAt ? endedAt.slice(0, 7).replace("-", ".") : "";
  return `${start} 〜 ${end}`;
}

function calcDuration(startedAt: string, endedAt: string | null, isCurrent: boolean): string {
  const start = new Date(startedAt);
  const end = isCurrent ? new Date() : (endedAt ? new Date(endedAt) : new Date());
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 12) return `${months}ヶ月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}年${m}ヶ月` : `${y}年`;
}

function AvatarCircle({ name, avatarUrl, size = 44 }: { name: string | null; avatarUrl: string | null; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  const colors = ["#002366", "#3B5FD9", "#059669", "#7C3AED", "#D97706"];
  const colorIdx = (name ?? "").charCodeAt(0) % colors.length;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ""}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[colorIdx]}, ${colors[(colorIdx + 1) % colors.length]})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif", fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    }}>
      {initial}
    </div>
  );
}

function EmployeeCard({
  emp,
  onHide,
  isPending,
}: {
  emp: BizEmployee;
  onHide: (experienceId: string) => void;
  isPending: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 10,
    }}>
      {/* プロフィールリンク */}
      <Link href={`/u/${emp.userId}`} target="_blank" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <AvatarCircle name={emp.name} avatarUrl={emp.avatarUrl} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {emp.name ?? "名前未設定"}
            </span>
            {emp.isMentor && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--royal)",
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                borderRadius: 4, padding: "1px 6px",
              }}>
                メンター
              </span>
            )}
          </div>
          {emp.roleTitle && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {emp.roleTitle}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
              {formatPeriod(emp.startedAt, emp.endedAt, emp.isCurrent)}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: emp.isCurrent ? "var(--success)" : "var(--ink-mute)",
              background: emp.isCurrent ? "var(--success-soft)" : "var(--line-soft)",
              border: `1px solid ${emp.isCurrent ? "#A7F3D0" : "var(--line)"}`,
              borderRadius: 4, padding: "1px 6px", fontFamily: "Inter, sans-serif",
            }}>
              {calcDuration(emp.startedAt, emp.endedAt, emp.isCurrent)}
            </span>
          </div>
        </div>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>

      {/* 非表示ボタン */}
      <div style={{ flexShrink: 0, marginLeft: 8 }}>
        {confirming ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>企業ページから非表示にしますか？</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => { onHide(emp.experienceId); setConfirming(false); }}
              style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px",
                background: "var(--error)", color: "#fff",
                border: "none", borderRadius: 6, cursor: "pointer",
              }}
            >
              {isPending ? "処理中..." : "非表示にする"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                fontSize: 11, padding: "4px 10px",
                background: "none", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              }}
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              fontSize: 11, fontWeight: 600, padding: "5px 10px",
              background: "none", color: "var(--ink-mute)",
              border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            非表示
          </button>
        )}
      </div>
    </div>
  );
}

function HiddenCard({
  emp,
  onUnhide,
  isPending,
}: {
  emp: BizEmployee;
  onUnhide: (experienceId: string) => void;
  isPending: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px",
      background: "var(--bg-tint)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      opacity: 0.75,
    }}>
      <AvatarCircle name={emp.name} avatarUrl={emp.avatarUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
            {emp.name ?? "名前未設定"}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            color: "#92400E", background: "#FEF3C7", border: "1px solid #FDE68A",
            borderRadius: 4, padding: "1px 6px", fontFamily: "Inter, sans-serif",
          }}>
            非表示中
          </span>
        </div>
        {emp.roleTitle && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {emp.roleTitle}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() => onUnhide(emp.experienceId)}
        style={{
          fontSize: 11, fontWeight: 600, padding: "5px 12px",
          background: "#fff", color: "var(--success)",
          border: "1px solid #A7F3D0", borderRadius: 6, cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {isPending ? "処理中..." : "表示に戻す"}
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg-tint)",
      border: "1px dashed var(--line)", borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
        {label}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.75, margin: 0 }}>
        社員・OBOGがプロフィールにこの企業を登録すると<br />自動的にここに表示されます。
      </p>
    </div>
  );
}

export function EmployeesClient({ current, alumni, hidden, companyName }: Props) {
  const [tab, setTab] = useState<Tab>("current");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleHide = (experienceId: string) => {
    startTransition(async () => {
      await fetch("/api/biz/hidden-experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId }),
      });
      router.refresh();
    });
  };

  const handleUnhide = (experienceId: string) => {
    startTransition(async () => {
      await fetch(`/api/biz/hidden-experiences?experience_id=${experienceId}`, {
        method: "DELETE",
      });
      router.refresh();
    });
  };

  const list = tab === "current" ? current : tab === "alumni" ? alumni : hidden;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 32px 80px" }}>

      {/* ページヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
          社員管理
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          OPINIOに登録された{companyName}の現役社員・OB/OGの一覧です。ユーザーが企業マスタからこの企業を選択すると自動的に反映されます。
        </p>
        {hidden.length > 0 && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#92400E" }}>
            企業ページから非表示中のメンバー: {hidden.length}名 — 「非表示中」タブから解除できます
          </div>
        )}
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--line)", marginBottom: 20 }}>
        {[
          { key: "current" as const, label: "現役社員", count: current.length },
          { key: "alumni" as const, label: "OB・OG社員", count: alumni.length },
          { key: "hidden" as const, label: "非表示中", count: hidden.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: "10px 20px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === key ? (key === "hidden" ? "#D97706" : "var(--royal)") : "transparent"}`,
              marginBottom: -2,
              fontSize: 13, fontWeight: tab === key ? 700 : 500,
              color: tab === key ? (key === "hidden" ? "#D97706" : "var(--royal)") : "var(--ink-mute)",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {label}
            {count > 0 && (
              <span style={{
                fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
                padding: "1px 6px", borderRadius: 10,
                background: tab === key ? (key === "hidden" ? "#FEF3C7" : "var(--royal-50)") : "var(--line-soft)",
                color: tab === key ? (key === "hidden" ? "#92400E" : "var(--royal)") : "var(--ink-mute)",
              }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 非表示タブの説明 */}
      {tab === "hidden" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#92400E", lineHeight: 1.7 }}>
          企業ページ（公開面）から非表示にしたメンバーです。<br />
          ユーザー自身のプロフィール（/u/...）には変わらず表示されます。「表示に戻す」で解除できます。
        </div>
      )}

      {/* リスト */}
      {tab === "hidden" ? (
        list.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg-tint)",
            border: "1px dashed var(--line)", borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              非表示中のメンバーはいません
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(list as BizEmployee[]).map((emp) => (
              <HiddenCard
                key={emp.experienceId}
                emp={emp}
                onUnhide={handleUnhide}
                isPending={isPending}
              />
            ))}
          </div>
        )
      ) : (
        list.length === 0 ? (
          <EmptyState
            label={tab === "current" ? "現役社員の登録がありません" : "OB・OG社員の登録がありません"}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(list as BizEmployee[]).map((emp) => (
              <EmployeeCard
                key={emp.experienceId}
                emp={emp}
                onHide={handleHide}
                isPending={isPending}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
