import Link from "next/link";

export type LPMember = {
  id: string;
  name: string;
  avatarColor: string | null;
  roleTitle: string | null;
  companyName: string | null;
  careerFlow: string[] | null;
  quote: string | null;
};

// ─── SVG Icon ───────────────────────────────────────────────────────────────
function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const d: Record<string, React.ReactNode> = {
    talk: (<><path d="M3.2 5.6h11.4v7.6H7.9L4.4 16v-2.8H3.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9.4 8.6h11.4v7.6h-1.2V19l-3.5-2.8h-2.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></>),
    check: <path d="M5 12.6l4.4 4.4L19 6.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>,
    verified: (<><path d="M12 2.6l7.2 2.8v6c0 4.5-3 8.2-7.2 10-4.2-1.8-7.2-5.5-7.2-10v-6L12 2.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8.6 11.8l2.4 2.4 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>),
    why: (<><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M9.4 9.6c.2-1.5 1.3-2.4 2.7-2.4 1.5 0 2.6 1 2.6 2.4 0 2-2.5 2.1-2.6 4.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="12.1" cy="16.8" r="1" fill="currentColor"/></>),
    spark: <path d="M12 3.4l2 5.4 5.4 2-5.4 2-2 5.4-2-5.4-5.4-2 5.4-2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>,
    free: (<><path d="M4 12h9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13.5 12l6.5-5.2V17.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="4" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/></>),
    search: (<><circle cx="10.6" cy="10.6" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15.4 15.4L20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>),
    decide: <path d="M4.5 12.5l4.6 4.6L19.5 6.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>,
    quiet: (<><path d="M6.6 16.4V11a5.4 5.4 0 0110.8 0v5.4h1.4H5.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10.3 19a1.9 1.9 0 003.4 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M4 20L20 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>),
    day: (<><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7.2V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>),
    eval: <path d="M5 18.4V13m4.6 5.4V8.4M14.2 18.4v-7M18.8 18.4V5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>,
    team: (<><circle cx="9" cy="9.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M3.6 18.8c0-3 2.4-5 5.4-5s5.4 2 5.4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M15.4 7.2a3 3 0 010 5.8M16.6 14.4c2.3.5 3.8 2.3 3.8 4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>),
    hard: (<><path d="M12 4.2l8.4 15H3.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 10v3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="16.2" r=".9" fill="currentColor"/></>),
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", color: color ?? "currentColor", flexShrink: 0 }}>
      {d[name]}
    </svg>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────
const C = {
  paper:  "#FBFAF6",
  paper2: "#F2F1EA",
  navy:   "#0E2148",
  navy2:  "#16305F",
  ink:    "#16202F",
  muted:  "#5A6779",
  line:   "#E5E5DF",
  blue:   "#2D5BD8",
  green:  "#0E6B4F",
  amber:  "#C77A2B",
};

const FEATURED = [
  { letter: "S", bg: "linear-gradient(135deg,#00A1E0,#0D74B8)", name: "Salesforce Japan", tag: "CRM・営業支援 ／ 外資SaaS", href: "/companies/salesforce", articles: 1, jobs: 5, members: 1 },
  { letter: "H", bg: "linear-gradient(135deg,#EA580C,#FB923C)",  name: "HubSpot",          tag: "マーケティング自動化 ／ 外資SaaS", href: "/companies/hubspot",    articles: 1, jobs: 3, members: 0 },
  { letter: "S", bg: "linear-gradient(135deg,#0ea5e9,#6366f1)", name: "SmartHR",           tag: "HR Tech ／ 国内SaaS",           href: "/companies/smarthr",    articles: 2, jobs: 0, members: 0 },
];

const ROLES = [
  { label: "フィールドセールス",   href: "/jobs/dept/sales" },
  { label: "インサイドセールス",   href: "/jobs/dept/sales" },
  { label: "カスタマーサクセス",   href: "/jobs/dept/management" },
  { label: "エンタープライズ営業", href: "/jobs/dept/sales" },
  { label: "プロダクトマネージャー", href: "/jobs/dept/product" },
  { label: "マーケティング",       href: "/jobs/dept/marketing" },
  { label: "エンジニア",           href: "/jobs/dept/engineer" },
];

const ASKS = [
  { icon: "why",   color: C.blue,  q: "なぜ、この会社を選んだんですか",  sub: "他社と迷ったか、決め手は何だったか" },
  { icon: "spark", color: C.green, q: "いま、何が面白いですか",           sub: "続けている理由と、手応えを感じる瞬間" },
  { icon: "day",   color: C.amber, q: "1日って、どう流れますか",          sub: "実際の稼働時間、会議の量、リモートの実態" },
  { icon: "eval",  color: C.blue,  q: "どう評価されるんですか",           sub: "目標の決まり方、昇給と昇格のリアル" },
  { icon: "team",  color: C.green, q: "チームは、どんな人たちですか",     sub: "年齢層、雰囲気、意見の言いやすさ" },
  { icon: "hard",  color: C.muted, q: "正直、しんどいのはどこですか",     sub: "やめたくなる瞬間と、それでも続く理由" },
];

const COMPARE = [
  { feature: "求人数",             opinio: "IT・SaaSに絞って掲載", others: "圧倒的に多い",      wins: false },
  { feature: "現役社員と直接話せる", opinio: "できる",             others: "人事とのみ",        wins: true  },
  { feature: "取材による企業情報",  opinio: "全掲載企業",          others: "一部のみ",          wins: true  },
  { feature: "スカウト・営業電話",  opinio: "一切なし",            others: "届く",              wins: true  },
  { feature: "登録に必要なもの",    opinio: "メールアドレスのみ",  others: "職務経歴の入力",    wins: true  },
];

const FAQ = [
  {
    q: "登録すると、何ができるようになりますか？",
    a: "現役社員に直接カジュアル面談を申し込めるようになります。企業情報・求人・取材記事はログイン不要で読めます。登録にはメールアドレスのみ必要で、30秒で完了します。スカウトや営業連絡は一切来ません。",
    open: true,
  },
  {
    q: "面談したことは、今の会社に知られませんか？",
    a: "知られません。企業への申し込みはOPINIO経由であり、面談相手の現役社員は守秘義務があります。あなたの会社に情報が伝わることはありません。",
    open: false,
  },
  {
    q: "転職せずに、現職に残ってもいいですか？",
    a: "もちろんです。OPINIOは「まず知る」ための場所です。調べた結果、今の会社に残るという判断も、私たちは等しく尊重します。残るよう急かす連絡も、転職を勧める連絡も一切ありません。",
    open: false,
  },
  {
    q: "本当に無料で使えますか？",
    a: "はい。メールアドレスの登録だけで、掲載企業の情報にすべて無料でアクセスできます。求職者側の費用は一切かかりません。",
    open: false,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function LandingPage({ members }: { members: LPMember[] }) {
  const memberCount = members.length;

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: '"Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif', WebkitFontSmoothing: "antialiased", lineHeight: 1.8 }}>
      <style>{`
        .lp-hero { padding: 78px 0 92px; border-bottom: 1px solid ${C.line}; position: relative; overflow: hidden; }
        .lp-hero-grid { display: grid; grid-template-columns: 1.03fr 0.97fr; gap: 60px; align-items: center; }
        .lp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .lp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .lp-asks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lp-section { padding: 92px 0; }
        .lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 28px; }
        .lp-thread-box { padding: 44px 40px 34px; }
        .lp-member-flow { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 7px; }
        .lp-member-flow em { font-style: normal; font-size: 11.5px; color: ${C.muted}; background: ${C.paper2}; border-radius: 999px; padding: 2px 8px; }
        .lp-member-flow .lp-dot { width: 4px; height: 4px; border-radius: 50%; background: #CBD5E0; flex-shrink: 0; display: inline-block; }
        .lp-member-quote { margin-top: 8px; display: flex; gap: 7px; align-items: flex-start; }
        .lp-member-quote .lp-ql { color: ${C.blue}; font-size: 17px; line-height: 1.1; flex-shrink: 0; font-family: serif; }
        .lp-member-quote span { font-size: 12px; color: #374357; line-height: 1.6; }
        .lp-cta-bullets { display: inline-flex; flex-direction: column; gap: 11px; text-align: left; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.13); border-radius: 13px; padding: 24px 30px; margin: 24px 0 32px; }
        .lp-cta-btns { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        @media (max-width: 900px) {
          .lp-hero { padding: 52px 0 64px; }
          .lp-hero-grid { grid-template-columns: 1fr; gap: 40px; }
          .lp-grid2 { grid-template-columns: 1fr; }
          .lp-grid3 { grid-template-columns: 1fr; }
          .lp-asks-grid { grid-template-columns: 1fr 1fr; }
          .lp-section { padding: 64px 0; }
          .lp-thread-box { padding: 30px 22px 24px; }
          .lp-wrap { padding: 0 18px; }
          table.lp-cmp th, table.lp-cmp td { padding: 14px 13px; font-size: 13.5px; }
        }
        @media (max-width: 580px) {
          .lp-asks-grid { grid-template-columns: 1fr; }
          .lp-grid3.lp-steps { grid-template-columns: 1fr; }
          .lp-cta-bullets { padding: 20px 22px; }
        }
        details summary::-webkit-details-marker { display: none; }
        details summary::marker { display: none; }
        details[open] summary .lp-faq-arrow { transform: rotate(90deg); }
        .lp-faq-arrow { transition: transform 0.2s; }
      `}</style>

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div className="lp-hero">
        {/* ドット背景 */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5, pointerEvents: "none" }} viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <pattern id="lp-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1.6" cy="1.6" r="1.1" fill="#DFDCD1" />
            </pattern>
            <linearGradient id="lp-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.paper} stopOpacity="1" />
              <stop offset="55%" stopColor={C.paper} stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1440" height="620" fill="url(#lp-dots)" />
          <rect width="1440" height="620" fill="url(#lp-fade)" />
          <path d="M-40 470 C 240 470, 300 300, 560 300 S 900 150, 1180 150 1480 150 1480 150" fill="none" stroke="#C9B896" strokeWidth="1.6" opacity=".55" />
          <circle cx="180" cy="459" r="5" fill={C.paper} stroke="#C9B896" strokeWidth="1.6" />
          <circle cx="560" cy="300" r="5" fill={C.paper} stroke="#C9B896" strokeWidth="1.6" />
          <circle cx="960" cy="176" r="5" fill={C.paper} stroke="#C9B896" strokeWidth="1.6" />
        </svg>

        <div className="lp-wrap lp-hero-grid" style={{ position: "relative" }}>
          {/* 左: コピー */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 22, textTransform: "uppercase" }}>IT・SaaS業界のキャリアプラットフォーム</div>
            <h1 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(29px, 3.5vw, 49px)", lineHeight: 1.44, letterSpacing: "-0.01em", color: C.navy, marginBottom: 24 }}>
              求人票に書いていないことは、<br />そこで働く人に聞く。
            </h1>
            <p style={{ fontSize: 16.5, color: "#374357", marginBottom: 34, maxWidth: "30em", lineHeight: 1.8 }}>
              取材記事、現役社員のキャリア、そして本人との面談。<br />応募を決める前に、中身を確かめられます。
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
              <Link href="/people" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.navy, color: "#fff", padding: "16px 30px", borderRadius: 8, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>
                話を聞ける人を見る
                <Icon name="talk" size={17} />
              </Link>
              <Link href="/auth" style={{ color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, fontSize: 14.5, fontWeight: 500 }}>
                メールアドレスだけで登録（30秒）
              </Link>
            </div>
            <p style={{ marginTop: 22, fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="quiet" size={17} color={C.green} />
              登録しても、企業から連絡が来ることはありません。スカウトも営業電話もゼロです。
            </p>
          </div>

          {/* 右: 話を聞ける人カード（DB動的） */}
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: "0 20px 50px rgba(14,33,72,.10)", overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: C.paper2 }}>
              <strong style={{ fontSize: 13.5, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 9 }}>
                <Icon name="talk" size={17} color={C.navy} />
                いま話を聞ける現役社員
              </strong>
              {memberCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: "#E2F1EB", padding: "5px 12px", borderRadius: 999 }}>
                  {memberCount}名が面談可
                </span>
              )}
            </div>

            {members.map((m) => (
              <div key={m.id} style={{ padding: "16px 22px", borderBottom: `1px solid #F1F1EC` }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: m.avatarColor ?? `linear-gradient(135deg,${C.navy},${C.blue})`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: '"Poppins", sans-serif' }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ position: "absolute", right: -4, bottom: -4, width: 18, height: 18, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.18)" }}>
                      <Icon name="check" size={11} color={C.green} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5, color: C.navy }}>
                      {m.roleTitle ?? "メンバー"}{m.companyName ? ` ／ ${m.companyName}` : ""}
                    </div>
                    {/* Career flow */}
                    {m.careerFlow && m.careerFlow.length > 0 && (
                      <div className="lp-member-flow">
                        {m.careerFlow.map((co, i) => (
                          <span key={i} style={{ display: "contents" }}>
                            {i > 0 && <span className="lp-dot" />}
                            <em>{co}</em>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Quote / theme */}
                    {m.quote && (
                      <div className="lp-member-quote">
                        <span className="lp-ql">&#8220;</span>
                        <span>{m.quote}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ padding: "18px 22px" }}>
              <Link href="/people" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.navy, color: "#fff", borderRadius: 8, padding: "14px", textDecoration: "none", fontWeight: 700, fontSize: 14.5 }}>
                この人たちに話を聞く →
              </Link>
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 11.5, color: C.muted }}>会うかどうかも、会ってから動くかも、あなた次第です</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ S2: 現役社員に聞ける + CAREER THREAD ════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>OPINIOにしかないもの</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>
              答えるのは人事ではなく、<br />いまその席に座っている人です。
            </h2>
            <p style={{ marginTop: 16, color: C.muted, fontSize: 15.5 }}>会社が在籍を認証した現役社員が、あなたの質問に答えます。</p>
          </div>

          {/* CAREER THREAD box */}
          <div className="lp-thread-box" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, color: C.muted, marginBottom: 6 }}>CAREER THREAD</div>
            <div style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 21, fontWeight: 600, color: C.navy, marginBottom: 26 }}>この人が、なぜここにいるのか。</div>
            <div style={{ overflowX: "auto" }}>
              <svg viewBox="0 0 1000 210" style={{ width: "100%", minWidth: 480, height: "auto" }} role="img" aria-label="みずほ証券からSalesforceを経て伊藤忠テクノソリューションズへ至るキャリアの軌跡">
                <path d="M60 150 C 200 150, 220 96, 360 96 S 560 62, 700 62 S 880 62, 940 62" fill="none" stroke="#C9B896" strokeWidth="2" />
                <circle cx="60"  cy="150" r="7"  fill={C.paper} stroke="#C9B896" strokeWidth="2" />
                <text x="60"  y="180" textAnchor="middle" fontFamily="Noto Sans JP" fontSize="14" fill={C.muted}>みずほ証券</text>
                <text x="60"  y="200" textAnchor="middle" fontFamily="Poppins"    fontSize="12" fill="#A9AEB8">2016</text>
                <circle cx="360" cy="96"  r="7"  fill={C.paper} stroke="#C9B896" strokeWidth="2" />
                <text x="360" y="126" textAnchor="middle" fontFamily="Noto Sans JP" fontSize="14" fill={C.muted}>Salesforce</text>
                <text x="360" y="146" textAnchor="middle" fontFamily="Poppins"    fontSize="12" fill="#A9AEB8">2021</text>
                <circle cx="700" cy="62"  r="10" fill={C.navy} />
                <circle cx="700" cy="62"  r="17" fill="none" stroke={C.navy} strokeWidth="1.5" opacity=".28" />
                <text x="700" y="36"  textAnchor="middle" fontFamily="Noto Sans JP" fontSize="14" fontWeight="700" fill={C.navy}>伊藤忠テクノソリューションズ</text>
                <text x="700" y="94"  textAnchor="middle" fontFamily="Noto Sans JP" fontSize="13" fill={C.muted}>現職・エンタープライズ営業</text>
                <rect x="768" y="112" width="212" height="66" rx="12" fill="#fff" stroke={C.line} />
                <path d="M800 112 l-12 -14 l0 14 z" fill="#fff" stroke={C.line} />
                <text x="788" y="140" fontFamily="Noto Sans JP" fontSize="13" fill={C.ink}>「なぜ証券から</text>
                <text x="788" y="162" fontFamily="Noto Sans JP" fontSize="13" fill={C.ink}>SaaSに移ったか」</text>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: C.muted, marginTop: 14 }}>経歴が一本の線で見えるから、「なぜこの会社を選んだのか」を、その人自身に聞けます。</p>
          </div>

          {/* 4 feature cards */}
          <div className="lp-grid2">
            {[
              { icon: "verified", bg: "#E8EEFC", fg: C.blue,  title: "所属が認証されている",       body: "本人が勝手に名乗っているのではなく、企業側が在籍を確認したうえで公開しています。匿名の口コミサイトとは、情報の出どころが違います。" },
              { icon: "why",      bg: "#E2F1EB", fg: C.green, title: "入社の理由が、聞ける",         body: "なぜ数ある会社の中でここを選んだのか。入ってみて何が想像どおりで、何が違ったのか。求人票にも面接にも出てこない話です。" },
              { icon: "spark",    bg: "#FBEEDF", fg: C.amber, title: "やりがいを、本人の言葉で",     body: "会社が用意した文章ではなく、いま働いている人が自分の言葉で語ります。何が面白くて、何がしんどいのかまで含めて。" },
              { icon: "free",     bg: "#EDEDE7", fg: C.muted, title: "話を聞いても、応募しなくていい", body: "面談は選考と切り離されています。進む義務はありません。「今は動かない」という結論も、この場では正解です。" },
            ].map((f) => (
              <div key={f.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 15, padding: 32 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: f.bg, display: "grid", placeItems: "center", marginBottom: 20 }}>
                  <Icon name={f.icon} size={24} color={f.fg} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: C.navy }}>{f.title}</h3>
                <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ S3: 面談で聞けること ════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>面談で聞けること</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>面接では、聞けないこと。</h2>
            <p style={{ marginTop: 16, color: C.muted, fontSize: 15.5 }}>評価される場ではないので、こういう質問ができます。</p>
          </div>
          <div className="lp-asks-grid">
            {ASKS.map((a) => (
              <div key={a.q} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: "22px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, background: C.paper2, display: "grid", placeItems: "center" }}>
                  <Icon name={a.icon} size={20} color={a.color} />
                </div>
                <div>
                  <b style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: C.navy, lineHeight: 1.6 }}>{a.q}</b>
                  <span style={{ fontSize: 13, color: C.muted }}>{a.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ S4: 掲載企業 ════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>掲載企業</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>企業の「中身」が、ここに揃う。</h2>
            <p style={{ marginTop: 16, color: C.muted, fontSize: 15.5 }}>取材記事・求人・そこで働く人のキャリアが、ひとつの企業ページに集まっています。</p>
          </div>
          <div className="lp-grid3">
            {FEATURED.map((c) => (
              <Link key={c.href} href={c.href} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: "26px 24px", textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: c.bg, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>{c.letter}</div>
                  <div>
                    <b style={{ fontSize: 15.5, color: C.navy, lineHeight: 1.5, display: "block" }}>{c.name}</b>
                    <small style={{ color: C.muted, fontSize: 12, fontWeight: 400, display: "block" }}>{c.tag}</small>
                  </div>
                </div>
                <div style={{ fontSize: 13.5, color: "#3E4A5C", paddingTop: 16, borderTop: "1px solid #F0F0EB", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span><span style={{ color: C.muted }}>取材記事 </span><strong style={{ color: C.navy, fontFamily: '"Poppins",sans-serif' }}>{c.articles}</strong></span>
                  <span><span style={{ color: C.muted }}>求人 </span><strong style={{ color: C.navy, fontFamily: '"Poppins",sans-serif' }}>{c.jobs}</strong></span>
                  <span><span style={{ color: C.muted }}>話せる人 </span><strong style={{ color: C.navy, fontFamily: '"Poppins",sans-serif' }}>{c.members}</strong></span>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center", marginTop: 34 }}>
            {ROLES.map((r) => (
              <Link key={r.label} href={r.href} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 19px", fontSize: 13.5, color: C.ink, textDecoration: "none" }}>
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ S5: 使い方3ステップ ══════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>使い方</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>調べて、聞いて、あなたが決める</h2>
          </div>
          <div className="lp-grid3 lp-steps">
            {[
              { bg: C.navy,    icon: "search", lab: "STEP 01 ・ 調べる", title: "内側を、知る",           body: "取材記事・求人票・社員のキャリアが一か所に。登録なしでも読めます。",               href: "/companies" },
              { bg: "#1F2B3E", icon: "talk",   lab: "STEP 02 ・ 聞く",  title: "本人に、聞く",           body: "気になった会社の現役社員に面談を申し込む。ここからは登録が必要です。",             href: "/people"    },
              { bg: C.green,   icon: "decide", lab: "STEP 03 ・ 決める", title: "自分のペースで、決める", body: "応募する、残る、保留する。急かされないので、どれを選んでも納得できます。",           href: "/companies" },
            ].map((s) => (
              <Link key={s.title} href={s.href} style={{ display: "block", background: s.bg, borderRadius: 15, padding: "32px 28px", color: "#fff", textDecoration: "none" }}>
                <div style={{ marginBottom: 18 }}>
                  <Icon name={s.icon} size={30} color="#fff" />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", opacity: 0.6, marginBottom: 10, textTransform: "uppercase" }}>{s.lab}</div>
                <h3 style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 21, fontWeight: 600, marginBottom: 11 }}>{s.title}</h3>
                <p style={{ fontSize: 14, opacity: 0.86, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ S6: 比較テーブル ══════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>他のサービスとの違い</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>なぜ、OPINIOなのか。</h2>
            <p style={{ marginTop: 16, color: C.muted, fontSize: 15.5 }}>勝てないところも書いています。</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="lp-cmp" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 15, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ padding: "19px 22px", textAlign: "left", fontSize: 13, color: C.muted, fontWeight: 700, background: C.paper2, borderBottom: "1px solid #F0F0EB" }} />
                  <th style={{ padding: "19px 22px", textAlign: "left", fontSize: 14, color: "#fff", fontWeight: 700, background: C.navy, borderBottom: "1px solid #F0F0EB" }}>OPINIO</th>
                  <th style={{ padding: "19px 22px", textAlign: "left", fontSize: 13, color: C.muted, fontWeight: 700, background: C.paper2, borderBottom: "1px solid #F0F0EB" }}>大手転職サービス</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => {
                  const border = i < COMPARE.length - 1 ? "1px solid #F0F0EB" : "none";
                  return (
                    <tr key={i}>
                      <th style={{ padding: "19px 22px", textAlign: "left", fontSize: 14.5, color: C.ink, fontWeight: 500, borderBottom: border }}>{row.feature}</th>
                      <td style={{ padding: "19px 22px", background: "#F7F9FE", fontSize: 14.5, fontWeight: 500, color: row.wins ? C.green : C.amber, borderBottom: border }}>{row.opinio}</td>
                      <td style={{ padding: "19px 22px", fontSize: 14.5, color: C.muted, borderBottom: border }}>{row.others}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 22, fontSize: 13.5, color: C.muted, textAlign: "center" }}>
            求人の量で選ぶなら、大手のほうが向いています。OPINIOは「1社を深く知ってから決めたい人」のためのサービスです。
          </p>
        </div>
      </section>

      {/* ══ S7: FAQ ════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: C.blue, marginBottom: 16, textTransform: "uppercase" }}>よくあるご質問</div>
            <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontWeight: 600, fontSize: "clamp(25px,3vw,38px)", lineHeight: 1.45, color: C.navy }}>正直に、お答えします</h2>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {FAQ.map((item, i) => (
              <details key={i} open={item.open} style={{ borderBottom: `1px solid ${C.line}`, padding: "22px 0" }}>
                <summary style={{ cursor: "pointer", fontSize: 16, fontWeight: 700, color: C.navy, display: "flex", gap: 14, alignItems: "flex-start", listStyle: "none", userSelect: "none" }}>
                  <span style={{ color: C.blue, fontFamily: '"Poppins", sans-serif', flexShrink: 0 }}>Q.</span>
                  <span style={{ flex: 1 }}>{item.q}</span>
                  <span className="lp-faq-arrow" style={{ fontSize: 18, color: C.muted, flexShrink: 0, marginTop: 1 }}>›</span>
                </summary>
                <p style={{ fontSize: 14.5, color: "#3E4A5C", paddingLeft: 30, marginTop: 13, lineHeight: 1.8 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.navy, color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* 背景グラデーション */}
        <div style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -20%, #1e3a8a, transparent 60%)", opacity: 0.5 }} />
        {/* 装飾SVG（キャリアの軌跡） */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M-40 320 C 200 320, 260 200, 480 200 S 760 100, 1000 100 1240 100 1240 100" fill="none" stroke="#fff" strokeWidth="1.5" />
          <circle cx="120"  cy="310" r="4" fill="#fff" />
          <circle cx="480"  cy="200" r="4" fill="#fff" />
          <circle cx="840"  cy="120" r="6" fill="#fff" />
          <circle cx="840"  cy="120" r="14" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>

        <div style={{ position: "relative", maxWidth: 780, margin: "0 auto", padding: "0 28px" }}>
          <h2 style={{ fontFamily: '"Noto Serif JP", serif', fontSize: "clamp(27px,3.4vw,42px)", fontWeight: 600, color: "#fff", marginBottom: 20 }}>深く知ってから、動く。</h2>
          <p style={{ color: "#B9C6DE", fontSize: 16, lineHeight: 1.8, marginBottom: 14 }}>今のキャリアを、無理に変えなくてもいい。<br />まずは知ることから、はじめよう。</p>

          <div className="lp-cta-bullets">
            <b style={{ color: "#fff", display: "block", marginBottom: 3 }}>登録すると、できること</b>
            {[
              "現役社員に面談を申し込める",
              "気になる企業を保存して比較できる",
              "新しく話せる人が増えたら通知が届く",
            ].map((t) => (
              <span key={t} style={{ color: "#C6D2E8", display: "flex", alignItems: "center", gap: 11, fontSize: 14.5 }}>
                <Icon name="check" size={16} color={C.green} />
                {t}
              </span>
            ))}
          </div>

          <div className="lp-cta-btns">
            <Link href="/auth" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: C.navy, padding: "16px 30px", borderRadius: 8, fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>
              メールアドレスで無料登録（30秒）
            </Link>
            <Link href="/companies" style={{ fontSize: 14, color: "#B9C6DE", textDecoration: "underline", textUnderlineOffset: 4 }}>
              先に企業を見てみる →
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
