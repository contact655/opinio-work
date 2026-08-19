"use client";

import { getUserAge } from "@/lib/age";

import { useState, useTransition } from "react";
import { bulkSetVisibility, bulkDeleteUsers } from "./actions";
import { CanCasualMeetingToggle } from "./CanCasualMeetingToggle";

type User = {
  id: string;
  auth_id: string | null;
  name: string | null;
  email: string | null;
  is_mentor: boolean | null;
  can_casual_meeting: boolean | null;
  /** 一覧には出さない（2026-08-05）。検索の対象としては使っている */
  location: string | null;
  birth_date: string | null;
  visibility: string | null;
  created_at: string;
  lastLogin: string | null;
  isBizAdmin: boolean;
};

function getAvatarGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, var(--royal), #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, var(--success), #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #DC2626, #F87171)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    "linear-gradient(135deg, #D97706, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, var(--royal))",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}


type ConfirmState =
  | { type: "private"; ids: string[] }
  | { type: "delete"; ids: string[] }
  | null;

export function CandidatesClient({ users }: { users: User[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allIds = users.map((u) => u.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleConfirmAction() {
    if (!confirm) return;
    const ids = confirm.ids;
    if (confirm.type === "private") {
      startTransition(async () => {
        const res = await bulkSetVisibility(ids, "private");
        setConfirm(null);
        setSelected(new Set());
        showToast(res.ok ? `${ids.length}名のプロフィールを非公開にしました` : `エラー: ${res.error}`);
      });
    } else {
      startTransition(async () => {
        const res = await bulkDeleteUsers(ids);
        setConfirm(null);
        setSelected(new Set());
        showToast(res.ok ? `${res.deleted}名のアカウントを削除しました` : `エラー: ${res.error}`);
      });
    }
  }

  return (
    <>
      <style>{`
        .admin-row:hover { background: var(--bg-tint); }
        .admin-row:last-child { border-bottom: none; }
        .admin-row.selected-row { background: #EFF3FC; }
        .bulk-bar { animation: slideUp 0.2s ease; }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* ── Table ── */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid var(--line)", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
              {/* チェックボックス全選択 */}
              <th style={{ padding: "10px 14px", width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--royal)" }}
                  aria-label="全選択"
                />
              </th>
              {/*
                ⚠️ 2026-08-05 に2列削除した。td 側も必ず一緒に増減させること。
                   「居住地」: 一覧で使わない（26名中5名しか埋まっていない）
                   「話せる」: ow_users.can_talk_to_candidates。本番0件・参照は
                     この画面の表示だけ・何もゲートしていなかった。カラムは残してある。
                     「話せるか」の判定は隣の「面談可」（can_casual_meeting）が担う。
              */}
              {["名前", "メール", "年代", "BIZ", "公開設定", "面談可", "最終ログイン", "登録日", "経歴"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: "left", padding: "10px 14px",
                    fontSize: 11, color: "var(--ink-mute)", fontWeight: 700,
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}>
                  <div style={{ marginBottom: 8, fontSize: 28 }}>👤</div>
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelected = selected.has(u.id);
                return (
                  <tr
                    key={u.id}
                    className={`admin-row${isSelected ? " selected-row" : ""}`}
                    style={{ borderBottom: "1px solid var(--line-soft)" }}
                  >
                    {/* チェックボックス */}
                    <td style={{ padding: "11px 14px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(u.id)}
                        style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--royal)" }}
                        aria-label={`${u.name ?? u.email}を選択`}
                      />
                    </td>
                    {/* 名前 */}
                    <td style={{ padding: "11px 14px" }}>
                      <a
                        href={`/u/${u.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: getAvatarGradient(u.id || u.name || ""),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#fff",
                        }}>
                          {u.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--royal)" }}>{u.name || "未入力"}</span>
                      </a>
                    </td>
                    {/* メール */}
                    <td style={{ padding: "11px 14px", color: "var(--ink-soft)", fontSize: 12 }}>{u.email}</td>
                    {/* 年代 */}
                    <td style={{ padding: "11px 14px", color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                      {u.birth_date ? `${getUserAge(u.birth_date)}歳` : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                    </td>
                    {/* BIZ */}
                    <td style={{ padding: "11px 14px" }}>
                      {u.isBizAdmin ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                          background: "#001233", color: "#fff", letterSpacing: "0.04em",
                        }}>
                          BIZ
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-mute)" }}>—</span>
                      )}
                    </td>
                    {/* 公開設定 */}
                    <td style={{ padding: "11px 14px" }}>
                      {u.visibility === "public" ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0" }}>公開</span>
                      ) : u.visibility === "login_only" ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>ログイン限定</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>非公開</span>
                      )}
                    </td>
                    {/* 面談可 */}
                    <td style={{ padding: "11px 14px" }}>
                      <CanCasualMeetingToggle
                        userId={u.id}
                        initialValue={u.can_casual_meeting ?? false}
                      />
                    </td>
                    {/* 最終ログイン */}
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      {u.lastLogin ? (
                        <span style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                          {formatRelative(u.lastLogin)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "#FEF3C7", color: "#B45309" }}>未ログイン</span>
                      )}
                    </td>
                    {/* 登録日 */}
                    <td style={{ padding: "11px 14px", color: "var(--ink-mute)", fontSize: 11, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                      {new Date(u.created_at).toLocaleDateString("ja-JP")}
                    </td>
                    {/* 経歴編集 */}
                    <td style={{ padding: "11px 14px" }}>
                      <a
                        href={`/admin/users/${u.id}`}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 10px",
                          borderRadius: 6, border: "1px solid var(--royal-100)",
                          background: "var(--royal-50)", color: "var(--royal)",
                          textDecoration: "none", whiteSpace: "nowrap",
                        }}
                      >
                        経歴編集
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 一括操作バー ── */}
      {someSelected && (
        <div className="bulk-bar" style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#0F172A", color: "#fff",
          borderRadius: 14, padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 8px 32px rgba(15,23,42,0.35)",
          zIndex: 1000, whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            {selected.size}名 を選択中
          </span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)" }} />
          <button
            onClick={() => setSelected(new Set())}
            style={{
              background: "transparent", border: "none", color: "rgba(255,255,255,0.6)",
              fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 6,
            }}
          >
            選択解除
          </button>
          <button
            onClick={() => setConfirm({ type: "private", ids: Array.from(selected) })}
            style={{
              background: "#1E293B", border: "1px solid #334155",
              color: "#CBD5E1", fontSize: 13, fontWeight: 600,
              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            }}
          >
            プロフィールを非公開にする
          </button>
          <button
            onClick={() => setConfirm({ type: "delete", ids: Array.from(selected) })}
            style={{
              background: "#DC2626", border: "none",
              color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
            }}
          >
            アカウントを削除する
          </button>
        </div>
      )}

      {/* ── 確認モーダル ── */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2000,
        }}>
          <div style={{
            background: "#fff", borderRadius: 16,
            padding: "28px 32px", maxWidth: 420, width: "90%",
            boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
          }}>
            {confirm.type === "delete" ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>🗑️</div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", textAlign: "center", margin: "0 0 8px" }}>
                  {confirm.ids.length}名のアカウントを削除しますか？
                </h2>
                <p style={{ fontSize: 13, color: "#64748B", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
                  この操作は取り消せません。<br />
                  ユーザーのすべてのデータ（プロフィール・経歴・ブックマーク）が完全に削除されます。
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>🔒</div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", textAlign: "center", margin: "0 0 8px" }}>
                  {confirm.ids.length}名を非公開にしますか？
                </h2>
                <p style={{ fontSize: 13, color: "#64748B", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
                  対象ユーザーのプロフィールが非公開になります。<br />
                  アカウントは残ります（後から変更可能）。
                </p>
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirm(null)}
                disabled={isPending}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8,
                  border: "1.5px solid var(--line)", background: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--ink-soft)",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isPending}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8,
                  border: "none",
                  background: confirm.type === "delete" ? "#DC2626" : "#0F172A",
                  color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: isPending ? "wait" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "処理中..." : confirm.type === "delete" ? "削除する" : "非公開にする"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── トースト ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "#0F172A", color: "#fff",
          padding: "12px 20px", borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(15,23,42,0.25)",
          zIndex: 3000,
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
