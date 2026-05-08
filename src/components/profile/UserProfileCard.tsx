"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InlineEditableSection from "@/components/profile/InlineEditableSection";
import InlineEditableField from "@/components/profile/InlineEditableField";

type UserProfileCardProps = {
  userId: string;
  userName: string;
  userInitial: string;
  userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null;
  userAboutMe?: string | null;
  isMentor: boolean;
};

// ─── Star badge (mentor indicator) ───────────────────────────────────────────

function MentorBadge({ size = 20 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--royal), var(--accent))",
        borderRadius: "50%",
        border: "2px solid #fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
      }}
    >
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
      </svg>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function UserProfileCard({
  userId,
  userName,
  userInitial,
  userAvatar,
  currentRole,
  userLocation,
  userAboutMe,
  isMentor,
}: UserProfileCardProps) {
  // Local state — optimistic update for About Me
  const [aboutMe, setAboutMe] = useState(userAboutMe ?? "");

  const handleUpdateAboutMe = useCallback(
    async (newValue: string): Promise<void> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("ow_users")
        .update({ about_me: newValue })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      // Commit optimistic update only after DB confirms success
      setAboutMe(newValue);
    },
    [userId]
  );

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "24px 28px",
        marginBottom: 20,
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: userAvatar,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 600,
            border: "3px solid #fff",
            boxShadow: "0 2px 10px rgba(15,23,42,0.10)",
          }}
        >
          {userInitial}
        </div>
        {isMentor && (
          <div style={{ position: "absolute", bottom: 0, right: -2 }}>
            <MentorBadge size={20} />
          </div>
        )}
      </div>

      {/* Info area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row + edit button */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 3,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-noto-serif)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {userName}
            {isMentor && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff",
                  borderRadius: "50%",
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                </svg>
              </span>
            )}
          </div>
          <Link
            href="/profile/edit"
            style={{
              padding: "6px 13px",
              background: "#fff",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            プロフィールを編集
          </Link>
        </div>

        {/* 肩書き（mock — 段階3でインライン編集化） */}
        {currentRole && (
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              marginBottom: 6,
            }}
          >
            {currentRole}
          </div>
        )}

        {/* 場所 */}
        {userLocation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "var(--ink-mute)",
              marginBottom: 4,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {userLocation}
          </div>
        )}

        {/* About Me — インライン編集 (Phase ν-6 段階2) */}
        <InlineEditableSection label="自己紹介">
          <InlineEditableField
            value={aboutMe}
            onSave={handleUpdateAboutMe}
            type="textarea"
            placeholder="自己紹介を追加すると、企業やメンターがあなたをより理解できます"
            maxLength={500}
          />
        </InlineEditableSection>
      </div>
    </div>
  );
}
