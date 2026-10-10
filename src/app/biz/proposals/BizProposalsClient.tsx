"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EvidenceList, { type CounterView, type EvidenceView } from "@/components/proposals/EvidenceList";
import DeclineSheet from "@/components/proposals/DeclineSheet";
import { InitialAvatar } from "@/components/ui/InitialAvatar";

export type BizProposalView = {
  id: string;
  evidence: EvidenceView[];
  counter: CounterView[];
  /** ★候補者（2026-10-09 / 案B で実名にした）。⚠️ いま見せてはいけない人は null
   *  （サーバーが `can_send_scout()` で判定し、名前を送っていない） */
  candidate: {
    id: string; name: string; headline: string | null;
    /** ★2026-10-11（キャンバス5）。⚠️ 取れなければ null（推測で埋めない） */
    tenureYears: number | null; roleTrail: string | null; prefecture: string | null;
  } | null;
  candidateInterested: boolean;
  /** ★終了したか（2026-10-09）。候補者が見送った／いまは見せてはいけない候補者になった。
   *  ⚠️★**どちらなのかは渡していない**（`lib/evidence/proposalEnded.ts`）。画面にも出さない */
  ended: boolean;
  response: string | null;
  /** 企業が答えた日時 */
  respondedAt: string | null;
  jobTitle: string | null;
  computedAt: string;
  /** ★双方合意で紹介済みなら、その会話の id（2026-09-21）。未紹介は null */
  conversationId: string | null;
  /** 紹介した日時（メッセージが開いた日）。⚠️ 会話が残っているときだけ */
  introducedAt: string | null;
  /** ★回答の締め切りまであと何日（2026-10-10）。終了・両方回答済みなら null（出さない） */
  daysLeft: number | null;
};

/**
 * ★4つの区分（2026-10-11 / キャンバス5）。
 *   waiting … 企業がまだ答えていない（サイドバーのバッジ `lib/business/navBadges.ts` と同じ条件）
 *   theirs  … 企業は「会いたい」、候補者の答え待ち
 *   mutual  … 両方が会いたい（紹介済み・会話あり）
 *   ended   … 終了（候補者の見送り・企業の見送り・締め切り・見せられなくなった。⚠️ どれかは出さない）
 */
type Stage = "waiting" | "theirs" | "mutual" | "ended";
function stageOf(p: BizProposalView): Stage {
  if (p.conversationId) return "mutual";
  if (p.ended || p.response === "declined") return "ended";
  if (p.response === "want_to_meet") return "theirs";
  return "waiting";
}
const TABS: { key: Stage; label: string }[] = [
  { key: "waiting", label: "回答待ち" },
  { key: "theirs", label: "相手の回答待ち" },
  { key: "mutual", label: "メッセージが開いた" },
  { key: "ended", label: "終了" },
];

function fmtMd(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}
/** "2026-09-21" → "9月21日"。⚠️ 形が違えばそのまま返す（推測で直さない） */
function fmtYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ymd;
}

/** 根拠の材料の今の数（`lib/evidence/materials.ts`）。⚠️ null は取得に失敗（「—」と出す。0 と出さない） */
type EvidenceMaterialsView = { path: number; motive: number; talkable: number; jobs: number; roles: number } | null;

export default function BizProposalsClient({
  proposals, loadFailed, materials = null, responseDays,
}: { proposals: BizProposalView[]; loadFailed: boolean; materials?: EvidenceMaterialsView;
  /** 提案の締め切り（日）。⚠️ 値は lib/evidence/proposalEnded.ts の PROPOSAL_RESPONSE_DAYS（サーバー専用なので props で受ける） */
  responseDays: number }) {
  const router = useRouter();
  const [items, setItems] = useState(proposals);
  /* ★答えたあとは server から取り直す（双方合意で会話ができたかはサーバーが決める） */
  useEffect(() => { setItems(proposals); }, [proposals]);
  const [declining, setDeclining] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Stage>("waiting");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const counts = TABS.reduce((acc, t) => ({ ...acc, [t.key]: items.filter((x) => stageOf(x) === t.key).length }), {} as Record<Stage, number>);
  /* ★回答待ちは「候補者が興味あり」を先に出す（2026-09-22）。⚠️ 並べ替えは安定なので、同じ区分の中はサーバーの並び（新しい順）のまま */
  const visible = items
    .filter((x) => stageOf(x) === tab)
    .sort((a, b) => (tab === "waiting" ? Number(b.candidateInterested) - Number(a.candidateInterested) : 0));

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
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, response, respondedAt: new Date().toISOString() } : p)));
      setDeclining(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }
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
        .bpz-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 16px 20px; }
        @media (max-width: 767px) {
          .bpz-main, .bpz-side { flex-basis: 100%; }
          .bpz-row { padding: 14px 16px; }
          .bpz-tab { padding: 0 8px; font-size: 13px; }
        }
      `}</style>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>提案</h1>
        {/* ⚠️★何が・いつ見えるようになるかは、求職者側（`ProposalsClient`）と**同じ事実**を
               向きだけ変えて書いている。**片方だけ直さないこと。**
               ⚠️★「メッセージが開くのは双方が会いたいと答えたとき」は消さないこと */}
        <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
          OPINIO が、御社の求人・部門と候補者の経歴を照らし合わせ、根拠が2つ以上そろった方を御社と候補者の両方にご紹介します。
          候補者のお名前と公開プロフィールは、候補者検索と同じようにご覧いただけます。
          <strong>両方が「会いたい」と答えると、メッセージが開きます。</strong>提案は届いてから{responseDays}日で終了します。
        </p>
      </div>

      {err && (
        <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
          {err}
        </p>
      )}

      <div className="bpz-cols">
        <div className="bpz-main">
          {loadFailed ? (
            <p style={{ fontSize: 14, lineHeight: 1.9, color: "#B3261E", margin: 0 }}>
              提案の読み込みに失敗しました。<strong>「0件」という意味ではありません。</strong>
            </p>
          ) : items.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 18px", fontSize: 14, lineHeight: 1.9 }}>
              <p style={{ margin: "0 0 10px", fontWeight: 600 }}>いまお出しできる提案はありません。</p>
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
                OPINIO は、<strong>根拠を2件以上そろえられた候補者だけ</strong>をご提案します。
                {"根拠になるのは、御社に移ってきた方の人数・在籍している方やしていた方が挙げた入社の決め手・話を聞ける方の人数・御社の求人や部門の職種と同じ経験・ご本人の希望条件との一致・御社の顧客の業界や事業領域での経験です（業界の経験だけでは提案になりません）。"}
                右の「提案の材料」を増やすと、提案が届きやすくなります。
              </p>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="提案の区分" className="bpz-tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-state={tab === t.key ? "active" : "inactive"}
                    className="bpz-tab btn-fixed-size" onClick={() => setTab(t.key)}>
                    {t.label}
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>{counts[t.key]}</span>
                  </button>
                ))}
              </div>
              {visible.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0" }}>該当する提案はありません。</p>
              )}
              {visible.map((p) => (tab === "waiting"
                ? <WaitingCard key={p.id} p={p} pending={pending} onMeet={() => respond(p.id, "want_to_meet")} onDecline={() => setDeclining(p.id)} />
                : <AnsweredRow key={p.id} p={p} stage={tab} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} />))}
            </>
          )}
        </div>

        <aside className="bpz-side">
          <section data-state="evidence-materials" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>提案の材料</h2>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-mute)" }}>登録が多いほど、根拠のある提案が届きやすくなります。</p>
            {/* ★実データから数える（`lib/evidence/materials.ts`）。⚠️ 取得に失敗したら「—」。0 と出さない
                   ⚠️ 企業資料の項目は出さない（いまは提案の根拠に使われていない） */}
            {([
              { key: "jobs", label: "公開中の求人", value: materials?.jobs, unit: "件", href: "/biz/jobs/new", action: "求人を登録する" },
              { key: "roles", label: "職種マスタに紐づいた部門・職種", value: materials?.roles, unit: "件", href: "/biz/organization?tab=roles", action: "部門・職種を登録する" },
              { key: "path", label: "御社に移ってきた方", value: materials?.path, unit: "人", href: "/biz/employees", action: "企業ページに出ている方を確かめる" },
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
            {materials === null && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>数を取得できませんでした（「—」は 0 という意味ではありません）。</p>
            )}
          </section>

          <section style={{ background: "var(--bg-tint, #f8f9fb)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>提案とメッセージリクエストの違い</h2>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.7 }}>
              <div><dt style={{ fontWeight: 700 }}>提案</dt><dd style={{ margin: 0, color: "var(--ink-soft)" }}>OPINIO が根拠をそろえて双方にご紹介します。送れる数の枠は使いません。両方が「会いたい」でメッセージが開きます。</dd></div>
              <div><dt style={{ fontWeight: 700 }}>メッセージリクエスト</dt><dd style={{ margin: 0, color: "var(--ink-soft)" }}>御社から理由を添えて送ります。毎月10通まで。相手が受け入れるとメッセージが開きます。</dd></div>
            </dl>
            <Link href="/biz/candidates" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>候補者を探してメッセージリクエストを送る →</Link>
          </section>
        </aside>
      </div>

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

function CandidateHead({ p, size }: { p: BizProposalView; size: number }) {
  const c = p.candidate;
  const meta = c ? [c.tenureYears != null ? `社会人${c.tenureYears}年` : null, c.roleTrail, c.prefecture].filter(Boolean).join(" ・ ") : "";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: "1 1 240px" }}>
      <InitialAvatar name={c?.name ?? "?"} size={size} bgStyle="var(--royal-100)" textColor="var(--royal)" />
      <div style={{ minWidth: 0 }}>
        {/* ⚠️ 名前が null のときは、理由を書かない（本人の設定を企業に伝えないため） */}
        <strong style={{ fontSize: size >= 48 ? 16 : 15, color: "var(--ink)" }}>{c ? c.name : "候補者（いまはお名前を表示できません）"}</strong>
        {meta && <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 2 }}>{meta}</div>}
      </div>
    </div>
  );
}

function WaitingCard({ p, pending, onMeet, onDecline }: { p: BizProposalView; pending: boolean; onMeet: () => void; onDecline: () => void }) {
  return (
    <article data-state="proposal-waiting" style={{ background: "#fff", border: "2px solid var(--royal)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <CandidateHead p={p} size={48} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--royal)", color: "#fff" }}>新しい提案</span>
            {p.candidateInterested && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--royal-50)", color: "var(--royal)" }}>候補者：興味あり</span>
            )}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
            {fmtYmd(p.computedAt)}{p.daysLeft != null ? ` ・ ${p.daysLeft <= 1 ? "今日で終了" : `あと${p.daysLeft}日で終了`}` : ""}
          </span>
        </div>
      </div>
      {p.jobTitle && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>求人「{p.jobTitle}」への提案</div>}
      <div style={{ background: "var(--bg-tint, #f4f6f9)", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 6 }}>提案の根拠</div>
        <EvidenceList evidence={p.evidence} counter={p.counter} audience="company" />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={onMeet} disabled={pending} className="btn-fixed-size" style={{ ...BTN, background: "var(--royal)", color: "#fff", border: "1px solid var(--royal)" }}>会いたい</button>
        <button type="button" onClick={onDecline} disabled={pending} className="btn-fixed-size" style={{ ...BTN, background: "#fff", color: "var(--royal)", border: "1px solid var(--line)" }}>今回は見送る</button>
        {p.candidate && (
          <a href={`/u/${p.candidate.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", marginLeft: 4 }}>プロフィールを見る</a>
        )}
      </div>
      {/* ★押す前に、押すと何が起きるかを書く（2026-09-22） */}
      {p.candidateInterested && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>候補者はすでに「興味あり」と答えています。「会いたい」と答えるとすぐにメッセージが開きます。</p>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-mute)" }}>見送っても、相手には「この提案は終了しました」とだけ表示されます。</p>
    </article>
  );
}

const STAGE_BADGE: Record<Exclude<Stage, "waiting">, { label: string; style: React.CSSProperties }> = {
  theirs: { label: "相手の回答待ち", style: { background: "var(--warm-soft)", color: "var(--warm-ink)" } },
  mutual: { label: "両方が会いたい", style: { background: "var(--royal-50)", color: "var(--royal)" } },
  ended: { label: "終了", style: { background: "var(--line-soft)", color: "var(--ink-soft)" } },
};

function AnsweredRow({ p, stage, open, onToggle }: { p: BizProposalView; stage: Exclude<Stage, "waiting">; open: boolean; onToggle: () => void }) {
  const badge = STAGE_BADGE[stage];
  /* ⚠️★終了の理由（候補者が見送った等）は書かない */
  const sub = stage === "theirs"
    ? [p.respondedAt ? `${fmtMd(p.respondedAt)}に「会いたい」と回答` : null, p.jobTitle ? `求人：${p.jobTitle}` : null, p.daysLeft != null ? `あと${p.daysLeft}日で終了` : null].filter(Boolean).join(" ・ ")
    : stage === "mutual"
      ? (p.introducedAt ? `${fmtMd(p.introducedAt)}にメッセージが開きました` : "メッセージが開きました")
      : "この提案は終了しました";
  return (
    <article data-state={`proposal-${stage}`} style={{ background: stage === "ended" ? "var(--bg-tint, #f8f9fb)" : "#fff", border: "1px solid var(--line)", borderRadius: 12 }}>
      <div className="bpz-row">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "1 1 260px", minWidth: 0 }}>
          <InitialAvatar name={p.candidate?.name ?? "?"} size={44} bgStyle={stage === "ended" ? "var(--line-soft)" : "var(--royal-100)"} textColor={stage === "ended" ? "var(--ink-mute)" : "var(--royal)"} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15, color: stage === "ended" ? "var(--ink-soft)" : "var(--ink)" }}>{p.candidate ? p.candidate.name : "候補者（いまはお名前を表示できません）"}</strong>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, ...badge.style }}>{badge.label}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 4 }}>{sub}</div>
          </div>
        </div>
        {stage === "mutual" && p.conversationId ? (
          <a href={`/biz/conversations/${p.conversationId}`} className="btn-fixed-size" style={{ ...BTN, background: "var(--royal)", color: "#fff", border: "1px solid var(--royal)" }}>メッセージを開く</a>
        ) : stage === "theirs" ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="btn-fixed-size" style={{ ...BTN, background: "#fff", color: "var(--royal)", border: "1px solid var(--line)" }}>{open ? "閉じる" : "提案の内容を見る"}</button>
        ) : null}
      </div>
      {open && stage === "theirs" && (
        <div style={{ padding: "0 20px 18px" }}>
          <div style={{ background: "var(--bg-tint, #f4f6f9)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 6 }}>提案の根拠</div>
            <EvidenceList evidence={p.evidence} counter={p.counter} audience="company" />
          </div>
          {p.candidate && (
            <a href={`/u/${p.candidate.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>プロフィールを見る</a>
          )}
        </div>
      )}
    </article>
  );
}

const BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40, padding: "0 18px", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" };
