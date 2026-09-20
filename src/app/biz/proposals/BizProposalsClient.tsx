"use client";

import { useState } from "react";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { COMPANY_RESPONSE_LABELS } from "@/lib/constants/proposalResponses";

export type BizProposalView = {
  id: string;
  evidence: EvidenceView[];
  counter: CounterView[];
  candidateInterested: boolean;
  candidateDeclined: boolean;
  response: string | null;
  jobTitle: string | null;
  computedAt: string;
};

export default function BizProposalsClient({
  proposals, loadFailed,
}: { proposals: BizProposalView[]; loadFailed: boolean }) {
  const [items, setItems] = useState(proposals);
  const [declining, setDeclining] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function respond(id: string, response: string, reason?: string, note?: string) {
    setPending(true); setErr(null);
    try {
      const res = await fetch(`/api/biz/proposals/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, reason, note }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "保存できませんでした");
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, response } : p)));
      setDeclining(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>候補者の提案</h1>

      {/* ★★スカウトではないことを明示。消さないこと */}
      <p
        style={{
          fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)",
          background: "#F5F7FD", border: "1px solid #DCE3F5",
          borderRadius: 8, padding: "10px 12px", margin: "0 0 8px",
        }}
      >
        <strong>これはスカウトではありません。</strong>
        OPINIO が根拠をそろえてお出ししている提案で、送信枠も消費しません。
      </p>
      {/* ⚠️★**何が・いつ見えるようになるかを書く**（2026-09-21 に実測して書き直した）。
             求職者側（`ProposalsClient`）と**同じ事実**を、向きだけ変えて書いている。
             **片方だけ直さないこと。** */}
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 20px" }}>
        候補者は匿名です。<strong>お名前・顔写真・現在の勤務先はお渡ししていません。</strong>
        <strong>双方が「会いたい」と答えるとメッセージが1本開き</strong>、そこから候補者の
        公開プロフィール（お名前・顔写真・見出し・職歴の勤務先と在籍期間）をご覧いただけます。
      </p>

      {err && (
        <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          {err}
        </p>
      )}

      {loadFailed ? (
        <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          提案の読み込みに失敗しました。<strong>「0件」という意味ではありません。</strong>
        </p>
      ) : items.length === 0 ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "20px 18px", fontSize: 14, lineHeight: 1.9 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>いまお出しできる提案はありません。</p>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
            OPINIO は、<strong>根拠を2件以上そろえられた候補者だけ</strong>をご提案します。
            根拠になるのは、御社に移ってきた方の人数・在籍している方が挙げた入社の決め手・
            話を聞ける方の人数・ご本人の希望条件との一致です。
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((p) => (
            <article key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "16px 16px 14px" }}>
              <header style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {/* ★匿名。名前の代わりに出すのは「提案」という事実だけ */}
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>候補者（匿名）</h2>
                {p.jobTitle && (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{p.jobTitle} の提案</span>
                )}
                {/* ★相手が既に答えているかで表示を変える */}
                {p.candidateInterested && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E7A4B", background: "#EAF6EF", border: "1px solid #C9E6D5", borderRadius: 999, padding: "2px 10px" }}>
                    この方は「興味がある」と答えています
                  </span>
                )}
                {p.candidateDeclined && (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", background: "#F4F4F5", borderRadius: 999, padding: "2px 10px" }}>
                    この方は見送りました
                  </span>
                )}
                {!p.candidateInterested && !p.candidateDeclined && (
                  /* ⚠️ null を「見送り」と読ませない */
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>まだ回答していません</span>
                )}
              </header>

              <EvidenceList evidence={p.evidence} counter={p.counter} />

              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "10px 0 0" }}>
                {p.computedAt} 時点の情報にもとづく提案です
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {p.response ? (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", padding: "9px 0" }}>
                    「{COMPANY_RESPONSE_LABELS[p.response as "want_to_meet" | "declined"]}」と答えました
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => respond(p.id, "want_to_meet")}
                      disabled={pending}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                    >
                      会いたい
                    </button>
                    <button
                      onClick={() => setDeclining(p.id)}
                      disabled={pending}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                    >
                      見送る
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {declining && (
        <DeclineSheet
          side="company"
          pending={pending}
          onCancel={() => setDeclining(null)}
          onSubmit={(reason, note) => respond(declining, "declined", reason, note)}
        />
      )}
    </main>
  );
}
