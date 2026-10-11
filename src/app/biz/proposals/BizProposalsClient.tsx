"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import type { ProposalPhase } from "@/lib/constants/proposalResponses";

/**
 * 企業の「提案」（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 * ★ここに届くのは、求職者が「話を聞いてみたい」と答えた方だけ（サーバーが `listCompanyProposals` で絞っている）。
 * ⚠️★紹介したのに答えなかった方は出さない。**誰に紹介したかも出さない**（一覧の下の注記を消さないこと）。
 * ⚠️ 状態は灰色の文字で出す（バッジにしない・色で意味を足さない）。
 * ★2026-10-11（同日）に企業側の設定（すぐにメッセージ／確認してから）と「会う／今回は見送る」・14日の期限をなくした。
 *   届いた方はその場で会話になる。⚠️ 設定欄・ボタン・期限の表示を戻さないこと（API も 410）。
 */
export type BizProposalView = {
  id: string;
  tab: "arrived" | "ended";
  phase: ProposalPhase;
  /** ⚠️ いま見せてはいけない方は null（サーバーが名前を送っていない） */
  candidate: {
    id: string; name: string; headline: string | null;
    tenureYears: number | null; roleTrail: string | null; prefecture: string | null;
  } | null;
  evidence: EvidenceView[];
  counter: CounterView[];
  /** 求職者のひとこと（任意） */
  note: string | null;
  jobTitle: string | null;
  /** 求職者が「話を聞いてみたい」と答えた日時 */
  raisedAt: string;
  /** 会話ができていればその id */
  conversationId: string | null;
};

type Stats = { introduced: number; raised: number; meetings: number; cutoff: string } | null;
type EvidenceMaterialsView = { path: number; motive: number; talkable: number; jobs: number; roles: number } | null;

const TABS: { key: "arrived" | "ended"; label: string }[] = [
  { key: "arrived", label: "話を聞きたい方" },
  { key: "ended", label: "終了" },
];

function fmtMd(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}

/**
 * ★状態の一言（灰色の文字）。⚠️ 「OPINIOからの紹介で、」は付けない（2026-10-11 / 柴さんの指示）。
 * ⚠️ hidden（いま見せられない）はサーバーが行ごと落とすので来ない。
 */
function statusLine(p: BizProposalView): string {
  const want = "貴社の話を聞いてみたいそうです";
  switch (p.phase) {
    case "introduced": return `${want}・メッセージが始まりました`;
    case "connecting": return `${want}・メッセージを準備しています`;
    /* ⚠️ 2026-10-11 より前に「確認してから」で見送った記録だけ */
    case "company_declined": return "今回は見送りました";
    default: return "このご紹介は終了しました";
  }
}

export default function BizProposalsClient({
  proposals, loadFailed, materials = null, stats,
}: {
  proposals: BizProposalView[];
  loadFailed: boolean;
  materials?: EvidenceMaterialsView;
  stats: Stats;
}) {
  const [items, setItems] = useState(proposals);
  useEffect(() => { setItems(proposals); }, [proposals]);
  const [tab, setTab] = useState<"arrived" | "ended">("arrived");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const counts = { arrived: items.filter((x) => x.tab === "arrived").length, ended: items.filter((x) => x.tab === "ended").length };
  const visible = items.filter((x) => x.tab === tab);

  const toggle = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    /* ⚠️ `<main>` にしない（BusinessLayout の main の中に入る） */
    <div className="bpz-root">
      <style>{`
        .bpz-root { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .bpz-cols { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
        .bpz-main { flex: 1.6 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
        .bpz-side { flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .bpz-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); overflow-x: auto; }
        .bpz-tab { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
        .bpz-tab[aria-selected=true] { border-bottom-color: var(--royal); color: var(--royal); font-weight: 700; }
        .bpz-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .bpz-head { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
        .bpz-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 767px) {
          .bpz-main, .bpz-side { flex-basis: 100%; }
          .bpz-card { padding: 14px 16px; }
          .bpz-tab { padding: 0 8px; font-size: 13px; }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>OPINIOからの紹介</h1>
        {/* ⚠️★求職者側（`ProposalsClient`）と同じ事実を向きだけ変えて書いている。片方だけ直さないこと */}
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
          OPINIO が、貴社の求人と経歴が合う方に貴社をご紹介し、『話を聞いてみたい』と答えた方だけをここにお届けします。貴社から送る必要はなく、送れる数の枠も使いません。
        </p>
      </div>

      <div className="bpz-cols">
        <div className="bpz-main">
          {loadFailed ? (
            <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E", margin: 0 }}>
              紹介の読み込みに失敗しました。<strong>「0件」という意味ではありません。</strong>
            </p>
          ) : (
            <>
              <div role="tablist" aria-label="紹介の区分" className="bpz-tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-state={tab === t.key ? "active" : "inactive"}
                    className="bpz-tab btn-fixed-size" onClick={() => setTab(t.key)}>
                    {t.label}
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>{counts[t.key]}</span>
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 18px", fontSize: 14, lineHeight: 1.9 }}>
                  {tab === "arrived" ? (
                    <>
                      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>まだ届いた方はいません。</p>
                      {/* ⚠️「右の」「下の」を付けない（375px では材料が下に出るため） */}
                      <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
                        登録が増えるほど、合う方に貴社をご紹介しやすくなります。{" "}
                        <Link href="/biz/help/proposals" style={{ color: "var(--royal)", fontWeight: 600 }}>紹介の決め方</Link>
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>終了したご紹介はありません。</p>
                  )}
                </div>
              ) : visible.map((p) => (
                <ProposalCard key={p.id} p={p} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} />
              ))}
              {/* ★★消さないこと（2026-10-11 / 柴さんの指示） */}
              <p data-state="proposals-footnote" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                ご紹介しても「話を聞いてみたい」と答えなかった方は、ここには出ません。誰に紹介したかも表示しません。
              </p>
            </>
          )}
        </div>

        <aside className="bpz-side">
          {/* ⚠️ 「話を聞きたい方が届いたら」の設定欄は 2026-10-11 に外した（すべて、その場でメッセージを始める） */}
          {/* ① 今月の紹介（人数だけ・毎朝更新） */}
          <section data-state="proposal-stats" style={SIDE_CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <h2 style={SIDE_H2}>今月の紹介<span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--ink-mute)", marginLeft: 4 }}>（毎朝更新）</span></h2>
            </div>
            {([
              { k: "introduced", label: "ご紹介した方" },
              { k: "raised", label: "話を聞いてみたいと答えた方" },
              { k: "meetings", label: "面談につながった方" },
            ] as const).map((m, i) => (
              <div key={m.k} data-stat={m.k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", fontSize: 13.5, borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
                <span style={{ color: "var(--ink)", minWidth: 0 }}>{m.label}</span>
                <strong style={{ whiteSpace: "nowrap" }}>{stats ? `${stats[m.k]}人` : "—"}</strong>
              </div>
            ))}
            {stats === null && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>数を取得できませんでした（「—」は 0 という意味ではありません）。</p>}
          </section>

          {/* ② 紹介を増やすには */}
          <section data-state="evidence-materials" style={SIDE_CARD}>
            <h2 style={SIDE_H2}>紹介を増やすには</h2>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-mute)" }}>登録が増えるほど、合う方に貴社をご紹介しやすくなります。</p>
            {/* ⚠️ 取得に失敗したら「—」。0 と出さない */}
            {([
              { key: "jobs", label: "公開中の求人", value: materials?.jobs, unit: "件", href: "/biz/jobs/new", action: "求人を登録する" },
              { key: "roles", label: "職種を設定した部門", value: materials?.roles, unit: "件", href: "/biz/organization?tab=roles", action: "部門・職種を登録する" },
              { key: "path", label: "貴社に移ってきた方", value: materials?.path, unit: "人", href: "/biz/employees", action: "企業ページに出ている方を確かめる" },
              { key: "motive", label: "入社の決め手の回答", value: materials?.motive, unit: "件", href: "/biz/employees", action: "社員に回答を呼びかける" },
              { key: "talkable", label: "話を聞ける方", value: materials?.talkable, unit: "人", href: "/biz/employees", action: "社員に登録を呼びかける" },
            ] as const).map((m, i, arr) => (
              <div key={m.key} data-material={m.key} style={{ padding: "8px 0", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5 }}>
                  <span style={{ color: "var(--ink)", minWidth: 0 }}>{m.label}</span>
                  <strong data-material-value style={{ color: m.value === 0 ? "var(--warm-ink)" : "var(--ink)", whiteSpace: "nowrap" }}>
                    {typeof m.value === "number" ? `${m.value}${m.unit}` : "—"}
                  </strong>
                </div>
                <Link href={m.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>{m.action} →</Link>
              </div>
            ))}
            <Link href="/biz/help/proposals" data-state="materials-help" style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--royal)" }}>紹介の決め方</Link>
            {materials === null && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>数を取得できませんでした（「—」は 0 という意味ではありません）。</p>
            )}
          </section>

          {/* ③ 紹介とメッセージの違い */}
          <section style={{ ...SIDE_CARD, background: "var(--bg-tint, #f8f9fb)" }}>
            <h2 style={{ ...SIDE_H2, marginBottom: 10 }}>紹介とメッセージの違い</h2>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.7 }}>
              <div><dt style={{ fontWeight: 700 }}>OPINIOからの紹介</dt><dd style={{ margin: 0, color: "var(--ink-soft)" }}>OPINIO が合う方に貴社をご紹介します。「話を聞いてみたい」と答えた方だけが届きます。枠は使いません。</dd></div>
              <div><dt style={{ fontWeight: 700 }}>メッセージ</dt><dd style={{ margin: 0, color: "var(--ink-soft)" }}>貴社から理由を添えて送ります。毎月10通まで。相手はそのまま返信できます。</dd></div>
            </dl>
            <Link href="/biz/candidates" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>候補者を探してメッセージを送る</Link>
          </section>
        </aside>
      </div>

    </div>
  );
}

function ProposalCard({ p, open, onToggle }: {
  p: BizProposalView; open: boolean; onToggle: () => void;
}) {
  const c = p.candidate;
  const ended = p.tab === "ended";
  const career = c ? [c.tenureYears != null ? `社会人${c.tenureYears}年` : null, c.roleTrail, c.prefecture].filter(Boolean).join(" ・ ") : "";
  return (
    <article data-state={`proposal-${p.phase}`} className="bpz-card" style={{ opacity: ended ? 0.7 : 1 }}>
      <div className="bpz-head">
        <InitialAvatar name={c?.name ?? "?"} size={48} bgStyle={ended ? "var(--line-soft)" : "var(--royal-100)"} textColor={ended ? "var(--ink-mute)" : "var(--royal)"} />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          {/* ⚠️ 名前が null のときは理由を書かない（本人の設定を企業に伝えないため） */}
          <strong style={{ fontSize: 16, color: ended ? "var(--ink-soft)" : "var(--ink)" }}>{c ? c.name : "候補者（いまはお名前を表示できません）"}</strong>
          {career && <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 2 }}>{career}</div>}
          <div data-state="proposal-status" style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4 }}>
            {fmtMd(p.raisedAt)} ・ {statusLine(p)}
          </div>
        </div>
      </div>

      {p.jobTitle && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>関連する求人：{p.jobTitle}</div>}

      {p.note && (
        <div data-state="candidate-note" style={{ background: "var(--bg-tint, #f4f6f9)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 4 }}>{c ? `${c.name}さん` : "候補者"}からのひとこと</div>
          {p.note}
        </div>
      )}

      {/* ★ご紹介した理由（根拠）。畳んで置く（届いた方のほうが主役） */}
      <div>
        <button type="button" onClick={onToggle} aria-expanded={open} className="btn-fixed-size"
          style={{ border: "none", background: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit" }}>
          {open ? "ご紹介した理由を閉じる" : "ご紹介した理由を見る"}
        </button>
        {open && (
          <div style={{ marginTop: 8, background: "var(--bg-tint, #f4f6f9)", borderRadius: 10, padding: "12px 14px" }}>
            <EvidenceList evidence={p.evidence} counter={p.counter} audience="company" />
          </div>
        )}
      </div>

      <div className="bpz-actions">
        {p.conversationId ? (
          <a href={`/biz/messages/${p.conversationId}`} className="btn-fixed-size" style={{ ...BTN, background: "var(--royal)", color: "#fff", border: "1px solid var(--royal)" }}>メッセージを開く</a>
        ) : null}
        {c && (
          <a href={`/u/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>プロフィールを見る</a>
        )}
      </div>
    </article>
  );
}

const SIDE_CARD: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px" };
const SIDE_H2: React.CSSProperties = { margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--ink)" };
const BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40, padding: "0 18px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" };
