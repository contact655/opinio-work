"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { grantAction, declineAction, revokeAction, type ActionResult } from "./actions";

export type ScoutRequestRow = {
  companyId: string; companyName: string; isTest: boolean; suspended: boolean;
  requesterName: string | null; requesterEmail: string | null; message: string | null; createdAt: string;
};
export type ScoutCompanyRow = {
  companyId: string; companyName: string; isTest: boolean; suspended: boolean; hasAdmin: boolean;
  status: "none" | "granted" | "revoked"; at: string | null; revokeReason: string | null;
};

const btn = (primary: boolean) => ({
  fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 100, cursor: "pointer", whiteSpace: "nowrap" as const,
  background: primary ? "var(--royal)" : "#fff", color: primary ? "#fff" : "var(--ink-soft)",
  border: primary ? "none" : "1px solid #E2E8F0",
});
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : "");

export function ScoutAccessClient({ requests, companies, loadFailed }: { requests: ScoutRequestRow[]; companies: ScoutCompanyRow[]; loadFailed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = async (id: string, fn: () => Promise<ActionResult>) => {
    setBusy(id);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    startTransition(() => router.refresh());
  };
  const askReason = (label: string) => window.prompt(`${label}\n企業に送る理由（任意）を入力してください。`);

  const granted = companies.filter((c) => c.status === "granted");
  const others = companies.filter((c) => c.status !== "granted");

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>スカウト機能の許可</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 20px" }}>
        スカウト機能（候補者を探す・候補者にメッセージを送る）は、ここで許可した企業だけが使えます。許可・見送り・取り消しは企業にメールで知らせます。
        企業ページが停止中の企業は、許可していても使えません。
      </p>
      {loadFailed && <p role="alert" style={{ fontSize: 13, color: "var(--error)", margin: "0 0 16px" }}>一部の読み込みに失敗しました。件数が0でも、0件という意味ではありません。</p>}
      {error && <p role="alert" style={{ fontSize: 13, color: "var(--error)", margin: "0 0 16px" }}>{error}</p>}

      <section data-state="scout-requests" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>依頼 {requests.length}件</h2>
        {requests.length === 0 ? <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>未対応の依頼はありません。</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((r) => (
              <div key={r.companyId} data-state="scout-request-row" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/admin/companies/${r.companyId}`} style={{ fontWeight: 700, color: "var(--ink)" }}>{r.companyName}</Link>
                  {r.isTest && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>検証用</span>}
                  {r.suspended && <span style={{ fontSize: 11, color: "var(--warm-ink)" }}>停止中</span>}
                  <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmt(r.createdAt)} に依頼{r.requesterName ? `・${r.requesterName}` : ""}{r.requesterEmail ? `（${r.requesterEmail}）` : ""}</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" disabled={busy === r.companyId} style={btn(true)} onClick={() => run(r.companyId, () => grantAction(r.companyId))}>許可する</button>
                  <button type="button" disabled={busy === r.companyId} style={btn(false)} onClick={() => { const x = askReason(`「${r.companyName}」の依頼を見送ります。`); if (x !== null) void run(r.companyId, () => declineAction(r.companyId, x)); }}>見送る</button>
                </div>
                {r.message && <p style={{ fontSize: 13, color: "var(--ink)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{r.message}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section data-state="scout-granted" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>使える企業 {granted.length}社</h2>
        <Rows rows={granted} busy={busy} action={(c) => (
          <button type="button" disabled={busy === c.companyId} style={btn(false)} onClick={() => { const x = askReason(`「${c.companyName}」のスカウト機能を取り消します。`); if (x !== null) void run(c.companyId, () => revokeAction(c.companyId, x)); }}>取り消す</button>
        )} />
      </section>

      <section data-state="scout-others">
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>まだ使えない企業 {others.length}社</h2>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 10px" }}>担当者がいる企業と、取り消した企業です。依頼が無くても「使えるようにする」で付与できます。</p>
        <Rows rows={others} busy={busy} action={(c) => (
          <button type="button" disabled={busy === c.companyId} style={btn(true)} onClick={() => { if (window.confirm(`「${c.companyName}」でスカウト機能を使えるようにします。`)) void run(c.companyId, () => grantAction(c.companyId)); }}>使えるようにする</button>
        )} />
      </section>
    </div>
  );
}

function Rows({ rows, action }: { rows: ScoutCompanyRow[]; busy: string | null; action: (c: ScoutCompanyRow) => React.ReactNode }) {
  if (rows.length === 0) return <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>ありません。</p>;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10 }}>
      {rows.map((c, i) => (
        <div key={c.companyId} data-state={`scout-row-${c.status}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
          <Link href={`/admin/companies/${c.companyId}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{c.companyName}</Link>
          {c.isTest && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>検証用</span>}
          {c.suspended && <span style={{ fontSize: 11, color: "var(--warm-ink)" }}>停止中</span>}
          {c.status === "granted" && c.at && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmt(c.at)} から</span>}
          {c.status === "revoked" && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{fmt(c.at)} に取り消し{c.revokeReason ? `・${c.revokeReason}` : ""}</span>}
          <span style={{ flex: 1 }} />
          {action(c)}
        </div>
      ))}
    </div>
  );
}
