"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MESSAGES_SPLIT_MIN_WIDTH } from "@/lib/constants/splitView";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { messagePreviewLine } from "@/lib/conversations/previewLine";
import {
  APPROACH_HEADLINE, approachQuotaTexts,
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
 * ⚠️ 上は1行だけ:「返事待ち 〇件（10件まで）」＋「ルール」。数字のカードを出さない（「今月あと〇通」は 2026-10-17 に月の上限ごと外した）。
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
/** 一覧の時刻。今日なら「22:13」、今年なら「10/9」、それより前は「2025/10/9」（2026-10-11 / 左右2画面） */
function fmtListDate(iso: string, now: Date): string {
  const tz = { timeZone: "Asia/Tokyo" } as const;
  const d = new Date(iso);
  const part = (x: Date) => new Intl.DateTimeFormat("ja-JP", { ...tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(x);
  const v = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
  const pd = part(d), pn = part(now);
  if (v(pd, "year") === v(pn, "year") && v(pd, "month") === v(pn, "month") && v(pd, "day") === v(pn, "day")) {
    return new Intl.DateTimeFormat("ja-JP", { ...tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
  return `${v(pd, "year") === v(pn, "year") ? "" : `${v(pd, "year")}/`}${v(pd, "month")}/${v(pd, "day")}`;
}

/** 一覧の1行（会話か、送って返信のないもの） */
type Item =
  | { kind: "conv"; key: string; id: string; at: string; conv: ConversationRow }
  | { kind: "sent"; key: string; id: string; at: string; sent: SentApproach };

/**
 * ★左右2画面（2026-10-11 / 柴さんの指示。LinkedIn のメッセージと同じ）。
 *   1280px 以上 … 左に一覧（360px）・右に選んだやり取り（`pane`。サーバーで描いたもの）
 *   1279px 以下 … 選んでいなければ一覧だけ・選んでいれば右側だけを全幅（右側の「← 一覧へ」で戻る）
 * ⚠️ 選択は URL の ?show= に残す（再読込・共有で同じものが開く）。開いたら既読にするのはサーバー（`loadCompanyThread`）
 * ⚠️ 広い画面で何も選んでいなければ、一覧の一番上を選ぶ（URL を置き換える）。狭い画面では選ばない（一覧を出す）
 */
export function MessagesView({ allowed, conversations, sent, quota, initialTab = "all", sentId, pane = null, selectedKey = null, emptyPane, noSelectionPane, autoSelect = true, linkBase = "/biz/messages", now: nowIso, approachableCount, hasPublishedJob, sentThisMonthFrom = null }: {
  allowed: boolean;
  conversations: ConversationRow[];
  /** 企業から送った1通目。null = 取れなかった */
  sent: SentApproach[] | null;
  quota: ApproachQuota | null;
  initialTab?: MessagesTab;
  sentId?: string;
  /** ★右側（選んだやり取り）。null = 選んでいない */
  pane?: React.ReactNode;
  /** 選んでいる行（`c:<会話>` か `s:<送ったメッセージ>`） */
  selectedKey?: string | null;
  emptyPane?: React.ReactNode;
  noSelectionPane?: React.ReactNode;
  /** 広い画面で一番上を自動で選ぶか（/dev/preview では false。URL を書き換えないため） */
  autoSelect?: boolean;
  /** 行のリンク先（/dev/preview では自分のページ） */
  linkBase?: string;
  /** 日数の計算の基準（サーバーで決めて渡す。描画のたびに変わらないように） */
  now: string;
  /** ★いまメッセージを送れる候補者の数（1通も送っていないときだけ）。null = 取れなかった */
  approachableCount?: number | null;
  /** ★公開中の求人があるか（送れる人0人のときの「求人を公開する」を出すか） */
  hasPublishedJob?: boolean | null;
  /**
   * ★「今月送った相手」の絞り込み（2026-10-12 / ホームの「送った数」から開く。URL は ?filter=sent_this_month）。
   *   今月の始まり（日本時間・送った数の数え方と同じ `startOfMonthJst`）。null なら絞り込んでいない
   */
  sentThisMonthFrom?: string | null;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const router = useRouter();
  const [tab, setTab] = useState<MessagesTab>(initialTab);

  /* ★会話と「送って返信のないもの」を1本にして新しい順に。⚠️ 返信があったもの（accepted）は会話の側に出るので足さない */
  const items: Item[] = useMemo(() => [
    ...conversations.map((c): Item => ({ kind: "conv", key: `c:${c.id}`, id: c.id, at: c.last_message_at ?? c.created_at, conv: c })),
    ...(sent ?? []).filter((r) => r.status !== "accepted").map((r): Item => ({ kind: "sent", key: `s:${r.id}`, id: r.id, at: r.createdAt, sent: r })),
  ].sort((x, y) => y.at.localeCompare(x.at)), [conversations, sent]);
  const isUnread = (it: Item) => it.kind === "conv" && (it.conv.isUnread || it.conv.isNewReply) && `c:${it.id}` !== selectedKey;
  const isPending = (it: Item) => it.kind === "sent" && it.sent.status === "pending";
  /* ★今月送った相手（送った1通目が今月）。返信があったものは会話の行、まだのものは送った行 */
  const sentThisMonthKeys = useMemo(() => {
    if (!sentThisMonthFrom) return null;
    const keys = new Set<string>();
    for (const r of sent ?? []) {
      if (new Date(r.createdAt).getTime() < new Date(sentThisMonthFrom).getTime()) continue;
      keys.add(r.status === "accepted" && r.conversationId ? `c:${r.conversationId}` : `s:${r.id}`);
    }
    return keys;
  }, [sent, sentThisMonthFrom]);
  const inSentFilter = (it: Item) => !sentThisMonthKeys || sentThisMonthKeys.has(it.key);
  const shown = items.filter((it) => inSentFilter(it) && (tab === "all" || (tab === "unread" ? isUnread(it) : isPending(it))));
  const counts: Record<MessagesTab, number> = { all: items.length, unread: items.filter(isUnread).length, pending: items.filter(isPending).length };
  const filterQ = sentThisMonthKeys ? "filter=sent_this_month&" : "";
  const hrefOf = (id: string, t: MessagesTab = tab) => `${linkBase}?${filterQ}${t === "all" ? "" : `tab=${t}&`}show=${id}`;

  /* ★広い画面で何も選んでいなければ、一覧の一番上を選ぶ。⚠️ 狭い画面では選ばない（一覧だけを出すため） */
  const firstId = shown[0]?.id ?? null;
  useEffect(() => {
    if (!autoSelect || selectedKey || !firstId) return;
    if (!window.matchMedia(`(min-width: ${MESSAGES_SPLIT_MIN_WIDTH}px)`).matches) return;
    router.replace(hrefOf(firstId), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, firstId]);

  const neverSent = sent !== null && sent.length === 0;
  const just = sentId ? (sent ?? []).find((r) => r.id === sentId) : undefined;
  const q = quota ? approachQuotaTexts(quota) : null;
  /* ★1通も送っていない（かつ会話も無い）なら、一覧の代わりに案内を出す。⚠️ このときは上の1行も出さない */
  const showBigGuide = allowed && neverSent && conversations.length === 0;
  const changeTab = (t: MessagesTab) => {
    setTab(t);
    /* タブを変えたら、そのタブの一番上を開き直す（広い画面）。URL にタブも残す */
    if (autoSelect) {
      const qs = [sentThisMonthKeys ? "filter=sent_this_month" : null, t === "all" ? null : `tab=${t}`].filter(Boolean).join("&");
      router.replace(qs ? `${linkBase}?${qs}` : linkBase, { scroll: false });
    }
  };

  return (
    <div className="apx-root">
      <style>{`
        .apx-root { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .apx-tabs { display: flex; gap: 4px; padding: 0 8px; border-bottom: 1px solid var(--line); overflow-x: auto; flex-shrink: 0; }
        .apx-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .apx-tab[aria-selected=true] { border-bottom-color: var(--royal); color: var(--royal); font-weight: 700; }
        .apx-item { display: flex; gap: 10px; align-items: flex-start; width: 100%; padding: 12px 14px 12px 11px; border: 0; border-left: 3px solid transparent; border-top: 1px solid var(--line-soft); background: #fff; text-align: left; font: inherit; color: inherit; text-decoration: none; cursor: pointer; }
        .apx-item:hover { background: var(--bg-tint, #f6f7f9); }
        .apx-item[data-selected=true] { border-left-color: var(--royal); background: var(--royal-50); }
        .apx-faded { opacity: 0.55; }
        .apx-empty { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .apx-empty-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .msg-split { display: grid; grid-template-columns: minmax(0, 1fr); background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; min-width: 0; }
        .msg-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .msg-list-scroll { overflow-y: auto; min-height: 0; }
        .msg-pane { display: none; min-width: 0; min-height: 0; }
        .msg-split[data-selected=true] .msg-list { display: none; }
        .msg-split[data-selected=true] .msg-pane { display: flex; }
        .msg-pane-inner { display: flex; flex-direction: column; width: 100%; min-width: 0; min-height: 420px; }
        .msg-pane-head { flex-shrink: 0; padding: 14px 20px 12px; border-bottom: 1px solid var(--line); }
        .msg-pane-back { display: inline-block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--royal); text-decoration: none; }
        .msg-pane-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; background: var(--bg-tint, #f6f7f9); }
        .msg-pane-foot { flex-shrink: 0; border-top: 1px solid var(--line); background: #fff; }
        @media (min-width: 1280px) {
          .msg-split { grid-template-columns: 360px minmax(0, 1fr); height: calc(100vh - var(--biz-header-h) - 190px); min-height: 520px; }
          .msg-list { border-right: 1px solid var(--line); }
          .msg-split[data-selected=true] .msg-list { display: flex; }
          .msg-pane { display: flex; }
          .msg-pane-inner { min-height: 0; }
          .msg-pane-back { display: none; }
        }
        @media (max-width: 767px) {
          .apx-empty { grid-template-columns: minmax(0, 1fr); }
          .msg-pane-head, .msg-pane-body { padding-left: 14px; padding-right: 14px; }
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
            <EmptyGuide approachableCount={approachableCount} hasPublishedJob={hasPublishedJob} />
            <SampleLetter />
          </div>
          <Link href="/biz/help/messages" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>候補者にメッセージを送るときのルール</Link>
        </>
      ) : (
        <>
          {/* ★上は1行だけ（2026-10-11 / 柴さんの指示）。⚠️ 数字のカードを出さない。
                 ⚠️ 一覧の下にあった長い注意書き（返事がない場合〜）は削除した。同じ内容は「ルール」（/biz/help/messages）にある */}
          {allowed && (
            <div data-state="messages-quota" style={{ display: "flex", alignItems: "baseline", gap: "4px 12px", flexWrap: "wrap", fontSize: 13, color: "var(--ink-soft)" }}>
              <span>{q ? q.openLine : "送れる数を確認できませんでした"}</span>
              <Link href="/biz/help/messages" data-state="messages-help-link" style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>ルール</Link>
            </div>
          )}
          <section className="msg-split" data-selected={pane ? "true" : "false"} data-state="messages-split">
            <div className="msg-list">
              <div role="tablist" aria-label="メッセージの絞り込み" className="apx-tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} data-state={tab === t.key ? "active" : "idle"} className="apx-tab btn-fixed-size" onClick={() => changeTab(t.key)}>
                    {t.label}
                    {t.key !== "all" && counts[t.key] > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{counts[t.key]}</span>}
                  </button>
                ))}
              </div>
              {sentThisMonthKeys && (
                <div data-state="messages-sent-filter" style={{ padding: "8px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 6px 3px 10px", borderRadius: 999, background: "var(--royal-50)", border: "1px solid var(--royal-100)", fontSize: 12.5, fontWeight: 600, color: "var(--royal)" }}>
                    今月送った相手（{sentThisMonthKeys.size}件）
                    <Link href={tab === "all" ? linkBase : `${linkBase}?tab=${tab}`} aria-label="今月送った相手の絞り込みを外す" data-state="messages-sent-filter-clear"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", color: "var(--royal)", textDecoration: "none", fontSize: 13 }}>✕</Link>
                  </span>
                </div>
              )}
              {sent === null && allowed && (
                <p role="alert" style={{ margin: 0, padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "var(--error)" }}>送ったメッセージの一覧を取得できませんでした。時間をおいて再読み込みしてください。</p>
              )}
              <div className="msg-list-scroll">
                {shown.length === 0 ? (
                  <p data-state="messages-empty" style={{ margin: 0, padding: 20, fontSize: 13, color: "var(--ink-mute)" }}>
                    {tab === "unread" ? "未読のメッセージはありません。" : tab === "pending" ? "返事を待っているメッセージはありません。" : "メッセージはまだありません。"}
                  </p>
                ) : shown.map((it) => it.kind === "conv"
                  ? <ConvItem key={it.key} c={it.conv} now={now} href={hrefOf(it.id)} selected={selectedKey === it.key} unread={isUnread(it)} />
                  : <SentItem key={it.key} r={it.sent} now={now} href={hrefOf(it.id)} selected={selectedKey === it.key} />)}
              </div>
            </div>
            <div className="msg-pane" aria-live="polite">
              {pane ?? (shown.length === 0 ? emptyPane : noSelectionPane) ?? null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return <InitialAvatar name={name} size={40} />;
}

/** 1行の共通の形（1行目＝名前と時刻・2行目＝本文の冒頭・3行目＝灰色の状態） */
function Line({ name, date, status, preview, unread, faded = false }: { name: string; date: string; status: string | null; preview: string | null; unread: boolean; faded?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span className={faded ? "apx-faded" : undefined} data-state={unread ? "item-name-unread" : "item-name"} style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: unread ? 800 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ flexShrink: 0, fontSize: 12, color: unread ? "var(--royal)" : "var(--ink-mute)", fontWeight: unread ? 700 : 400 }}>{date}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: unread ? "var(--ink)" : "var(--ink-soft)", fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview ?? ""}</span>
        {unread && <span aria-label="未読" data-state="unread-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />}
      </div>
      {status && <div data-state="item-status" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{status}</div>}
    </div>
  );
}

/** 会話（返信があったもの・応募・面談・OPINIO のおすすめから開いたもの） */
function ConvItem({ c, now, href, selected, unread }: { c: ConversationRow; now: Date; href: string; selected: boolean; unread: boolean }) {
  const name = c.candidate?.name || "名前未設定";
  /* ⚠️ 参加していない会話は本文を読めない（RLS）。冒頭の代わりに灰色の一言（バッジにしない） */
  /* ★自分が送ったものは「あなた：」、同じ会社の別の担当者なら「氏名：」。相手からのものは付けない */
  const line = c.lastMessage ? messagePreviewLine(c.lastMessage) : null;
  const prefix = c.lastSender === "me" ? "あなた：" : c.lastSender && c.lastSender !== "candidate" ? `${c.lastSender.colleague}：` : "";
  const preview = line ? `${prefix}${line}` : !c.isParticipant ? "開くと会話に参加できます" : null;
  return (
    <Link href={href} scroll={false} className="apx-item" data-item="conv" data-selected={selected ? "true" : "false"} data-unread={unread ? "true" : "false"} aria-current={selected ? "true" : undefined}>
      <Avatar name={name} url={c.candidate?.avatar_url ?? null} />
      {/* ★「話を聞いてみたい」と答えてできた会話は、3行目に灰色で（バッジにしない） */}
      <Line name={name} date={fmtListDate(c.last_message_at ?? c.created_at, now)} status={c.fromInterest ? "貴社に興味があります" : null} preview={preview} unread={unread} />
    </Link>
  );
}

/** 送って返信がないもの（30日以内・30日を過ぎたもの）。押すと右側に送った内容 */
function SentItem({ r, now, href, selected }: { r: SentApproach; now: Date; href: string; selected: boolean }) {
  const name = r.candidate.name || "名前未設定";
  /* ★返信がなかった行は、顔写真と名前を少し薄く */
  const faded = r.status !== "pending";
  return (
    <Link href={href} scroll={false} id={`approach-${r.id}`} className="apx-item" data-item="sent" data-approach-status={r.status} data-selected={selected ? "true" : "false"} aria-current={selected ? "true" : undefined}>
      <span className={faded ? "apx-faded" : undefined} style={{ flexShrink: 0, display: "inline-flex" }}><Avatar name={name} url={r.candidate.avatarUrl} /></span>
      <Line name={name} date={fmtListDate(r.createdAt, now)} status={r.status === "pending" ? "返信を待っています" : "返信はありませんでした"}
        preview={`あなた：${r.reason.split("\n")[0]}`} unread={false} faded={faded} />
    </Link>
  );
}

/**
 * ★1通も送っていないときの案内（2026-10-11）。順に: まだ送っていない → いま送れる人数 → 書き方のコツ → ボタン。
 * ⚠️ 人数は候補者検索の送るボタンと同じ判定（`can_send_company_approach()`）。取れなかったら「取得できませんでした」（0人と出さない）。
 * ⚠️ 送れる人が0人のときは、しくみを見る（主）・求人を公開する（公開中の求人が無いときだけ）・候補者を探す（文字リンク）。
 */
function EmptyGuide({ approachableCount, hasPublishedJob }: { approachableCount: number | null | undefined; hasPublishedJob?: boolean | null }) {
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
            {/* ⚠️★「候補者は○名いますが、受け取る設定の方は…」は 2026-10-11 に外した（全員が最初から受け取る形にしたため）。戻さないこと */}
            いま、メッセージを送れる候補者はいません。経歴の合う方には、OPINIO が貴社をおすすめすることがあります。「話を聞いてみたい」と答えた方は、このメッセージに届きます。
          </p>
          <div className="apx-empty-actions">
            <Link href="/biz/help/interested" className="btn-fixed-size" style={BTN_PRIMARY}>しくみを見る</Link>
            {hasPublishedJob === false && <Link href="/biz/jobs/new" className="btn-fixed-size" style={BTN_WRAP_SECONDARY}>求人を公開する</Link>}
            <Link href="/biz/candidates" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none", padding: "8px 4px" }}>候補者を探す</Link>
          </div>
        </>
      ) : (
        <div className="apx-empty-actions">
          <Link href="/biz/candidates" className="btn-fixed-size" style={BTN_PRIMARY}>候補者を探す</Link>
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
