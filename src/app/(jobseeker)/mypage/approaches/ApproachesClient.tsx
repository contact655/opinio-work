"use client";

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
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>企業からのメッセージリクエスト</h1>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 16px" }}>
        候補者検索であなたを見つけた企業が、理由を添えて「話を聞かせてもらえませんか」とメッセージリクエストを送ってきています。
        「話してみる」を押すと、その企業とメッセージでやり取りを始められます。
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
