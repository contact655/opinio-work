"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { NO_REASON_PROMPT, type ForYouReaction } from "@/lib/forYou/weights";
import { PROPOSAL_NOTE_MAX } from "@/lib/constants/proposalResponses";
import { ALL_COMPANIES_SECTION_TITLE, OTHER_COMPANIES_TITLE } from "./fitPageText";
import { BTN, CARD_STYLE, CautionBox, NameLabel, Phrases, ReasonBox } from "./FitCardParts";

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
  /** ow_companies.logo_url（無ければ頭文字で出す） */
  logoUrl: string | null;
  /** 理由（最大2行）。★無い会社は枠ごと出さない。1番目は見出しになるのでカードでは出さない */
  reasons: string[];
  /** ★まとめる見出し（1番目の理由）。理由の無い会社は null（「その他の掲載企業」へ） */
  groupLabel: string | null;
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
      {/* ⚠️ この <style> のコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる） */}
      <style>{`
        .fy-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .fy-card { display: flex; flex-direction: column; min-width: 0; }
        .fy-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fy-tagline { font-size: 12.5px; line-height: 1.6; color: var(--ink-soft); margin: 8px 0 0;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .fy-actions { margin-top: auto; padding-top: 12px; }
        @media (max-width: 760px) { .fy-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <h2 id="for-you-heading" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>{ALL_COMPANIES_SECTION_TITLE}</h2>

      {loadFailed ? (
        <p role="alert" style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          一覧を表示できませんでした。<strong>「0社」という意味ではありません。</strong>時間をおいて開き直してください。
        </p>
      ) : (
        <>
          {noReasons && (
            <div data-state="for-you-no-reasons" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: "var(--bg-tint)", fontSize: 14, lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}><Phrases text={NO_REASON_PROMPT} /></p>
              <Link href="/mypage#career" style={{ color: "var(--royal)", fontWeight: 600, fontSize: 13 }}>職歴を追加する →</Link>
            </div>
          )}

          {visible.length === 0 && hidden.length === 0 && (
            <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>いま表示できる会社はありません。</p>
          )}

          {/* ★理由ごとにまとめる（2026-10-15 / 柴さんの指示）。見出しは1番目の理由。
                 グループの並び＝グループの中で最も順位の高い会社の順（下の groupCompanies）。
                 理由の無い会社は最後に「その他の掲載企業」としてまとめる */}
          <div style={{ display: "grid", gap: 20 }}>
            {groupCompanies(visible).map((g) => (
              <section key={g.label ?? "__other"} data-state={g.label ? "for-you-group" : "for-you-group-other"} aria-label={g.label ?? OTHER_COMPANIES_TITLE}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: g.label ? "#14532D" : "var(--ink-soft)" }}>
                  {g.label ? `✓ ${g.label}` : OTHER_COMPANIES_TITLE}
                  <span style={{ fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6, fontSize: 12 }}>{g.items.length}社</span>
                </h3>
                {/* ★2026-10-16: 1列の縦長カードが21枚続いて読みにくかったので、広い画面は2列にした（柴さんの指示）。
                       ⚠️ 列の幅は minmax(0, 1fr)（1fr だと長い社名で列が押し広がる）。狭い画面は CSS で1列 */}
                <ol className="fy-grid">
                  {g.items.map((c) => (
                    <li key={c.id} data-company-id={c.id} data-rank={c.rank} className="fy-card" style={CARD_STYLE}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                        <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="sm" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 className="fy-name" style={{ fontSize: 15, fontWeight: 700, margin: 0 }} title={c.name}>
                            {c.href
                              ? <Link href={c.href} style={{ color: "inherit", textDecoration: "none" }}>{c.name}</Link>
                              : c.name}
                          </h4>
                          {/* ★担当者の有無は小さなラベルだけ。説明は「詳しく」に1回（柴さんの指示） */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                            <NameLabel state={c.hasResponder ? "for-you-has-responder" : "for-you-no-responder"}>
                              {c.hasResponder ? "担当者あり" : "担当者未登録"}
                            </NameLabel>
                            {c.hasOpenJobs && <NameLabel state="fit-tag-jobs">募集あり</NameLabel>}
                            {c.phaseLabel && <NameLabel state="fit-tag-phase">{c.phaseLabel}</NameLabel>}
                          </div>
                        </div>
                      </div>
                      {c.tagline && <p className="fy-tagline" title={c.tagline}>{c.tagline}</p>}

                      {/* ★見出しにした理由（1番目）はカードで繰り返さない。2つ目以降だけ */}
                      <ReasonBox items={g.label ? c.reasons.slice(1) : c.reasons} state="for-you-reasons" />
                      {/* ★中身が空なら枠ごと出さない（CautionBox が null を返す） */}
                      <CautionBox items={c.cautions} state="for-you-cautions" />

                      <div className="fy-actions">
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
                      </div>
                      {err?.id === c.id && (
                        <p role="alert" style={{ fontSize: 12, color: "#B3261E", margin: "6px 0 0" }}>{err.text}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

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
  const btn = BTN;

  /* ── 「話を聞いてみたい」を押した後 ── */
  if (c.interested) {
    return (
      <div data-state="for-you-interested" style={{ fontSize: 13, lineHeight: 1.7 }}>
        {c.conversationId ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* ⚠️ 上段（ProposalsClient）の回答済みと同じ1行。片方だけ変えないこと */}
            <span style={{ fontWeight: 600 }}>「話を聞いてみたい」と答えました</span>
            <Link href={`/mypage/conversations/${c.conversationId}`}
              style={{ padding: "6px 12px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
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
      <div data-state="for-you-composing" style={{}}>
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
      <div style={{}}>
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
    /* ★2026-10-16: 同じ濃紺のボタンが21個並んで重かったので、下段は枠線にした（柴さんの指示）。
          上段（OPINIO からの提案）は塗りのまま —— 強さの差で「提案」と「一覧」を見分けられるようにする。
          「あとで」「興味なし」は文字だけにして、主の操作を1つに見せる */
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" disabled={props.busy} onClick={props.onInterested}
        style={{ ...btn, border: "1px solid var(--royal)", background: "#fff", color: "var(--royal)", opacity: props.busy ? 0.6 : 1, marginRight: 4 }}>
        話を聞いてみたい
      </button>
      <button type="button" disabled={props.busy} onClick={props.onLater} aria-pressed={c.reaction === "later"}
        style={{ ...btn, border: "none", background: c.reaction === "later" ? "var(--bg-tint)" : "none", color: "var(--ink-soft)", padding: "8px 10px" }}>
        {c.reaction === "later" ? "あとで（保存済み）" : "あとで"}
      </button>
      <button type="button" disabled={props.busy} onClick={props.onStartDecline}
        style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)", padding: "8px 10px" }}>
        興味なし
      </button>
    </div>
  );
}

/**
 * ★理由ごとにまとめる（2026-10-15）。
 *   - 見出し＝1番目の理由（groupLabel）。同じ見出しの会社を1つにまとめる
 *   - グループの並び＝グループの中で最も順位の高い会社の順（rank が小さい順）
 *   - グループの中は順位の順
 *   - 理由の無い会社（groupLabel が null）は最後に1つ（「その他の掲載企業」）
 */
function groupCompanies(list: ForYouView[]): { label: string | null; items: ForYouView[] }[] {
  const map = new Map<string, ForYouView[]>();
  const other: ForYouView[] = [];
  for (const c of [...list].sort((a, b) => a.rank - b.rank)) {
    if (!c.groupLabel) { other.push(c); continue; }
    const arr = map.get(c.groupLabel) ?? [];
    arr.push(c);
    map.set(c.groupLabel, arr);
  }
  const groups = Array.from(map.entries())
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => a.items[0].rank - b.items[0].rank);
  return other.length > 0 ? [...groups, { label: null, items: other }] : groups;
}
