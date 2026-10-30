"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANY_ROLES, ROLE_LABELS, type CompanyRole } from "@/lib/auth/roles";
import type { CompanyJoinRequest } from "@/lib/business/joinRequests";

/**
 * ★「担当者に追加してください」という依頼（2026-10-18 / 柴さんの指示）。
 *
 * それまで依頼は既存の担当者にメールが届くだけで、この画面のどこにも出ていなかった。
 * 権限を選んで「担当者に追加」を押すとその場で追加され、本人にメールが届く。
 * 「見送る」は本人に知らせない（理由を書けないため。運営の見送りと同じ）。
 *
 * ⚠️ 取得に失敗したとき（null）は「0件」に見せず、そう書く。
 * ⚠️ 0件のときは何も出さない（依頼が無いのが普通の状態）。
 */
export function JoinRequestsCard({
  requests,
  onToast,
}: {
  requests: CompanyJoinRequest[] | null;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const [roleById, setRoleById] = useState<Record<string, CompanyRole>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  if (requests === null) {
    return (
      <div role="alert" style={{ padding: "12px 16px", marginBottom: 20, background: "var(--warm-soft)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, color: "var(--warm-ink)" }}>
        参加の依頼を確認できませんでした（0件という意味ではありません）。時間をおいて読み込み直してください。
      </div>
    );
  }
  const visible = requests.filter((r) => !doneIds.has(r.id));
  if (visible.length === 0) return null;

  async function respond(r: CompanyJoinRequest, action: "approve" | "reject") {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/biz/join-requests/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, permission: roleById[r.id] ?? "recruiter" } : { action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { onToast(json.error ?? "うまくいきませんでした"); return; }
      setDoneIds((s) => new Set(s).add(r.id));
      setConfirmRejectId(null);
      onToast(action === "approve"
        ? `${r.userName}さんを担当者（${ROLE_LABELS[roleById[r.id] ?? "recruiter"]}）に追加しました`
        : "依頼を見送りました");
      router.refresh();
    } catch {
      onToast("通信エラーが発生しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section data-join-requests style={{ background: "#fff", border: "1px solid var(--royal-100, var(--line))", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
      <style>{`
        .jr-row { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-top: 1px solid var(--line-soft); }
        .jr-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        @media (max-width: 720px) {
          .jr-row { flex-wrap: wrap; padding: 14px 16px; }
          .jr-actions { width: 100%; flex-wrap: wrap; }
        }
      `}</style>
      <div style={{ padding: "14px 20px 12px", background: "var(--royal-50, var(--bg-tint))" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          参加の依頼 <span style={{ color: "var(--royal)" }}>{visible.length}件</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "4px 0 0", lineHeight: 1.6 }}>
          担当者に追加すると、本人にメールでお知らせします。見送っても相手には知らせません。
        </p>
      </div>
      {visible.map((r) => {
        const busy = busyId === r.id;
        const role = roleById[r.id] ?? "recruiter";
        return (
          <div key={r.id} className="jr-row" data-join-request={r.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{r.userName}</span>
                {r.isTest && (
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>検証用アカウント</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.userEmail ?? undefined}>
                {r.userEmail ?? "メールアドレス不明"}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                {new Date(r.sentAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} に依頼
                {r.domainMatch === true && " ・ メールのドメインが貴社サイトと同じです"}
                {r.domainMatch === false && " ・ メールのドメインが貴社サイトと異なります"}
              </div>
            </div>
            <div className="jr-actions">
              {confirmRejectId === r.id ? (
                <>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>見送りますか？</span>
                  <button type="button" disabled={busy} onClick={() => respond(r, "reject")}
                    style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", cursor: busy ? "default" : "pointer" }}>
                    {busy ? "処理中…" : "見送る"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmRejectId(null)}
                    style={{ padding: "7px 10px", fontSize: 13, border: "none", background: "none", color: "var(--ink-soft)", cursor: "pointer" }}>
                    やめる
                  </button>
                </>
              ) : (
                <>
                  <label style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
                    権限
                    <select value={role} disabled={busy}
                      onChange={(e) => setRoleById((m) => ({ ...m, [r.id]: e.target.value as CompanyRole }))}
                      style={{ padding: "6px 8px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)", background: "#fff" }}>
                      {COMPANY_ROLES.map((k) => <option key={k} value={k}>{ROLE_LABELS[k]}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={busy} onClick={() => respond(r, "approve")}
                    style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", cursor: busy ? "default" : "pointer" }}>
                    {busy ? "処理中…" : "担当者に追加"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmRejectId(r.id)}
                    style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer" }}>
                    見送る
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
