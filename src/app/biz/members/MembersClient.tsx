"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MemberRecord } from "@/lib/business/members";

type Tab = "active" | "inactive";
type ActionType = "permission" | "deactivate" | "reactivate";

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

// ── DropdownMenu ────────────────────────────────────────────────────
function DropdownMenu({
  member,
  isSelf,
  onAction,
}: {
  member: MemberRecord;
  isSelf: boolean;
  onAction: (id: string, action: ActionType, value?: "admin" | "member") => void;
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
  const newPermLabel = member.permission === "admin" ? "メンバー" : "管理者";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
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
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif JP', serif",
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
          <div style={{
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

// ── AddMemberDialog ─────────────────────────────────────────────────
function AddMemberDialog({
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (email: string, permission: "admin" | "member") => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"admin" | "member">("member");

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
      <div style={{
        background: "#fff",
        borderRadius: 14,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 6,
        }}>
          メンバーを追加
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 20, lineHeight: 1.7 }}>
          Opinio に登録済みのメールアドレスを入力してください。
        </p>

        {/* email */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
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
              const label = p === "admin" ? "管理者" : "メンバー";
              const desc = p === "admin"
                ? "メンバーの追加・削除や権限変更ができます"
                : "チームメンバーとして表示されます";
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

        {errorMessage && (
          <div style={{
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
            onClick={() => onSubmit(email, permission)}
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

// ── Toast ───────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed",
      bottom: 32,
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--ink)",
      color: "#fff",
      padding: "12px 22px",
      borderRadius: 100,
      fontSize: 13,
      fontWeight: 600,
      zIndex: 2000,
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      whiteSpace: "nowrap",
    }}>
      {message}
    </div>
  );
}

// ── MembersClient ───────────────────────────────────────────────────
export function MembersClient({ initialMembers, currentUserId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("active");

  // add member dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
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

  const activeMembers = initialMembers.filter((m) => m.is_active);
  const inactiveMembers = initialMembers.filter((m) => !m.is_active);
  const displayMembers = activeTab === "active" ? activeMembers : inactiveMembers;

  const dialogMember = dialogMemberId
    ? initialMembers.find((m) => m.id === dialogMemberId) ?? null
    : null;

  async function handleAddMember(email: string, permission: "admin" | "member") {
    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/biz/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permission }),
      });
      const json = await res.json() as { error?: string; member?: { name?: string } };
      if (!res.ok) {
        setAddError(json.error ?? "エラーが発生しました");
        return;
      }
      const name = json.member?.name ?? email;
      setShowAddDialog(false);
      setToastMessage(`${name}さんをメンバーに追加しました`);
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
        <button
          onClick={() => { setAddError(null); setShowAddDialog(true); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "var(--royal)",
            color: "#fff",
            border: "1px solid var(--royal)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
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

                {/* 権限バッジ + 操作メニュー */}
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
                  <DropdownMenu
                    member={member}
                    isSelf={isSelf}
                    onAction={openDialog}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* メンバー追加ダイアログ */}
      {showAddDialog && (
        <AddMemberDialog
          isSubmitting={isAdding}
          errorMessage={addError}
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
