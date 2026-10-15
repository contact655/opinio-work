"use client";

import { useState } from "react";
import Link from "next/link";
import { NO_REASON_PROMPT, type ForYouReaction } from "@/lib/forYou/weights";
import { PROPOSAL_NOTE_MAX } from "@/lib/constants/proposalResponses";
import { ALL_COMPANIES_SECTION_TITLE } from "./fitPageText";

/**
 * ★「あなたに合う会社」の下段「すべての会社を合う順に」（2026-10-15 に /mypage/for-you から移した）。
 *   並べ方は lib/forYou/（weights.ts）。上段（提案）に出ている会社は page.tsx が除いてから渡す。
 *
 * ボタンは上段と同じ「話を聞いてみたい」に揃えた（柴さんの指示）:
 *   担当者あり … 押すと「会社へのひとこと」の欄が開き、送ると会話ができる（上段と同じ形）
 *   担当者未登録 … 押すとその場で記録して運営に知らせる（説明はページの冒頭に1回だけ。カードはラベルだけ）
 * ⚠️ 記録は ow_for_you_reactions（上段の ow_proposals とは別の表のまま。統合するかは別途判断）。
 */

export type ForYouView = {
  id: string;
  rank: number;
  name: string;
  /** 企業ページへのリンク。開けない会社（検証用など）は null */
  href: string | null;
  tagline: string | null;
  /** 理由（最大2行）。★無い会社は枠ごと出さない */
  reasons: string[];
  hasTalkable: boolean;
  hasOpenJobs: boolean;
  phaseLabel: string | null;
  /** ★「気をつけて見てほしいこと」。いまは器だけで常に空（rank.ts） */
  cautions: string[];
  hasResponder: boolean;
  reaction: ForYouReaction | null;
  conversationId: string | null;
  /** 「話を聞いてみたい」を押した（取り消していない） */
  interested: boolean;
};

export default function ForYouSection({
  companies, loadFailed, noReasons, declineReasons,
}: {
  companies: ForYouView[];
  loadFailed: boolean;
  noReasons: boolean;
  declineReasons: { value: string; label: string }[];
}) {
  const [items, setItems] = useState(companies);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  /* 担当者がいる会社で「話を聞いてみたい」を押したときに開く、ひとことの欄 */
  const [composing, setComposing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showHidden, setShowHidden] = useState(false);

  async function post(id: string, body: Record<string, unknown>): Promise<{ ok: boolean; conversationId?: string }> {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/jobseeker/for-you/${encodeURIComponent(id)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; conversationId?: string };
      if (!res.ok) {
        /* ⚠️ 失敗を黙って飲まない */
        setErr({ id, text: json.error ?? "保存できませんでした。時間をおいてもう一度お試しください。" });
        return { ok: false };
      }
      return { ok: true, conversationId: json.conversationId };
    } catch {
      setErr({ id, text: "保存できませんでした。通信を確かめてもう一度お試しください。" });
      return { ok: false };
    } finally {
      setBusy(null);
    }
  }

  async function react(id: string, reaction: ForYouReaction, extra: Record<string, unknown> = {}) {
    const r = await post(id, { reaction, ...extra });
    if (!r.ok) return;
    setItems((prev) => prev.map((c) => c.id !== id ? c : {
      ...c,
      reaction,
      interested: c.interested || reaction === "interested",
      conversationId: r.conversationId ?? c.conversationId,
    }));
    setDeclining(null);
    setDeclineReason("");
    setComposing(null);
  }

  async function undo(id: string) {
    const r = await post(id, { undo: true });
    if (!r.ok) return;
    setItems((prev) => prev.map((c) => c.id !== id ? c : { ...c, reaction: "later", interested: false }));
  }

  const visible = items.filter((c) => c.reaction !== "not_interested");
  const hidden = items.filter((c) => c.reaction === "not_interested");

  return (
    <section aria-labelledby="for-you-heading">
      <h2 id="for-you-heading" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>{ALL_COMPANIES_SECTION_TITLE}</h2>

      {loadFailed ? (
        <p role="alert" style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          一覧を表示できませんでした。<strong>「0社」という意味ではありません。</strong>時間をおいて開き直してください。
        </p>
      ) : (
        <>
          {noReasons && (
            <div data-state="for-you-no-reasons" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: "var(--bg-tint)", fontSize: 14, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{NO_REASON_PROMPT}</p>
              <Link href="/mypage#career" style={{ color: "var(--royal)", fontWeight: 600, fontSize: 13 }}>職歴を追加する →</Link>
            </div>
          )}

          {visible.length === 0 && hidden.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>いま表示できる会社はありません。</p>
          )}

          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {visible.map((c) => (
              <li key={c.id} data-company-id={c.id} data-rank={c.rank}
                style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span aria-label={`${c.rank}位`} style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mute)", minWidth: 28 }}>{c.rank}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                        {c.href
                          ? <Link href={c.href} style={{ color: "inherit", textDecoration: "none" }}>{c.name}</Link>
                          : c.name}
                      </h3>
                      {/* ★担当者の有無は小さなラベルだけ。説明はページの冒頭に1回（柴さんの指示） */}
                      <span data-state={c.hasResponder ? "for-you-has-responder" : "for-you-no-responder"}
                        style={{ fontSize: 11, color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 999, padding: "0 8px" }}>
                        {c.hasResponder ? "担当者あり" : "担当者未登録"}
                      </span>
                    </div>
                    {c.tagline && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "2px 0 0" }}>{c.tagline}</p>}

                    {/* ★理由は目立つ枠で。緑は「プラスの一致」（ui-conventions の色の役割） */}
                    {c.reasons.length > 0 && (
                      <ul data-state="for-you-reasons" style={{
                        listStyle: "none", margin: "10px 0 0", padding: "8px 12px", display: "grid", gap: 2,
                        background: "#ECF6EF", border: "1px solid #D3E8DA", borderRadius: 8,
                      }}>
                        {c.reasons.map((r) => (
                          <li key={r} style={{ fontSize: 13, lineHeight: 1.6, color: "#14532D" }}>✓ {r}</li>
                        ))}
                      </ul>
                    )}

                    {/* ★「気をつけて見てほしいこと」の器。いまは常に空（rank.ts の cautions） */}
                    {c.cautions.length > 0 && (
                      /* ⚠️ 色は上段の EvidenceList の「気をつけて見てほしいこと」と同じ。片方だけ変えないこと */
                      <div data-state="for-you-cautions" style={{ margin: "8px 0 0", padding: "8px 12px", background: "#FBF8F2", border: "1px solid #EADFC8", borderRadius: 8 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#8A6D3B" }}>気をつけて見てほしいこと</p>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                          {c.cautions.map((t) => <li key={t} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-soft)" }}>・{t}</li>)}
                        </ul>
                      </div>
                    )}

                    {(c.hasTalkable || c.hasOpenJobs || c.phaseLabel) && (
                      <p style={{ margin: "8px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.hasTalkable && <Tag state="talkable">話を聞ける人</Tag>}
                        {c.hasOpenJobs && <Tag state="jobs">募集あり</Tag>}
                        {c.phaseLabel && <Tag state="phase">{c.phaseLabel}</Tag>}
                      </p>
                    )}

                    <Actions
                      c={c}
                      busy={busy === c.id}
                      composing={composing === c.id}
                      note={notes[c.id] ?? ""}
                      declining={declining === c.id}
                      declineReason={declineReason}
                      declineReasons={declineReasons}
                      onInterested={() => c.hasResponder ? setComposing(c.id) : react(c.id, "interested")}
                      onChangeNote={(v) => setNotes((n) => ({ ...n, [c.id]: v }))}
                      onSend={() => react(c.id, "interested", { note: (notes[c.id] ?? "").trim() || null })}
                      onCancelCompose={() => setComposing(null)}
                      onUndo={() => undo(c.id)}
                      onLater={() => react(c.id, "later")}
                      onStartDecline={() => { setDeclining(c.id); setDeclineReason(""); }}
                      onCancelDecline={() => setDeclining(null)}
                      onChangeReason={setDeclineReason}
                      onDecline={() => react(c.id, "not_interested", { reason: declineReason })}
                    />
                    {err?.id === c.id && (
                      <p role="alert" style={{ fontSize: 12, color: "#B3261E", margin: "6px 0 0" }}>{err.text}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {hidden.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <button type="button" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden}
                style={{ fontSize: 13, color: "var(--ink-soft)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                「興味なし」にした会社（{hidden.length}社）{showHidden ? "を閉じる" : "を見る"}
              </button>
              {showHidden && (
                <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 8 }}>
                  {hidden.map((c) => (
                    <li key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, borderBottom: "1px solid var(--line-soft)", padding: "6px 0" }}>
                      <span>{c.name}</span>
                      <button type="button" disabled={busy === c.id} onClick={() => react(c.id, "later")}
                        style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}>
                        一覧に戻す
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}

function Tag({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <span data-state={`for-you-tag-${state}`} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--ink-soft)", background: "#fff" }}>
      {children}
    </span>
  );
}

function Actions(props: {
  c: ForYouView;
  busy: boolean;
  composing: boolean;
  note: string;
  declining: boolean;
  declineReason: string;
  declineReasons: { value: string; label: string }[];
  onInterested: () => void;
  onChangeNote: (v: string) => void;
  onSend: () => void;
  onCancelCompose: () => void;
  onUndo: () => void;
  onLater: () => void;
  onStartDecline: () => void;
  onCancelDecline: () => void;
  onChangeReason: (v: string) => void;
  onDecline: () => void;
}) {
  const { c } = props;
  const btn = { fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", minHeight: 36 } as const;

  /* ── 「話を聞いてみたい」を押した後 ── */
  if (c.interested) {
    return (
      <div data-state="for-you-interested" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
        {c.conversationId ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>「話を聞いてみたい」と答えました。メッセージでやり取りできます。</span>
            <Link href={`/mypage/conversations/${c.conversationId}`}
              style={{ padding: "8px 14px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
              メッセージを開く
            </Link>
          </div>
        ) : (
          /* ⚠️★担当者が登録されたら知らせる仕組みはまだ無い。守れない約束を書かない */
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--ink-soft)" }}>「話を聞いてみたい」と記録し、運営に伝えました。</span>
            <button type="button" disabled={props.busy} onClick={props.onUndo}
              style={{ padding: "4px 0", border: "none", background: "none", color: "var(--ink-soft)", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>
              取り消す
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── 担当者がいる会社: ひとことを書いて送る（上段の提案と同じ形） ── */
  if (props.composing) {
    return (
      <div data-state="for-you-composing" style={{ marginTop: 12 }}>
        <label htmlFor={`fy-note-${c.id}`} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          会社へのひとこと<span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>（任意・{PROPOSAL_NOTE_MAX}字まで）</span>
        </label>
        <textarea id={`fy-note-${c.id}`} value={props.note} maxLength={PROPOSAL_NOTE_MAX} rows={3}
          onChange={(e) => props.onChangeNote(e.target.value)} placeholder="聞いてみたいことや、いまの状況など"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, lineHeight: 1.6, resize: "vertical" }} />
        <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 0", textAlign: "right" }}>{props.note.length} / {PROPOSAL_NOTE_MAX}</p>
        {/* ★押す直前に置く（何が届くか）。文言は柴さんの指示 */}
        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, margin: "6px 0 0" }}>
          押すと、この会社にあなたのプロフィールが届き、メッセージでやりとりできるようになります
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button type="button" disabled={props.busy} onClick={props.onSend}
            style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff", opacity: props.busy ? 0.6 : 1 }}>
            話を聞いてみたい
          </button>
          <button type="button" onClick={props.onCancelCompose}
            style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)" }}>
            やめる
          </button>
        </div>
      </div>
    );
  }

  /* ── 「興味なし」の理由を選ぶ ── */
  if (props.declining) {
    return (
      <div style={{ marginTop: 12 }}>
        <label htmlFor={`decline-${c.id}`} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          理由を1つ選んでください<span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>（会社には伝わりません）</span>
        </label>
        <select id={`decline-${c.id}`} value={props.declineReason} onChange={(e) => props.onChangeReason(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}>
          <option value="">選んでください</option>
          {props.declineReasons.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" disabled={props.busy || !props.declineReason} onClick={props.onDecline}
            style={{ ...btn, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", opacity: props.declineReason ? 1 : 0.5 }}>
            興味なしにする
          </button>
          <button type="button" onClick={props.onCancelDecline}
            style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)" }}>
            やめる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" disabled={props.busy} onClick={props.onInterested}
        style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff", opacity: props.busy ? 0.6 : 1 }}>
        話を聞いてみたい
      </button>
      <button type="button" disabled={props.busy} onClick={props.onLater} aria-pressed={c.reaction === "later"}
        style={{ ...btn, border: "1px solid var(--line)", background: c.reaction === "later" ? "var(--bg-tint)" : "#fff", color: "var(--ink)" }}>
        {c.reaction === "later" ? "あとで（保存済み）" : "あとで"}
      </button>
      <button type="button" disabled={props.busy} onClick={props.onStartDecline}
        style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)" }}>
        興味なし
      </button>
    </div>
  );
}
