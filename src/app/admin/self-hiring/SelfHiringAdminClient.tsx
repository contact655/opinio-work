"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SelfHiringRow } from "@/lib/nextManager/server";
import { removeSelfHiringByOps, restoreSelfHiringByOps, type SelfHiringActionResult } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—");

/**
 * ★申告の採用中の運営画面（2026-11-19）。⚠️ 取得に失敗したら「0件」と見せない（rows が null）。
 *   「一覧に出ていない」＝採用中だが、職歴の現職でなくなった・会社の担当者になった・会社が停止中など。
 */
export function SelfHiringAdminClient({ rows }: { rows: SelfHiringRow[] | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<SelfHiringActionResult>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  };

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>採用中（本人の申告）</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          会社の担当者でない人が、職歴で在籍中の会社で「採用中」にしたものです。一覧には「本人の申告」と添えて出ています。
          心当たりの無い会社を名乗っているものは外してください。外すと、本人はその会社でもう一度オンにできません。
        </p>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>{error}</p>}
      {rows === null ? (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: "var(--error)" }}>読み込めませんでした（0件という意味ではありません）。</p>
      ) : rows.length === 0 ? (
        <p data-state="admin-self-hiring-empty" style={{ margin: 0, fontSize: 14, color: "var(--ink-mute)" }}>まだありません。</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid var(--line)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-mute)" }}>
                {["人", "会社", "募集の内容", "状態", "更新", ""].map((h) => <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.userId}|${r.companyId}`} data-state={r.removedAt ? "admin-self-hiring-removed" : r.listed ? "admin-self-hiring-listed" : "admin-self-hiring-unlisted"}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}><Link href={`/u/${r.userId}`} style={{ color: "var(--ink)", fontWeight: 700 }}>{r.userName}</Link></td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>{r.companyName}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--ink-soft)" }}>{r.note ?? ""}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {r.removedAt ? `外した（${r.removedByRole === "company" ? "会社" : "運営"}）` : r.listed ? "一覧に出ている" : "一覧に出ていない"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap", color: "var(--ink-mute)" }}>{fmt(r.removedAt ?? r.updatedAt)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {r.removedAt ? (
                      <button type="button" disabled={pending} onClick={() => run(() => restoreSelfHiringByOps(r.userId, r.companyId))}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                        外したのを取り消す
                      </button>
                    ) : (
                      <button type="button" disabled={pending}
                        onClick={() => { if (window.confirm(`${r.userName}さんの「${r.companyName}で採用中」を外しますか？`)) run(() => removeSelfHiringByOps(r.userId, r.companyId)); }}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                        外す
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
