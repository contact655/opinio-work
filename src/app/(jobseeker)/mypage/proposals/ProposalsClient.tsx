"use client";

import { useState } from "react";
import Link from "next/link";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { PROPOSAL_NOTE_MAX, PROPOSAL_RESPONSE_DAYS } from "@/lib/constants/proposalResponses";
import { OwnCompanyNote } from "@/components/companies/OwnCompanyNote";

export type ProposalView = {
  id: string;
  companyName: string;
  companyHref: string | null;
  tagline: string | null;
  logoUrl: string | null;
  /** ★運営会社か（2026-10-10）。true なら「この会社は OPINIO の運営会社です。」を出す */
  isOwnCompany: boolean;
  evidence: EvidenceView[];
  counter: CounterView[];
  /**
   * ★この提案がいまどうなっているか（`proposalPhase()` から作った表示用の区分）。
   *   pending … 答えられる ／ waiting … 話を聞いてみたいと答え、企業の返事を待っている ／
   *   introduced … メッセージが開いた ／ declined … 自分が見送った ／ ended … 終了した
   * ⚠️★ended の理由（企業が見送った・14日返事が無い・30日たった等）は**渡していない**。画面にも出さない
   */
  status: "pending" | "waiting" | "introduced" | "declined" | "ended";
  /** ★企業が「確認してから」（B）の設定か。押す直前の説明を変えるだけ。未回答のときだけ意味を持つ */
  companyReviews: boolean;
  jobTitle: string | null;
  /** 求人ページへのリンク。掲載中でないときは null */
  jobHref: string | null;
  /** 関連する求人の掲載が終わっている */
  jobClosed: boolean;
  /** 自分が送ったひとこと */
  note: string | null;
  /** メッセージが開いたときの会話 */
  conversationId: string | null;
  computedAt: string;
  /** ★回答の締め切りまであと何日（2026-10-10）。終了・両方回答済みなら null。⚠️ 通知は送らない（表示だけ） */
  daysLeft: number | null;
};

export default function ProposalsClient({
  proposals, minEvidence, loadFailed,
}: { proposals: ProposalView[]; minEvidence: number; loadFailed: boolean }) {
  const [items, setItems] = useState(proposals);
  const [declining, setDeclining] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* ★会社へのひとこと（任意）。提案ごとに持つ */
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function respond(id: string, response: "interested" | "declined", reason?: string, declineNote?: string) {
    setPending(true); setErr(null);
    try {
      const res = await fetch(`/api/jobseeker/proposals/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          response === "interested"
            ? { response, note: (notes[id] ?? "").trim() || null }
            : { response, reason: reason || null, declineNote: declineNote || null },
        ),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        /* ⚠️ 失敗を黙って飲まない。押したのに何も起きない状態を作らない */
        setErr(j.error ?? "保存できませんでした");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { conversationId?: string | null };
      setItems((prev) => prev.map((p) => {
        if (p.id !== id) return p;
        /* ⚠️ 答えたら締め切りは出さない（daysLeft を消す） */
        if (response === "declined") return { ...p, status: "declined", daysLeft: null };
        /* ★auto ならその場で会話ができている。review なら企業の返事待ち */
        return j.conversationId
          ? { ...p, status: "introduced", conversationId: j.conversationId, note: (notes[id] ?? "").trim() || null, daysLeft: null }
          : { ...p, status: "waiting", note: (notes[id] ?? "").trim() || null, daysLeft: null };
      }));
      setDeclining(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>あなたへの提案</h1>

      {/* ★★中立の明示。消さないこと */}
      <p
        style={{
          fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)",
          background: "#F5F7FD", border: "1px solid #DCE3F5",
          borderRadius: 8, padding: "10px 12px", margin: "0 0 8px",
        }}
      >
        この提案は <strong>OPINIO が出しています。人材紹介会社は関わっていません。</strong><br />
        根拠にしているのは、OPINIO に登録された職歴と、在籍している方がご自身で答えた内容だけです。
      </p>

      {/* ★★何が・いつ・どこまで渡るかを書く（2026-10-11 に「求職者が先に答える」形へ書き直した）。
             ⚠️★選択肢を持たせない以上、告知は厚くする。消さないこと。
             ⚠️★「提案のことは企業に伝わらない」は**提案について**の話。候補者検索に出ているかは別
                （そちらは「転職について」の設定で決まる）。混ぜて「企業から見えません」と書かないこと */}
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 20px" }}>
        <strong>提案はあなたにだけ届いています。</strong>
        あなたが「話を聞いてみたい」と答えるまで、この提案のことは企業に伝わりません。
        答えると、企業にあなたの公開プロフィール（お名前・顔写真・見出し・職歴など）と、書いた場合はひとことが届きます。
        応募にはなりません。「今回は見送る」を選んでも、企業には伝わりません。
        提案は届いてから{PROPOSAL_RESPONSE_DAYS}日で終了します。
      </p>

      {err && (
        <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          {err}
        </p>
      )}

      {/* ── 空のとき ★ここで手を抜かない ────────────────────────────────── */}
      {loadFailed ? (
        <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          提案の読み込みに失敗しました。<strong>「0社」という意味ではありません。</strong>
          しばらくしてから開き直してください。
        </p>
      ) : items.length === 0 ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "20px 18px", lineHeight: 1.9, fontSize: 14 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>
            いまお出しできる提案はありません。
          </p>
          <p style={{ margin: "0 0 10px", color: "var(--ink-soft)", fontSize: 13 }}>
            OPINIO は、<strong>根拠を {minEvidence} 件以上そろえられた会社だけ</strong>を提案します。
            「近そうだから」という理由では出しません。
          </p>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
            {/* ★2026-10-10 に会社の求人・部門の職種・業界を足した。⚠️ 企業側（BizProposalsClient）と同じ事実を向きだけ変えて書いている */}
            {"根拠になるのは、同じ職種から移った方の人数・在籍している方が挙げた入社の決め手・話を聞ける方の人数・あなたの経験と同じ職種の求人や部門・あなたの希望条件との一致・あなたが経験した業界や事業領域との一致です（業界の一致だけでは提案になりません）。"}
            <strong>職歴と希望条件を登録していただくほど、そろいやすくなります。</strong>
          </p>
        </div>
      ) : (
        <>
          {/* ★件数は出す。黙って消さない */}
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
            根拠を {minEvidence} 件以上そろえられたのは <strong>{items.length} 社</strong>でした。
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            {items.map((p) => (
              <article key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "16px 16px 14px" }}>
                <header style={{ marginBottom: 10 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px" }}>
                    {p.companyHref ? (
                      <Link href={p.companyHref} style={{ color: "inherit", textDecoration: "none" }}>
                        {p.companyName}
                      </Link>
                    ) : p.companyName}
                  </h2>
                  {p.tagline && (
                    <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>{p.tagline}</p>
                  )}
                  {/* ★運営会社の開示（2026-10-10）。運営が自社を薦める形になるので必ず出す */}
                  {p.isOwnCompany && <OwnCompanyNote style={{ marginTop: 4 }} />}
                </header>

                <EvidenceList evidence={p.evidence} counter={p.counter} audience="candidate" />

                {/* ★関連する求人（2026-10-11。提案は求人つきでしか作らない） */}
                {p.jobTitle && (
                  <p style={{ fontSize: 13, margin: "10px 0 0" }}>
                    <span style={{ color: "var(--ink-soft)" }}>関連する求人：</span>
                    {p.jobHref ? (
                      <Link href={p.jobHref} style={{ color: "var(--royal)" }}>{p.jobTitle}</Link>
                    ) : (
                      <span>{p.jobTitle}{p.jobClosed && <span style={{ color: "var(--ink-soft)" }}>（掲載を終了しました）</span>}</span>
                    )}
                  </p>
                )}

                {/* ⚠️ スナップショットである旨を書く。数字が古くなりうることを隠さない */}
                <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "10px 0 0" }}>
                  {p.computedAt} 時点の情報にもとづく提案です
                  {p.daysLeft != null && (
                    <span data-state="proposal-days-left" style={{ marginLeft: 8, fontWeight: 600 }}>
                      ・回答の締め切りまで{p.daysLeft <= 1 ? "今日まで" : `あと${p.daysLeft}日`}
                    </span>
                  )}
                </p>

                {p.status === "pending" ? (
                  <div data-state="proposal-pending" style={{ marginTop: 14 }}>
                    <label htmlFor={`note-${p.id}`} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      会社へのひとこと<span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>（任意・{PROPOSAL_NOTE_MAX}字まで）</span>
                    </label>
                    <textarea
                      id={`note-${p.id}`}
                      value={notes[p.id] ?? ""}
                      maxLength={PROPOSAL_NOTE_MAX}
                      rows={3}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="聞いてみたいことや、いまの状況など"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, lineHeight: 1.6, resize: "vertical" }}
                    />
                    <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 0", textAlign: "right" }}>
                      {(notes[p.id] ?? "").length} / {PROPOSAL_NOTE_MAX}
                    </p>

                    {/* ★★押す直前に置く。⚠️ 画面の先頭の告知は、提案が増えると押すときには視界から外れている */}
                    <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, margin: "8px 0 0" }}>
                      {p.companyReviews
                        ? <>押すと、{p.companyName}にあなたのプロフィールとひとことが届きます。{p.companyName}が「会う」と答えると、メッセージでやり取りできるようになります。応募にはなりません。見送っても会社には伝わりません。</>
                        : <>押すと、{p.companyName}にあなたのプロフィールとひとことが届き、メッセージでやり取りできるようになります。応募にはなりません。見送っても会社には伝わりません。</>}
                    </p>

                    <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        onClick={() => respond(p.id, "interested")}
                        disabled={pending}
                        style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
                      >
                        話を聞いてみたい
                      </button>
                      {p.companyHref && (
                        <Link href={p.companyHref} style={{ fontSize: 13, color: "var(--royal)" }}>
                          企業ページを見る
                        </Link>
                      )}
                      {/* ★小さく置く（2026-10-11）。理由は任意 */}
                      <button
                        onClick={() => setDeclining(p.id)}
                        disabled={pending}
                        style={{ marginLeft: "auto", padding: "4px 0", border: "none", background: "none", color: "var(--ink-soft)", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}
                      >
                        今回は見送る
                      </button>
                    </div>
                  </div>
                ) : (
                  <div data-state={`proposal-${p.status}`} style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
                    {p.status === "introduced" ? (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>「話を聞いてみたい」と答えました。メッセージでやり取りできます。</span>
                        {p.conversationId && (
                          <Link
                            href={`/mypage/conversations/${p.conversationId}`}
                            style={{ padding: "8px 14px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontWeight: 600, textDecoration: "none" }}
                          >
                            メッセージを開く
                          </Link>
                        )}
                      </div>
                    ) : p.status === "waiting" ? (
                      <span>「話を聞いてみたい」と答えました。{p.companyName}からの返事をお待ちください。</span>
                    ) : p.status === "declined" ? (
                      <span style={{ color: "var(--ink-soft)" }}>今回は見送りました。</span>
                    ) : (
                      /* ⚠️★理由（企業が見送った・期限切れ等）は書かない */
                      <span style={{ color: "var(--ink-soft)" }}>このご紹介は終了しました</span>
                    )}
                    {p.note && (p.status === "waiting" || p.status === "introduced") && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
                        送ったひとこと：{p.note}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {declining && (
        <DeclineSheet
          side="candidate"
          pending={pending}
          onCancel={() => setDeclining(null)}
          onSubmit={(reason, note) => respond(declining, "declined", reason, note)}
        />
      )}
    </main>
  );
}
