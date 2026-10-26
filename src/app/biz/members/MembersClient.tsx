"use client";
import { COMPANY_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type CompanyRole } from "@/lib/auth/roles";

import { NotificationRecipientsCard } from "@/components/business/NotificationRecipientsCard";
import { SlackNotificationCard } from "@/components/business/SlackNotificationCard";
import type { SlackSettingsView } from "@/lib/notify/slack";
import type { NotificationTeamMember } from "@/lib/business/notificationTeam";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { MemberRecord, PendingInviteRecord } from "@/lib/business/members";
import Toast from "@/components/ui/Toast";
import type { CompanyJoinRequest } from "@/lib/business/joinRequests";
import { JoinRequestsCard } from "./JoinRequestsCard";

type ActionType = "permission" | "deactivate" | "reactivate";

/**
 * ★権限の呼び名（2026-09-22）。**画面ではこの1箇所だけを使う。**
 * ⚠️ それまでこの画面だけ member を「人事」と呼び、ヘッダー・企業の切り替え・確認ダイアログの
 *    「メンバー」と食い違っていた（メニューは「人事に変更」、確認は「メンバーに変更」）。
 */
/* ★役割は4つ（2026-10-12）。呼び名と1行の説明は lib/auth/roles.ts の1か所（ROLE_LABELS / ROLE_DESCRIPTIONS）。
      ⚠️ この画面に別の呼び名を書かないこと */
const PERMISSION_LABEL = ROLE_LABELS;
const PERMISSION_HINT = ROLE_DESCRIPTIONS;
type ProfileEditTarget = { id: string; role_title: string | null; department: string | null };

/* ⚠️ 「面談対応者」「面談を依頼できる社員」の2タブ（`ow_company_members` の招待・掲載・解除）は
      2026-10-16 に撤去した（面談OKの撤去・柴さんの判断）。この画面は採用担当だけ */

type Props = {
  /** ★通知の宛先（2026-10-12 に /biz/company から移した）。採用担当タブの下に出す */
  notificationMembers?: NotificationTeamMember[];
  /** ★Slack 通知の設定（2026-10-12）。管理者のときだけ渡る（それ以外は null で欄を出さない） */
  slackSettings?: SlackSettingsView | null;
  notificationEmails?: string[];
  initialMembers: MemberRecord[];
  initialPendingInvites: PendingInviteRecord[];
  /** ★参加の依頼（2026-10-18）。取得に失敗したら null。管理者でなければ渡さない */
  joinRequests?: CompanyJoinRequest[] | null;
  currentUserId: string;
  isAdmin?: boolean;
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
  isLastAdmin,
}: {
  member: MemberRecord;
  isSelf: boolean;
  onAction: (id: string, action: ActionType, value?: CompanyRole) => void;
  onEditProfile: (target: ProfileEditTarget) => void;
  /** ★最後の管理者（2026-10-12）。役割の変更も無効化も出さない（API も断る） */
  isLastAdmin: boolean;
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${member.name ?? "メンバー"} の操作`}
        aria-expanded={open}
        className="btn-fixed-size"
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
              {/* ★自分の行では権限の変更と無効化を出さない（2026-09-22）。
                     それまでは「（自分は変更不可）」と灰色で並べていた。押せないものを並べない。
                     ⚠️ API 側も自分を拒む。ここは見た目だけ */}
              {!isSelf && isLastAdmin && (
                <p data-state="last-admin-note" style={{ margin: 0, padding: "10px 14px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                  最後の管理者のため、役割の変更と無効化はできません。先にほかの人を管理者にしてください。
                </p>
              )}
              {!isSelf && !isLastAdmin && (<>
              <button
                type="button"
                data-state="change-role"
                onClick={() => {
                  setOpen(false);
                  onAction(member.id, "permission", member.permission);
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
                役割を変更
              </button>
              <button
                type="button"
                
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
                  color: "var(--error)",
                  cursor: "pointer",
                }}
              >
                無効化
              </button>
              </>)}
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
                color: "var(--success-ink)",
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
  actionValue: CompanyRole | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: (value?: CompanyRole) => void;
  onCancel: () => void;
}) {
  /* ★役割の変更は4つから選ぶ（2026-10-12）。初期値はいまの役割。同じなら「変更する」を押せない */
  const [picked, setPicked] = useState<CompanyRole | null>(actionValue);
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
    title = "役割を変更";
    body = `${member.name}さんの役割を選んでください。`;
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
        {actionType === "permission" && (
          <RolePicker name="change-role" value={picked} onChange={setPicked} />
        )}

        {errorMessage && (
          <div role="alert" aria-live="polite" style={{
            padding: "10px 14px",
            background: "var(--error-soft)",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--error-ink)",
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
            onClick={() => onConfirm(actionType === "permission" ? picked ?? undefined : undefined)}
            disabled={isSubmitting || (actionType === "permission" && (!picked || picked === actionValue))}
            style={{
              /* ⚠️ 押せないときは薄くする（押せそうに見えて何も起きない状態にしない） */
              opacity: isSubmitting || (actionType === "permission" && (!picked || picked === actionValue)) ? 0.45 : 1,
              padding: "9px 18px",
              border: "none",
              borderRadius: 8,
              background: confirmColor,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: isSubmitting ? "not-allowed" : "pointer",
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
            color: "var(--error-ink)",
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

// ── RolePicker ──────────────────────────────────────────────────────
/** ★役割を選ぶ（2026-10-12）。4つの役割と、それぞれでできることを1行で出す。追加と変更の両方で使う */
function RolePicker({ name, value, onChange }: { name: string; value: CompanyRole | null; onChange: (r: CompanyRole) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>役割</div>
      <div role="radiogroup" aria-label="役割" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {COMPANY_ROLES.map((p) => {
          const isSelected = value === p;
          return (
            <label key={p} data-state={isSelected ? "selected" : "unselected"} style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${isSelected ? "var(--royal)" : "var(--line)"}`, background: isSelected ? "var(--royal-50)" : "#fff",
            }}>
              <input type="radio" name={name} value={p} checked={isSelected} onChange={() => onChange(p)} style={{ marginTop: 2, accentColor: "var(--royal)" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{PERMISSION_LABEL[p]}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.6 }}>{PERMISSION_HINT[p]}</div>
              </div>
            </label>
          );
        })}
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
  defaultPermission?: CompanyRole;
  onSubmit: (email: string, permission: CompanyRole) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<CompanyRole>(defaultPermission ?? "recruiter");
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
          メールアドレスを入力してください。招待メールを送信します。相手が承諾すると担当者になります（既に OPINIO のアカウントがある方も同じです）。
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

        {/* ★役割（2026-10-12 に4つにした）。それぞれ1行の説明つき */}
        <RolePicker name="permission" value={permission} onChange={setPermission} />

        {(localError || errorMessage) && (
          <div style={{
            padding: "10px 14px",
            background: "var(--error-soft)",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--error-ink)",
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
  onResent,
  onToast,
}: {
  invites: PendingInviteRecord[];
  onCancelled: (id: string) => void;
  /** ★再送したら、新しいリンクと招待日時で行を差し替える（2026-10-12） */
  onResent: (id: string, patch: { invitation_token: string; invited_at: string }) => void;
  onToast: (msg: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  /* ★招待の再送（2026-10-12）。新しいリンクを作って期限を今から7日に延ばし、メールを送り直す。
        ⚠️ 前のリンクは使えなくなる。メールが送れなくてもリンクは新しくなる（URL コピーで渡せる） */
  async function handleResend(invite: PendingInviteRecord) {
    setResendingId(invite.id);
    try {
      const res = await fetch(`/api/biz/members/${invite.id}/resend`, { method: "POST" });
      const json = await res.json().catch(() => ({})) as { error?: string; email_sent?: boolean; invite_url?: string };
      if (!res.ok || !json.invite_url) { onToast(json.error ?? "再送に失敗しました"); return; }
      const token = new URL(json.invite_url).searchParams.get("token") ?? invite.invitation_token;
      onResent(invite.id, { invitation_token: token, invited_at: new Date().toISOString() });
      onToast(json.email_sent ? "招待メールを再送しました（期限は今日から7日）" : "リンクを作り直しました。メールは送れなかったので、URL をコピーして渡してください");
    } catch {
      onToast("通信エラーが発生しました");
    } finally {
      setResendingId(null);
    }
  }
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

  const PERM_LABELS = PERMISSION_LABEL;

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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warm-ink)", letterSpacing: "0.04em" }}>
            招待中
          </span>
          <span style={{
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontSize: 11,
            fontWeight: 700,
            padding: "0px 6px",
            borderRadius: 100,
            /* ⚠️ 白文字 on `--warm`(#F59E0B) は **2.15**（11px には 4.5 が要る）。
                  塗りを `--warm-strong`(#92400E) にすると白で **7.09**。
               ⚠️★**2026-09-21 まで、ここは `--warm-ink`(#B45309) と書いてあった。**
                  `--warm-ink` は 2026-09-02 に #B45309 → #92400E へ変わっており、
                  **コメントだけが古い値のまま残っていた**（5.02 は #B45309 のときの比）。
               ⚠️ これは「文字色の移行」とは別の系統（白文字を塗りに載せている側）。
                  塗り用のトークンは `--warm-strong` / `--success-strong`（globals.css）。 */
            background: "var(--warm-strong)",
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
                      color: "var(--warm-ink)",
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
                        color: "var(--error-ink)",
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-state="resend-invite"
                    onClick={() => void handleResend(invite)}
                    disabled={resendingId === invite.id}
                    style={{
                      padding: "6px 11px", background: "#fff", border: "1px solid var(--line)", borderRadius: 7,
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
                      cursor: resendingId === invite.id ? "default" : "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {resendingId === invite.id ? "再送中..." : "再送"}
                  </button>
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
                        color: isCopied ? "var(--success-ink)" : "var(--ink-soft)",
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
export function MembersClient({ slackSettings = null, notificationMembers = [], notificationEmails = [], initialMembers, initialPendingInvites, joinRequests = [], currentUserId, isAdmin = true }: Props) {
  const router = useRouter();

  // edit profile dialog state
  const [editProfileTarget, setEditProfileTarget] = useState<ProfileEditTarget | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // add member dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogPermission, setAddDialogPermission] = useState<CompanyRole>("recruiter");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // dialog state
  const [dialogMemberId, setDialogMemberId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionValue, setActionValue] = useState<CompanyRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const activeMembers = useMemo(() => initialMembers.filter((m) => m.is_active), [initialMembers]);

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

  async function handleAddMember(email: string, permission: CompanyRole) {
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/biz/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      const json = await res.json() as { error?: string; invite?: PendingInviteRecord };
      if (!res.ok) {
        setAddError(json.error ?? "エラーが発生しました");
        return;
      }
      setShowAddDialog(false);
      /* ★返ってきた招待をその場で「招待中」の先頭に足す（2026-10-26 / 柴さんの指示）。
            ⚠️ 一覧は useState(initialPendingInvites) で持っているので、router.refresh() だけでは画面に出なかった */
      const created = json.invite;
      if (created) setPendingInvites((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      /* ★既にアカウントがある人にも招待を送る（2026-10-26）。承諾するまで担当者にはならない */
      setToastMessage(`${email} に招待メールを送信しました。承諾すると担当者になります`);
      router.refresh();
    } catch {
      setAddError("通信エラーが発生しました");
    } finally {
      setIsAdding(false);
    }
  }

  function openDialog(id: string, action: ActionType, value?: CompanyRole) {
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

  async function handleConfirm(picked?: CompanyRole) {
    if (!dialogMemberId || !actionType) return;
    if (actionType === "permission" && !picked) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const body: Record<string, string> = { action: actionType };
    if (actionType === "permission" && picked) body.value = picked;

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
        actionType === "permission" ? "役割を変更しました" :
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
              fontWeight: 700,
              fontSize: 18,
              color: "var(--ink)",
              margin: 0,
            }}>
              {/* ⚠️★**表示名は「メンバーと権限」に統一する**（2026-09-18 に「チーム管理」で統一 →
                     2026-10-11 に柴さんの指示で「メンバーと権限」へ改名。サイドバー・title・
                     アバターメニュー・求人フォームのリンクも同時に変えた）。
                     サイドバー・`metadata.title` と同じ語にした。
                     ここだけ「チームメンバー」で、3つの呼び名がずれていた。
                  ⚠️★**URL は `/biz/members` のまま。変えない**（既存リンクが切れる）。
                     コードの中で場所を指すときは `/biz/members`、
                     画面に出す語は「メンバーと権限」。 */}
              メンバーと権限
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
            採用担当のメンバーと権限を管理します。
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAddDialogPermission("recruiter");
              setAddError(null);
              setShowAddDialog(true);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 18px", background: "var(--royal)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", flexShrink: 0, marginLeft: 24,
              boxShadow: "0 2px 6px rgba(0,35,102,0.2)",
            }}
          >
            + 採用担当を追加
          </button>
        )}
      </div>

      {/* ★参加の依頼（2026-10-18）。管理者だけ */}
      {isAdmin && <JoinRequestsCard requests={joinRequests} onToast={setToastMessage} />}

      {/* ── 採用担当 ── */}
      <>
          {activeMembers.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13, background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10, marginBottom: 24 }}>
              採用担当メンバーがいません
            </div>
          ) : (
            /* ★カードの格子をやめ、1人1行の一覧にした（2026-09-22）。
                  カードはメールと日付しか載っておらず、3列の格子だと空白ばかりだった。
                  他の /biz の一覧（求人・候補者）と同じ読み方にする。 */
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
              <style>{`
                .mem-row:hover { background: var(--bg-tint); }
                @media (max-width: 720px) {
                  .mem-row { flex-wrap: wrap; }
                  .mem-row-meta { width: 100%; padding-left: 50px; }
                }
              `}</style>
              {activeMembers.map((member, idx) => {
                const isSelf = member.user_id === currentUserId;
                const perm = member.permission;
                /* ★最後の管理者（招待中の行は数えない。API と同じ数え方） */
                const isLastAdmin = perm === "admin" && activeMembers.filter((m) => m.permission === "admin" && m.is_active).length <= 1;
                return (
                  <div key={member.id} className="mem-row" style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--line-soft)",
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: member.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {member.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{member.name}</span>
                        {isSelf && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--royal)", color: "#fff" }}>あなた</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {/* ⚠️ 役職・部署が無いときは「未設定」で埋めない（行ごと出さず、メールだけ） */}
                        {[member.role_title, member.department].filter(Boolean).join(" · ")}
                        {(member.role_title || member.department) && " ・ "}
                        {member.email}
                        <button type="button" onClick={() => handleCopyEmail(member.email)} aria-label={`${member.name} のメールアドレスをコピー`} title="コピー"
                          className="btn-fixed-size"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", verticalAlign: "-1px", color: copiedEmail === member.email ? "var(--success-ink)" : "var(--ink-mute)" }}>
                          {copiedEmail === member.email
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                        </button>
                      </div>
                    </div>
                    <div className="mem-row-meta" style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      {/* ★役割は灰色の文字で出す（色のバッジにしない。2026-10-12） */}
                      <span title={PERMISSION_HINT[perm]} data-state={`role-${perm}`} style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                        {PERMISSION_LABEL[perm]}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap", minWidth: 110 }}>{formatDate(member.created_at)} 追加</span>
                      {isAdmin && <DropdownMenu member={member} isSelf={isSelf} isLastAdmin={isLastAdmin} onAction={openDialog} onEditProfile={(t) => { setProfileError(null); setEditProfileTarget(t); }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ★招待が無いときは出さない（2026-09-22）。「招待中 0」と空の箱が常に出ていた */}
          {pendingInvites.length > 0 && (
          <PendingInvitesSection
            invites={pendingInvites}
            onCancelled={(id) => {
              setPendingInvites((prev) => prev.filter((i) => i.id !== id));
              router.refresh();
            }}
            onResent={(id, patch) => setPendingInvites((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))}
            onToast={setToastMessage}
          />
          )}
          {/* ★通知の宛先（2026-10-12 に企業ページの設定タブから移した）。即時保存 */}
          <NotificationRecipientsCard members={notificationMembers} initialEmails={notificationEmails} canEdit={isAdmin} />
          {/* ★Slack 通知（2026-10-12）。管理者だけ（設定は管理者しか読めない） */}
          {isAdmin && slackSettings && <SlackNotificationCard initial={slackSettings} />}
      </>

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

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      )}
    </div>
  );
}
