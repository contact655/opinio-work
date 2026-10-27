"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InterestConfirmDialog from "@/components/interest/InterestConfirmDialog";
import { useCompanyViewerState } from "@/lib/companies/useCompanyViewerState";
import { interestStatusText, type InterestStatus } from "@/lib/interest/constants";

type State = {
  eligible: boolean;
  companyName: string | null;
  hasResponder: boolean;
  pressed: boolean;
  status: InterestStatus | null;
  conversationId: string | null;
};

const pill = {
  display: "inline-flex", alignItems: "center", padding: "10px 20px", borderRadius: 100, fontSize: 14, fontWeight: 700,
  border: "1.5px solid var(--royal)", background: "#fff", color: "var(--royal)", cursor: "pointer",
} as const;

/**
 * ★企業ページの「話を聞いてみたい」（2026-10-27 / 話を聞きたい人 フェーズ1a）。カジュアル面談の申込とは別のボタン。
 *   担当者がいる会社 … 押すと確認の画面（合う会社と同じ部品）→［届ける］で名前とプロフィールが届く
 *   ★担当者がいない会社 … ボタンを出さない（企業ページの「保存」だけ）。保存した人には担当者が付いたときに知らせる。
 *                         **名前は届けない**。いないことが分かる文言も出さない（2026-10-27 / 柴さんの決定）
 * ⚠️★押せない会社（在籍した会社・グループ会社・自分が担当者の会社・ブロック・検証用と実在の不一致）では**ボタンを出さない**。
 *    判定はサーバー（can_contact_without_stance）。理由は出さない。
 * ⚠️ 企業ページは ISR。未ログインでは API を叩かない（useCompanyViewerState で確かめてから）。
 */
export default function CompanyInterestButton({ companyId }: { companyId: string }) {
  const viewer = useCompanyViewerState(companyId);
  const [st, setSt] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const api = `/api/jobseeker/interest/${encodeURIComponent(companyId)}`;

  useEffect(() => {
    if (!viewer.ready || !viewer.authenticated) return;
    let alive = true;
    fetch(api)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setSt(d as State); })
      .catch(() => { /* 取れなければボタンを出さない */ });
    return () => { alive = false; };
  }, [api, viewer.ready, viewer.authenticated]);

  if (!st || !st.eligible || !st.companyName) return null;
  const name = st.companyName;

  async function confirm(input: { note: string; consentVersion: string }) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(api, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: input.note || null, consentVersion: input.consentVersion }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; status?: InterestStatus | "recorded"; conversationId?: string | null };
      if (!res.ok) { setErr(j.error ?? "届けられませんでした。時間をおいてもう一度お試しください。"); return; }
      setSt((s) => s && ({
        ...s, pressed: true,
        status: j.status === "recorded" ? null : (j.status ?? null),
        conversationId: j.conversationId ?? null,
      }));
      setOpen(false);
    } catch {
      setErr("届けられませんでした。通信を確かめてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  /* ── 担当者がいない会社：ボタンを出さない（企業ページの「保存」だけが残る）。
        ⚠️ いないことが分かる文言を出さない（2026-10-27 / 柴さんの決定） ── */
  if (!st.hasResponder) return null;

  if (st.pressed) {
    return (
      <span data-state={`company-interest-${st.status ?? "pressed"}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "var(--royal)" }}>「話を聞いてみたい」を届けました</span>
        {st.conversationId ? (
          <Link href={`/mypage/conversations/${st.conversationId}`} style={{ fontWeight: 600, color: "var(--royal)" }}>メッセージを開く</Link>
        ) : (
          <span>{interestStatusText(st.status, name)}</span>
        )}
      </span>
    );
  }

  return (
    <>
      <button type="button" data-action="company-interest" onClick={() => { setErr(null); setOpen(true); }} style={pill}>
        話を聞いてみたい
      </button>
      <InterestConfirmDialog open={open} companyName={name} busy={busy} error={err}
        onCancel={() => setOpen(false)} onConfirm={(input) => void confirm(input)} />
    </>
  );
}
