"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { messagePreviewLine } from "@/lib/conversations/previewLine";
import {
  APPROACH_HEADLINE, APPROACH_SILENCE_NOTE, approachQuotaTexts, approachStatusLine,
} from "@/lib/constants/companyApproaches";
import { ApproachStepsLarge, ApproachTipsList } from "@/components/approaches/ApproachGuide";
import { ApproachLetter } from "@/components/approaches/ApproachLetter";
import { RequestReplyBox } from "@/components/approaches/RequestReplyBox";
import type { ConversationRow } from "./page";

/**
 * /biz/messages の本文（2026-10-11 / 柴さんの指示。「メッセージリクエスト」を「メッセージ」にまとめた）。
 *
 * ★一覧は1本（LinkedIn の受信箱と同じ考え方）。1行 ＝ 顔写真・名前・最後のメッセージの冒頭1行・日付・未読の点。
 *   状態は名前の下に灰色の小さな文字で出す:
 *     送って返信がない   … 「返信を待っています・あと〇日」
 *     30日を過ぎた       … 「返信はありませんでした・〇年〇月〇日から再び送れます」
 *     返信があった会話   … 何も付けない（普通の会話）
 * ⚠️★状態のバッジ（色付きのラベル）を使わないこと（2026-10-11 / 柴さんの指示）。
 * ⚠️★タブは「すべて」「未読」「返事待ち」の3つ。「30日を過ぎました」のタブは作らない（すべての中に並ぶ）。
 * ⚠️ 上は1行だけ:「今月あと〇通送れます・返事待ち 〇件（10件まで）」＋「ルール」。数字のカードを出さない。
 * ⚠️ 1通も送っていない（かつ会話も無い）ときは、上の1行も出さずに案内（3つの手順・ボタン・見本）を出す。
 * ⚠️★画面に「リクエスト」「受け入れ」「確認する」と書かない。
 * ⚠️★見送られたかどうかは出さない（`SentApproach` に declined_at は無い）。見送りも30日までは「返信を待っています」。
 * ⚠️ DB を読まない。/dev/preview/approaches から固定データで描くための部品。
 */
export type MessagesTab = "all" | "unread" | "pending";
const TABS: { key: MessagesTab; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unread", label: "未読" },
  { key: "pending", label: "返事待ち" },
];
/** 一覧の日付。今日なら時刻、今年なら「10月3日」、それより前は「2025年10月3日」 */
function fmtListDate(iso: string, now: Date): string {
  const tz = { timeZone: "Asia/Tokyo" } as const;
  const d = new Date(iso);
  const ymd = (x: Date) => new Intl.DateTimeFormat("ja-JP", { ...tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  if (ymd(d) === ymd(now)) return new Intl.DateTimeFormat("ja-JP", { ...tz, hour: "2-digit", minute: "2-digit" }).format(d);
  const y = (x: Date) => new Intl.DateTimeFormat("ja-JP", { ...tz, year: "numeric" }).format(x);
  return new Intl.DateTimeFormat("ja-JP", { ...tz, ...(y(d) === y(now) ? {} : { year: "numeric" }), month: "long", day: "numeric" }).format(d);
}

/** 一覧の1行（会話か、送って返信のないもの） */
type Item =
  | { kind: "conv"; key: string; at: string; conv: ConversationRow }
  | { kind: "sent"; key: string; at: string; sent: SentApproach };

export function MessagesView({ allowed, conversations, sent, quota, initialTab = "all", sentId, showId, now: nowIso, approachableCount, candidateCount = null, hasPublishedJob }: {
  allowed: boolean;
  conversations: ConversationRow[];
  /** 企業から送った1通目。null = 取れなかった */
  sent: SentApproach[] | null;
  quota: ApproachQuota | null;
  initialTab?: MessagesTab;
  sentId?: string;
  /** ★「送った内容を見る」で来たときに開いておくメッセージ（?show=） */
  showId?: string;
  /** 日数の計算の基準（サーバーで決めて渡す。描画のたびに変わらないように） */
  now: string;
  /** ★いまメッセージを送れる候補者の数（1通も送っていないときだけ）。null = 取れなかった */
  approachableCount?: number | null;
  /** ★候補者検索に出る人数（1通も送っていないときだけ）。null = 取れなかった */
  candidateCount?: number | null;
  /** ★公開中の求人があるか（送れる人0人のときの「求人を公開する」を出すか） */
  hasPublishedJob?: boolean | null;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  /* ★?show= で来たら、その送ったメッセージを開いておく（返事待ちなら返事待ちのタブで） */
  const showRow = showId ? (sent ?? []).find((r) => r.id === showId) : undefined;
  const [tab, setTab] = useState<MessagesTab>(showRow ? (showRow.status === "pending" ? "pending" : "all") : initialTab);
  const [open, setOpen] = useState<string | null>(showId ? `s:${showId}` : null);
  useEffect(() => {
    if (!showId) return;
    /* ⚠️ rAF は描画されていないと動かないので setTimeout（ui-debugging ⑪） */
    const t = setTimeout(() => document.getElementById(`approach-${showId}`)?.scrollIntoView({ block: "center" }), 60);
    return () => clearTimeout(t);
  }, [showId]);

  /* ★会話と「送って返信のないもの」を1本にして新しい順に。⚠️ 返信があったもの（accepted）は会話の側に出るので足さない */
  const items: Item[] = useMemo(() => [
    ...conversations.map((c): Item => ({ kind: "conv", key: `c:${c.id}`, at: c.last_message_at ?? c.created_at, conv: c })),
    ...(sent ?? []).filter((r) => r.status !== "accepted").map((r): Item => ({ kind: "sent", key: `s:${r.id}`, at: r.createdAt, sent: r })),
  ].sort((x, y) => y.at.localeCompare(x.at)), [conversations, sent]);
  const isUnread = (it: Item) => it.kind === "conv" && (it.conv.isUnread || it.conv.isNewReply);
  const isPending = (it: Item) => it.kind === "sent" && it.sent.status === "pending";
  const shown = items.filter((it) => tab === "all" || (tab === "unread" ? isUnread(it) : isPending(it)));
  const counts: Record<MessagesTab, number> = { all: items.length, unread: items.filter(isUnread).length, pending: items.filter(isPending).length };

  const neverSent = sent !== null && sent.length === 0;
  const just = sentId ? (sent ?? []).find((r) => r.id === sentId) : undefined;
  const q = quota ? approachQuotaTexts(quota, now) : null;
  /* ★1通も送っていない（かつ会話も無い）なら、一覧の代わりに案内を出す。⚠️ このときは上の1行も出さない */
  const showBigGuide = allowed && neverSent && conversations.length === 0;

  return (
    <div className="apx-root">
      <style>{`
        .apx-root { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .apx-tabs { display: flex; gap: 4px; padding: 0 12px; border-bottom: 1px solid var(--line); overflow-x: auto; }
        .apx-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .apx-tab[aria-selected=true] { border-bottom-color: var(--royal); color: var(--royal); font-weight: 700; }
        .apx-item { display: flex; gap: 12px; align-items: flex-start; width: 100%; padding: 14px 18px; border: 0; border-top: 1px solid var(--line-soft); background: #fff; text-align: left; font: inherit; color: inherit; text-decoration: none; cursor: pointer; }
        .apx-item:hover { background: var(--bg-tint, #f6f7f9); }
        .apx-item[data-unread=true] { background: var(--royal-50); }
        .apx-faded { opacity: 0.55; }
        .apx-list { margin-top: -1px; }
        .apx-empty { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .apx-empty-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 767px) {
          .apx-item { padding: 12px 14px; }
          .apx-tabs { padding: 0 4px; }
          .apx-tab { padding: 0 10px; }
          .apx-empty { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      {just && (
        <div role="status" data-state="approach-sent-banner" style={{ background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700 }}>
          {just.candidate.name}さんにメッセージを送りました。返信があるとメールでお知らせします。
        </div>
      )}

      {/* ★右上に「候補者を探して送る」（2026-10-11 / モックに合わせた）。⚠️ 1通も送っていないときの大きな案内には出さない（案内の中に同じ行き先がある） */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>メッセージ</h1>
        {!showBigGuide && allowed && (
          <Link href="/biz/candidates" data-state="messages-find" className="btn-fixed-size" style={BTN_SECONDARY}>候補者を探して送る</Link>
        )}
      </div>

      {showBigGuide ? (
        <>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: 0 }}>{APPROACH_HEADLINE}</p>
          <ApproachStepsLarge />
          <div className="apx-empty">
            <EmptyGuide approachableCount={approachableCount} candidateCount={candidateCount} hasPublishedJob={hasPublishedJob} />
            <SampleLetter />
          </div>
          <Link href="/biz/help/messages" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>候補者にメッセージを送るときのルール</Link>
        </>
      ) : (
        <>
          {/* ★上は1行だけ（2026-10-11 / 柴さんの指示）。⚠️ 数字のカードを出さない */}
          {allowed && (
            <div data-state="messages-quota" style={{ display: "flex", alignItems: "baseline", gap: "4px 12px", flexWrap: "wrap", fontSize: 13, color: "var(--ink-soft)" }}>
              <span>{quota && q ? `今月あと${q.remaining}通送れます・返事待ち ${quota.openCount}件（${quota.openLimit}件まで）` : "送れる数を確認できませんでした"}</span>
              <Link href="/biz/help/messages" data-state="messages-help-link" style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>ルール</Link>
            </div>
          )}
          <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
            <div role="tablist" aria-label="メッセージの絞り込み" className="apx-tabs">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} data-state={tab === t.key ? "active" : "idle"} className="apx-tab btn-fixed-size" onClick={() => setTab(t.key)}>
                  {t.label}
                  {t.key !== "all" && counts[t.key] > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{counts[t.key]}</span>}
                </button>
              ))}
            </div>
            {sent === null && allowed && (
              <p role="alert" style={{ margin: 0, padding: "12px 18px", fontSize: 13, fontWeight: 600, color: "var(--error)" }}>送ったメッセージの一覧を取得できませんでした。時間をおいて再読み込みしてください。</p>
            )}
            {shown.length === 0 ? (
              <p data-state="messages-empty" style={{ margin: 0, padding: 24, fontSize: 13, color: "var(--ink-mute)" }}>
                {tab === "unread" ? "未読のメッセージはありません。" : tab === "pending" ? "返事を待っているメッセージはありません。" : "メッセージはまだありません。"}
              </p>
            ) : (
              <div className="apx-list">
                {shown.map((it) => it.kind === "conv"
                  ? <ConvItem key={it.key} c={it.conv} now={now} />
                  : <SentItem key={it.key} r={it.sent} now={now} open={open === it.key} onToggle={() => setOpen(open === it.key ? null : it.key)} />)}
              </div>
            )}
          </section>
          {allowed && (
            <p data-state="approach-footnote" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-mute)" }}>{APPROACH_SILENCE_NOTE}返信が来る前に、同じ方へ続けて送ることはできません。</p>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return <InitialAvatar name={name} size={44} />;
}

/** 1行の共通の形（名前・日付・状態の灰色の行・冒頭1行・未読の点） */
function Line({ name, date, status, preview, unread, faded = false }: { name: string; date: string; status: string | null; preview: string | null; unread: boolean; faded?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span className={faded ? "apx-faded" : undefined} style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: unread ? 700 : 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ flexShrink: 0, fontSize: 12, color: unread ? "var(--royal)" : "var(--ink-mute)", fontWeight: unread ? 700 : 400 }}>{date}</span>
      </div>
      {status && <div data-state="item-status" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{status}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: unread ? "var(--ink)" : "var(--ink-soft)", fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview ?? ""}</span>
        {unread && <span aria-label="未読" data-state="unread-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
      </div>
    </div>
  );
}

/** 会話（返信があったもの・応募・面談・提案から開いたもの） */
function ConvItem({ c, now }: { c: ConversationRow; now: Date }) {
  const name = c.candidate?.name || "名前未設定";
  const unread = c.isUnread || c.isNewReply;
  /* ⚠️ 参加していない会話は本文を読めない（RLS）。冒頭の代わりに灰色の一言（バッジにしない） */
  /* ★自分が送ったものは「あなた：」、同じ会社の別の担当者なら「氏名：」（2026-10-11 / モックに合わせた）。相手からのものは付けない */
  const line = c.lastMessage ? messagePreviewLine(c.lastMessage) : null;
  const prefix = c.lastSender === "me" ? "あなた：" : c.lastSender && c.lastSender !== "candidate" ? `${c.lastSender.colleague}：` : "";
  const preview = line ? `${prefix}${line}` : !c.isParticipant ? "開くと会話に参加できます" : null;
  return (
    <Link href={`/biz/messages/${c.id}`} className="apx-item" data-item="conv" data-unread={unread ? "true" : "false"}>
      <Avatar name={name} url={c.candidate?.avatar_url ?? null} />
      <Line name={name} date={fmtListDate(c.last_message_at ?? c.created_at, now)} status={null} preview={preview} unread={unread} />
    </Link>
  );
}

/** 送って返信がないもの（30日以内・30日を過ぎたもの）。押すと送った内容がその場で開く */
function SentItem({ r, now, open, onToggle }: { r: SentApproach; now: Date; open: boolean; onToggle: () => void }) {
  const name = r.candidate.name || "名前未設定";
  /* ⚠️ 文言は候補者検索のカード・候補者の詳細と同じ関数（`approachStatusLine`） */
  const status = approachStatusLine(r.status, r.createdAt, now);
  /* ★返信がなかった行は、顔写真と名前を少し薄く（2026-10-11 / モックに合わせた） */
  const faded = r.status !== "pending";
  return (
    <div id={`approach-${r.id}`} data-item="sent" data-approach-status={r.status}>
      <button type="button" className="apx-item" onClick={onToggle} aria-expanded={open}>
        <span className={faded ? "apx-faded" : undefined} style={{ flexShrink: 0, display: "inline-flex" }}><Avatar name={name} url={r.candidate.avatarUrl} /></span>
        <Line name={name} date={fmtListDate(r.createdAt, now)} status={status} preview={`あなた：${r.reason.split("\n")[0]}`} unread={false} faded={faded} />
      </button>
      {open && (
        <div data-state="approach-detail" style={{ margin: "0 18px 14px 74px", padding: "12px 14px", background: "var(--bg-tint, #f6f7f9)", borderRadius: 8, fontSize: 13, lineHeight: 1.8, color: "var(--ink)", minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            {[r.senderName ? `送った人：${r.senderName}` : null, r.jobTitle ? `求人：${r.jobTitle}` : null].filter(Boolean).join("・")}
          </div>
          <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12, marginTop: 6 }}>送った理由</div>
          <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.reason}</p>
          {r.body && (
            <>
              <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12, marginTop: 10 }}>本文</div>
              <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.body}</p>
            </>
          )}
          <Link href={`/u/${r.candidate.username ?? r.candidate.id}`} style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>プロフィールを見る →</Link>
        </div>
      )}
    </div>
  );
}

/**
 * ★1通も送っていないときの案内（2026-10-11）。順に: まだ送っていない → いま送れる人数 → 書き方のコツ → ボタン。
 * ⚠️ 人数は候補者検索の「メッセージを受け取る方のみ」と同じ判定。取れなかったら「取得できませんでした」（0人と出さない）。
 * ⚠️ 送れる人が0人のときは、提案（主）・求人を公開する（公開中の求人が無いときだけ）・候補者を探す（文字リンク）。
 */
function EmptyGuide({ approachableCount, candidateCount = null, hasPublishedJob }: { approachableCount: number | null | undefined; candidateCount?: number | null; hasPublishedJob?: boolean | null }) {
  const unknown = approachableCount === null || approachableCount === undefined;
  const zero = approachableCount === 0;
  return (
    <section data-state="approach-empty" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>まだメッセージを送っていません。</p>
      {unknown ? (
        <p data-state="approachable-unknown" style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>いまメッセージを送れる候補者：<span style={{ color: "var(--ink-mute)" }}>取得できませんでした</span></p>
      ) : (
        <p data-state={zero ? "approachable-zero" : "approachable-count"} style={{ margin: 0, fontSize: 14, color: "var(--ink)" }}>
          いまメッセージを送れる候補者：<strong style={{ fontSize: 18 }}>{approachableCount}</strong>人
        </p>
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>返信をもらいやすい理由の書き方</div>
        <ApproachTipsList />
      </div>
      {zero ? (
        <>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
            {/* ★「候補者は○名いるのに送れるのは0人」を分かるようにする（2026-10-11 / 柴さんの文言）。人数が取れなかったら前半を出さない */}
            {candidateCount !== null && candidateCount > 0 ? `候補者は${candidateCount}名いますが、` : ""}メッセージを受け取る設定の方はまだいません。条件に合う方には、OPINIO から提案としてお届けすることがあります。
          </p>
          <div className="apx-empty-actions">
            <Link href="/biz/proposals" className="btn-fixed-size" style={BTN_PRIMARY}>提案を見る</Link>
            {hasPublishedJob === false && <Link href="/biz/jobs/new" className="btn-fixed-size" style={BTN_WRAP_SECONDARY}>求人を公開する</Link>}
            <Link href="/biz/candidates" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none", padding: "8px 4px" }}>候補者を探す</Link>
          </div>
        </>
      ) : (
        <div className="apx-empty-actions">
          <Link href="/biz/candidates" className="btn-fixed-size" style={BTN_PRIMARY}>候補者を探す</Link>
          <Link href="/biz/candidates?approach=1" className="btn-fixed-size" style={BTN_WRAP_SECONDARY}>メッセージを受け取る方だけを見る</Link>
        </div>
      )}
    </section>
  );
}

/**
 * ★見本：相手にはこう届きます（2026-10-11）。求職者の画面と**同じ部品**（ApproachLetter ＋ RequestReplyBox。返信欄とひな形のボタンつき）。
 * ⚠️ 中身は架空。ボタンは押せない見た目で、押しても何も起きない（sample）。
 */
function SampleLetter() {
  return (
    <section data-state="approach-sample" aria-label="見本：相手にはこう届きます" style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>見本：相手にはこう届きます</div>
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
        <ApproachLetter companyName="株式会社サンプル" companyHref={null} logoUrl={null} logoLetter="サ" logoGradient={null}
          senderName="採用担当 山田" dateText="今日"
          reason="〇〇での新規開拓の経験を拝見し、当社の営業チームの立ち上げについて、ぜひお話を伺いたいと考えました。"
          body={null} job={null} />
        <RequestReplyBox sample declineNote="見送っても企業には伝わりません。" />
      </div>
    </section>
  );
}

const BTN_BASE: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" };
const BTN_PRIMARY: React.CSSProperties = { ...BTN_BASE, background: "var(--royal)", color: "#fff", border: "1px solid var(--royal)" };
const BTN_SECONDARY: React.CSSProperties = { ...BTN_BASE, background: "#fff", color: "var(--royal)", border: "1px solid var(--line)" };
/* ⚠️ 0件の案内の中のボタンは、狭い幅で文字を折り返す（nowrap のままだとカードからはみ出す。2026-10-11 に 375px で実測） */
const BTN_WRAP_SECONDARY: React.CSSProperties = { ...BTN_SECONDARY, whiteSpace: "normal", maxWidth: "100%", textAlign: "center" };
