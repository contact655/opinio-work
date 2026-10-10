"use client";

import { useState } from "react";
import Link from "next/link";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { CANDIDATE_RESPONSE_LABELS } from "@/lib/constants/proposalResponses";

export type ProposalView = {
  id: string;
  companyName: string;
  companyHref: string | null;
  tagline: string | null;
  logoUrl: string | null;
  evidence: EvidenceView[];
  counter: CounterView[];
  response: string | null;
  /** ★終了したか（2026-10-09）。企業が見送った／いまは企業に見せてはいけない状態になった。
   *  ⚠️★**どちらなのかは渡していない**（`lib/evidence/proposalEnded.ts`）。画面にも出さない */
  ended: boolean;
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

  async function respond(id: string, response: string, reason?: string, note?: string) {
    setPending(true); setErr(null);
    try {
      const res = await fetch(`/api/jobseeker/proposals/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, reason, note }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        /* ⚠️ 失敗を黙って飲まない。押したのに何も起きない状態を作らない */
        setErr(j.error ?? "保存できませんでした");
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, response } : p)));
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

      {/* ★★何が・いつ・どこまで渡るかを書く（2026-09-21 に実測して書き直した）。
             ⚠️★**「お互いが分かります」だけにしないこと。** 何が渡るかを言っていなかった。
                カジュアル面談の `share_profile` を撤去したときと同じで、
                **選択肢を持たせない以上、告知は厚くする。**
             ⚠️★**非対称であることも書く。** 企業名はこの画面に最初から出ているので、
                「お互いが」は事実と違う。伏せているのは候補者側だけ。
             ⚠️★**2026-10-09 に「匿名で届いていて」をやめた**（柴さんの判断・案B）。
                提案の対象は全員、同じ企業の候補者検索に実名で出ているので、匿名は守れない
                約束だった。企業側の提案カードにもお名前を出している（`biz/proposals/page.tsx`）。
             ⚠️★**「この時点では企業に何も伝わりません」も同日に外した。事実と違っていた。**
                企業側のカードには以前から「候補者：興味あり」のバッジが出ている。
             ⚠️★「メッセージが開くのは双方合意のとき」は**変えていない。消さないこと。** */}
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 20px" }}>
        <strong>提案の時点から、企業にはあなたのお名前と職歴が見えています。</strong>
        企業が見るのは、候補者検索と同じ OPINIO の公開プロフィール
        （お名前・顔写真・見出し・職歴など）です。
        {/* ★2026-10-09 に「見送る」も表示される、をやめた。見送りは企業に伝えず、
               企業には「この提案は終了しました」とだけ出る（理由は出さない）。 */}
        「興味がある」と答えると、そのことが企業に表示されます。
        「今は見送る」は企業には伝わらず、企業には「この提案は終了しました」とだけ表示されます。<br />
        <strong>メッセージができるようになるのは、双方が「会いたい」と答えたとき</strong>です。
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
                </header>

                <EvidenceList evidence={p.evidence} counter={p.counter} audience="candidate" />

                {/* ⚠️ スナップショットである旨を書く。数字が古くなりうることを隠さない */}
                <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "10px 0 0" }}>
                  {p.computedAt} 時点の情報にもとづく提案です
                  {p.daysLeft != null && (
                    <span data-state="proposal-days-left" style={{ marginLeft: 8, fontWeight: 600 }}>
                      ・回答の締め切りまで{p.daysLeft <= 1 ? "今日まで" : `あと${p.daysLeft}日`}
                    </span>
                  )}
                </p>

                {/* ★★押す直前にも1行だけ置く（2026-09-21）。
                       ⚠️ 上の告知は**画面の先頭**にあるので、提案が増えると
                          押すときには視界から外れている。**決める場所に置く。**
                       ⚠️ 答えたあとは出さない（もう決める場面ではない）。 */}
                {!p.response && !p.ended && (
                  <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "4px 0 0" }}>
                    「興味がある」＝ 企業にもそのことが表示されます。企業も会いたいと答えると、メッセージが開きます
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {p.response ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", padding: "9px 0" }}>
                      「{CANDIDATE_RESPONSE_LABELS[p.response as "interested" | "declined"]}」と答えました
                    </span>
                  ) : p.ended ? (
                    /* ⚠️ 終了した提案にはボタンを出さない（API も 409 で止める）。
                          ⚠️★理由（企業が見送った等）は書かない */
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", padding: "9px 0" }}>
                      この提案は終了しました
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => respond(p.id, "interested")}
                        disabled={pending}
                        style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                      >
                        興味がある
                      </button>
                      <button
                        onClick={() => setDeclining(p.id)}
                        disabled={pending}
                        style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                      >
                        今は見送る
                      </button>
                      {p.companyHref && (
                        <Link
                          href={p.companyHref}
                          style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 14, textDecoration: "none", color: "inherit" }}
                        >
                          根拠を確かめる
                        </Link>
                      )}
                    </>
                  )}
                </div>
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
