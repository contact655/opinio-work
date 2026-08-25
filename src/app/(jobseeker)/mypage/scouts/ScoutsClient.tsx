"use client";

import { useState } from "react";
import Link from "next/link";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";

export type ScoutItem = {
  id: string;
  message: string;
  status: "sent" | "interested" | "declined";
  sentAt: string | null;
  conversationId: string | null;
  company: {
    id: string;
    name: string;
    slug: string | null;
    logoLetter: string | null;
    logoGradient: string | null;
    logoUrl: string | null;
  } | null;
  job: { id: string; title: string } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 届いたスカウトの一覧と返答。
 *
 * ⚠️ 返答は1回きり。API 側が `status` を見て2回目を 409 で弾く。
 *    画面側でもボタンを消すが、**画面の状態を根拠にしない**（別タブで返答済みの可能性）。
 *    409 が返ったら「すでに返答済み」として扱い、その旨を出す。
 */
export function ScoutsClient({ scouts: initial }: { scouts: ScoutItem[] }) {
  const [scouts, setScouts] = useState(initial);

  /* ⚠️★**ページ側で器を作らない**（2026-08-25）。余白と最大幅は `MypageLayout` が持つ。
     以前ここに `maxWidth:720 / margin:0 auto / padding:28px` があったため、
     サイドバーを移動するたびに**見出しの位置が飛んでいた**
     （実測 1440px: 応募管理は上113px・左300px、スカウトだけ上186px・左510px）。
     ⚠️ 読みやすさのために幅を絞るのは可。ただし**中央寄せにしない**
     （左端が動くと、ページを移った瞬間に目線がずれる）。 */
  return (
    <div style={{ maxWidth: 720, paddingBottom: 64 }}>
      <h1
        style={{
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 22,
          fontWeight: 800,
          color: "var(--ink)",
          margin: "0 0 6px",
        }}
      >
        届いたスカウト
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 13,
          color: "var(--ink-soft)",
          margin: "0 0 22px",
          lineHeight: 1.7,
        }}
      >
        企業からのスカウトです。返答するかどうかはあなたが決められます。見送っても相手に理由は伝わりません。
      </p>

      {scouts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {scouts.map((s) => (
            <ScoutCard
              key={s.id}
              scout={s}
              onReplied={(status, conversationId) =>
                setScouts((prev) =>
                  prev.map((x) => (x.id === s.id ? { ...x, status, conversationId: conversationId ?? x.conversationId } : x)),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "36px 24px",
        textAlign: "center",
        background: "var(--bg-tint)",
      }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>📬</div>
      <div
        style={{
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 14,
          fontWeight: 700,
          color: "var(--ink)",
          marginBottom: 6,
        }}
      >
        まだスカウトは届いていません
      </div>
      <p
        style={{
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 13,
          color: "var(--ink-soft)",
          lineHeight: 1.8,
          margin: "0 0 18px",
        }}
      >
        プロフィールに経歴や希望条件を入れておくと、企業から見つけてもらいやすくなります。
      </p>
      <Link
        href="/mypage"
        style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 8,
          background: "var(--royal)",
          color: "#fff",
          textDecoration: "none",
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        プロフィールを編集する
      </Link>
    </div>
  );
}

function ScoutCard({
  scout,
  onReplied,
}: {
  scout: ScoutItem;
  onReplied: (status: "interested" | "declined", conversationId: string | null) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const company = scout.company;

  async function reply(action: "interested" | "declined") {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobseeker/scouts/${scout.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message: message.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        /* ⚠️ 409 は「すでに返答済み」。画面が古いだけなので、
              エラーとして見せずに状態を合わせる。 */
        if (res.status === 409) {
          onReplied(action, null);
          return;
        }
        setError(typeof json.error === "string" ? json.error : "返答に失敗しました");
        return;
      }

      onReplied(action, typeof json.conversationId === "string" ? json.conversationId : null);
    } catch {
      setError("通信に失敗しました。時間をおいて試してください");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 18,
        background: "#fff",
      }}
    >
      {/* 送り主 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <CompanyLogoImg
          logoUrl={company?.logoUrl ?? null}
          name={company?.name ?? "企業"}
          logoLetter={company?.logoLetter ?? null}
          logoGradient={company?.logoGradient ?? null}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={company?.name ?? undefined}
          >
            {company ? (
              <Link href={`/companies/${company.slug ?? company.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                {company.name}
              </Link>
            ) : (
              "企業"
            )}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
            {formatDate(scout.sentAt)}
          </div>
        </div>
        <StatusPill status={scout.status} />
      </div>

      {/* 紐づく求人 */}
      {scout.job && (
        <Link
          href={`/jobs/${scout.job.id}`}
          style={{
            display: "block",
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: "var(--royal)", marginBottom: 2 }}>
            この求人について
          </div>
          <div
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={scout.job.title}
          >
            {scout.job.title}
          </div>
        </Link>
      )}

      {/* 本文 */}
      <p
        style={{
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          fontSize: 13.5,
          color: "var(--ink-soft)",
          lineHeight: 1.9,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {scout.message}
      </p>

      {/* 返答 */}
      <div style={{ marginTop: 16, borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
        {scout.status === "interested" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, color: "var(--ink-soft)" }}>
              興味があると返答しました
            </span>
            {scout.conversationId && (
              <Link
                href={`/mypage/conversations/${scout.conversationId}`}
                style={{
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--royal)",
                  textDecoration: "none",
                }}
              >
                メッセージを見る →
              </Link>
            )}
          </div>
        ) : scout.status === "declined" ? (
          <span style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 13, color: "var(--ink-mute)" }}>
            今回は見送りました
          </span>
        ) : replyOpen ? (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="メッセージ（任意）。話してみたいことや、聞きたいことがあればどうぞ。"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--line)",
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 13,
                lineHeight: 1.8,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={sending}
                onClick={() => reply("interested")}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--royal)",
                  color: "#fff",
                  cursor: sending ? "default" : "pointer",
                  opacity: sending ? 0.6 : 1,
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {sending ? "送信中…" : "興味があると伝える"}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => setReplyOpen(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "var(--ink-soft)",
                  cursor: sending ? "default" : "pointer",
                  fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                やめる
              </button>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 12,
                color: "var(--ink-mute)",
                margin: "10px 0 0",
                lineHeight: 1.7,
              }}
            >
              返答すると企業とのメッセージが始まります。応募したことにはなりません。
            </p>
          </>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setReplyOpen(true)}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "var(--royal)",
                color: "#fff",
                cursor: "pointer",
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              返答する
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => reply("declined")}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "#fff",
                color: "var(--ink-soft)",
                cursor: sending ? "default" : "pointer",
                opacity: sending ? 0.6 : 1,
                fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {sending ? "処理中…" : "今回は見送る"}
            </button>
          </div>
        )}

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
              fontSize: 12,
              color: "var(--error)",
              margin: "10px 0 0",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ScoutItem["status"] }) {
  const map = {
    sent: { label: "未返答", bg: "var(--warm-soft)", fg: "#92400E" },
    interested: { label: "返答済み", bg: "var(--success-soft)", fg: "var(--success)" },
    declined: { label: "見送り", bg: "var(--line-soft)", fg: "var(--ink-mute)" },
  } as const;
  const s = map[status];
  return (
    <span
      style={{
        flexShrink: 0,
        padding: "4px 10px",
        borderRadius: 100,
        background: s.bg,
        color: s.fg,
        fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
