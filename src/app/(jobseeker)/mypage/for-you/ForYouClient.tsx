"use client";

import { useState } from "react";
import Link from "next/link";
import { NO_REASON_PROMPT, type ForYouReaction } from "@/lib/forYou/weights";

export type ForYouView = {
  id: string;
  rank: number;
  name: string;
  /** 企業ページへのリンク。開けない会社（検証用など）は null */
  href: string | null;
  /** 事業の一行（ow_companies.tagline） */
  tagline: string | null;
  /** 理由（最大2行）。★無い会社は行ごと出さない（「接点はまだ見つかっていません」とは書かない） */
  reasons: string[];
  /** タグ「話を聞ける人がいます」。★並び順の点数には入れていない */
  hasTalkable: boolean;
  /** 「興味あり」を押したら会話が開くか */
  hasResponder: boolean;
  reaction: ForYouReaction | null;
  conversationId: string | null;
  /** 一度でも「興味あり」を押した */
  interested: boolean;
};

type Outcome = "conversation" | "ops_notified" | "recorded";

export default function ForYouClient({
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
  const [declineReason, setDeclineReason] = useState<string>("");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [showHidden, setShowHidden] = useState(false);

  async function send(id: string, reaction: ForYouReaction, reason?: string) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/jobseeker/for-you/${encodeURIComponent(id)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction, reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; result?: Outcome; conversationId?: string };
      if (!res.ok || !json.result) {
        setErr({ id, text: json.error ?? "記録できませんでした。時間をおいてもう一度お試しください。" });
        return;
      }
      setItems((prev) => prev.map((c) => c.id !== id ? c : {
        ...c,
        reaction,
        interested: c.interested || reaction === "interested",
        conversationId: json.conversationId ?? c.conversationId,
      }));
      if (reaction === "interested") setOutcomes((o) => ({ ...o, [id]: json.result! }));
      setDeclining(null);
      setDeclineReason("");
    } catch {
      setErr({ id, text: "記録できませんでした。通信を確かめてもう一度お試しください。" });
    } finally {
      setBusy(null);
    }
  }

  const visible = items.filter((c) => c.reaction !== "not_interested");
  const hidden = items.filter((c) => c.reaction === "not_interested");

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>あなたに合う順</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 20px" }}>
        掲載中の会社を、あなたの職歴・希望職種などから合う順に並べています。
        この一覧はあなたにしか見えません。<strong>「興味あり」を押すまで、会社には何も伝わりません。</strong>
      </p>

      {loadFailed ? (
        <p role="alert" style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          一覧を表示できませんでした。時間をおいて開き直してください。
        </p>
      ) : (
        <>
          {noReasons && (
            <div data-state="for-you-no-reasons" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 18, background: "var(--bg-tint)", fontSize: 14, lineHeight: 1.8 }}>
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
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                      {c.href
                        ? <Link href={c.href} style={{ color: "inherit", textDecoration: "none" }}>{c.name}</Link>
                        : c.name}
                    </h2>
                    {c.tagline && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "2px 0 0" }}>{c.tagline}</p>}
                    {c.reasons.length > 0 && (
                      <ul data-state="for-you-reasons" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 2 }}>
                        {c.reasons.map((r) => (
                          <li key={r} style={{ fontSize: 13, lineHeight: 1.6 }}>・{r}</li>
                        ))}
                      </ul>
                    )}
                    {c.hasTalkable && (
                      <p style={{ margin: "8px 0 0" }}>
                        <span data-state="for-you-talkable" style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                          話を聞ける人がいます
                        </span>
                      </p>
                    )}

                    <Actions
                      c={c}
                      busy={busy === c.id}
                      outcome={outcomes[c.id]}
                      declining={declining === c.id}
                      declineReason={declineReason}
                      declineReasons={declineReasons}
                      onInterested={() => send(c.id, "interested")}
                      onLater={() => send(c.id, "later")}
                      onStartDecline={() => { setDeclining(c.id); setDeclineReason(""); }}
                      onCancelDecline={() => setDeclining(null)}
                      onChangeReason={setDeclineReason}
                      onDecline={() => send(c.id, "not_interested", declineReason)}
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
                      <button type="button" disabled={busy === c.id} onClick={() => send(c.id, "later")}
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
    </main>
  );
}

function Actions(props: {
  c: ForYouView;
  busy: boolean;
  outcome: Outcome | undefined;
  declining: boolean;
  declineReason: string;
  declineReasons: { value: string; label: string }[];
  onInterested: () => void;
  onLater: () => void;
  onStartDecline: () => void;
  onCancelDecline: () => void;
  onChangeReason: (v: string) => void;
  onDecline: () => void;
}) {
  const { c } = props;
  const btn = { fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", minHeight: 36 } as const;

  /* ── 「興味あり」を押した後 ── */
  if (c.interested) {
    return (
      <div data-state="for-you-interested" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
        {c.conversationId ? (
          <p style={{ margin: 0 }}>
            「興味あり」を会社に伝えました。{" "}
            <Link href={`/mypage/conversations/${c.conversationId}`} style={{ color: "var(--royal)", fontWeight: 600 }}>メッセージを開く →</Link>
          </p>
        ) : props.outcome === "ops_notified" || (!c.hasResponder && props.outcome === undefined) ? (
          /* ⚠️★担当者が登録されたら知らせる仕組みはまだ無い。守れない約束を書かない */
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            この会社はまだ担当者が未登録です。「興味あり」として記録し、運営に伝えました。
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>「興味あり」として記録しました。</p>
        )}
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
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={props.busy} onClick={props.onInterested}
          style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff" }}>
          興味あり
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
      {/* ★押す前に、企業に何が届くかを書く（柴さんの指示・2026-10-15。文言は指示どおり）。
             ⚠️ どちらの企業かは「担当者あり／担当者未登録」の札で押す前に分かるようにする */}
      <p data-state={c.hasResponder ? "for-you-has-responder" : "for-you-no-responder"}
        style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, margin: "8px 0 0" }}>
        <span style={{
          display: "inline-block", fontSize: 11, fontWeight: 600, padding: "1px 8px", marginRight: 6, borderRadius: 999,
          border: "1px solid var(--line)", color: c.hasResponder ? "var(--ink)" : "var(--ink-soft)", background: "#fff",
        }}>
          {c.hasResponder ? "担当者あり" : "担当者未登録"}
        </span>
        {c.hasResponder
          ? "押すと、この会社にあなたのプロフィールが届き、メッセージでやりとりできるようになります"
          : "押すと、運営に記録されます。この会社にはまだ担当者がいません"}
      </p>
    </div>
  );
}
