"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { MemberRecord, PendingInviteRecord } from "@/lib/business/members";
import Toast from "@/components/ui/Toast";

type ActionType = "permission" | "deactivate" | "reactivate";
type ProfileEditTarget = { id: string; role_title: string | null; department: string | null };

export type AmbassadorRecord = {
  id: string;
  user_id: string;
  name: string;
  initial: string;
  gradient: string;
  avatar_url: string | null;
  role_title: string | null;
  display_consent: boolean;
  is_public: boolean;
  invited_at: string | null;
  talk_themes: string[];
};

export type AmbassadorCandidate = {
  user_id: string;
  name: string;
  initial: string;
  gradient: string;
  avatar_url: string | null;
  role_title: string | null;
  current_company: string | null;
};

export type MeetingStat = {
  user_id: string;
  total: number;
  completed: number;
  this_month_completed: number;
};

type Props = {
  initialMembers: MemberRecord[];
  initialPendingInvites: PendingInviteRecord[];
  currentUserId: string;
  isAdmin?: boolean;
  ambassadors?: AmbassadorRecord[];
  ambassadorCandidates?: AmbassadorCandidate[];
  meetingStats?: MeetingStat[];
};

const PERM_LABELS: Record<MemberRecord["permission"], string> = {
  admin: "管理者",
  member: "人事",
};

const PERM_STYLES: Record<MemberRecord["permission"], { bg: string; color: string }> = {
  admin: { bg: "var(--royal-50)", color: "var(--royal)" },
  member: { bg: "var(--line-soft)", color: "var(--ink-mute)" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

// ── DropdownMenu ────────────────────────────────────────────────────
function DropdownMenu({
  member,
  isSelf,
  onAction,
  onEditProfile,
}: {
  member: MemberRecord;
  isSelf: boolean;
  onAction: (id: string, action: ActionType, value?: "admin" | "member") => void;
  onEditProfile: (target: ProfileEditTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const newPerm = member.permission === "admin" ? "member" : "admin";
  const newPermLabel = member.permission === "admin" ? "人事" : "管理者";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28,
          height: 28,
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "#fff",
          color: "var(--ink-mute)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: 34,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          minWidth: 180,
          zIndex: 100,
          overflow: "hidden",
        }}>
          {member.is_active ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEditProfile({ id: member.id, role_title: member.role_title, department: member.department });
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: "var(--ink)",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                役職・部署を編集
              </button>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => {
                  setOpen(false);
                  onAction(member.id, "permission", newPerm);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: isSelf ? "var(--ink-mute)" : "var(--ink)",
                  cursor: isSelf ? "not-allowed" : "pointer",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                権限を「{newPermLabel}」に変更
                {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: "var(--ink-mute)" }}>（自分は変更不可）</span>}
              </button>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => {
                  setOpen(false);
                  onAction(member.id, "deactivate");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: isSelf ? "var(--ink-mute)" : "var(--error)",
                  cursor: isSelf ? "not-allowed" : "pointer",
                }}
              >
                無効化
                {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: "var(--ink-mute)" }}>（自分は無効化不可）</span>}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAction(member.id, "reactivate");
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "none",
                border: "none",
                fontFamily: "inherit",
                fontSize: 13,
                color: "var(--success)",
                cursor: "pointer",
              }}
            >
              再有効化
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── ConfirmDialog ───────────────────────────────────────────────────
function ConfirmDialog({
  member,
  actionType,
  actionValue,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: {
  member: MemberRecord;
  actionType: ActionType;
  actionValue: "admin" | "member" | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSubmitting, onCancel]);

  let title = "";
  let body = "";
  let confirmLabel = "";
  let confirmColor = "var(--royal)";

  if (actionType === "permission") {
    const label = actionValue === "admin" ? "管理者" : "メンバー";
    title = "権限を変更";
    body = `${member.name}さんの権限を「${label}」に変更しますか？`;
    confirmLabel = "変更する";
  } else if (actionType === "deactivate") {
    title = "メンバーを無効化";
    body = `${member.name}さんを無効化しますか？「無効化済み」タブに移動し、ログインできなくなります。`;
    confirmLabel = "無効化する";
    confirmColor = "var(--error)";
  } else {
    title = "メンバーを再有効化";
    body = `${member.name}さんを再有効化しますか？アクティブな一覧に戻ります。`;
    confirmLabel = "再有効化する";
    confirmColor = "var(--success)";
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}>
        <h2 id="confirm-dialog-title" style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 12,
        }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 20 }}>
          {body}
        </p>

        {errorMessage && (
          <div role="alert" aria-live="polite" style={{
            padding: "10px 14px",
            background: "var(--error-soft)",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--error)",
            marginBottom: 16,
          }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: "9px 18px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-soft)",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              padding: "9px 18px",
              border: "none",
              borderRadius: 8,
              background: confirmColor,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "処理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditProfileDialog ────────────────────────────────────────────────
function EditProfileDialog({
  target,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  target: ProfileEditTarget;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (id: string, roleTitle: string, department: string) => void;
  onCancel: () => void;
}) {
  const [roleTitle, setRoleTitle] = useState(target.role_title ?? "");
  const [department, setDepartment] = useState(target.department ?? "");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSubmitting, onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-dialog-title"
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}>
        <h2 id="edit-profile-dialog-title" style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 20,
        }}>
          役職・部署を編集
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="member-role-title" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
            役職
          </label>
          <input
            id="member-role-title"
            type="text"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="例：プロダクトマネージャー"
            maxLength={100}
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="member-department" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
            部署
          </label>
          <input
            id="member-department"
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="例：プロダクト開発部"
            maxLength={100}
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
          />
        </div>

        {errorMessage && (
          <div role="alert" aria-live="polite" style={{
            padding: "10px 14px",
            background: "var(--error-soft)",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--error)",
            marginBottom: 16,
          }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: "9px 18px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-soft)",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onSubmit(target.id, roleTitle, department)}
            disabled={isSubmitting}
            style={{
              padding: "9px 18px",
              border: "none",
              borderRadius: 8,
              background: "var(--royal)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddMemberDialog ─────────────────────────────────────────────────
function AddMemberDialog({
  isSubmitting,
  errorMessage,
  defaultPermission,
  onSubmit,
  onCancel,
}: {
  isSubmitting: boolean;
  errorMessage: string | null;
  defaultPermission?: "admin" | "member";
  onSubmit: (email: string, permission: "admin" | "member") => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"admin" | "member">(defaultPermission ?? "member");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSubmitting, onCancel]);

  function handleSubmit() {
    setLocalError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError("有効なメールアドレスを入力してください");
      return;
    }
    onSubmit(email.trim(), permission);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-dialog-title"
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}>
        <h2 id="add-member-dialog-title" style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 6,
        }}>
          メンバーを追加
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
          メールアドレスを入力してください。登録済みの場合はすぐに追加、未登録の場合は招待メールを送信します。
        </p>

        {/* email */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="member-invite-email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
            メールアドレス
          </label>
          <input
            id="member-invite-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@company.com"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
          />
        </div>

        {/* permission */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
            権限
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["member", "admin"] as const).map((p) => {
              const isSelected = permission === p;
              const label = p === "admin" ? "管理者" : "人事";
              const desc = p === "admin"
                ? "メンバーの追加・削除や権限変更ができます"
                : "チームメンバーとして採用管理画面にアクセスできます";
              return (
                <label
                  key={p}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${isSelected ? "var(--royal)" : "var(--line)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isSelected ? "var(--royal-50)" : "#fff",
                  }}
                >
                  <input
                    type="radio"
                    name="permission"
                    value={p}
                    checked={isSelected}
                    onChange={() => setPermission(p)}
                    style={{ marginTop: 2, accentColor: "var(--royal)" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {(localError || errorMessage) && (
          <div style={{
            padding: "10px 14px",
            background: "var(--error-soft)",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--error)",
            marginBottom: 16,
          }}>
            {localError ?? errorMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: "9px 18px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-soft)",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !email.trim()}
            style={{
              padding: "9px 18px",
              border: "none",
              borderRadius: 8,
              background: "var(--royal)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: isSubmitting || !email.trim() ? "not-allowed" : "pointer",
              opacity: isSubmitting || !email.trim() ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "追加中..." : "追加する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast は src/components/ui/Toast.tsx に移動済み ─────────────────

// ── PendingInvitesSection ────────────────────────────────────────────
function daysUntilExpiry(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function PendingInvitesSection({
  invites,
  onCancelled,
  onToast,
}: {
  invites: PendingInviteRecord[];
  onCancelled: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleCopy(invite: PendingInviteRecord) {
    const url = `${window.location.origin}/biz/auth/accept-invite?token=${invite.invitation_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((v) => (v === invite.id ? null : v)), 2000);
      onToast("招待 URL をコピーしました");
    } catch {
      onToast("コピーに失敗しました");
    }
  }

  async function handleCancel(invite: PendingInviteRecord) {
    setConfirmingId(null);
    setCancellingId(invite.id);
    try {
      const res = await fetch(`/api/biz/members/${invite.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        onToast(json.error ?? "キャンセルに失敗しました");
        return;
      }
      onToast("招待をキャンセルしました");
      onCancelled(invite.id);
    } catch {
      onToast("通信エラーが発生しました");
    } finally {
      setCancellingId(null);
    }
  }

  const PERM_LABELS: Record<"admin" | "member", string> = { admin: "管理者", member: "人事" };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 12px 5px 10px",
          background: "var(--warm-soft)",
          border: "1px solid #F59E0B44",
          borderRadius: 100,
        }}>
          {/* envelope + clock icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warm)", letterSpacing: "0.04em" }}>
            招待中
          </span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            padding: "0px 6px",
            borderRadius: 100,
            background: "var(--warm)",
            color: "#fff",
          }}>
            {invites.length}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
          メールで招待済み・承認待ち
        </span>
      </div>

      {invites.length === 0 ? (
        <div style={{
          padding: "20px 24px",
          textAlign: "center",
          color: "var(--ink-mute)",
          fontSize: 13,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}>
          招待中のメンバーはいません
        </div>
      ) : (
        <div style={{
          background: "#FFFBEB",
          border: "1px solid #F59E0B44",
          borderLeft: "3px solid var(--warm)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {invites.map((invite, index) => {
            const daysLeft = daysUntilExpiry(invite.expires_at);
            const isExpired = daysLeft <= 0;
            const isCancelling = cancellingId === invite.id;
            const isCopied = copiedId === invite.id;
            const isConfirming = confirmingId === invite.id;
            const isLast = index === invites.length - 1;

            return (
              <div
                key={invite.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: isLast ? "none" : "1px solid #F59E0B22",
                  background: isExpired ? "var(--bg-tint)" : "#FFFBEB",
                  opacity: isCancelling ? 0.5 : 1,
                }}
              >
                {/* Left: email + meta */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                      {invite.invited_email}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 100,
                      background: "var(--warm-soft)",
                      color: "var(--warm)",
                    }}>
                      招待中
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 7px",
                      borderRadius: 100,
                      background: "var(--line-soft)",
                      color: "var(--ink-mute)",
                    }}>
                      {PERM_LABELS[invite.permission]}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--ink-mute)" }}>
                    <span>{new Date(invite.invited_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })} に招待</span>
                    {isExpired ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 100,
                        background: "var(--error-soft)",
                        color: "var(--error)",
                      }}>
                        期限切れ
                      </span>
                    ) : (
                      <span style={{ color: daysLeft <= 2 ? "var(--error)" : "var(--ink-mute)" }}>
                        あと {daysLeft} 日で期限切れ
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isExpired && (
                    <button
                      type="button"
                      onClick={() => handleCopy(invite)}
                      title="招待 URL をコピー"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "6px 11px",
                        background: isCopied ? "var(--success-soft)" : "var(--bg-tint)",
                        border: `1px solid ${isCopied ? "var(--success)" : "var(--line)"}`,
                        borderRadius: 7,
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        color: isCopied ? "var(--success)" : "var(--ink-soft)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isCopied ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                          コピー済み
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          URL コピー
                        </>
                      )}
                    </button>
                  )}
                  {isConfirming ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 10px",
                      background: "var(--error-soft)",
                      border: "1px solid var(--error)",
                      borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--error)", whiteSpace: "nowrap" }}>
                        キャンセルしますか？
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancel(invite)}
                        disabled={isCancelling}
                        style={{
                          padding: "3px 9px", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                          borderRadius: 5, cursor: "pointer", border: "none",
                          background: "var(--error)", color: "#fff", whiteSpace: "nowrap",
                        }}
                      >
                        はい
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        style={{
                          padding: "3px 9px", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                          borderRadius: 5, cursor: "pointer",
                          border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        いいえ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(invite.id)}
                      disabled={isCancelling}
                      style={{
                        padding: "6px 11px",
                        background: "none",
                        border: "1px solid var(--line)",
                        borderRadius: 7,
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--error)",
                        cursor: isCancelling ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isCancelling ? "キャンセル中..." : "キャンセル"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MembersClient ───────────────────────────────────────────────────
export function MembersClient({ initialMembers, initialPendingInvites, currentUserId, isAdmin = true, ambassadors: initialAmbassadors = [], ambassadorCandidates = [], meetingStats = [] }: Props) {
  const router = useRouter();
  // edit profile dialog state
  const [editProfileTarget, setEditProfileTarget] = useState<ProfileEditTarget | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // add member dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogPermission, setAddDialogPermission] = useState<"admin" | "member">("member");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // dialog state
  const [dialogMemberId, setDialogMemberId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionValue, setActionValue] = useState<"admin" | "member" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);

  // 面談対応者セクション state
  const [ambassadors, setAmbassadors] = useState(initialAmbassadors);
  const [inviteRoleTitles, setInviteRoleTitles] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const c of ambassadorCandidates) {
      m[c.user_id] = c.role_title ?? "";
    }
    return m;
  });
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [revokingMemberId, setRevokingMemberId] = useState<string | null>(null);

  // メールアドレス招待 state
  const [emailInviteOpen, setEmailInviteOpen] = useState(false);
  const [emailInviteEmail, setEmailInviteEmail] = useState("");
  const [emailInviteRole, setEmailInviteRole] = useState("");
  const [emailInviting, setEmailInviting] = useState(false);

  // talk_themes 編集 state
  const [editingThemesMemberId, setEditingThemesMemberId] = useState<string | null>(null);
  const [themesInput, setThemesInput] = useState("");
  const [savingThemes, setSavingThemes] = useState(false);

  // is_public トグル pending state
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);

  // HR 自己申告 state
  const [selfRoleTitle, setSelfRoleTitle] = useState("");
  const [selfRegistering, setSelfRegistering] = useState(false);
  const selfIsAmbassador = ambassadors.some((a) => a.user_id === currentUserId);

  async function handleSelfRegister() {
    if (!selfRoleTitle.trim()) return;
    setSelfRegistering(true);
    try {
      const res = await fetch("/api/biz/ambassador/self-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_title: selfRoleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setToastMessage("面談対応者として登録しました");
        router.refresh();
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setSelfRegistering(false);
    }
  }

  async function handleInviteAmbassador(userId: string) {
    const roleTitle = inviteRoleTitles[userId]?.trim();
    if (!roleTitle) return;
    setInvitingUserId(userId);
    try {
      const res = await fetch("/api/biz/ambassador/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role_title: roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setToastMessage("招待メールを送信しました");
        router.refresh();
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setInvitingUserId(null);
    }
  }

  async function handleRevokeAmbassador(memberId: string) {
    setRevokingMemberId(memberId);
    try {
      const res = await fetch("/api/biz/ambassador/revoke", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setAmbassadors((prev) => prev.filter((a) => a.id !== memberId));
        setToastMessage("解除しました");
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setRevokingMemberId(null);
    }
  }
  async function handleEmailInvite() {
    const email = emailInviteEmail.trim();
    const roleTitle = emailInviteRole.trim();
    if (!email || !roleTitle) return;
    setEmailInviting(true);
    try {
      const res = await fetch("/api/biz/ambassador/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role_title: roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setToastMessage("招待メールを送信しました");
        setEmailInviteEmail("");
        setEmailInviteRole("");
        setEmailInviteOpen(false);
        router.refresh();
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setEmailInviting(false);
    }
  }

  async function handleSaveThemes(memberId: string) {
    setSavingThemes(true);
    const themes = themesInput.split(/[,、\n]/).map((t) => t.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/biz/ambassador/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, talk_themes: themes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setAmbassadors((prev) =>
          prev.map((a) => a.id === memberId ? { ...a, talk_themes: themes } : a)
        );
        setEditingThemesMemberId(null);
        setToastMessage("保存しました");
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setSavingThemes(false);
    }
  }

  async function handleTogglePublic(memberId: string, current: boolean) {
    setTogglingPublicId(memberId);
    try {
      const res = await fetch("/api/biz/ambassador/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, is_public: !current }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error ?? "エラーが発生しました");
      } else {
        setAmbassadors((prev) =>
          prev.map((a) => a.id === memberId ? { ...a, is_public: !current } : a)
        );
      }
    } catch {
      setToastMessage("通信エラーが発生しました");
    } finally {
      setTogglingPublicId(null);
    }
  }

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const activeMembers = useMemo(() => initialMembers.filter((m) => m.is_active), [initialMembers]);
  const adminMembers = useMemo(() => activeMembers.filter((m) => m.permission === "admin"), [activeMembers]);
  const hrMembers = useMemo(() => activeMembers.filter((m) => m.permission === "member"), [activeMembers]);

  async function handleCopyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setToastMessage("メールアドレスをコピーしました");
      setTimeout(() => setCopiedEmail((v) => v === email ? null : v), 2000);
    } catch {
      setToastMessage("コピーに失敗しました");
    }
  }

  const dialogMember = dialogMemberId
    ? initialMembers.find((m) => m.id === dialogMemberId) ?? null
    : null;

  async function handleSaveProfile(id: string, roleTitle: string, department: string) {
    setIsSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/biz/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_profile", role_title: roleTitle, department }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setProfileError(json.error ?? "エラーが発生しました");
        return;
      }
      setEditProfileTarget(null);
      setToastMessage("変更しました");
      router.refresh();
    } catch {
      setProfileError("通信エラーが発生しました");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAddMember(email: string, permission: "admin" | "member") {
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/biz/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      const json = await res.json() as { error?: string; already_registered?: boolean; member?: { name?: string } };
      if (!res.ok) {
        setAddError(json.error ?? "エラーが発生しました");
        return;
      }
      const name = json.member?.name ?? email;
      setShowAddDialog(false);
      setToastMessage(
        json.already_registered
          ? `${name}さんをメンバーに追加しました`
          : `${email} に招待メールを送信しました`
      );
      router.refresh();
    } catch {
      setAddError("通信エラーが発生しました");
    } finally {
      setIsAdding(false);
    }
  }

  function openDialog(id: string, action: ActionType, value?: "admin" | "member") {
    setDialogMemberId(id);
    setActionType(action);
    setActionValue(value ?? null);
    setErrorMessage(null);
  }

  function closeDialog() {
    if (isSubmitting) return;
    setDialogMemberId(null);
    setActionType(null);
    setActionValue(null);
    setErrorMessage(null);
  }

  async function handleConfirm() {
    if (!dialogMemberId || !actionType) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const body: Record<string, string> = { action: actionType };
    if (actionType === "permission" && actionValue) body.value = actionValue;

    try {
      const res = await fetch(`/api/biz/members/${dialogMemberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setErrorMessage(json.error ?? "エラーが発生しました");
        return;
      }

      const successMsg =
        actionType === "permission" ? "権限を変更しました" :
        actionType === "deactivate" ? "無効化しました" :
        "再有効化しました";

      closeDialog();
      setToastMessage(successMsg);
      router.refresh();
    } catch {
      setErrorMessage("通信エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }



  return (
    <div>
      {/* ページヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <h1 style={{
              fontFamily: "'Noto Serif JP', serif",
              fontWeight: 700,
              fontSize: 22,
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}>
              チームメンバー
            </h1>
            <span style={{
              fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
              color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif",
              textTransform: "uppercase",
            }}>
              Members
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6, margin: 0 }}>
            採用担当メンバーを管理・招待します。現在 {activeMembers.length} 名がアクティブです。
          </p>
        </div>
        {false && (
        <button
          type="button"
          style={{
            display: "none",
          }}
        >
          {/* Mail icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          招待する
        </button>
        )}
      </div>

      {/* ── 管理者 セクション ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 3px" }}>
              管理者
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, marginLeft: 8, padding: "1px 7px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)" }}>
                {adminMembers.length}
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0, lineHeight: 1.5 }}>
              求人・企業情報の管理、メンバー招待・権限変更ができます。
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setAddDialogPermission("admin"); setAddError(null); setShowAddDialog(true); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              + メールで招待
            </button>
          )}
        </div>
        {adminMembers.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13, background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10 }}>
            管理者がいません
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            {adminMembers.map((member, index) => {
              const isSelf = member.user_id === currentUserId;
              const ps = PERM_STYLES[member.permission];
              const isLast = index === adminMembers.length - 1;
              return (
                <div key={member.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: isLast ? "none" : "1px solid var(--line-soft)", background: isSelf ? "var(--royal-50)" : "#fff" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: member.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {member.initial}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{member.name}</span>
                      {isSelf && (<span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>あなた</span>)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{member.email}</span>
                      <button type="button" onClick={() => handleCopyEmail(member.email)} title="メールアドレスをコピー" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: copiedEmail === member.email ? "var(--success)" : "var(--ink-mute)", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
                        {copiedEmail === member.email ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>) : (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>)}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {member.role_title && (<span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{member.role_title}</span>)}
                      {member.department && (<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{member.department}</span>)}
                      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{formatDate(member.created_at)} 追加</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: ps.bg, color: ps.color, whiteSpace: "nowrap" }}>
                      {PERM_LABELS[member.permission]}
                    </span>
                    {isAdmin && (<DropdownMenu member={member} isSelf={isSelf} onAction={openDialog} onEditProfile={(t) => { setProfileError(null); setEditProfileTarget(t); }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 人事 セクション ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 3px" }}>
              人事
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, marginLeft: 8, padding: "1px 7px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                {hrMembers.length}
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0, lineHeight: 1.5 }}>
              採用管理画面にアクセスできます。求人・面談の閲覧・管理が可能です。
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setAddDialogPermission("member"); setAddError(null); setShowAddDialog(true); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", background: "#fff", color: "var(--royal)",
                border: "1px solid var(--royal)", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              + メールで招待
            </button>
          )}
        </div>
        {hrMembers.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13, background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10 }}>
            人事メンバーがいません
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            {hrMembers.map((member, index) => {
              const isSelf = member.user_id === currentUserId;
              const ps = PERM_STYLES[member.permission];
              const isLast = index === hrMembers.length - 1;
              return (
                <div key={member.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: isLast ? "none" : "1px solid var(--line-soft)", background: isSelf ? "var(--royal-50)" : "#fff" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: member.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {member.initial}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{member.name}</span>
                      {isSelf && (<span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>あなた</span>)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{member.email}</span>
                      <button type="button" onClick={() => handleCopyEmail(member.email)} title="メールアドレスをコピー" style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: copiedEmail === member.email ? "var(--success)" : "var(--ink-mute)", lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
                        {copiedEmail === member.email ? (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>) : (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>)}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {member.role_title && (<span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{member.role_title}</span>)}
                      {member.department && (<span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{member.department}</span>)}
                      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{formatDate(member.created_at)} 追加</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: ps.bg, color: ps.color, whiteSpace: "nowrap" }}>
                      {PERM_LABELS[member.permission]}
                    </span>
                    {isAdmin && (<DropdownMenu member={member} isSelf={isSelf} onAction={openDialog} onEditProfile={(t) => { setProfileError(null); setEditProfileTarget(t); }} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 招待中セクション */}
      <PendingInvitesSection
        invites={pendingInvites}
        onCancelled={(id) => {
          setPendingInvites((prev) => prev.filter((i) => i.id !== id));
          router.refresh();
        }}
        onToast={setToastMessage}
      />

      {/* 役職・部署編集ダイアログ */}
      {editProfileTarget && (
        <EditProfileDialog
          target={editProfileTarget}
          isSubmitting={isSavingProfile}
          errorMessage={profileError}
          onSubmit={handleSaveProfile}
          onCancel={() => { if (!isSavingProfile) setEditProfileTarget(null); }}
        />
      )}

      {/* メンバー追加ダイアログ */}
      {showAddDialog && (
        <AddMemberDialog
          isSubmitting={isAdding}
          errorMessage={addError}
          defaultPermission={addDialogPermission}
          onSubmit={handleAddMember}
          onCancel={() => { if (!isAdding) setShowAddDialog(false); }}
        />
      )}

      {/* 確認ダイアログ */}
      {dialogMember && actionType && (
        <ConfirmDialog
          member={dialogMember}
          actionType={actionType}
          actionValue={actionValue}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onConfirm={handleConfirm}
          onCancel={closeDialog}
        />
      )}

      {/* ── 現場 セクション ── */}
      <div style={{ marginTop: 48 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 3px" }}>
              現場
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0, lineHeight: 1.5 }}>
              候補者と直接話してもらう社員です。面談OKフラグで公開管理。管理画面アクセス権なし。
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setEmailInviteOpen((v) => !v)}
              style={{
                background: "var(--royal)", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              + メールで招待
            </button>
          )}
        </div>

        {/* メールアドレス招待フォーム */}
        {isAdmin && emailInviteOpen && (
          <div style={{
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            borderRadius: 10, padding: "16px 20px", marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 12 }}>
              メールアドレスで招待
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>メールアドレス</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={emailInviteEmail}
                  onChange={(e) => setEmailInviteEmail(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--royal-100)", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>役職（公開されます）</label>
                <input
                  type="text"
                  placeholder="例：エンジニア"
                  value={emailInviteRole}
                  onChange={(e) => setEmailInviteRole(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--royal-100)", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleEmailInvite}
                  disabled={emailInviting || !emailInviteEmail.trim() || !emailInviteRole.trim()}
                  style={{
                    background: emailInviting || !emailInviteEmail.trim() || !emailInviteRole.trim() ? "var(--line)" : "var(--royal)",
                    color: emailInviting || !emailInviteEmail.trim() || !emailInviteRole.trim() ? "var(--ink-mute)" : "#fff",
                    border: "none", borderRadius: 7, padding: "8px 16px", fontWeight: 700, fontSize: 13,
                    cursor: emailInviting ? "wait" : "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {emailInviting ? "送信中..." : "招待メールを送る"}
                </button>
                <button
                  onClick={() => { setEmailInviteOpen(false); setEmailInviteEmail(""); setEmailInviteRole(""); }}
                  style={{ background: "none", border: "1px solid var(--line)", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "var(--ink-mute)", cursor: "pointer" }}
                >
                  キャンセル
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 8 }}>
              ※ OPINIOに登録済みのメールアドレスのみ招待できます
            </div>
          </div>
        )}

        {/* HR 自己申告（管理者自身を面談対応者に追加） */}
        {isAdmin && !selfIsAmbassador && (
          <div style={{
            background: "#fff", border: "1px dashed var(--royal-100)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, flex: "0 0 auto" }}>
              自分も面談対応者になる
            </span>
            <input
              type="text"
              placeholder="役職（例：採用担当）"
              value={selfRoleTitle}
              onChange={(e) => setSelfRoleTitle(e.target.value)}
              style={{
                flex: 1, minWidth: 160, padding: "7px 12px",
                border: "1.5px solid var(--royal-100)", borderRadius: 7, fontSize: 13, outline: "none",
              }}
            />
            <button
              onClick={handleSelfRegister}
              disabled={selfRegistering || !selfRoleTitle.trim()}
              style={{
                background: selfRegistering || !selfRoleTitle.trim() ? "var(--line)" : "var(--royal)",
                color: selfRegistering || !selfRoleTitle.trim() ? "var(--ink-mute)" : "#fff",
                border: "none", borderRadius: 7, padding: "7px 16px",
                fontWeight: 700, fontSize: 13,
                cursor: selfRegistering || !selfRoleTitle.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {selfRegistering ? "登録中..." : "登録する"}
            </button>
          </div>
        )}

        {/* 承認済み */}
        {ambassadors.filter((a) => a.display_consent).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              承認済み
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ambassadors.filter((a) => a.display_consent).map((a) => (
                <div key={a.id} style={{
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", background: a.gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0, overflow: "hidden",
                    }}>
                      {a.avatar_url ? <img src={a.avatar_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : a.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{a.role_title ?? "役職未設定"}</div>
                      {(() => {
                        const stat = meetingStats.find((s) => s.user_id === a.user_id);
                        if (!stat) return null;
                        return (
                          <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)" }}>
                              面談 担当{stat.total}件
                            </span>
                            {stat.completed > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--success-soft)", color: "var(--success)" }}>
                                完了{stat.completed}件
                              </span>
                            )}
                            {stat.this_month_completed > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--warm-soft)", color: "#92400E" }}>
                                今月{stat.this_month_completed}件
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {/* is_public トグル */}
                    {isAdmin && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{a.is_public ? "公開中" : "非公開"}</span>
                        <button
                          onClick={() => handleTogglePublic(a.id, a.is_public)}
                          disabled={togglingPublicId === a.id}
                          title={a.is_public ? "非公開にする" : "公開する"}
                          style={{
                            width: 38, height: 22, borderRadius: 11, border: "none",
                            background: a.is_public ? "var(--success)" : "var(--line)",
                            cursor: "pointer", position: "relative", transition: "background 0.2s",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 3, left: a.is_public ? 18 : 3,
                            width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            transition: "left 0.2s", display: "block",
                          }} />
                        </button>
                      </div>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleRevokeAmbassador(a.id)}
                        disabled={revokingMemberId === a.id}
                        style={{
                          background: "none", border: "1px solid var(--line)", borderRadius: 6,
                          padding: "4px 10px", fontSize: 12, color: "var(--ink-mute)", cursor: "pointer",
                        }}
                      >
                        {revokingMemberId === a.id ? "..." : "解除"}
                      </button>
                    )}
                  </div>

                  {/* talk_themes 表示・編集 */}
                  {isAdmin && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
                      {editingThemesMemberId === a.id ? (
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>
                            話せるテーマ（カンマ区切り）
                          </label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="text"
                              value={themesInput}
                              onChange={(e) => setThemesInput(e.target.value)}
                              placeholder="例：採用、組織設計、エンジニアのキャリア"
                              style={{ flex: 1, padding: "6px 10px", border: "1.5px solid var(--royal-100)", borderRadius: 6, fontSize: 12, outline: "none" }}
                            />
                            <button
                              onClick={() => handleSaveThemes(a.id)}
                              disabled={savingThemes}
                              style={{
                                background: "var(--royal)", color: "#fff", border: "none",
                                borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              {savingThemes ? "..." : "保存"}
                            </button>
                            <button
                              onClick={() => setEditingThemesMemberId(null)}
                              style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--ink-mute)", cursor: "pointer" }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>話せるテーマ:</span>
                          {a.talk_themes.length > 0 ? (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {a.talk_themes.map((t) => (
                                <span key={t} style={{ fontSize: 11, background: "var(--royal-50)", color: "var(--royal)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{t}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontStyle: "italic" }}>未設定</span>
                          )}
                          <button
                            onClick={() => { setEditingThemesMemberId(a.id); setThemesInput(a.talk_themes.join("、")); }}
                            style={{ marginLeft: "auto", background: "none", border: "1px solid var(--line)", borderRadius: 5, padding: "2px 8px", fontSize: 11, color: "var(--ink-mute)", cursor: "pointer", flexShrink: 0 }}
                          >
                            編集
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 招待中（承認待ち） */}
        {ambassadors.filter((a) => !a.display_consent).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              招待中（承認待ち）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ambassadors.filter((a) => !a.display_consent).map((a) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", opacity: 0.85,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: a.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0, overflow: "hidden",
                  }}>
                    {a.avatar_url ? <img src={a.avatar_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : a.initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{a.role_title ?? "—"}</div>
                  </div>
                  <span style={{ background: "var(--warm-soft)", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>
                    招待中
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleRevokeAmbassador(a.id)}
                      disabled={revokingMemberId === a.id}
                      style={{ background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "var(--ink-mute)", cursor: "pointer" }}
                    >
                      {revokingMemberId === a.id ? "..." : "取消"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 指名できる社員（候補） */}
        {ambassadorCandidates.length > 0 && isAdmin && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              OPINIOに登録している自社の社員
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ambassadorCandidates.map((c) => (
                <div key={c.user_id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10, padding: "12px 16px",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: c.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0, overflow: "hidden",
                  }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{c.name}</div>
                    <input
                      type="text"
                      placeholder="役職を入力（例：エンジニア）"
                      value={inviteRoleTitles[c.user_id] ?? ""}
                      onChange={(e) => setInviteRoleTitles((prev) => ({ ...prev, [c.user_id]: e.target.value }))}
                      style={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "3px 8px", color: "var(--ink)", marginTop: 4, width: "100%", maxWidth: 200, outline: "none" }}
                    />
                  </div>
                  <button
                    onClick={() => handleInviteAmbassador(c.user_id)}
                    disabled={invitingUserId === c.user_id || !inviteRoleTitles[c.user_id]?.trim()}
                    style={{
                      background: invitingUserId === c.user_id || !inviteRoleTitles[c.user_id]?.trim() ? "var(--line)" : "var(--royal)",
                      color: invitingUserId === c.user_id || !inviteRoleTitles[c.user_id]?.trim() ? "var(--ink-mute)" : "#fff",
                      border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700,
                      cursor: invitingUserId === c.user_id || !inviteRoleTitles[c.user_id]?.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {invitingUserId === c.user_id ? "送信中..." : "招待する"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {ambassadors.length === 0 && ambassadorCandidates.length === 0 && !emailInviteOpen && (
          <div style={{
            background: "var(--bg-tint)", border: "1px dashed var(--line)",
            borderRadius: 10, padding: "24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13,
          }}>
            まだ面談対応者がいません。<br />
            「メールで招待」ボタンからOPINIO登録済みの社員を招待できます。
          </div>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}
    </div>
  );
}
