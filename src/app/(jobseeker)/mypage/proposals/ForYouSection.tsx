"use client";

import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { NO_REASON_PROMPT, type ForYouReaction } from "@/lib/forYou/weights";
import InterestConfirmDialog from "@/components/interest/InterestConfirmDialog";
import { ALL_COMPANIES_SECTION_TITLE, OTHER_COMPANIES_TITLE } from "./fitPageText";
import { BTN, CARD_STYLE, CautionBox, NameLabel, Phrases, ReasonBox } from "./FitCardParts";

/**
 * ★「あなたに合う会社」の下段「すべての会社を合う順に」（2026-10-15 に /mypage/for-you から移した）。
 *   並べ方は lib/forYou/（weights.ts）。上段（提案）に出ている会社は page.tsx が除いてから渡す。
 *
 * ★ボタン（2026-10-27 / 話を聞きたい人 フェーズ1a）:
 *   担当者あり … 「話を聞いてみたい」→ 確認の画面（InterestConfirmDialog）→［届ける］で名前とプロフィールが届き、会話ができる
 *   担当者未登録 … 「保存」（既存の ow_bookmarks）。**名前は届けない**。担当者が付いたら保存した人に知らせるだけ
 *                 （柴さんの決定。届くのは改めて押したときだけ）。⚠️ いないことが分かる文言は出さない（見出しで分けることもしない）
 * ⚠️ 記録と届け方は lib/interest/server.ts の1か所（企業ページ・上段の提案と同じ）。
 */

const VIEW_KEY = "opinio-for-you-view";

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
  /** 「話を聞いてみたい」の状態（lib/interest/constants.ts の InterestStatus）。押していなければ null */
  interestStatus: "delivered" | "replied" | "no_reply" | null;
  reaction: ForYouReaction | null;
  conversationId: string | null;
  /** 「話を聞いてみたい」を押した（取り消していない） */
  interested: boolean;
};

export default function ForYouSection({
  companies, loadFailed, noReasons, declineReasons, compact,
}: {
  companies: ForYouView[];
  loadFailed: boolean;
  noReasons: boolean;
  declineReasons: { value: string; label: string }[];
  /**
   * ★ホーム（/home）用の短い形（2026-10-27 / 柴さんの決定 8）。上から limit 社だけ1社1行で出し、下に「すべて見る →」。
   * ⚠️ 表示の切り替え・見出しでのまとめ・「興味なし」にした会社の一覧は出さない（それはマイページの役目）
   */
  compact?: { limit: number; moreHref: string; title: string };
}) {
  const [items, setItems] = useState(companies);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  /* ★「話を聞いてみたい」の確認の画面（2026-10-27。どの会社でも開く） */
  const [confirming, setConfirming] = useState<ForYouView | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  /* ★表示の形（2026-10-23 / 柴さんの指示）。リスト（1社1行）とタイル（ロゴと社名。押すと開く）。
        ⚠️ 選んだ形はこの端末にだけ覚える（localStorage。読めなければリスト） */
  const [view, setView] = useState<"list" | "tiles">("list");
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "list" || v === "tiles") setView(v); } catch { /* 読めなければリストのまま */ }
  }, []);
  const changeView = (v: "list" | "tiles") => {
    setView(v); setExpanded(null);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* 覚えられなくても表示は切り替わる */ }
  };

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
    setItems((prev) => prev.map((c) => c.id !== id ? c : { ...c, reaction }));
    setDeclining(null);
    setDeclineReason("");
  }

  /* ★確認の画面の［届ける］。⚠️ 失敗は画面の中に出す（閉じない） */
  async function deliver(c: ForYouView, input: { note: string; consentVersion: string }) {
    setConfirmErr(null);
    setBusy(c.id);
    try {
      const res = await fetch(`/api/jobseeker/for-you/${encodeURIComponent(c.id)}/react`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: "interested", note: input.note || null, consentVersion: input.consentVersion }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; result?: string; conversationId?: string };
      if (!res.ok) { setConfirmErr(json.error ?? "届けられませんでした。時間をおいてもう一度お試しください。"); return; }
      setItems((prev) => prev.map((x) => x.id !== c.id ? x : {
        ...x, reaction: "interested", interested: true,
        conversationId: json.conversationId ?? x.conversationId,
        interestStatus: json.result === "conversation" ? "delivered" : x.interestStatus,
      }));
      setConfirming(null);
    } catch {
      setConfirmErr("届けられませんでした。通信を確かめてもう一度お試しください。");
    } finally {
      setBusy(null);
    }
  }

  async function undo(id: string) {
    const r = await post(id, { undo: true });
    if (!r.ok) return;
    /* ★取り消したら何も押していない状態に戻す（2026-10-23。それまでは「あとで」になっていた） */
    setItems((prev) => prev.map((c) => c.id !== id ? c : { ...c, reaction: null, interested: false, interestStatus: null }));
  }

  /* ★「あとで」をもう一度押すと外す（2026-10-23） */
  async function toggleLater(c: ForYouView) {
    if (c.reaction !== "later") return react(c.id, "later");
    const r = await post(c.id, { clear: true });
    if (!r.ok) return;
    setItems((prev) => prev.map((x) => x.id !== c.id ? x : { ...x, reaction: null }));
  }

  const visible = items.filter((c) => c.reaction !== "not_interested");
  const hidden = items.filter((c) => c.reaction === "not_interested");
  /* ★「あとで」を押した会社は上にまとめる（2026-10-23 / 柴さんの指示）。⚠️ 気になる・話を聞いてみたい済みは入れない */
  const later = visible.filter((c) => c.reaction === "later" && !c.interested);
  const rest = visible.filter((c) => !(c.reaction === "later" && !c.interested));

  /* 会社ごとの操作（話を聞いてみたい・あとで・興味なし）。リスト・タイル・カードで同じものを使う */
  const actionsFor = (c: ForYouView) => (
    <Actions
      c={c}
      busy={busy === c.id}
      declining={declining === c.id}
      declineReason={declineReason}
      declineReasons={declineReasons}
      onInterested={() => { setConfirmErr(null); setConfirming(c); }}
      onUndo={() => undo(c.id)}
      onLater={() => toggleLater(c)}
      onStartDecline={() => { setDeclining(c.id); setDeclineReason(""); }}
      onCancelDecline={() => setDeclining(null)}
      onChangeReason={setDeclineReason}
      onDecline={() => react(c.id, "not_interested", { reason: declineReason })}
    />
  );
  const errFor = (c: ForYouView) => err?.id === c.id
    ? <p role="alert" style={{ fontSize: 12, color: "#B3261E", margin: "6px 0 0", flexBasis: "100%" }}>{err.text}</p>
    : null;

  /* カード（タイルを開いたとき）。g.label があれば1番目の理由は見出しにあるので繰り返さない */
  const fullCard = (c: ForYouView, g: { label: string | null }, onClose?: () => void) => (
    <li key={c.id} data-company-id={c.id} data-rank={c.rank} className="fy-card" style={{ ...CARD_STYLE, ...(onClose ? { gridColumn: "1 / -1" } : {}) }}>
      {onClose && (
        <button type="button" onClick={onClose} data-action="tile-close" aria-label={`${c.name}を閉じる`}
          style={{ alignSelf: "flex-end", background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer", marginBottom: 4 }}>
          閉じる ×
        </button>
      )}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                        <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="sm" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 className="fy-name" style={{ fontSize: 15, fontWeight: 700, margin: 0 }} title={c.name}>
                            {c.href
                              ? <Link href={c.href} className="fit-company-link">{c.name}</Link>
                              : c.name}
                          </h4>
                          {/* ⚠️ 担当者の有無のラベルは 2026-10-23 に外した（見出しで分けたため） */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
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

                      <div className="fy-actions">{actionsFor(c)}</div>
      {errFor(c)}
    </li>
  );

  /* ★リスト（2026-10-23 / 柴さんの指示）。1社1行で流し読みできる形。説明は理由（無ければ一言）を1行だけ */
  const row = (c: ForYouView, g: { label: string | null }) => {
    const reason = (g.label ? c.reasons[1] : c.reasons[0]) ?? null;
    const text = reason ? `✓ ${reason}` : c.tagline;
    const open = declining === c.id;
    return (
      <li key={c.id} data-company-id={c.id} data-rank={c.rank} className="fy-row">
        <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="sm" />
        <div className="fy-row-main">
          <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
            <span className="fy-name" style={{ fontSize: 14.5, fontWeight: 700 }} title={c.name}>
              {c.href ? <Link href={c.href} className="fit-company-link">{c.name}</Link> : c.name}
            </span>
            {c.hasOpenJobs && <NameLabel state="fit-tag-jobs">募集あり</NameLabel>}
            {c.phaseLabel && <NameLabel state="fit-tag-phase">{c.phaseLabel}</NameLabel>}
          </div>
          {text && <div className="fy-row-text" title={text} style={reason ? { color: "#14532D" } : undefined}>{text}</div>}
        </div>
        <div className={open || c.interested ? "fy-row-actions is-open" : "fy-row-actions"}>{actionsFor(c)}</div>
        {errFor(c)}
      </li>
    );
  };

  /* ★タイル（2026-10-23）。ロゴ・社名・理由（無ければ一言）と、主の操作1つを並べる。
        ロゴや社名を押すとその場でカードに開き、「あとで」「興味なし」も選べる。
        ⚠️ 主の操作をタイルから外さないこと（並べるだけでは押す先が無く、アクションにつながらなかった。柴さんの指摘） */
  const tile = (c: ForYouView, g: { label: string | null }) => {
    if (expanded === c.id) return fullCard(c, g, () => setExpanded(null));
    const reason = (g.label ? c.reasons[1] : c.reasons[0]) ?? null;
    const text = reason ? `✓ ${reason}` : c.tagline;
    return (
      <li key={c.id} data-company-id={c.id} data-rank={c.rank} className="fy-tile">
        <button type="button" className="fy-tile-head" onClick={() => setExpanded(c.id)} aria-expanded={false} data-action="tile-open"
          title={`${c.name}の詳しい内容を開く`}>
          <CompanyLogo name={c.name} logoUrl={c.logoUrl} size="sm" />
          <span className="fy-name" style={{ fontSize: 13.5, fontWeight: 700, maxWidth: "100%" }}>{c.name}</span>
          {c.phaseLabel && <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.phaseLabel}</span>}
          {text && <span className="fy-tile-text" style={reason ? { color: "#14532D" } : undefined}>{text}</span>}
        </button>
        <div className="fy-tile-foot">
          {c.interested ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>届けました</span>
          ) : !c.hasResponder ? (
            /* ★担当者がいない会社は「保存」（2026-10-27）。⚠️ いないことが分かる文言は出さない */
            <span data-state="tile-save"><BookmarkButton targetType="company" targetId={c.id} label="保存" variant="with-text" /></span>
          ) : (
            <button type="button" disabled={busy === c.id} data-action="tile-primary"
              onClick={() => { setConfirmErr(null); setConfirming(c); }}
              style={{ ...BTN, width: "100%", border: "1px solid var(--royal)", background: "#fff", color: "var(--royal)", opacity: busy === c.id ? 0.6 : 1 }}>
              話を聞いてみたい
            </button>
          )}
        </div>
        {errFor(c)}
      </li>
    );
  };

  /* 理由ごとにまとめた一覧 */
  /* ⚠️ 理由の無い会社だけのとき（＝まとめの見出しが「その他の掲載企業」1つだけ）は、その見出しを出さない（2026-10-23）。
        上の「気になる会社 N社」と同じ会社を指す見出しが2つ並んでいた */
  const renderGroups = (list: ForYouView[]) => (
          /* ⚠️ 列は minmax(0, 1fr)。1fr だとリストの行の最小幅で枠が押し広がり、スマホで横にはみ出した（2026-10-23） */
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1fr)" }}>
            {groupCompanies(list).map((g) => (
              <section key={g.label ?? "__other"} data-state={g.label ? "for-you-group" : "for-you-group-other"} aria-label={g.label ?? OTHER_COMPANIES_TITLE}>
                {(g.label || groupCompanies(list).length > 1) && <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: g.label ? "#14532D" : "var(--ink-soft)" }}>
                  {g.label ? `✓ ${g.label}` : OTHER_COMPANIES_TITLE}
                  <span style={{ fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6, fontSize: 12 }}>{g.items.length}社</span>
                </h3>}
                {view === "list"
                  ? <ol className="fy-list" data-state="for-you-list">{g.items.map((c) => row(c, g))}</ol>
                  : <ol className="fy-tiles" data-state="for-you-tiles">{g.items.map((c) => tile(c, g))}</ol>}
              </section>
            ))}
          </div>
  );

  const confirmDialog = (
    <InterestConfirmDialog
      open={!!confirming}
      companyName={confirming?.name ?? ""}
      busy={!!confirming && busy === confirming.id}
      error={confirmErr}
      onCancel={() => { setConfirming(null); setConfirmErr(null); }}
      onConfirm={(input) => { if (confirming) void deliver(confirming, input); }}
    />
  );

  if (compact) {
    const top = visible.slice(0, compact.limit);
    if (loadFailed || top.length === 0) return null; // ★空の箱を出さない（ホームの約束）
    return (
      <section id="home-for-you" aria-labelledby="for-you-heading" data-state="home-for-you" style={{ scrollMarginTop: 80 }}>
        <style>{FY_ROW_CSS}</style>
        <h2 id="for-you-heading" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 12px" }}>{compact.title}</h2>
        <ol className="fy-list" data-state="for-you-list">{top.map((c) => row(c, { label: null }))}</ol>
        {confirmDialog}
        <Link href={compact.moreHref} data-state="home-for-you-more"
          style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
          すべて見る →
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="for-you-heading">
      {confirmDialog}
      {/* ⚠️ この <style> のコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる） */}
      <style>{`
        .fy-grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .fy-card { display: flex; flex-direction: column; min-width: 0; }
        .fy-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fy-tagline { font-size: 12.5px; line-height: 1.6; color: var(--ink-soft); margin: 8px 0 0;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .fy-actions { margin-top: auto; padding-top: 12px; }
        @media (max-width: 760px) { .fy-grid { grid-template-columns: minmax(0, 1fr); } }
        ${FY_ROW_CSS}
        .fy-tiles { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); grid-auto-flow: dense; }
        .fy-tile { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 12px; background: #fff; min-width: 0; overflow: hidden; }
        .fy-tile:hover { border-color: var(--royal-100); }
        .fy-tile-head { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 10px 8px; border: none; background: none; cursor: pointer; font-family: inherit; color: var(--ink); min-width: 0; text-align: center; }
        .fy-tile-text { font-size: 11.5px; line-height: 1.5; color: var(--ink-soft); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; }
        .fy-tile-foot { padding: 0 10px 12px; text-align: center; }
        @media (max-width: 760px) { .fy-row-actions { flex-basis: 100%; margin-left: 0; } .fy-tiles { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
        <h2 id="for-you-heading" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{ALL_COMPANIES_SECTION_TITLE}</h2>
        <div role="group" aria-label="表示の形" data-state="for-you-view-toggle" style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {([["list", "リスト"], ["tiles", "タイル"]] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => changeView(v)} data-view={v}
              style={{ padding: "6px 14px", fontSize: 12.5, fontWeight: 600, border: "none", fontFamily: "inherit", cursor: "pointer",
                background: view === v ? "var(--royal)" : "#fff", color: view === v ? "#fff" : "var(--ink-soft)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

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

          {later.length > 0 && (
            <section data-state="for-you-later" style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>あとで見る<span style={{ fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6, fontSize: 12 }}>{later.length}社</span></h3>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.7 }}>「あとで」を押した会社です。もう一度「あとで」を押すと、ここから外れます。</p>
              {renderGroups(later)}
            </section>
          )}
          {/* ★2026-10-27（柴さんの決定）: 担当者の有無で見出しを分けない（「担当者がいる会社」「気になる会社」をやめた）。
                 分けると、下の会社が OPINIO にいないことが分かり、外のサイトで直接応募するきっかけになる。合う順に1つにまとめる。
                 担当者がいる会社は「話を聞いてみたい」、いない会社は「保存」（Actions が c.hasResponder で出し分ける） */}
          {rest.length > 0 && (
            <section data-state="for-you-all" style={{ marginBottom: 28 }}>
              {renderGroups(rest)}
            </section>
          )}

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

/* ★1社1行のリストの見た目。マイページの一覧とホームの短い形で同じものを使う。
   ⚠️ このテンプレートのコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる） */
const FY_ROW_CSS = `
  .fy-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fy-list { list-style: none; padding: 0; margin: 0; border: 1px solid var(--line); border-radius: 12px; background: #fff; overflow: hidden; }
  .fy-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 10px 14px; border-top: 1px solid var(--line-soft); min-width: 0; }
  .fy-row:first-child { border-top: none; }
  .fy-row-main { flex: 1 1 260px; min-width: 0; }
  .fy-row-text { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fy-row-actions { flex: 0 0 auto; margin-left: auto; }
  .fy-row-actions.is-open { flex-basis: 100%; margin-left: 0; }
  @media (max-width: 760px) { .fy-row-actions { flex-basis: 100%; margin-left: 0; } }
`;

function Actions(props: {
  c: ForYouView;
  busy: boolean;
  declining: boolean;
  declineReason: string;
  declineReasons: { value: string; label: string }[];
  onInterested: () => void;
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
          <span style={{ fontWeight: 600 }}>「話を聞いてみたい」と答えました</span>
        )}
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
      {c.hasResponder ? (
        <button type="button" disabled={props.busy} onClick={props.onInterested}
          style={{ ...btn, border: "1px solid var(--royal)", background: "#fff", color: "var(--royal)", opacity: props.busy ? 0.6 : 1, marginRight: 4 }}>
          話を聞いてみたい
        </button>
      ) : (
        /* ★担当者がいない会社は「保存」（2026-10-27 / 柴さんの決定）。名前は届けない。⚠️ いないことが分かる文言は出さない */
        <span data-state="for-you-save" style={{ marginRight: 4 }}>
          <BookmarkButton targetType="company" targetId={c.id} label="保存" variant="with-text" />
        </span>
      )}
      <button type="button" disabled={props.busy} onClick={props.onLater} aria-pressed={c.reaction === "later"}
        style={{ ...btn, border: "none", background: c.reaction === "later" ? "var(--bg-tint)" : "none", color: "var(--ink-soft)", padding: "8px 10px" }}>
        {/* ★「あとで見る」に入っている会社では外すボタンにする（2026-10-23） */}
        {c.reaction === "later" ? "あとでから外す" : "あとで"}
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
