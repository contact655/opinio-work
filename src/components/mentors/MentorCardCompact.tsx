// src/components/mentors/MentorCardCompact.tsx
// カルーセル用メンターカード（CompanyCardCompact と同トンマナ）

import Link from "next/link";
import type { MentorData } from "@/lib/supabase/queries";

type Props = {
  mentor: MentorData;
};

export function MentorCardCompact({ mentor }: Props) {
  return (
    <Link href={`/mentors/${mentor.id}`} className="genre-card mentor-card-compact">
      {/* アバターエリア */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "22px 14px 14px",
        background: `linear-gradient(160deg, ${mentor.gradient.includes("gradient") ? "var(--royal-50)" : "var(--royal-50)"} 0%, #f0f4ff 100%)`,
        gap: 10,
        position: "relative",
      }}>
        {/* 受付ステータス */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
          background: mentor.is_available ? "rgba(5,150,105,0.12)" : "rgba(148,163,184,0.15)",
          color: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
          border: `1px solid ${mentor.is_available ? "#A7F3D0" : "var(--line)"}`,
        }}>
          <span style={{
            width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
            background: mentor.is_available ? "var(--success)" : "var(--ink-mute)",
          }} className={mentor.is_available ? "pulse-dot" : undefined} />
          {mentor.is_available ? "受付中" : "停止中"}
        </div>

        {/* アバター */}
        <div style={{
          width: 68, height: 68, borderRadius: "50%",
          background: mentor.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 24, fontWeight: 700,
          flexShrink: 0,
          boxShadow: mentor.is_available
            ? "0 0 0 3px #fff, 0 0 0 5.5px var(--royal), 0 0 12px rgba(0,35,102,0.2)"
            : "0 0 0 3px #fff, 0 0 0 5.5px var(--line)",
        }}>
          {mentor.initial}
        </div>

        {/* 名前 + 会社 */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
            {mentor.name}さん
          </div>
          {mentor.current_company && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 3 }}>
              {mentor.current_company}
              {mentor.current_role && <span style={{ color: "var(--ink-mute)" }}> · {mentor.current_role}</span>}
            </div>
          )}
        </div>
      </div>

      {/* カード本体 */}
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {/* キャッチフレーズ */}
        {mentor.catchphrase && (
          <div style={{
            fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.65,
            fontStyle: "italic",
            padding: "7px 10px",
            background: "var(--royal-50)",
            borderLeft: "2px solid var(--royal)",
            borderRadius: "0 6px 6px 0",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}>
            「{mentor.catchphrase}」
          </div>
        )}

        {/* 相談テーマタグ */}
        {mentor.themes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {mentor.themes.slice(0, 3).map((theme) => (
              <span key={theme} style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 100,
                background: "#fff", border: "1px solid var(--royal-100)",
                color: "var(--royal)", fontWeight: 600, lineHeight: 1.4,
              }}>
                {theme}
              </span>
            ))}
          </div>
        )}

        {/* 相談実績 */}
        {(mentor.success_count ?? 0) > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10.5, fontWeight: 700, color: "var(--success)",
            padding: "3px 8px", borderRadius: 6,
            background: "var(--success-soft)", border: "1px solid #A7F3D0",
            alignSelf: "flex-start",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            相談実績 {mentor.success_count}件
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--line-soft, #F1F5F9)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: "10px",
            background: mentor.is_available
              ? "linear-gradient(135deg, #F59E0B, #D97706)"
              : "var(--bg-tint)",
            color: mentor.is_available ? "#fff" : "var(--ink-mute)",
            border: mentor.is_available ? "none" : "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 12.5, fontWeight: 700,
            boxShadow: mentor.is_available ? "0 2px 8px rgba(245,158,11,0.3)" : "none",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {mentor.is_available ? "相談する（無料）" : "詳細を見る"}
          </div>
        </div>
      </div>
    </Link>
  );
}
