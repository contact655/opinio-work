import Link from "next/link";
import { devOnly } from "../guard";

/**
 * 求人詳細の並び替えの見本（2026-11-25 / 柴さんの指示「並び替えの見本を作って」）。
 *
 * ★この並びは 2026-11-25 に本番の求人ページ（components/jobs/JobDetailView.tsx）へ入れた（柴さんの了承）。決めたときの見本として残す。
 *   ?v=now … いまの並び（2026-11-25 時点）／ 既定 … 見本の並び
 *
 * 見本で変えていること:
 *   ① 判断に使う情報を上へ: ポイント → なぜ今採用するか → 入社後90日 → 一緒に働く人 → 仕事内容 → 勤務条件 → 選考 → 労働条件
 *   ② 見出しを1つの形にそろえる（いまは「明朝＋アイコンの枠」と「青い帯の小さな見出し」が混ざっている）
 *   ③ 「チーム構成」「Hiring Manager」「採用担当者」「この職種の人」を「一緒に働く人」の1つの枠にまとめる
 *   ④ 労働条件（決まった文の並ぶ表）は最初は畳んでおく
 *
 * ⚠️ ここで DB を読まないこと。固定データだけ（会社・人はすべて架空）。
 */

type Block = { key: string; node: React.ReactNode };

const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)",
};

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 16px", fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--royal-50)", color: "var(--royal)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      {children}
    </h2>
  );
}

/* いまの「青い帯の小さな見出し」（入社後90日・チーム構成・なぜ今採用するか） */
function BandCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: "var(--royal-50)", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>{title}</div>
      <div style={{ padding: "16px 20px", fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>{children}</div>
    </section>
  );
}

const I = {
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  why: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
  flag: <><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></>,
  people: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  check: <><rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="8 12 11 15 16 9" /></>,
  scale: <><path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z" /></>,
};

/* ── 固定データ（架空） ── */
const POINTS = [
  "顧客と直接話して、要件定義から設計まで任される",
  "入社3か月でPLに上がった人が複数いる",
  "受注案件の過半数がAI関連。本番運用の経験が積める",
];
const WHY = "事業の拡大にあわせて、設計から任せられるエンジニアを増やします。いまは案件の数に対して、要件定義を担える人が足りていません。";
const DAYS90 = "1か月目は研修で Salesforce の開発を学びます。2か月目から既存案件に入り、3か月目にはひとつの機能の設計を担当してもらう想定です。";
const OVERVIEW = [
  "■ このポジションについて",
  "Salesforce の開発案件で、顧客の業務の整理から要件定義・設計・実装・テスト・本番後の改善までを一気通貫で担当します。",
  "■ 業務内容",
  "・顧客業務の構造整理／要件定義・業務フロー設計",
  "・Salesforce 上での実装",
  "・AI エージェントを使った業務の設計",
];

function PointsCard() {
  return (
    <section style={{ ...CARD, background: "linear-gradient(135deg, #f0f4ff 0%, var(--royal-50) 100%)", border: "1.5px solid var(--royal-100)" }}>
      <Title icon={I.star}>この募集のポイント</Title>
      <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 15, lineHeight: 1.7, color: "var(--ink)", fontWeight: 600 }}>
        {POINTS.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </section>
  );
}

function TextCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section style={CARD}>
      <Title icon={icon}>{title}</Title>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--ink)" }}>{text}</p>
    </section>
  );
}

function Person({ initial, name, role, tag }: { initial: string; name: string; role: string; tag?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 12, minWidth: 0 }}>
      <span style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--royal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{initial}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role}</div>
        {tag && <div style={{ marginTop: 4, display: "inline-block", fontSize: 11, fontWeight: 700, color: "var(--royal)", background: "var(--royal-50)", borderRadius: 100, padding: "2px 8px" }}>{tag}</div>}
      </div>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", margin: "18px 0 8px" }}>{children}</div>;
}

const PEOPLE_GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 };

/* ③ 一緒に働く人（チーム構成・Hiring Manager・採用担当者・この職種の人をまとめた枠） */
function PeopleCard() {
  return (
    <section style={CARD}>
      <Title icon={I.people}>一緒に働く人</Title>
      <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.8 }}>
        <span style={{ fontWeight: 700 }}>チーム構成：</span>PM 1名・エンジニア 4名
      </div>
      <SubHead>この募集の Hiring Manager</SubHead>
      <div style={PEOPLE_GRID}>
        <Person initial="佐" name="佐藤 一郎" role="開発部 マネージャー" tag="採用中" />
      </div>
      <SubHead>採用担当者</SubHead>
      <div style={PEOPLE_GRID}>
        <Person initial="山" name="山田 花子" role="人事部" />
      </div>
      <SubHead>この職種の現役社員</SubHead>
      <div style={PEOPLE_GRID}>
        <Person initial="鈴" name="鈴木 次郎" role="エンジニア・入社2年" />
        <Person initial="高" name="高橋 三郎" role="エンジニア・入社1年" />
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>この職種を経験して退職した方は、まだ登録されていません。</p>
    </section>
  );
}

function OverviewCard() {
  return (
    <section style={CARD}>
      <Title icon={I.doc}>仕事内容</Title>
      <div style={{ fontSize: 15, lineHeight: 1.9, color: "var(--ink)" }}>
        {OVERVIEW.map((l) => l.startsWith("■")
          ? <div key={l} style={{ fontWeight: 700, margin: "14px 0 4px" }}>{l}</div>
          : <div key={l}>{l}</div>)}
      </div>
    </section>
  );
}

function ConditionsCard() {
  const rows = [["勤務地", "大阪府大阪市北区堂島1-1-1 サンプルビル2階"], ["働き方", "フル出社"], ["雇用形態", "正社員"], ["休日・休暇", "完全週休2日制（土日祝）・年間休日125日"]];
  return (
    <section style={CARD}>
      <Title icon={I.monitor}>勤務条件</Title>
      <div style={{ padding: 16, borderRadius: 12, background: "var(--royal-50)", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>想定年収</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--royal)" }}>400〜600万円</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{k}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SelectionCard() {
  const steps = ["書類選考・WEBテスト", "1次面接", "2次面接", "最終面接"];
  return (
    <section style={CARD}>
      <Title icon={I.check}>選考フロー</Title>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={s} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "var(--ink-soft)" }}>{i + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const LEGAL_ROWS = [["契約期間", "期間の定めなし"], ["就業場所の変更の範囲", "会社の定める場所"], ["業務の変更の範囲", "会社の定める業務"], ["休憩時間", "60分"], ["時間外労働", "あり"], ["固定残業代", "あり（月20時間分。超過分は追加で支給）"], ["社会保険", "健康保険・厚生年金・雇用保険・労災保険"], ["受動喫煙防止の措置", "屋内禁煙"]];

function LegalCard({ folded }: { folded: boolean }) {
  const table = (
    <dl style={{ margin: 0 }}>
      {LEGAL_ROWS.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 16, padding: "10px 0", borderTop: "1px solid var(--line-soft, #F1F5F9)", fontSize: 13 }}>
          <dt style={{ width: 160, flexShrink: 0, color: "var(--ink-mute)", fontWeight: 600 }}>{k}</dt>
          <dd style={{ margin: 0, color: "var(--ink)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
  if (!folded) return <section style={CARD}><Title icon={I.scale}>労働条件</Title>{table}</section>;
  return (
    <section style={CARD}>
      <details>
        <summary style={{ cursor: "pointer", listStyle: "none" }}>
          <Title icon={I.scale}>労働条件</Title>
          <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>契約期間・休憩・固定残業代・社会保険などを見る ▾</span>
        </summary>
        <div style={{ marginTop: 12 }}>{table}</div>
      </details>
    </section>
  );
}

function PeopleNow() {
  return (
    <>
      <section style={CARD}>
        <Title icon={I.people}>この職種の現役社員</Title>
        <div style={PEOPLE_GRID}>
          <Person initial="鈴" name="鈴木 次郎" role="エンジニア・入社2年" />
          <Person initial="高" name="高橋 三郎" role="エンジニア・入社1年" />
        </div>
      </section>
      <section style={CARD}>
        <Title icon={I.people}>この職種のOB・OG</Title>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>この職種を経験して退職された方は、まだ登録されていません。</p>
      </section>
    </>
  );
}

function RecruiterNow() {
  return (
    <section style={CARD}>
      <Title icon={I.people}>採用担当者</Title>
      <div style={PEOPLE_GRID}><Person initial="山" name="山田 花子" role="人事部" /></div>
    </section>
  );
}

const NOW: Block[] = [
  { key: "points", node: <PointsCard /> },
  { key: "overview", node: <OverviewCard /> },
  { key: "hm", node: <section style={CARD}><Title icon={I.people}>この募集の Hiring Manager</Title><div style={PEOPLE_GRID}><Person initial="佐" name="佐藤 一郎" role="開発部 マネージャー" /></div></section> },
  { key: "people", node: <PeopleNow /> },
  { key: "conditions", node: <ConditionsCard /> },
  { key: "legal", node: <LegalCard folded={false} /> },
  { key: "90", node: <BandCard title="入社後90日でやること">{DAYS90}</BandCard> },
  { key: "team", node: <BandCard title="チーム構成">PM 1名・エンジニア 4名</BandCard> },
  { key: "why", node: <BandCard title="なぜ今採用するか">{WHY}</BandCard> },
  { key: "selection", node: <SelectionCard /> },
  { key: "recruiter", node: <RecruiterNow /> },
];

const PROPOSED: Block[] = [
  { key: "points", node: <PointsCard /> },
  { key: "why", node: <TextCard icon={I.why} title="なぜ今採用するか" text={WHY} /> },
  { key: "90", node: <TextCard icon={I.flag} title="入社後90日でやること" text={DAYS90} /> },
  { key: "people", node: <PeopleCard /> },
  { key: "overview", node: <OverviewCard /> },
  { key: "conditions", node: <ConditionsCard /> },
  { key: "selection", node: <SelectionCard /> },
  { key: "legal", node: <LegalCard folded /> },
];

const NOW_ORDER = "ポイント → 仕事内容 → Hiring Manager → この職種の人 → 勤務条件 → 労働条件 → 入社後90日 → チーム構成 → なぜ今 → 選考 → 採用担当者";
const PROPOSED_ORDER = "ポイント → なぜ今 → 入社後90日 → 一緒に働く人 → 仕事内容 → 勤務条件 → 選考 → 労働条件（畳む）";

export default function Page({ searchParams }: { searchParams: { v?: string } }) {
  devOnly();
  const isNow = searchParams.v === "now";
  const blocks = isNow ? NOW : PROPOSED;
  const tab = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 700, textDecoration: "none",
    border: "1px solid var(--line)", background: active ? "var(--royal)" : "#fff", color: active ? "#fff" : "var(--ink)",
  });
  return (
    <main style={{ background: "var(--bg-tint, #F8FAFC)", minHeight: "100vh", padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>求人詳細の並び替え（見本）</h1>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          この並びは本番の求人ページに入れました（2026-11-25）。会社・人はすべて架空です。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Link href="/dev/preview/job-detail-order" style={tab(!isNow)} data-state="order-proposed">見本の並び</Link>
          <Link href="/dev/preview/job-detail-order?v=now" style={tab(isNow)} data-state="order-now">いまの並び</Link>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>{isNow ? NOW_ORDER : PROPOSED_ORDER}</p>

        <div className="jdo-layout">
          <style>{`
            .jdo-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
            .jdo-side { position: sticky; top: 16px; }
            @media (max-width: 1023px) { .jdo-layout { grid-template-columns: minmax(0, 1fr); } .jdo-side { display: none; } }
          `}</style>
          <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
            {blocks.map((b) => <div key={b.key}>{b.node}</div>)}
          </div>
          <aside className="jdo-side" style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>サンプル株式会社</div>
            <div style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 14px" }}>Salesforce エンジニア（PL候補）</div>
            <div style={{ padding: 12, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)", color: "#fff", textAlign: "center", fontWeight: 700, fontSize: 14 }}>話を聞く（カジュアル面談）</div>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 10, border: "1px solid var(--line)", textAlign: "center", fontWeight: 700, fontSize: 14, color: "var(--royal)" }}>この募集に応募する →</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
