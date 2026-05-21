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
        padding: "20px 14px 16px",
        background: "var(--bg-tint)",
        gap: 10,
      }}>
        {/* アバター円 */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: mentor.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 22, fontWeight: 700,
          flexShrink: 0,
          boxShadow: "0 0 0 3px #fff, 0 0 0 5px var(--royal), 0 0 0 7px rgba(0,35,102,0.12)",
        }}>
          {mentor.initial}
        </div>

        {/* 名前 */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--ink)",
          textAlign: "center", lineHeight: 1.3,
        }}>
          {mentor.name}さん
        </div>
      </div>

      {/* カード本体 */}
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {/* 会社・ポジション */}
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>
            {mentor.current_company || "（非公開）"}
          </span>
          {mentor.current_role && (
            <span style={{ color: "var(--ink-soft)" }}> · {mentor.current_role}</span>
          )}
        </div>

        {/* 相談テーマタグ */}
        {mentor.themes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {mentor.themes.slice(0, 3).map((theme) => (
              <span key={theme} style={{
                fontSize: 10.5, padding: "3px 9px", borderRadius: 100,
                background: "#fff", border: "1px solid var(--royal-100)",
                color: "var(--royal)", fontWeight: 600, lineHeight: 1.4,
              }}>
                {theme}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--line-soft, #F1F5F9)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", padding: "9px",
            background: "var(--royal-50)", color: "var(--royal)",
            border: "1px solid var(--royal-100)",
            borderRadius: 8,
            fontSize: 12.5, fontWeight: 700,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            この人に相談する
          </div>
        </div>
      </div>
    </Link>
  );
}
