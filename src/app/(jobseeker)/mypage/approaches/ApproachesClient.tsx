"use client";

import { RequestReplyBox } from "@/components/approaches/RequestReplyBox";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPROACH_EXPIRE_DAYS } from "@/lib/constants/companyApproaches";
import { ApproachLetter } from "@/components/approaches/ApproachLetter";

export type IncomingApproachView = {
  id: string;
  createdAt: string;
  reason: string;
  body: string | null;
  senderName: string | null;
  companyName: string;
  companyHref: string | null;
  /** ★運営会社か（2026-10-10） */
  isOwnCompany: boolean;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  /** ★関連する求人（2026-10-10）。href が null なら掲載を終了している */
  job: { title: string; href: string | null } | null;
};

/**
 * ★企業からのメッセージリクエストの一覧と返信欄（2026-10-09。2026-10-11 に「受け入れる」をやめ、そのまま返信できる形に）。
 * ⚠️ 返信すると企業とのメッセージが開く。「今回は見送る」は企業に伝わらない。
 * ⚠️ 答えたら一覧から外す（サーバーの値を取り直す）。
 */
export default function ApproachesClient({ items }: { items: IncomingApproachView[] | null }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());

  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));

  /* ★返信（2026-10-11）。返信した時点で会話が開き、そのまま会話の画面へ移る */
  async function reply(id: string, body: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/jobseeker/approaches/${id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "送信できませんでした。もう一度お試しください。";
      if (data?.conversationId) { router.push(`/mypage/conversations/${data.conversationId}`); return null; }
      setGone((g) => new Set(g).add(id));
      router.refresh();
      return null;
    } catch {
      return "送信できませんでした。もう一度お試しください。";
    }
  }
  /* 見送る。⚠️ 企業には伝わらない */
  async function decline(id: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/jobseeker/approaches/${id}/respond`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decline" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "うまくいきませんでした。もう一度お試しください。";
      setGone((g) => new Set(g).add(id));
      router.refresh();
      return null;
    } catch {
      return "うまくいきませんでした。もう一度お試しください。";
    }
  }

  const shown = (items ?? []).filter((a) => !gone.has(a.id));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>企業からのメッセージリクエスト</h1>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 16px" }}>
        候補者検索であなたを見つけた企業が、理由を添えて「話を聞かせてもらえませんか」とメッセージリクエストを送ってきています。
        返信すると、そのままその企業とメッセージでやり取りが始まります。
        <strong style={{ color: "var(--ink)" }}>見送っても、企業には伝わりません。</strong>
        届いてから{APPROACH_EXPIRE_DAYS}日たつと、ここには表示されなくなります。
      </p>

      {items === null ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error)" }}>メッセージリクエストを取得できませんでした。時間をおいて再読み込みしてください。</p>
      ) : shown.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, fontSize: 13, color: "var(--ink-soft)" }}>
          いま届いているメッセージリクエストはありません。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((a) => (
            <section key={a.id} data-state="incoming-approach" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
              {/* ★見た目は企業の「〇〇さんにはこう見えます」と同じ部品（ApproachLetter）。⚠️ 片方だけ書き換えない */}
              <ApproachLetter companyName={a.companyName} companyHref={a.companyHref} logoUrl={a.logoUrl} logoLetter={a.logoLetter}
                logoGradient={a.logoGradient} senderName={a.senderName} dateText={fmt(a.createdAt)} reason={a.reason} body={a.body} job={a.job}
                isOwnCompany={a.isOwnCompany} />

              {/* ★返信欄は企業の見本と同じ部品（RequestReplyBox）。⚠️ 片方だけ書き換えない */}
              <RequestReplyBox declineNote="見送っても企業には伝わりません。"
                onSend={(body) => reply(a.id, body)} onDecline={() => decline(a.id)} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
