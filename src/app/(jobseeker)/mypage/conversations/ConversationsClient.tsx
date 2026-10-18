"use client";

import { RequestReplyBox } from "@/components/approaches/RequestReplyBox";
import { ApproachLetter } from "@/components/approaches/ApproachLetter";
import type { IncomingApproachView } from "@/components/approaches/incomingApproachView";
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils/formatRelativeTime";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { ChatBubble } from "@/components/messages/ChatBubble";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { usableLogoUrl } from "@/lib/utils/companyLogo";

import { MAX_BULK_RECIPIENTS, MAX_DM_LENGTH } from "@/lib/constants/messages";
/* ⚠️ 型だけ。`messageRequest.ts` はサーバー専用なので、値を import しないこと */
import type { IncomingRequest } from "@/lib/conversations/messageRequest";
import { formatLabel, isMessageFormat, topicLabel, MESSAGE_TOPICS, type MessageTopic } from "@/lib/constants/messageTopics";
import { FirstTopicNotice } from "@/components/messages/FirstMessage";

/** ★送り手が承認前の DM を開いたときに出す文言（段階3）。⚠️ 断られていても同じ文言 */
const NOT_ACCEPTED_TEXT = "まだ返信がありません。返信があると続きを送れます";

export type Conversation = {
  id: string;
  kind: string;
  stage: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  company_id: string | null;
  partner_user_id: string | null;
  /** ★DM の「メッセージのお願い」の段（段階3）。この一覧に出るのは自分が参加者の会話だけなので、
   *  pending ＝ 自分が送って承認待ち（断られていても pending のまま見える） */
  request_status?: string | null;
  /** ★最初の1通で選んだテーマ（DM。2026-10-17） */
  request_topic?: string | null;
  request_format?: string | null;
  ow_companies: {
    id: string;
    name: string;
    logo_url: string | null;
    logo_letter: string | null;
  } | null;
  partner: {
    id: string;
    name: string;
  } | null;
  hasUnread?: boolean;
  /** ★最後のメッセージの冒頭1行（2026-10-11） */
  lastMessage?: string | null;
};

type MessageRow = {
  id: string;
  body: string;
  sent_at: string;
  sender_participant_id: string | null;
  ow_conversation_participants: {
    ow_users: { name: string } | null;
  } | null;
};

function ConvAvatar({ conv }: { conv: Conversation }) {
  const displayName =
    conv.kind === "direct_message"
      ? conv.partner?.name ?? "ユーザー"
      : conv.ow_companies?.name ?? "対話相手";
  const company = conv.ow_companies;

  if (conv.kind === "direct_message") {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff",
      }}>{displayName[0] ?? "?"}</div>
    );
  }
  const logoSrc = usableLogoUrl(company?.logo_url);
  if (logoSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoSrc} alt={company?.name ?? ""} loading="lazy"
      style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
      background: "var(--royal-50)", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 14, fontWeight: 700, color: "var(--royal)",
    }}>
      {company?.logo_letter ?? company?.name?.[0] ?? displayName[0] ?? "?"}
    </div>
  );
}

/** 保存されているテーマが、いまの語彙にあるか（無い値は出さない） */
const isKnownTopic = (v: string | null | undefined): v is MessageTopic => !!v && MESSAGE_TOPICS.some((t) => t.value === v);

const isPendingRequest = (c: Conversation | null | undefined) =>
  !!c && c.kind === "direct_message" && c.request_status !== "accepted";

/** ★未返信の1件（2026-10-11 / 柴さんの指示。企業から・個人からの最初のメッセージを同じ見た目で並べる） */
export type UnrepliedItem =
  | { kind: "company"; key: string; at: string; approach: IncomingApproachView }
  | { kind: "person"; key: string; at: string; request: IncomingRequest };

const linkBtn: React.CSSProperties = { background: "none", border: "none", padding: "4px 0", fontSize: 12.5, color: "var(--ink-mute)", textDecoration: "underline", fontFamily: "inherit", cursor: "pointer" };

/** 一覧の1行（未返信）。⚠️ 理由・本文の冒頭だけ。全文は開いてから */
function UnrepliedRow({ item, selected, onOpen }: { item: UnrepliedItem; selected: boolean; onOpen: () => void }) {
  const name = item.kind === "company" ? item.approach.companyName : item.request.requester.name;
  const preview = item.kind === "company" ? item.approach.reason : (item.request.body ?? "");
  /* ★個人からの1通目のテーマ（2026-10-17）。それより前のものは無い */
  const topic = item.kind === "person" && item.request.topic
    ? `${topicLabel(item.request.topic)}${item.request.format ? `・${formatLabel(item.request.format)}` : ""}` : null;
  return (
    <button type="button" onClick={onOpen} data-unreplied={item.kind} data-unreplied-id={item.key} aria-expanded={selected}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", textAlign: "left", border: "none",
        borderBottom: "1px solid var(--line-soft)", width: "100%", cursor: "pointer", fontFamily: "inherit",
        background: selected ? "var(--royal-50)" : "#fff",
        borderLeft: selected ? "3px solid var(--royal)" : "3px solid transparent",
      }}>
      {item.kind === "company" ? (
        item.approach.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.approach.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: item.approach.logoGradient ?? "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: item.approach.logoGradient ? "#fff" : "var(--royal)" }}>
            {item.approach.logoLetter ?? name[0] ?? "?"}
          </div>
        )
      ) : item.request.requester.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.request.requester.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <InitialAvatar name={name} size={40} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{name}</span>
          <span style={{ fontSize: 11.5, color: "var(--ink-mute)", flexShrink: 0 }}>{formatRelativeTime(item.at)}</span>
        </div>
        {/* ★状態は灰色の小さな文字（2026-10-11 / 柴さんの指示）。⚠️ バッジ・「企業から」の印を付けない */}
        <div data-state="item-status" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>まだ返信していません</div>
        <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {topic && <span data-state="request-topic-inline" style={{ color: "var(--royal)", fontWeight: 700 }}>{topic}　</span>}
          {preview}
        </div>
      </div>
      <div aria-hidden style={{ width: 8, height: 8, marginTop: 6, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />
    </button>
  );
}

/**
 * ★未返信の1件を開いたところ（2026-10-11）。理由と本文・返信欄（ひな形つき）・「今回は見送る」・ブロック・運営に報告。
 * ⚠️★返信するまで、個人からのものは参加者に加えない決まり・企業からのものは会話を開かない決まりはそのまま（サーバーが守る）。
 * ⚠️ 見送り・ブロック・報告はどれも相手に伝えない。
 */
function UnrepliedDetail({ item, reported, onReply, onAction }: {
  item: UnrepliedItem;
  reported: boolean;
  onReply: (item: UnrepliedItem, body: string) => Promise<string | null>;
  onAction: (item: UnrepliedItem, action: "decline" | "block" | "report") => Promise<string | null>;
}) {
  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));
  const who = item.kind === "company" ? item.approach.companyName : `${item.request.requester.name}さん`;
  const extra = (
    <>
      <button type="button" data-action="block" style={linkBtn}
        onClick={() => {
          const msg = item.kind === "company"
            ? `${who}をブロックしますか？このメッセージは一覧から消え、以後この企業からのメッセージは届きません。企業には伝わりません。`
            : `${who}をブロックしますか？このメッセージは一覧から消え、以後この方からのメッセージは届きません。相手には伝わりません。`;
          if (window.confirm(msg)) void onAction(item, "block");
        }}>ブロック</button>
      {reported ? (
        <span data-state="reported" style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>運営に報告しました</span>
      ) : (
        <button type="button" data-action="report" style={linkBtn}
          onClick={() => { if (window.confirm("このメッセージを運営に報告しますか？内容を運営が確認します。相手には伝わりません。")) void onAction(item, "report"); }}>運営に報告</button>
      )}
    </>
  );
  return (
    <div data-state="unreplied-detail" data-unreplied={item.kind} style={{ padding: "16px 18px", minWidth: 0 }}>
      {item.kind === "company" ? (
        /* ★見た目は企業の「〇〇さんにはこう見えます」と同じ部品（ApproachLetter）。⚠️ 片方だけ書き換えない */
        <ApproachLetter companyName={item.approach.companyName} companyHref={item.approach.companyHref} logoUrl={item.approach.logoUrl}
          logoLetter={item.approach.logoLetter} logoGradient={item.approach.logoGradient} senderName={item.approach.senderName} senderRole={item.approach.senderRole}
          dateText={fmt(item.approach.createdAt)} reason={item.approach.reason} body={item.approach.body} job={item.approach.job}
          isOwnCompany={item.approach.isOwnCompany} />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {item.request.requester.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.request.requester.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <InitialAvatar name={item.request.requester.name} size={40} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/u/${item.request.requester.username ?? item.request.requester.id}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.request.requester.name}
              </Link>
              {item.request.requester.headline && (
                <span style={{ fontSize: 12, color: "var(--ink-mute)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.request.requester.headline}</span>
              )}
            </div>
          </div>
          {item.request.topic && (
            <div style={{ marginTop: 12 }}>
              <span data-state="request-topic" style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 12.5, fontWeight: 700 }}>
                聞きたいこと: {topicLabel(item.request.topic)}
              </span>
              {item.request.format && (
                <span data-state="request-format" style={{ display: "inline-block", marginLeft: 6, padding: "3px 10px", borderRadius: 999, background: "var(--bg-tint)", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600 }}>
                  {formatLabel(item.request.format)}
                </span>
              )}
            </div>
          )}
          <p data-state="request-body" style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.8, color: item.request.body ? "var(--ink)" : "var(--ink-mute)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {item.request.body ?? "（本文を読み込めませんでした）"}
          </p>
        </>
      )}
      {/* ★返信欄は企業の見本と同じ部品（RequestReplyBox）。⚠️ 片方だけ書き換えない */}
      <RequestReplyBox
        declineNote={item.kind === "company" ? "見送っても企業には伝わりません。" : "見送っても相手には伝わりません。"}
        onSend={(body) => onReply(item, body)}
        onDecline={() => onAction(item, "decline")}
        extra={extra} />
      {/* ★注記（2026-10-11 / モックの文言） */}
      {item.kind === "company" && (
        <p data-state="unreplied-note" style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
          見送っても企業には伝わりません。返信は応募や面談の申し込みにはなりません。ブロック・運営に報告もできます。
        </p>
      )}
    </div>
  );
}

export default function ConversationsClient({
  initialConversations,
  initialOpenConvId,
  initialRequests,
  initialApproaches = [],
  initialTab = "all",
}: {
  initialConversations: Conversation[];
  initialOpenConvId?: string | null;
  initialRequests: IncomingRequest[];
  /** ★企業から届いた、まだ返信していない最初のメッセージ（2026-10-11）。null = 取れなかった */
  initialApproaches?: IncomingApproachView[] | null;
  initialTab?: "all" | "unreplied";
}) {
  const router = useRouter();
  const [requests, setRequests] = useState<IncomingRequest[]>(initialRequests);
  const [approaches, setApproaches] = useState<IncomingApproachView[]>(initialApproaches ?? []);
  const approachesFailed = initialApproaches === null;
  const [reported, setReported] = useState<Set<string>>(new Set());
  /* ★「すべて」「未返信」（2026-10-11 / 柴さんの指示）。未返信 ＝ まだ返信していない最初のメッセージ（企業から・個人から） */
  const [tab, setTab] = useState<"all" | "unreplied">(initialTab);
  const [openUnreplied, setOpenUnreplied] = useState<string | null>(null);
  const unreplied: UnrepliedItem[] = [
    ...approaches.map((a): UnrepliedItem => ({ kind: "company", key: `a:${a.id}`, at: a.createdAt, approach: a })),
    ...requests.map((r): UnrepliedItem => ({ kind: "person", key: `r:${r.conversationId}`, at: r.requestedAt ?? "", request: r })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));
  const openedUnreplied = unreplied.find((u) => u.key === openUnreplied) ?? null;

  /* 返信（企業から・個人から）。返信した時点でやり取りが始まる */
  const replyUnreplied = async (item: UnrepliedItem, body: string): Promise<string | null> => {
    if (item.kind === "person") return handleReply(item.request.conversationId, body);
    try {
      const res = await fetch(`/api/jobseeker/approaches/${item.approach.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "送信できませんでした。もう一度お試しください。";
      window.location.assign(data?.conversationId ? `/mypage/conversations?open=${data.conversationId}` : "/mypage/conversations");
      return null;
    } catch {
      return "送信できませんでした。もう一度お試しください。";
    }
  };
  /* 見送る・ブロック（一覧から消す）・運営に報告（一覧には残す）。⚠️ どれも相手には伝わらない */
  const actUnreplied = async (item: UnrepliedItem, action: "decline" | "block" | "report"): Promise<string | null> => {
    if (item.kind === "person") {
      const err = await handleAction(item.request.conversationId, action);
      if (!err && action === "report") setReported((prev) => new Set(prev).add(item.key));
      if (!err && action !== "report") setOpenUnreplied(null);
      return err;
    }
    try {
      const res = await fetch(`/api/jobseeker/approaches/${item.approach.id}/respond`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "処理できませんでした。もう一度お試しください。";
      if (action === "report") setReported((prev) => new Set(prev).add(item.key));
      else { setApproaches((prev) => prev.filter((a) => a.id !== item.approach.id)); setOpenUnreplied(null); }
      return null;
    } catch {
      return "処理できませんでした。もう一度お試しください。";
    }
  };

  /* ★返信（2026-10-11）。返信した時点で会話が開く。⚠️ 一覧は初期値の state なので、開き直して会話を出す */
  const handleReply = async (id: string, body: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/dm/requests/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", body }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "送信できませんでした。もう一度お試しください。";
      window.location.assign(`/mypage/conversations?open=${id}`);
      return null;
    } catch {
      return "送信できませんでした。もう一度お試しください。";
    }
  };
  /* 見送る・ブロック（一覧から消す）・運営に報告（一覧には残す）。⚠️ どれも相手には伝わらない */
  const handleAction = async (id: string, action: "decline" | "block" | "report"): Promise<string | null> => {
    try {
      const res = await fetch(`/api/dm/requests/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return null; }
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "処理できませんでした。もう一度お試しください。";
      if (action === "report") setReported((prev) => new Set(prev).add(id));
      else setRequests((prev) => prev.filter((r) => r.conversationId !== id));
      return null;
    } catch {
      return "処理できませんでした。もう一度お試しください。";
    }
  };
  const [conversations] = useState<Conversation[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialOpenConvId ?? null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  /** ★企業から届いたメッセージの1通目（見出しなしで出す本文）。API が送ったメッセージの行と照合して返す */
  const [approachFirst, setApproachFirst] = useState<{ messageId: string; text: string } | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ★狭い画面（768px 未満）では会話を詳細ページで開く（2026-10-09）。
        判定は押した時点の幅で行う（state に持たない）。 */
  const isNarrowNow = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const openConversation = (id: string) => {
    if (isNarrowNow()) {
      router.push(`/mypage/conversations/${id}`);
      return;
    }
    setOpenUnreplied(null);
    setSelectedConvId(id);
  };
  /* ⚠️ `?open=` で来たとき（DM の入口・通知から）も、狭い画面なら詳細ページへ移す。
        そのままだと一覧だけが出て、開いたはずの会話が見えない。 */
  useEffect(() => {
    if (initialOpenConvId && isNarrowNow()) {
      router.replace(`/mypage/conversations/${initialOpenConvId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const r = await fetch(`/api/dm/conversation?id=${convId}`);
    if (!r.ok) return;
    const data = await r.json();
    setMessages(data.messages ?? []);
    setApproachFirst(data.approachFirst ?? null);
    setMyParticipantId(data.myParticipantId ?? null);
    setMyName(data.myName ?? null);
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;
    setPanelLoading(true);
    setMessages([]);
    setApproachFirst(null);
    setInputText("");
    setSendError(null);
    fetchMessages(selectedConvId).finally(() => setPanelLoading(false));
  }, [selectedConvId, fetchMessages]);

  useEffect(() => {
    if (!selectedConvId) return;
    const timer = setInterval(() => fetchMessages(selectedConvId), 10_000);
    return () => clearInterval(timer);
  }, [selectedConvId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── ★複数の宛先へ送る（2026-08-27）────────────────────────────────────────
        ⚠️ **グループ会話ではない。** 宛先ごとに既存の1対1の会話へ1通ずつ入る。
           受け取った側からは通常のメッセージと区別がつかず、**他の宛先も見えない。**
        ⚠️ **新しく会話は作らない。** 選べるのは**すでにある会話**だけなので、
           面識のない企業へ一斉送信することはできない。 */
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkText, setBulkText] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const toggleBulkId = (id: string) => {
    setBulkError(null);
    /* ⚠️ 承認前の DM には送れない（API も 409 で止める）。選ばせない */
    if (isPendingRequest(conversations.find((c) => c.id === id))) {
      setBulkError(NOT_ACCEPTED_TEXT);
      return;
    }
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX_BULK_RECIPIENTS) return prev; /* 上限。⚠️ 静かに無視しない（下で件数を出す） */
      else next.add(id);
      return next;
    });
  };

  const exitBulk = () => {
    setBulkMode(false); setBulkIds(new Set()); setBulkText("");
    setBulkError(null); setBulkNote(null);
  };

  const handleBulkSend = async () => {
    if (bulkSending || bulkIds.size === 0 || !bulkText.trim()) return;
    setBulkSending(true); setBulkError(null); setBulkNote(null);
    try {
      const res = await fetch("/api/dm/bulk-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds: Array.from(bulkIds), message: bulkText.trim() }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return; }
      const data = await res.json().catch(() => null);
      /* ⚠️ **「全部送れた」で片付けない。** 誰に届かなかったかを出す。
            出さないと、利用者は同じ本文をもう一度全員に送ることになる。 */
      const sent = typeof data?.sent === "number" ? data.sent : 0;
      const total = typeof data?.total === "number" ? data.total : bulkIds.size;
      if (sent === 0) {
        setBulkError(data?.message ?? "送信できませんでした。もう一度お試しください。");
        return;
      }
      if (sent < total) {
        setBulkNote(`${total}件中 ${sent}件に送りました。残り${total - sent}件は送れませんでした。`);
        return;
      }
      setBulkNote(`${sent}件に送りました。`);
      setBulkText("");
      setBulkIds(new Set());
      router.refresh();
    } catch {
      setBulkError("送信できませんでした。もう一度お試しください。");
    } finally {
      setBulkSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConvId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/dm/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, message: inputText.trim() }),
      });
      if (res.status === 401) { router.push("/auth?next=/mypage/conversations"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信に失敗しました");
      setInputText("");
      await fetchMessages(selectedConvId);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;
  /* ⚠️★`kind === "mentor"` の分岐は 2026-09-26 に削除した。**戻さないこと。**
        メンター機能は存在しない —— `ow_mentors` は DROP 済み、`kind='mentor'` の会話は
        **本番0件**で、**作る経路も無い**（`kind: "mentor"` を渡す呼び出しが0件。
        `/api/mentor-reservations` も存在しない）。
     ⚠️ 消す前はフォールバックが**3箇所で割れていた**（「メンター」×2 /「対話相手」×1）。
        一度も出ていないので誰も気づけなかった。
     ⚠️ `ow_conversations.partner_user_id` は**触っていない**。3件中2件が持っていて、
        中身は `kind='direct_message'` の相手。名前だけの名残（`?industry=` と同じ形）。 */
  const displayName = selectedConv
    ? selectedConv.kind === "direct_message"
      ? selectedConv.partner?.name ?? "ユーザー"
      : selectedConv.ow_companies?.name ?? "(企業情報なし)"
    : null;

  return (
    <MypageLayout activeKey="conversations">
      {/* ★768px 未満は1列にする（2026-10-09 / 柴さんの指示）。
             それまで 375px でも 300px の一覧と会話の面を横に並べており、
             **入力欄が 27px 幅**しかなく送れなかった（実測）。
             狭い画面では一覧だけを出し、押したら会話の詳細ページへ移る。
          ⚠️ 幅で変える値（display・width・height）はインラインに書かない（ui-debugging ②）。
          ⚠️ style タグの中には不等号・バッククォート・二重引用符を書かない（ui-debugging ⑲。属性セレクタの引用符でハイドレーションが壊れた）。 */}
      <style>{`
        .conv-shell { display: flex; height: calc(100vh - 160px); min-height: 500px; }
        .conv-list { width: 300px; flex-shrink: 0; border-right: 1px solid var(--line); }
        .conv-panel { display: flex; flex: 1; flex-direction: column; min-width: 0; }
        .conv-inline-detail { display: none; }
        @media (max-width: 767px) {
          .conv-inline-detail { display: block; }
          .conv-shell { flex-direction: column; height: auto; min-height: 0; }
          .conv-list { width: 100%; border-right: none; }
          .conv-panel { display: none; }
          .conv-panel.conv-panel-bulk { display: flex; border-top: 1px solid var(--line); min-height: 320px; }
        }
      `}</style>
      <div className="conv-shell" style={{ gap: 0, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>

        {/* ── 左カラム: 会話リスト ── */}
        <div className="conv-list" style={{
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* 左ヘッダー */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                メッセージ
              </h1>
              {/* ⚠️ 会話が2件以上あるときだけ出す。1件しか無い人に「複数に送る」は意味が無い */}
              {conversations.length >= 2 && (
                <button
                  type="button"
                  onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
                  style={{
                    border: "none", background: "none", padding: 0, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--royal)",
                  }}
                >
                  {bulkMode ? "やめる" : "複数に送る"}
                </button>
              )}
            </div>
            {bulkMode && (
              <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                宛先を選んでください（{bulkIds.size} / {MAX_BULK_RECIPIENTS}）。
                {/* ★何が起きるかを先に言う。送ったあとで気づく形にしない */}
                <br />相手ごとに<strong style={{ color: "var(--ink)" }}>別々に届きます</strong>。他の宛先は見えません。
              </p>
            )}
          </div>

          {/* ★「すべて」「未返信」（2026-10-11 / 柴さんの指示）。⚠️ 選択状態は下線だけ（ui-conventions） */}
          {!bulkMode && (
            <div role="tablist" aria-label="メッセージの絞り込み" style={{ display: "flex", gap: 16, padding: "0 16px", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
              {([["all", "すべて", 0], ["unreplied", "未返信", unreplied.length]] as const).map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} data-tab={k} data-state={tab === k ? "active" : "inactive"}
                  onClick={() => { setTab(k); setOpenUnreplied(null); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 2px", background: "none", border: "none", borderBottom: `2px solid ${tab === k ? "var(--royal)" : "transparent"}`, marginBottom: -1, fontFamily: "inherit", fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? "var(--ink)" : "var(--ink-mute)", cursor: "pointer" }}>
                  {label}
                  {n > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>{n}</span>}
                </button>
              ))}
            </div>
          )}

          {/* ★未返信の最初のメッセージ（企業から・個人から）。「すべて」でも先頭に並べる。
                 広い画面は右の面で開き、狭い画面はその場で開く（ui-debugging ② 幅で変える値は CSS） */}
          {!bulkMode && approachesFailed && (
            <p role="alert" style={{ margin: 0, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--error)" }}>企業からのメッセージを読み込めませんでした。時間をおいて再読み込みしてください。</p>
          )}
          {!bulkMode && unreplied.map((u) => (
            <Fragment key={u.key}>
              <UnrepliedRow item={u} selected={openUnreplied === u.key}
                onOpen={() => { setOpenUnreplied(openUnreplied === u.key && isNarrowNow() ? null : u.key); setSelectedConvId(null); }} />
              {openUnreplied === u.key && (
                <div className="conv-inline-detail" style={{ borderBottom: "1px solid var(--line)" }}>
                  <UnrepliedDetail item={u} reported={reported.has(u.key)} onReply={replyUnreplied} onAction={actUnreplied} />
                </div>
              )}
            </Fragment>
          ))}
          {!bulkMode && tab === "unreplied" && unreplied.length === 0 && !approachesFailed && (
            <p data-state="unreplied-empty" style={{ margin: 0, padding: 24, fontSize: 13, color: "var(--ink-soft)", textAlign: "center" }}>未返信のメッセージはありません。</p>
          )}

          {tab === "unreplied" && !bulkMode ? null : conversations.length === 0 && unreplied.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                まだ対話がありません
              </p>
              <Link href="/people" style={{
                display: "inline-block", marginTop: 12,
                fontSize: 12, color: "var(--royal)", fontWeight: 700, textDecoration: "none",
              }}>
                先輩を探す →
              </Link>
            </div>
          ) : (
            conversations.map((conv) => {
              const name =
                conv.kind === "direct_message"
                  ? conv.partner?.name ?? "ユーザー"
                  : conv.ow_companies?.name ?? "(企業情報なし)";
              const isSelected = conv.id === selectedConvId;
              const hasUnread = conv.hasUnread ?? false;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => (bulkMode ? toggleBulkId(conv.id) : openConversation(conv.id))}
                  aria-pressed={bulkMode ? bulkIds.has(conv.id) : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", textAlign: "left", border: "none",
                    borderBottom: "1px solid var(--line-soft)",
                    background: (bulkMode ? bulkIds.has(conv.id) : isSelected) ? "var(--royal-50)" : "transparent",
                    cursor: "pointer", width: "100%",
                    borderLeft: (bulkMode ? bulkIds.has(conv.id) : isSelected) ? "3px solid var(--royal)" : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                >
                  {/* ⚠️ 選択モードでは**選ばれているかを形で出す**。背景色だけだと、
                         いま選ばれているのか開いているだけなのか区別がつかない。 */}
                  {bulkMode && (
                    <span aria-hidden style={{
                      width: 16, height: 16, flexShrink: 0, borderRadius: 4,
                      border: bulkIds.has(conv.id) ? "none" : "1.5px solid var(--line)",
                      background: bulkIds.has(conv.id) ? "var(--royal)" : "#fff",
                      color: "#fff", fontSize: 11, lineHeight: "16px", textAlign: "center", fontWeight: 700,
                    }}>{bulkIds.has(conv.id) ? "✓" : ""}</span>
                  )}
                  <ConvAvatar conv={conv} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* ★LinkedIn の受信箱と同じ形（2026-10-11 / 柴さんの指示）。名前・日付・最後のメッセージの冒頭。
                           ⚠️ 状態のバッジ（「DM」「返事待ち」）を使わない。状態は灰色の小さな文字で出す */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13, fontWeight: hasUnread ? 700 : 500,
                        color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        flex: 1, minWidth: 0,
                      }}>{name}</span>
                      <span style={{ fontSize: 11.5, color: hasUnread ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 }}>
                        {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ""}
                      </span>
                    </div>
                    {/* ★自分が送った最初のメッセージに返信がまだ無い（段階3）。⚠️ 見送られていても同じ表示 */}
                    {isPendingRequest(conv) && (
                      <div data-state="request-pending" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>返信を待っています</div>
                    )}
                    <div style={{ fontSize: 12.5, fontWeight: hasUnread ? 600 : 400, color: hasUnread ? "var(--ink)" : "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {conv.lastMessage ?? "これから対話"}
                    </div>
                  </div>
                  {hasUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />
                  )}
                </button>
              );
            })
          )}
          {/* ★一覧の一番下に、止め方の1行（2026-10-11 に受け取りの設定から置き換えた。全員が最初から受け取る形） */}
          {!bulkMode && (
            <div data-state="approach-setting-line" style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid var(--line-soft)", fontSize: 12, color: "var(--ink-mute)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <span>企業からのメッセージは、マイページの「転職の状況」で止められます。</span>
              <Link href="/mypage#intent" style={{ fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>転職の状況を変える</Link>
            </div>
          )}
        </div>

        {/* ── 右カラム: 会話パネル ── */}
        <div className={bulkMode ? "conv-panel conv-panel-bulk" : "conv-panel"} data-bulk={bulkMode ? "1" : "0"}>
          {/* ★複数送信のときは、会話ではなく**本文を書く面**にする（2026-08-27）。
                 ⚠️ 会話を開いたまま複数送信の欄も出す形にしない。どちらに書いているのか
                    分からなくなり、開いている相手にだけ送ったつもりで全員に届く。 */}
          {bulkMode ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {bulkIds.size === 0 ? "宛先を選んでください" : `${bulkIds.size}件の宛先に送る`}
              </p>
              {/* ⚠️ 誰に送るのかを**名前で**出す。件数だけだと選び間違いに気づけない */}
              {bulkIds.size > 0 && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                  {conversations
                    .filter((c) => bulkIds.has(c.id))
                    .map((c) =>
                      c.kind === "direct_message"
                        ? c.partner?.name ?? "ユーザー"
                        : c.ow_companies?.name ?? "(企業情報なし)",
                    )
                    .join("・")}
                </p>
              )}
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="送る内容を入力…"
                aria-label="複数の宛先へ送るメッセージ"
                maxLength={MAX_DM_LENGTH}
                disabled={bulkSending}
                style={{
                  flex: 1, minHeight: 160, resize: "none", padding: 12,
                  border: "1px solid var(--line)", borderRadius: 8,
                  fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, color: "var(--ink)",
                }}
              />
              {bulkError && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{bulkError}</p>
              )}
              {/* ⚠️ 部分的に送れたときは**それを出す**。「送りました」だけだと、
                     届かなかった相手に同じ本文をもう一度送ることになる。 */}
              {bulkNote && (
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{bulkNote}</p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={exitBulk} disabled={bulkSending} style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)",
                  background: "#fff", color: "var(--ink-soft)", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600, cursor: bulkSending ? "default" : "pointer",
                }}>やめる</button>
                <button
                  type="button"
                  onClick={() => { void handleBulkSend(); }}
                  disabled={bulkSending || bulkIds.size === 0 || !bulkText.trim()}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    background: bulkSending || bulkIds.size === 0 || !bulkText.trim() ? "var(--line)" : "var(--royal)",
                    color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    cursor: bulkSending || bulkIds.size === 0 || !bulkText.trim() ? "default" : "pointer",
                  }}
                >
                  {bulkSending ? "送信中…" : "送信"}
                </button>
              </div>
            </div>
          ) : openedUnreplied ? (
            <div style={{ overflowY: "auto", height: "100%" }}>
              <UnrepliedDetail item={openedUnreplied} reported={reported.has(openedUnreplied.key)} onReply={replyUnreplied} onAction={actUnreplied} />
            </div>
          ) : !selectedConvId ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-mute)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.3 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: 14, color: "var(--ink-mute)" }}>会話を選択してください</p>
            </div>
          ) : (
            <>
              {/* 右ヘッダー */}
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--line)",
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
              }}>
                {selectedConv && <ConvAvatar conv={selectedConv} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{displayName}</p>
                  {selectedConv?.kind === "direct_message" && (
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: 0 }}>ダイレクトメッセージ</p>
                  )}
                </div>
              </div>

              {/* メッセージエリア */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", minHeight: 0 }}>
                {panelLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込み中...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>まだメッセージはありません</p>
                  </div>
                ) : (
                  /* ★吹き出しは会社側と同じ共通部品（`ChatBubble`。2026-10-12 / 柴さんの指示）。
                        求職者側は左右を反転: 自分＝右・薄い青 ／ 企業・相手＝左・白。各吹き出しの上に「名前・日時」を灰色で。
                        ⚠️ /mypage/conversations/[id] と同じ並べ方。片方だけ書き換えない */
                  <div data-state="jobseeker-thread" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {selectedConv?.kind === "direct_message" && isKnownTopic(selectedConv.request_topic) && <FirstTopicNotice topic={selectedConv.request_topic} format={isMessageFormat(selectedConv.request_format) ? selectedConv.request_format : null} />}
                    {messages.map((msg) => {
                      const isMe = msg.sender_participant_id === myParticipantId;
                      const sender = isMe ? (myName ?? "自分") : (msg.ow_conversation_participants?.ow_users?.name ?? "相手");
                      return (
                        <ChatBubble key={msg.id} mine={isMe} sender={sender} at={msg.sent_at}>
                          {approachFirst?.messageId === msg.id
                            ? <span data-state="approach-first">{approachFirst.text}</span>
                            : msg.body}
                        </ChatBubble>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* エラー */}
              {sendError && (
                <div style={{ padding: "4px 16px", fontSize: 12, fontWeight: 600, color: "var(--error)", background: "#fef2f2" }}>{sendError}</div>
              )}

              {/* ★承認前（段階3）。⚠️ 入力欄は閉じる（API も 409 で止める） */}
              {isPendingRequest(selectedConv) ? (
                <div data-state="request-pending-banner" style={{
                  borderTop: "1px solid var(--line)", padding: "14px 16px", flexShrink: 0,
                  fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", background: "var(--line-soft)",
                }}>{NOT_ACCEPTED_TEXT}</div>
              ) : (
              /* 入力エリア */
              <div style={{
                borderTop: "1px solid var(--line)", padding: "12px 16px",
                display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
              }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力… (⌘+Enter で送信)"
                  rows={2}
                  disabled={sending}
                  style={{
                    flex: 1, boxSizing: "border-box",
                    padding: "9px 12px", borderRadius: 8,
                    border: "1.5px solid var(--line)", outline: "none",
                    fontSize: 13, lineHeight: 1.5, resize: "none",
                    fontFamily: "inherit", color: "var(--ink)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !inputText.trim()}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                    cursor: sending || !inputText.trim() ? "not-allowed" : "pointer",
                    background: sending || !inputText.trim() ? "var(--line)" : "var(--royal)",
                    color: sending || !inputText.trim() ? "var(--ink-mute)" : "#fff",
                  }}
                >
                  {sending ? "送信中…" : "送信"}
                </button>
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </MypageLayout>
  );
}
