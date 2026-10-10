"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { APPROACH_EXPIRE_DAYS, APPROACH_RESEND_DAYS, COMPANY_APPROACH_STATUS_LABELS, type CompanyApproachStatus } from "@/lib/constants/companyApproaches";

/**
 * /biz/approaches の本文（2026-10-11 にキャンバス4「声かけの状況」へ揃えた）。
 * ⚠️ DB を読まない。/dev/preview/approaches から固定データで描くための部品。
 *
 * ⚠️★見送られたかどうかは出さない（`SentApproach` に declined_at は無い）。
 *    見送りは30日以内は「承認待ち」、過ぎたら「30日を過ぎました」と同じに見える。
 * ⚠️ 並び: **未読の承認（企業がまだ会話を開いていない）を先頭**、残りは送った新しい順。
 * ⚠️ タブは下線だけで選択を示す。件数はニュートラルな数字（ui-conventions「タブ」）。
 */
type Tab = "all" | CompanyApproachStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "承認待ち" },
  { key: "accepted", label: "やり取り中" },
  { key: "expired", label: `${APPROACH_EXPIRE_DAYS}日を過ぎたもの` },
];
const DAY = 24 * 60 * 60 * 1000;

function fmtMd(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}
function fmtYmd(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}
/** 次の月初（日本時間）の「◯月」 */
function nextMonthLabel(now: Date): string {
  const m = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" }).format(now).replace(/\D/g, ""));
  return `${(m % 12) + 1}月1日`;
}

export function ApproachesView({ allowed, rows, quota, sentId, now: nowIso }: {
  allowed: boolean;
  rows: SentApproach[] | null;
  quota: ApproachQuota | null;
  sentId?: string;
  /** 日数の計算の基準（サーバーで決めて渡す。描画のたびに変わらないように） */
  now: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])];
    list.sort((a, b) => (a.unseen === b.unseen ? b.createdAt.localeCompare(a.createdAt) : a.unseen ? -1 : 1));
    return list;
  }, [rows]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: sorted.length, pending: 0, accepted: 0, expired: 0 };
    for (const r of sorted) c[r.status]++;
    return c;
  }, [sorted]);
  const shown = tab === "all" ? sorted : sorted.filter((r) => r.status === tab);
  const talking = useMemo(() => new Set(sorted.filter((r) => r.status === "accepted").map((r) => r.candidate.id)).size, [sorted]);
  const unseen = sorted.filter((r) => r.unseen).length;
  const just = sentId ? sorted.find((r) => r.id === sentId) : undefined;

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="apx-root">
      <style>{`
        .apx-root { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .apx-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .apx-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .apx-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding: 16px 20px; border-top: 1px solid var(--line-soft); }
        .apx-row:first-child { border-top: 0; }
        .apx-tabs { display: flex; gap: 4px; padding: 0 12px; border-bottom: 1px solid var(--line); overflow-x: auto; }
        .apx-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .apx-tab[aria-selected=true] { border-bottom-color: var(--royal); color: var(--royal); font-weight: 700; }
        @media (max-width: 767px) {
          .apx-cards { grid-template-columns: minmax(0, 1fr); gap: 10px; }
          .apx-row { padding: 14px 16px; }
          .apx-tabs { padding: 0 4px; }
          .apx-tab { padding: 0 10px; }
        }
      `}</style>

      {just && (
        <div role="status" data-state="approach-sent-banner" style={{ background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700 }}>
          {just.candidate.name}さんに声かけを送りました。承認されるとメールでお知らせします。
        </div>
      )}

      <div className="apx-head">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>声かけ</h1>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
            企業名義で送った「メッセージのお願い」の状況です。承認された方とはメッセージでやり取りできます。
          </p>
        </div>
        <Link href="/biz/candidates" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
          候補者を探す
        </Link>
      </div>

      {!allowed ? (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, fontSize: 13, color: "var(--ink-soft)" }}>
          ご利用のプランでは声かけを使えません。
        </div>
      ) : (
        <>
          {/* ⚠️ 取得に失敗したら「0件」と出さない */}
          {quota ? (
            <div className="apx-cards" data-state="approach-quota">
              <QuotaCard label="今月送った数" value={quota.monthlyUsed} unit={` / ${quota.monthlyLimit}`} sub={`${nextMonthLabel(now)}に戻ります`} />
              <QuotaCard label="承認待ち" value={quota.openCount} unit={` / ${quota.openLimit}`} sub={`送ってから${APPROACH_EXPIRE_DAYS}日で枠に戻ります`} />
              <QuotaCard label="やり取り中" value={rows === null ? null : talking} unit=" 人" sub={unseen > 0 ? `未読の承認 ${unseen}件` : null} subStrong />
            </div>
          ) : (
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", margin: 0 }}>送信数を取得できませんでした。</p>
          )}

          {rows === null ? (
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error)", margin: 0 }}>一覧を取得できませんでした。時間をおいて再読み込みしてください。</p>
          ) : rows.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
              まだ声かけを送っていません。候補者を探して、理由を添えて声をかけてみましょう。
            </div>
          ) : (
            <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
              <div role="tablist" className="apx-tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-state={tab === t.key ? "active" : "idle"} className="apx-tab btn-fixed-size" onClick={() => setTab(t.key)}>
                    {t.label}
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>{counts[t.key]}</span>
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p style={{ margin: 0, padding: "20px", fontSize: 13, color: "var(--ink-mute)" }}>該当する声かけはありません。</p>
              ) : shown.map((r) => (
                <ApproachRow key={r.id} r={r} now={now} open={open.has(r.id)} onToggle={() => toggle(r.id)} />
              ))}
            </section>
          )}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-mute)" }}>
            見送られたかどうかは企業には表示されません。{APPROACH_EXPIRE_DAYS}日たつと、返事がなかったものと同じ表示になります。
          </p>
        </>
      )}
    </div>
  );
}

function QuotaCard({ label, value, unit, sub, subStrong }: { label: string; value: number | null; unit: string; sub: string | null; subStrong?: boolean }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px", minWidth: 0 }}>
      <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", marginTop: 4, fontFamily: "var(--font-inter), var(--font-noto)" }}>
        {value === null ? "—" : value}<span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink-mute)" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, marginTop: 2, color: subStrong ? "var(--royal)" : "var(--ink-mute)", fontWeight: subStrong ? 700 : 400 }}>{sub}</div>}
    </div>
  );
}

const BADGE: Record<CompanyApproachStatus, React.CSSProperties> = {
  pending: { background: "var(--warm-soft)", color: "var(--warm-ink)" },
  accepted: { background: "var(--royal-50)", color: "var(--royal)" },
  expired: { background: "var(--line-soft)", color: "var(--ink-soft)" },
};

function ApproachRow({ r, now, open, onToggle }: { r: SentApproach; now: Date; open: boolean; onToggle: () => void }) {
  const elapsedDays = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / DAY);
  const daysBack = Math.max(1, APPROACH_EXPIRE_DAYS - elapsedDays);
  const resendAt = new Date(new Date(r.createdAt).getTime() + APPROACH_RESEND_DAYS * DAY).toISOString();
  const meta: string[] = [];
  if (r.status === "accepted" && r.acceptedAt) meta.push(`${fmtMd(r.acceptedAt)}に承認`);
  else meta.push(`${fmtMd(r.createdAt)}に送信`);
  if (r.senderName) meta.push(`送った人：${r.senderName}`);
  if (r.jobTitle) meta.push(`求人：${r.jobTitle}`);
  if (r.status === "pending") meta.push(`あと${daysBack}日で枠に戻ります`);
  if (r.status === "expired") meta.push(`枠に戻りました ・ この方へは${fmtYmd(resendAt)}から再び送れます`);
  const firstLine = r.reason.split("\n")[0];
  const name = r.candidate.name || "名前未設定";

  return (
    <div className="apx-row" data-approach-status={r.status} data-unseen={r.unseen ? "true" : "false"} style={r.unseen ? { background: "var(--royal-50)" } : undefined}>
      <InitialAvatar name={name} size={44} bgStyle={r.status === "expired" ? "var(--line-soft)" : "var(--royal-100)"} textColor={r.status === "expired" ? "var(--ink-mute)" : "var(--royal)"} />
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href={`/u/${r.candidate.id}`} target="_blank" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{name}</Link>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, ...BADGE[r.status] }}>{COMPANY_APPROACH_STATUS_LABELS[r.status]}</span>
          {r.unseen && <span data-state="unseen-accepted" style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--royal)", color: "#fff" }}>承認されました</span>}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.7 }}>{meta.join(" ・ ")}</div>
        {r.status !== "accepted" && !open && (
          <div title={r.reason} style={{ fontSize: 13, color: "var(--ink)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>理由：{firstLine}</div>
        )}
        {open && (
          <div data-state="approach-detail" style={{ marginTop: 10, padding: "12px 14px", background: "var(--bg-soft, #f8f9fb)", border: "1px solid var(--line-soft)", borderRadius: 8, fontSize: 13, lineHeight: 1.8, color: "var(--ink)" }}>
            <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12 }}>声をかけた理由</div>
            <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{r.reason}</p>
            {r.body && (
              <>
                <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12, marginTop: 10 }}>本文</div>
                <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap" }}>{r.body}</p>
              </>
            )}
          </div>
        )}
      </div>
      {r.status === "accepted" ? (
        r.conversationId && (
          <Link href={`/biz/conversations/${r.conversationId}`} className="btn-fixed-size" style={r.unseen ? BTN_PRIMARY : BTN_SECONDARY}>メッセージを開く</Link>
        )
      ) : (
        <button type="button" className="btn-fixed-size" onClick={onToggle} aria-expanded={open} style={BTN_SECONDARY}>
          {open ? "閉じる" : "送った内容を見る"}
        </button>
      )}
    </div>
  );
}

const BTN_BASE: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" };
const BTN_PRIMARY: React.CSSProperties = { ...BTN_BASE, background: "var(--royal)", color: "#fff", border: "1px solid var(--royal)" };
const BTN_SECONDARY: React.CSSProperties = { ...BTN_BASE, background: "#fff", color: "var(--royal)", border: "1px solid var(--line)" };
