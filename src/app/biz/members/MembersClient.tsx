"use client";

import { useState } from "react";
import type { MemberRecord } from "@/lib/business/members";

type Tab = "active" | "inactive";

type Props = {
  initialMembers: MemberRecord[];
  currentUserId: string;
};

const PERM_LABELS: Record<MemberRecord["permission"], string> = {
  admin: "管理者",
  member: "メンバー",
};

const PERM_STYLES: Record<MemberRecord["permission"], { bg: string; color: string }> = {
  admin: { bg: "var(--royal-50)", color: "var(--royal)" },
  member: { bg: "var(--line-soft)", color: "var(--ink-mute)" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export function MembersClient({ initialMembers, currentUserId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("active");

  const activeMembers = initialMembers.filter((m) => m.is_active);
  const inactiveMembers = initialMembers.filter((m) => !m.is_active);
  const displayMembers = activeTab === "active" ? activeMembers : inactiveMembers;

  return (
    <div>
      {/* ページヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Noto Serif JP', serif",
            fontWeight: 500,
            fontSize: 26,
            color: "var(--ink)",
            letterSpacing: "0.02em",
            marginBottom: 6,
          }}>
            チーム管理
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            自社の採用担当メンバーを管理します。
          </p>
        </div>
        {/* M-3 で有効化予定 */}
        <button
          disabled
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "var(--line-soft)",
            color: "var(--ink-mute)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "not-allowed",
            flexShrink: 0,
            marginLeft: 24,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          メンバーを追加
        </button>
      </div>

      {/* タブ */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 16,
        borderBottom: "1px solid var(--line)",
        paddingBottom: 0,
      }}>
        {(["active", "inactive"] as const).map((tab) => {
          const count = tab === "active" ? activeMembers.length : inactiveMembers.length;
          const label = tab === "active" ? "アクティブ" : "無効化済み";
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: isSelected ? "2px solid var(--royal)" : "2px solid transparent",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? "var(--royal)" : "var(--ink-mute)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -1,
                transition: "all 0.15s",
              }}
            >
              {label}
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 100,
                background: isSelected ? "var(--royal-50)" : "var(--line-soft)",
                color: isSelected ? "var(--royal)" : "var(--ink-mute)",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* メンバー一覧 */}
      {displayMembers.length === 0 ? (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--ink-mute)",
          fontSize: 13,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}>
          {activeTab === "active" ? "アクティブなメンバーがいません" : "無効化済みのメンバーはいません"}
        </div>
      ) : (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {displayMembers.map((member, index) => {
            const isSelf = member.user_id === currentUserId;
            const ps = PERM_STYLES[member.permission];
            const isLast = index === displayMembers.length - 1;
            return (
              <div
                key={member.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
                  background: isSelf ? "var(--royal-50)" : "#fff",
                  transition: "background 0.1s",
                }}
              >
                {/* アバター */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: member.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}>
                  {member.initial}
                </div>

                {/* 名前・email・役職 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                      {member.name}
                    </span>
                    {isSelf && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 100,
                        background: "var(--royal)",
                        color: "#fff",
                      }}>
                        あなた
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 2 }}>
                    {member.email}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {member.role_title && (
                      <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                        {member.role_title}
                      </span>
                    )}
                    {member.department && (
                      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                        {member.department}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                      {formatDate(member.created_at)} 追加
                    </span>
                  </div>
                </div>

                {/* 権限バッジ + 操作ボタン(M-2 で有効化) */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 100,
                    background: ps.bg,
                    color: ps.color,
                    whiteSpace: "nowrap",
                  }}>
                    {PERM_LABELS[member.permission]}
                  </span>
                  {/* M-2 で有効化 */}
                  <button
                    disabled
                    title="M-2 で実装予定"
                    style={{
                      width: 28,
                      height: 28,
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      background: "#fff",
                      color: "var(--ink-mute)",
                      cursor: "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.4,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
