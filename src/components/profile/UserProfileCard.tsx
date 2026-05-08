"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InlineEditableSection from "@/components/profile/InlineEditableSection";
import InlineEditableField from "@/components/profile/InlineEditableField";
import Toast from "@/components/ui/Toast";
import { LOCATIONS, AGE_RANGES } from "@/app/profile/edit/mockProfileData";
import CareerHistoryEditor from "@/components/profile/CareerHistoryEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

type SnsLinks = { twitter: string; linkedin: string; note: string };

type UserProfileCardProps = {
  userId: string;
  userName: string;
  userInitial: string;
  userAvatar: string;
  currentRole?: string | null;
  userLocation?: string | null;
  userAboutMe?: string | null;
  userAgeRange?: string | null;
  userFutureAspirations?: string | null;
  userSocialLinks?: Record<string, string> | null;
  isMentor: boolean;
};

function parseSns(raw: Record<string, string> | null | undefined): SnsLinks {
  return {
    twitter: raw?.["twitter"] ?? "",
    linkedin: raw?.["linkedin"] ?? "",
    note: raw?.["note"] ?? "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function PencilIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// SNS platform icons
const SnsIcons = {
  twitter: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  linkedin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43c-1.14 0-2.06-.93-2.06-2.07 0-1.14.92-2.06 2.06-2.06s2.06.92 2.06 2.06c0 1.14-.92 2.07-2.06 2.07zm1.78 13.02H3.56V9h3.56v11.45z" />
    </svg>
  ),
  note: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
};

// Shared save button style
function actionBtnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: primary ? (disabled ? "var(--ink-mute)" : "var(--royal)") : "#fff",
    color: primary ? "#fff" : "var(--ink-soft)",
    border: primary ? "none" : "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: primary ? 700 : 600,
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
    opacity: !primary && disabled ? 0.5 : 1,
    transition: "background 0.15s",
  };
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
  userAgeRange,
  userFutureAspirations,
  userSocialLinks,
  isMentor,
}: UserProfileCardProps) {

  // ── Per-field state (all optimistic) ────────────────────────────────
  const [displayName, setDisplayName] = useState(userName);
  const [aboutMe, setAboutMe] = useState(userAboutMe ?? "");
  const [location, setLocation] = useState(userLocation ?? "");
  const [ageRange, setAgeRange] = useState(userAgeRange ?? "");
  const [futureAspirations, setFutureAspirations] = useState(userFutureAspirations ?? "");
  const [sns, setSns] = useState<SnsLinks>(() => parseSns(userSocialLinks));

  // ── Name inline edit (custom — heading needs 20px serif styling) ─────
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameEditValue, setNameEditValue] = useState(userName);
  const [nameToast, setNameToast] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const startNameEdit = useCallback(() => {
    setNameEditValue(displayName);
    setNameEditing(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [displayName]);

  const cancelNameEdit = useCallback(() => {
    setNameEditing(false);
    setNameEditValue(displayName);
  }, [displayName]);

  const saveNameEdit = useCallback(async () => {
    const trimmed = nameEditValue.trim();
    if (!trimmed || trimmed === displayName) { cancelNameEdit(); return; }
    setNameSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("ow_users").update({ name: trimmed }).eq("id", userId);
      if (error) throw new Error(error.message);
      setDisplayName(trimmed);
      setNameEditing(false);
    } catch {
      setNameToast("保存に失敗しました。もう一度お試しください。");
      setNameEditing(false);
    } finally {
      setNameSaving(false);
    }
  }, [nameEditValue, displayName, userId, cancelNameEdit]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cancelNameEdit(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void saveNameEdit(); }
    },
    [cancelNameEdit, saveNameEdit]
  );

  // ── Supabase field updaters (for InlineEditableField) ───────────────
  const makeUpdater = useCallback(
    (dbField: string, setter: (v: string) => void) =>
      async (newValue: string): Promise<void> => {
        const supabase = createClient();
        const { error } = await supabase
          .from("ow_users")
          .update({ [dbField]: newValue || null })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        setter(newValue);
      },
    [userId]
  );

  const handleUpdateAboutMe = useCallback(makeUpdater("about_me", setAboutMe), [makeUpdater]);
  const handleUpdateLocation = useCallback(makeUpdater("location", setLocation), [makeUpdater]);
  const handleUpdateAgeRange = useCallback(makeUpdater("age_range", setAgeRange), [makeUpdater]);
  const handleUpdateFutureAspirations = useCallback(
    makeUpdater("future_aspirations", setFutureAspirations),
    [makeUpdater]
  );

  // ── SNS section state ────────────────────────────────────────────────
  const [snsEditing, setSnsEditing] = useState(false);
  const [snsSaving, setSnsSaving] = useState(false);
  const [snsEditValue, setSnsEditValue] = useState<SnsLinks>(sns);
  const [snsToast, setSnsToast] = useState<string | null>(null);

  const startSnsEdit = useCallback(() => {
    setSnsEditValue(sns);
    setSnsEditing(true);
  }, [sns]);

  const cancelSnsEdit = useCallback(() => {
    setSnsEditing(false);
    setSnsEditValue(sns);
  }, [sns]);

  const saveSns = useCallback(async () => {
    setSnsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("ow_users")
        .update({ social_links: snsEditValue })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      setSns(snsEditValue);
      setSnsEditing(false);
    } catch {
      setSnsToast("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSnsSaving(false);
    }
  }, [snsEditValue, userId]);

  // Derived
  const displayInitial = displayName.charAt(0) || userInitial;

  // ── Render ────────────────────────────────────────────────────────────
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
          {displayInitial}
        </div>
        {isMentor && (
          <div style={{ position: "absolute", bottom: 0, right: -2 }}>
            <MentorBadge size={20} />
          </div>
        )}
      </div>

      {/* Info area */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Name row (custom inline edit — 20px Noto Serif heading) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 3,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {nameEditing ? (
              /* Edit mode */
              <div>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameEditValue}
                  onChange={(e) => setNameEditValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  disabled={nameSaving}
                  maxLength={50}
                  placeholder="お名前"
                  style={{
                    width: "100%",
                    border: "1.5px solid var(--royal)",
                    borderRadius: 8,
                    padding: "7px 10px",
                    fontSize: 18,
                    fontFamily: "var(--font-noto-serif)",
                    fontWeight: 700,
                    color: "var(--ink)",
                    background: nameSaving ? "var(--bg-tint)" : "#fff",
                    outline: "none",
                    boxShadow: "0 0 0 3px rgba(0,35,102,0.08)",
                    opacity: nameSaving ? 0.6 : 1,
                    boxSizing: "border-box",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={cancelNameEdit}
                    disabled={nameSaving}
                    style={actionBtnStyle(false, nameSaving)}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveNameEdit()}
                    disabled={nameSaving || !nameEditValue.trim()}
                    style={actionBtnStyle(true, nameSaving || !nameEditValue.trim())}
                  >
                    {nameSaving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode — click to edit */
              <div
                className="upc-name-display"
                onClick={startNameEdit}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startNameEdit(); }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-noto-serif)",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "var(--ink)",
                  cursor: "text",
                  borderRadius: 6,
                  padding: "4px 6px",
                  margin: "-4px -6px",
                  position: "relative",
                  transition: "background 0.15s",
                }}
              >
                {displayName}
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
                <span
                  className="upc-name-pencil"
                  aria-hidden
                  style={{
                    color: "var(--ink-mute)",
                    opacity: 0,
                    transition: "opacity 0.15s",
                    display: "flex",
                    alignItems: "center",
                    marginLeft: 2,
                  }}
                >
                  <PencilIcon size={14} />
                </span>
              </div>
            )}
          </div>

          {/* プロフィールを編集 button (always visible in display mode) */}
          {!nameEditing && (
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
          )}
        </div>

        {/* currentRole (mock — 段階3でインライン編集化しない) */}
        {currentRole && !nameEditing && (
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              marginBottom: 2,
            }}
          >
            {currentRole}
          </div>
        )}

        {/* ── 所在地 */}
        <InlineEditableSection label="所在地">
          <InlineEditableField
            value={location}
            onSave={handleUpdateLocation}
            type="select"
            options={LOCATIONS}
            placeholder="都道府県を選択"
          />
        </InlineEditableSection>

        {/* ── 年齢層 */}
        <InlineEditableSection label="年齢層">
          <InlineEditableField
            value={ageRange}
            onSave={handleUpdateAgeRange}
            type="select"
            options={AGE_RANGES}
            placeholder="年齢層を選択"
          />
        </InlineEditableSection>

        {/* ── 自己紹介 (About Me) */}
        <InlineEditableSection label="自己紹介">
          <InlineEditableField
            value={aboutMe}
            onSave={handleUpdateAboutMe}
            type="textarea"
            placeholder="自己紹介を追加すると、企業やメンターがあなたをより理解できます"
            maxLength={500}
          />
        </InlineEditableSection>

        {/* ── この先やってみたいこと (Future Aspirations) */}
        <InlineEditableSection label="この先やってみたいこと">
          <InlineEditableField
            value={futureAspirations}
            onSave={handleUpdateFutureAspirations}
            type="textarea"
            placeholder="キャリアの次のチャプターは何ですか？"
            maxLength={500}
          />
        </InlineEditableSection>

        {/* ── 職歴 (CareerHistoryEditor manages its own state / API) */}
        <InlineEditableSection label="職歴">
          <CareerHistoryEditor />
        </InlineEditableSection>

        {/* ── SNSリンク (Section-level edit) */}
        <InlineEditableSection
          label="SNSリンク"
          sectionEditMode
          isEditing={snsEditing}
          isSaving={snsSaving}
          onEdit={startSnsEdit}
          onSave={() => { void saveSns(); }}
          onCancel={cancelSnsEdit}
        >
          {snsEditing ? (
            /* Edit mode: 3 text inputs */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "twitter" as const, label: "X（旧Twitter）", placeholder: "https://x.com/yourname", icon: SnsIcons.twitter },
                { key: "linkedin" as const, label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname", icon: SnsIcons.linkedin },
                { key: "note" as const, label: "note", placeholder: "https://note.com/yourname", icon: SnsIcons.note },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      color: "var(--ink-soft)",
                      fontWeight: 600,
                      marginBottom: 4,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {icon} {label}
                  </div>
                  <input
                    type="url"
                    value={snsEditValue[key]}
                    onChange={(e) =>
                      setSnsEditValue((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    disabled={snsSaving}
                    style={{
                      width: "100%",
                      border: "1.5px solid var(--royal)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--ink)",
                      background: snsSaving ? "var(--bg-tint)" : "#fff",
                      outline: "none",
                      fontFamily: "Inter, sans-serif",
                      boxShadow: "0 0 0 3px rgba(0,35,102,0.08)",
                      opacity: snsSaving ? 0.6 : 1,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Display mode */
            <div>
              {sns.twitter || sns.linkedin || sns.note ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {sns.twitter && (
                    <a
                      href={sns.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--royal)",
                        textDecoration: "none",
                        wordBreak: "break-all",
                      }}
                    >
                      {SnsIcons.twitter}
                      <span style={{ opacity: 0.85 }}>{sns.twitter}</span>
                    </a>
                  )}
                  {sns.linkedin && (
                    <a
                      href={sns.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--royal)",
                        textDecoration: "none",
                        wordBreak: "break-all",
                      }}
                    >
                      {SnsIcons.linkedin}
                      <span style={{ opacity: 0.85 }}>{sns.linkedin}</span>
                    </a>
                  )}
                  {sns.note && (
                    <a
                      href={sns.note}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--royal)",
                        textDecoration: "none",
                        wordBreak: "break-all",
                      }}
                    >
                      {SnsIcons.note}
                      <span style={{ opacity: 0.85 }}>{sns.note}</span>
                    </a>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-mute)",
                    fontStyle: "italic",
                    lineHeight: 1.7,
                  }}
                >
                  SNS リンクを追加すると企業やメンターに見てもらえます
                </div>
              )}
            </div>
          )}
        </InlineEditableSection>
      </div>

      {/* Name save error toast */}
      {nameToast && (
        <Toast message={nameToast} variant="error" onDone={() => setNameToast(null)} />
      )}

      {/* SNS save error toast */}
      {snsToast && (
        <Toast message={snsToast} variant="error" onDone={() => setSnsToast(null)} />
      )}

      <style>{`
        .upc-name-display:hover { background: var(--line-soft) !important; }
        @media (hover: hover) {
          .upc-name-display:hover .upc-name-pencil { opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
