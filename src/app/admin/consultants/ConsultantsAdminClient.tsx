"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminConsultant } from "@/lib/featuredConsultants/server";
import { CONSULTANTS_TITLE, CONSULTANT_CONSENT_METHODS, CONSULTANT_STOP_REASON_MAX, routeTalkTagLabel } from "@/lib/constants/careerRoutes";
import { deleteConsultant, setConsultantStopped, type ConsultantActionResult } from "./actions";

/**
 * ★相談可能なユーザーの運営画面（2026-11-12）。本人がマイページでオンにする形なので、運営は見て・止めて・消すだけ。
 * ⚠️ 取得に失敗したら「0件」と見せない（items が null）。
 */
const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, background: "#fff", padding: 16 };
const input: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0, boxSizing: "border-box" };
const btn = (primary = false): React.CSSProperties => ({
  padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  border: primary ? "none" : "1px solid var(--line)", background: primary ? "var(--royal)" : "#fff", color: primary ? "#fff" : "var(--ink)",
});
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—");
const methodLabel = (v: string | null) => CONSULTANT_CONSENT_METHODS.find((m) => m.value === v)?.label ?? "—";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ConsultantActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      after?.();
      router.refresh();
    });
  };
  return { pending, error, run };
}

export function ConsultantsAdminClient({ items }: { items: AdminConsultant[] | null }) {
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1000, padding: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{CONSULTANTS_TITLE}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          本人がマイページ（設定）でオンにすると、ホームの右の列とユーザー一覧の左サイドバーに載ります（新しくオンにした順に5人まで）。
          運営は、載せるべきでない人を止められます。止めている間は、本人もオンにできません。
        </p>
      </div>
      {items === null ? (
        <p data-state="consultants-admin-error" style={{ color: "var(--error)", fontWeight: 600 }}>読み込みに失敗しました（0件という意味ではありません）。</p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            載っている人 {items.filter((c) => c.blockers.length === 0).length}人 / 設定したことがある人 {items.length}人
          </p>
          {items.length === 0 && <p data-state="consultants-admin-empty" style={{ color: "var(--ink-soft)" }}>まだオンにした人はいません。</p>}
          {items.map((c) => <ConsultantRow key={c.id} item={c} />)}
        </>
      )}
    </div>
  );
}

function ConsultantRow({ item }: { item: AdminConsultant }) {
  const [reason, setReason] = useState("");
  const { pending, error, run } = useAction();
  const shown = item.blockers.length === 0;
  return (
    <section data-state={shown ? "consultant-listed" : "consultant-unlisted"} style={{ ...box, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <a href={`/u/${encodeURIComponent(item.profileKey)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--ink)" }}>{item.name}</a>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{item.email ?? "（メールなし）"}</span>
        {item.isTest && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>検証用アカウント</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: shown ? "var(--royal)" : "var(--ink-soft)" }}>
          {shown ? "載っている" : `載っていない：${item.blockers.join("・")}`}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        同意：{fmt(item.consentConfirmedAt)}（{methodLabel(item.consentMethod)}）
        {item.talkTags.length > 0 && <>　話せること：{item.talkTags.map(routeTalkTagLabel).join("・")}</>}
      </div>
      {item.message && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.message}</p>}
      <div style={{ background: "var(--bg-tint)", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>職歴（古い順・運営の確認用）</div>
        {item.experiences.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>職歴が登録されていません</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, lineHeight: 1.6 }}>
            {item.experiences.map((e) => (
              <li key={e.id}>{(e.startedAt ?? "?").slice(0, 7)}〜{e.isCurrent ? "現在" : (e.endedAt ?? "?").slice(0, 7)}　{e.company}{e.role ? ` ／ ${e.role}` : ""}</li>
            ))}
          </ol>
        )}
      </div>
      {item.stoppedAt ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span data-state="consultant-stopped" style={{ fontSize: 13, color: "var(--error)", fontWeight: 600 }}>止めています（{fmt(item.stoppedAt)}：{item.stopReason ?? ""}）</span>
          <button type="button" style={btn()} disabled={pending} onClick={() => run(() => setConsultantStopped(item.id, false, ""))}>止めるのをやめる</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...input, flex: "1 1 260px" }} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={CONSULTANT_STOP_REASON_MAX} placeholder="止める理由（運営用・本人には見えません）" />
          <button type="button" data-action="consultant-stop" style={{ ...btn(), color: "var(--error)" }} disabled={pending}
            onClick={() => run(() => setConsultantStopped(item.id, true, reason), () => setReason(""))}>止める</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={btn()} disabled={pending}
          onClick={() => { if (window.confirm(`${item.name} さんの設定を消しますか？（本人はまたオンにできます）`)) run(() => deleteConsultant(item.id)); }}>
          設定を消す
        </button>
        {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
      </div>
    </section>
  );
}
