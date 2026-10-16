"use client";

import { useState } from "react";
import Link from "next/link";
import { MAX_EVIDENCE_SHOWN, type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import { evidenceText } from "@/lib/evidence/fit";
import { BTN, CARD_STYLE, CautionBox, NameLabel, ReasonBox, TagRow } from "./FitCardParts";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { PROPOSAL_NOTE_MAX } from "@/lib/constants/proposalResponses";
import { PROPOSALS_SECTION_TITLE } from "./fitPageText";
import { OwnCompanyNote } from "@/components/companies/OwnCompanyNote";

export type ProposalView = {
  id: string;
  companyName: string;
  companyHref: string | null;
  tagline: string | null;
  logoUrl: string | null;
  /** ★運営会社か（2026-10-10）。true なら「この会社は OPINIO の運営会社です。」を出す */
  isOwnCompany: boolean;
  evidence: EvidenceView[];
  counter: CounterView[];
  /**
   * ★この提案がいまどうなっているか（`proposalPhase()` から作った表示用の区分）。
   *   pending … 答えられる ／ waiting … 話を聞いてみたいと答え、メッセージを準備している（作成に失敗し、運営が救う間） ／
   *   introduced … メッセージが開いた ／ declined … 自分が見送った ／ ended … 終了した
   * ⚠️★ended の理由（以前に企業が見送った・30日たった等）は**渡していない**。画面にも出さない
   */
  status: "pending" | "waiting" | "introduced" | "declined" | "ended";
  jobTitle: string | null;
  /** 求人ページへのリンク。掲載中でないときは null */
  jobHref: string | null;
  /** 関連する求人の掲載が終わっている */
  jobClosed: boolean;
  /** 自分が送ったひとこと */
  note: string | null;
  /** メッセージが開いたときの会話 */
  conversationId: string | null;
  computedAt: string;
  /** ★回答の締め切りまであと何日（2026-10-10）。終了・両方回答済みなら null。⚠️ 通知は送らない（表示だけ） */
  daysLeft: number | null;
  /** タグ「フェーズ」（lib/constants/phase.ts のラベル。不明なら null） */
  phaseLabel: string | null;
};

export default function ProposalsClient({
  proposals, loadFailed,
}: { proposals: ProposalView[]; loadFailed: boolean }) {
  const [items, setItems] = useState(proposals);
  const [declining, setDeclining] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* ★会社へのひとこと（任意）。提案ごとに持つ */
  const [notes, setNotes] = useState<Record<string, string>>({});
  /* ★「話を聞いてみたい」を押すとひとこと欄が開く（下段と同じ並び。2026-10-15） */
  const [composing, setComposing] = useState<string | null>(null);

  async function respond(id: string, response: "interested" | "declined", reason?: string, declineNote?: string) {
    setPending(true); setErr(null);
    try {
      const res = await fetch(`/api/jobseeker/proposals/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          response === "interested"
            ? { response, note: (notes[id] ?? "").trim() || null }
            : { response, reason: reason || null, declineNote: declineNote || null },
        ),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        /* ⚠️ 失敗を黙って飲まない。押したのに何も起きない状態を作らない */
        setErr(j.error ?? "保存できませんでした");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { conversationId?: string | null };
      setItems((prev) => prev.map((p) => {
        if (p.id !== id) return p;
        /* ⚠️ 答えたら締め切りは出さない（daysLeft を消す） */
        if (response === "declined") return { ...p, status: "declined", daysLeft: null };
        /* ★auto ならその場で会話ができている。review なら企業の返事待ち */
        return j.conversationId
          ? { ...p, status: "introduced", conversationId: j.conversationId, note: (notes[id] ?? "").trim() || null, daysLeft: null }
          : { ...p, status: "waiting", note: (notes[id] ?? "").trim() || null, daysLeft: null };
      }));
      setDeclining(null);
    } finally {
      setPending(false);
    }
  }

  return (
    /* ★2026-10-15 に「あなたに合う順」と1ページに統合した（ページ名「あなたに合う会社」）。
          この部品は上段だけを描く。冒頭の説明と「詳しく」は FitPageIntro。
          ★カードの見た目は下段と揃えた（FitCardParts）。区別は社名の横の「OPINIO からの提案」のラベルで行う。
          ⚠️ 提案が0件の人には page.tsx がこの部品ごと出さない（空のときの説明はここに置かない） */
    <section aria-label={PROPOSALS_SECTION_TITLE} style={{ marginBottom: 28 }}>
      {err && (
        <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          {err}
        </p>
      )}

      {loadFailed ? (
        <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          おすすめの読み込みに失敗しました。<strong>「0社」という意味ではありません。</strong>
          しばらくしてから開き直してください。
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((p) => {
            const shown = p.evidence.slice(0, MAX_EVIDENCE_SHOWN);
            const rest = p.evidence.length - shown.length;
            /* ★「確かめられなかったこと」（kind:'unknown'）は注意点として出さない（柴さんの指示・2026-10-15）。
                  ⚠️ 確かめていないことの説明は「詳しく」に1回だけ書いてある（FitPageIntro） */
            const cautions = p.counter.filter((c) => c.kind !== "unknown").map((c) => c.label);
            return (
              <article key={p.id} data-state="proposal-card" style={CARD_STYLE}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {p.companyHref
                      ? <Link href={p.companyHref} style={{ color: "inherit", textDecoration: "none" }}>{p.companyName}</Link>
                      : p.companyName}
                  </h3>
                  <NameLabel state="proposal-label" strong>{PROPOSALS_SECTION_TITLE}</NameLabel>
                </div>
                {p.tagline && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "2px 0 0" }}>{p.tagline}</p>}
                {/* ★運営会社の開示（2026-10-10）。運営が自社を薦める形になるので必ず出す */}
                {p.isOwnCompany && <OwnCompanyNote style={{ marginTop: 4 }} />}

                <ReasonBox items={shown.map((e) => evidenceText(e, "candidate"))} state="proposal-reasons" />
                {/* ⚠️ 隠した件数は出す。黙って切らない */}
                {rest > 0 && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "4px 0 0" }}>ほかに根拠が {rest} 件あります</p>}
                <CautionBox items={cautions} state="proposal-cautions" />
                <TagRow
                  talkable={p.evidence.some((e) => e.kind === "talkable")}
                  openJobs={!!p.jobHref}
                  phase={p.phaseLabel}
                />

                {/* ★関連する求人（提案は求人つきでしか作らない）と、いつ時点の根拠か。小さく1行ずつ */}
                {p.jobTitle && (
                  <p style={{ fontSize: 12, margin: "8px 0 0", color: "var(--ink-soft)" }}>
                    関連する求人：
                    {p.jobHref
                      ? <Link href={p.jobHref} style={{ color: "var(--royal)" }}>{p.jobTitle}</Link>
                      : <span>{p.jobTitle}{p.jobClosed && "（掲載を終了しました）"}</span>}
                  </p>
                )}
                {/* ⚠️ スナップショットである旨を書く。数字が古くなりうることを隠さない */}
                <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 0" }}>
                  {p.computedAt} 時点の情報にもとづく提案です
                  {p.daysLeft != null && (
                    <span data-state="proposal-days-left" style={{ marginLeft: 8, fontWeight: 600 }}>
                      ・回答の締め切りまで{p.daysLeft <= 1 ? "今日まで" : `あと${p.daysLeft}日`}
                    </span>
                  )}
                </p>

                {p.status === "pending" ? (
                  composing === p.id ? (
                    <div data-state="proposal-composing" style={{ marginTop: 12 }}>
                      <label htmlFor={`note-${p.id}`} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        会社へのひとこと<span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>（任意・{PROPOSAL_NOTE_MAX}字まで）</span>
                      </label>
                      <textarea
                        id={`note-${p.id}`}
                        value={notes[p.id] ?? ""}
                        maxLength={PROPOSAL_NOTE_MAX}
                        rows={3}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="聞いてみたいことや、いまの状況など"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, lineHeight: 1.6, resize: "vertical" }}
                      />
                      <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 0", textAlign: "right" }}>
                        {(notes[p.id] ?? "").length} / {PROPOSAL_NOTE_MAX}
                      </p>
                      {/* ★★押す直前に置く。⚠️ 文言は変えていない（説明は1種類。企業ごとに変えないこと） */}
                      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, margin: "6px 0 0" }}>
                        押すと、{p.companyName}にあなたのプロフィールとひとことが届き、メッセージでやり取りできるようになります。応募にはなりません。見送っても会社には伝わりません。
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <button onClick={() => respond(p.id, "interested")} disabled={pending}
                          style={{ ...BTN, border: "none", background: "var(--royal)", color: "#fff", opacity: pending ? 0.6 : 1 }}>
                          話を聞いてみたい
                        </button>
                        <button onClick={() => setComposing(null)}
                          style={{ ...BTN, border: "none", background: "none", color: "var(--ink-soft)" }}>
                          やめる
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div data-state="proposal-pending" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => setComposing(p.id)} disabled={pending}
                        style={{ ...BTN, border: "none", background: "var(--royal)", color: "#fff", opacity: pending ? 0.6 : 1 }}>
                        話を聞いてみたい
                      </button>
                      <button onClick={() => setDeclining(p.id)} disabled={pending}
                        style={{ ...BTN, border: "none", background: "none", color: "var(--ink-soft)" }}>
                        今回は見送る
                      </button>
                    </div>
                  )
                ) : (
                  <div data-state={`proposal-${p.status}`} style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
                    {p.status === "introduced" ? (
                      /* ★1行にまとめる（柴さんの指示）。送ったひとことは折りたたむ */
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>「話を聞いてみたい」と答えました</span>
                        {p.conversationId && (
                          <Link href={`/mypage/conversations/${p.conversationId}`}
                            style={{ padding: "6px 12px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
                            メッセージを開く
                          </Link>
                        )}
                      </div>
                    ) : p.status === "waiting" ? (
                      <span>「話を聞いてみたい」と答えました。メッセージを準備しています。</span>
                    ) : p.status === "declined" ? (
                      <span style={{ color: "var(--ink-soft)" }}>今回は見送りました。</span>
                    ) : (
                      /* ⚠️★理由（企業が見送った・期限切れ等）は書かない */
                      <span style={{ color: "var(--ink-soft)" }}>このおすすめは終了しました</span>
                    )}
                    {p.note && (p.status === "waiting" || p.status === "introduced") && (
                      <details style={{ marginTop: 4, fontSize: 12, color: "var(--ink-soft)" }}>
                        <summary style={{ cursor: "pointer" }}>送ったひとこと</summary>
                        <p style={{ margin: "4px 0 0" }}>{p.note}</p>
                      </details>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {declining && (
        <DeclineSheet
          side="candidate"
          pending={pending}
          onCancel={() => setDeclining(null)}
          onSubmit={(reason, note) => respond(declining, "declined", reason, note)}
        />
      )}
    </section>
  );
}
