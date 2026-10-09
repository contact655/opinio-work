"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APPROACH_EXPIRE_DAYS } from "@/lib/constants/companyApproaches";

export type IncomingApproachView = {
  id: string;
  createdAt: string;
  reason: string;
  body: string | null;
  senderName: string | null;
  companyName: string;
  companyHref: string;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
};

/**
 * ★企業からの声かけの一覧と、答えるボタン（2026-10-09）。
 * ⚠️ 「話してみる」で企業とのメッセージが開く。「今回は見送る」は企業に伝わらない。
 * ⚠️ 答えたら一覧から外す（サーバーの値を取り直す）。
 */
export default function ApproachesClient({ items }: { items: IncomingApproachView[] | null }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());

  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/jobseeker/approaches/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrors((e) => ({ ...e, [id]: data?.error ?? "うまくいきませんでした。もう一度お試しください。" }));
        return;
      }
      if (action === "accept" && data?.conversationId) {
        router.push(`/mypage/conversations/${data.conversationId}`);
        return;
      }
      setGone((g) => new Set(g).add(id));
      router.refresh();
    } catch {
      setErrors((e) => ({ ...e, [id]: "うまくいきませんでした。もう一度お試しください。" }));
    } finally {
      setBusyId(null);
    }
  }

  const shown = (items ?? []).filter((a) => !gone.has(a.id));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>企業からの声かけ</h1>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 16px" }}>
        候補者検索であなたを見つけた企業が、理由を添えて「話を聞いてみたい」と連絡してきています。
        「話してみる」を押すと、その企業とメッセージでやり取りを始められます。
        <strong style={{ color: "var(--ink)" }}>見送っても、企業には伝わりません。</strong>
        届いてから{APPROACH_EXPIRE_DAYS}日たつと、ここには表示されなくなります。
      </p>

      {items === null ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error)" }}>声かけを取得できませんでした。時間をおいて再読み込みしてください。</p>
      ) : shown.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 24, fontSize: 13, color: "var(--ink-soft)" }}>
          いま届いている声かけはありません。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((a) => (
            <section key={a.id} data-state="incoming-approach" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {a.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logoUrl} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", border: "1px solid var(--line)", background: "#fff", flexShrink: 0 }} />
                ) : (
                  <span aria-hidden style={{ width: 40, height: 40, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: a.logoGradient ?? "var(--royal)", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                    {a.logoLetter ?? a.companyName.charAt(0)}
                  </span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link href={a.companyHref} style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{a.companyName}</Link>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                    {a.senderName ? `${a.senderName} さんから · ` : ""}{fmt(a.createdAt)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>あなたに声をかけた理由</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{a.reason}</p>
              </div>
              {a.body && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>メッセージ</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{a.body}</p>
                </div>
              )}

              {errors[a.id] && (
                <p role="alert" style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{errors[a.id]}</p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-action="accept"
                  disabled={busyId === a.id}
                  onClick={() => { void respond(a.id, "accept"); }}
                  className="tap-min-h"
                  style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: busyId === a.id ? "default" : "pointer" }}
                >
                  {busyId === a.id ? "処理中…" : "話してみる"}
                </button>
                <button
                  type="button"
                  data-action="decline"
                  disabled={busyId === a.id}
                  onClick={() => { void respond(a.id, "decline"); }}
                  className="tap-min-h"
                  style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: busyId === a.id ? "default" : "pointer" }}
                >
                  今回は見送る
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
