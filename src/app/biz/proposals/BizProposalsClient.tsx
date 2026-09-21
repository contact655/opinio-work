"use client";

import { useState } from "react";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { COMPANY_RESPONSE_LABELS } from "@/lib/constants/proposalResponses";

export type BizProposalView = {
  id: string;
  evidence: EvidenceView[];
  counter: CounterView[];
  candidateInterested: boolean;
  candidateDeclined: boolean;
  response: string | null;
  jobTitle: string | null;
  computedAt: string;
  /** ★双方合意で紹介済みなら、その会話の id（2026-09-21）。未紹介は null */
  conversationId: string | null;
};

/* ★「未回答」＝企業がまだ答えておらず、候補者も見送っていないもの。
      サイドバーのバッジ（`lib/business/navBadges.ts`）と同じ条件にしてある。
      ⚠️ 候補者が見送った提案は答えても何も起きないので「回答済み」側に入れ、ボタンを出さない */
function isOpen(p: BizProposalView): boolean {
  return !p.response && !p.candidateDeclined;
}

/** "2026-09-21" → "2026年9月21日"。⚠️ 形が違えばそのまま返す（推測で直さない） */
function formatJaDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ymd;
}

/* ★候補者の答えは3つとも同じ形のバッジで出す（2026-09-22）。
      それまで「興味がある」だけバッジで、「まだ回答していません」は地の文だった。
   ⚠️ null を「見送り」と読ませない（まだ答えていないだけ） */
function CandidateBadge({ p }: { p: BizProposalView }) {
  const [label, bg, color, border] = p.candidateInterested
    ? ["候補者：興味あり", "var(--royal-50)", "var(--royal)", "var(--royal-100)"]
    : p.candidateDeclined
      ? ["候補者：見送り", "var(--line-soft)", "var(--ink-mute)", "var(--line)"]
      : ["候補者：まだ回答していません", "#fff", "var(--ink-soft)", "var(--line)"];
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export default function BizProposalsClient({
  proposals, loadFailed,
}: { proposals: BizProposalView[]; loadFailed: boolean }) {
  const [items, setItems] = useState(proposals);
  const [declining, setDeclining] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "done">("open");

  /* ★未回答は「候補者が興味あり」を先に出す（2026-09-22）。いちばん会える見込みが高いものを埋もれさせない。
        ⚠️ 並べ替えは安定なので、同じ区分の中はサーバーの並び（新しい順）のまま */
  const visible = items
    .filter((x) => (tab === "open" ? isOpen(x) : !isOpen(x)))
    .sort((a, b) => (tab === "open" ? Number(b.candidateInterested) - Number(a.candidateInterested) : 0));

  async function respond(id: string, response: string, reason?: string, note?: string) {
    setPending(true); setErr(null);
    try {
      const res = await fetch(`/api/biz/proposals/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, reason, note }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
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
    /* ⚠️ `<main>` にしない（BusinessLayout の main の中に入る）。中央寄せ・余白も足さない
          （2026-09-21 まで二重で、ほかの画面とずれていた） */
    <div style={{ maxWidth: 760 }}>
      {/* ★名前はサイドバーと同じ「提案」（それまで「候補者の提案」） */}
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>提案</h1>

      {/* ★2つの注意書きを1つの枠にまとめた（2026-09-22）。**文言はそのまま。**
             ⚠️★「これはスカウトではありません」は消さないこと。
             ⚠️★何が・いつ見えるようになるかは、求職者側（`ProposalsClient`）と**同じ事実**を
                向きだけ変えて書いている。**片方だけ直さないこと。** */}
      <div
        style={{
          fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)",
          background: "#F5F7FD", border: "1px solid #DCE3F5",
          borderRadius: 8, padding: "10px 14px", margin: "0 0 20px",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>これはスカウトではありません。</strong>
          OPINIO が根拠をそろえてお出ししている提案で、送信枠も消費しません。
        </p>
        <p style={{ margin: "4px 0 0" }}>
          候補者は匿名です。<strong>お名前・顔写真・現在の勤務先はお渡ししていません。</strong>
          <strong>双方が「会いたい」と答えるとメッセージが1本開き</strong>、そこから候補者の
          公開プロフィール（お名前・顔写真・見出し・職歴の勤務先と在籍期間）をご覧いただけます。
        </p>
      </div>

      {err && (
        <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          {err}
        </p>
      )}

      {loadFailed ? (
        <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E" }}>
          提案の読み込みに失敗しました。<strong>「0件」という意味ではありません。</strong>
        </p>
      ) : items.length === 0 ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "20px 18px", fontSize: 14, lineHeight: 1.9 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>いまお出しできる提案はありません。</p>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
            OPINIO は、<strong>根拠を2件以上そろえられた候補者だけ</strong>をご提案します。
            根拠になるのは、御社に移ってきた方の人数・在籍している方が挙げた入社の決め手・
            話を聞ける方の人数・ご本人の希望条件との一致です。
          </p>
        </div>
      ) : (
        <>
        {/* ★未回答 / 回答済み（2026-09-21）。それまでは新しい順に混ざって並び、答えるべきものが埋もれた */}
        <div role="tablist" aria-label="提案の区分" style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 14 }}>
          {([
            { key: "open" as const, label: "未回答", count: items.filter(isOpen).length },
            { key: "done" as const, label: "回答済み", count: items.filter((x) => !isOpen(x)).length },
          ]).map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-state={tab === t.key ? "active" : "inactive"}
              onClick={() => setTab(t.key)}
              style={{ padding: "9px 14px", marginBottom: -1, background: "none", border: "none", borderBottom: `2px solid ${tab === t.key ? "var(--royal)" : "transparent"}`, fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? "var(--royal)" : "var(--ink-mute)", cursor: "pointer" }}>
              {t.label} {t.count}
            </button>
          ))}
        </div>
        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "8px 0" }}>
            {tab === "open" ? "答えていない提案はありません。" : "回答済みの提案はまだありません。"}
          </p>
        )}
        <div style={{ display: "grid", gap: 14 }}>
          {visible.map((p) => (
            <article key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "16px 16px 14px" }}>
              {/* ★見出しは求人名（2026-09-22）。それまでは全カードが「候補者（匿名）」で見分けがつかなかった。
                     ⚠️★匿名。名前の代わりに出すのは「提案」という事実だけ */}
              <header style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    {/* ⚠️ 求人名が無いとき、求人を指定していないのか取れなかったのかは区別できないので「提案」とだけ書く */}
                    {p.jobTitle ? `${p.jobTitle} への提案` : "提案"}
                  </h2>
                  <CandidateBadge p={p} />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3 }}>
                  候補者（匿名）・{formatJaDate(p.computedAt)}時点の情報にもとづく提案
                </div>
              </header>

              <EvidenceList evidence={p.evidence} counter={p.counter} />


              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {p.response ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", padding: "9px 0" }}>
                      「{COMPANY_RESPONSE_LABELS[p.response as "want_to_meet" | "declined"]}」と答えました
                    </span>
                    {/* ★双方合意なら、その会話を直接開く（2026-09-21）。
                           それまでは会話ができていても、この画面から辿る手段が無かった */}
                    {p.conversationId && (
                      <a href={`/biz/conversations/${p.conversationId}`}
                        style={{ padding: "9px 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                        メッセージを開く
                      </a>
                    )}
                  </>
                ) : p.candidateDeclined ? (
                  /* ⚠️ 候補者が見送った提案には答えても何も起きない。ボタンを出さない */
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", padding: "9px 0" }}>
                    この方が見送ったため、回答は不要です
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => respond(p.id, "want_to_meet")}
                      disabled={pending}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                    >
                      会いたい
                    </button>
                    <button
                      onClick={() => setDeclining(p.id)}
                      disabled={pending}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                    >
                      見送る
                    </button>
                    {/* ★押す前に、押すと何が起きるかを書く（2026-09-22）。
                           候補者が既に興味ありなら、「会いたい」で双方合意になりメッセージが開く */}
                    {p.candidateInterested && (
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", alignSelf: "center" }}>
                        「会いたい」と答えるとすぐにメッセージが開き、候補者の公開プロフィールが見られるようになります
                      </span>
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
          side="company"
          pending={pending}
          onCancel={() => setDeclining(null)}
          onSubmit={(reason, note) => respond(declining, "declined", reason, note)}
        />
      )}
    </div>
  );
}
