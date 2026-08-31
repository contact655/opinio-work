import React from "react";

/*
 * ═══ 企業向けLP の図版（組織図 / 職歴年表） ═══════════════════════════════
 *
 * 2026-08-31 新設。トップを「提案」1本に絞った刷新で、
 * 製品UIのキャプチャに代えて**仕組みを説明する図**を置いた。
 *
 * ⚠️★**実在の個人・企業を描かないこと。** ここに出てくる経歴（外資SaaS →
 *    国内SaaS → SIer）は**仕組みを示すための例**であって、実データではない。
 *    実ユーザーの職歴を写すと、LPは公開かつインデックス対象なので
 *    本人の同意なく経歴を公開することになる。
 *    → 図の直下に「実在の特定個人を示すものではない」注記を置いてある。**外さないこと。**
 *
 * ⚠️★**色をハードコードしないこと。** すべて既存のカラートークン
 *    （`--royal` / `--royal-100` / `--ink-soft` / `--line` / `--bg-tint`）を参照する。
 *    アクセントは1色（ネイビー）＋無彩色だけ。**色を増やさない。**
 *    階層は**濃淡・線幅・破線**で出す。グラデーションと影は使わない。
 *
 * ⚠️★**広い画面と狭い画面で別の図を出す。1枚を縮小して回さないこと。**
 *    680 幅の図を 390px の画面に入れると倍率が約 0.50 になり、
 *    **13px の文字が実効 6.5px になって読めない。**
 *    狭い側は viewBox 自体を狭くして（320）、情報も落としてある
 *    （組織図は「営業チーム＋空席」だけ）。
 *    ⚠️ 片方だけ直さないこと。文言を変えるときは必ず2枚とも直す。
 *
 * ⚠️ `width:100%; height:auto` で流し込む。中の座標は固定でよい。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ── 共有トークン（ここ以外に色を書かない） ──────────────────────────────── */
const ACCENT = "var(--royal)";        // 焦点・空席・矢印
const SOFT = "var(--royal-100)";      // 焦点でない人
const LINE = "var(--line)";           // 組織のつながり
const TEXT = "var(--ink-soft)";       // ラベル
const MUTE = "var(--ink-mute)";       // 補足
const CARD = "var(--bg-tint)";        // 職歴カードの下地（枠線なし）

/**
 * 人のマーク。**単なる円にしない**（円＋頭の小円＋肩の弧）。
 * @param focus 濃い塗り（いま焦点を当てているチーム）
 */
function Person({ cx, cy, r, focus }: { cx: number; cy: number; r: number; focus?: boolean }) {
  const headR = r * 0.28;
  const headY = cy - r * 0.3;
  const shoulderR = r * 0.47;
  const shoulderY = cy + r * 0.55;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={focus ? ACCENT : SOFT} />
      <circle cx={cx} cy={headY} r={headR} fill={focus ? "#fff" : ACCENT} fillOpacity={focus ? 1 : 0.5} />
      <path
        d={`M ${cx - shoulderR} ${shoulderY} a ${shoulderR} ${shoulderR} 0 0 1 ${shoulderR * 2} 0`}
        fill={focus ? "#fff" : ACCENT}
        fillOpacity={focus ? 1 : 0.5}
      />
    </g>
  );
}

/** 空席。破線の円＋中央の「＋」。⚠️ 破線をやめないこと（実在の席と区別が付かなくなる） */
function EmptySeat({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const a = r * 0.42;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3 3" />
      <line x1={cx - a} y1={cy} x2={cx + a} y2={cy} stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy - a} x2={cx} y2={cy + a} stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/* ══ 組織図（FV） ═══════════════════════════════════════════════════════ */

const svgBox: React.CSSProperties = { width: "100%", height: "auto", display: "block" };

/** 広い画面用。会社 → 3チーム。営業だけ濃くして、その末尾に空席を置く。 */
function OrgChartWide() {
  const teams = [
    { label: "開発", cx: 140, seats: [80, 120, 160, 200], focus: false },
    { label: "CS",   cx: 340, seats: [300, 340, 380],      focus: false },
    { label: "営業", cx: 540, seats: [480, 520, 560],      focus: true  },
  ];
  const EMPTY_X = 600;
  return (
    <svg viewBox="0 0 680 250" style={svgBox} role="img"
      aria-label="自社の組織図。開発・CS・営業の3チームが並び、営業チームに1つ空席がある。">
      {/* 会社ノード */}
      <rect x={294} y={16} width={92} height={30} rx={6} fill={ACCENT} />
      <text x={340} y={36} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">自社</text>

      {/* 幹 → 横バス → 枝 */}
      <line x1={340} y1={46} x2={340} y2={70} stroke={LINE} strokeWidth={1.5} />
      <line x1={140} y1={70} x2={540} y2={70} stroke={LINE} strokeWidth={1.5} />
      {teams.map((t) => (
        <line key={t.label} x1={t.cx} y1={70} x2={t.cx} y2={88} stroke={LINE} strokeWidth={1.5} />
      ))}

      {teams.map((t) => (
        <g key={t.label}>
          <text x={t.cx} y={104} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>{t.label}</text>
          {t.seats.map((x) => <Person key={x} cx={x} cy={152} r={16} focus={t.focus} />)}
        </g>
      ))}

      {/* 空席（営業の末尾）と引き出し線 */}
      <EmptySeat cx={EMPTY_X} cy={152} r={16} />
      <line x1={EMPTY_X} y1={172} x2={EMPTY_X} y2={196} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3 3" />
      <text x={EMPTY_X} y={214} textAnchor="middle" fontSize={13} fontWeight={700} fill={ACCENT}>ここが空いている</text>
    </svg>
  );
}

/**
 * 狭い画面用。**営業チームと空席だけ**に落とす。
 * ⚠️ 3チームを 390px に押し込むと文字が実効 6.5px になって読めない。
 */
function OrgChartNarrow() {
  const seats = [67, 129, 191];
  const EMPTY_X = 253;
  return (
    <svg viewBox="0 0 320 240" style={svgBox} role="img"
      aria-label="自社の営業チーム。3名が並び、1つ空席がある。">
      <rect x={116} y={12} width={88} height={30} rx={6} fill={ACCENT} />
      <text x={160} y={32} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">自社</text>

      <line x1={160} y1={42} x2={160} y2={66} stroke={LINE} strokeWidth={1.5} />
      <text x={160} y={84} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>営業</text>

      {/* ⚠️ 縦線だけで終わらせないこと。横バスと枝が無いと、線が席の手前で
             宙ぶらりんに切れて「どこにも繋がっていない線」に見える。 */}
      <line x1={160} y1={92} x2={160} y2={104} stroke={LINE} strokeWidth={1.5} />
      <line x1={seats[0]} y1={104} x2={EMPTY_X} y2={104} stroke={LINE} strokeWidth={1.5} />
      {[...seats, EMPTY_X].map((x) => (
        <line key={x} x1={x} y1={104} x2={x} y2={112} stroke={LINE} strokeWidth={1.5} />
      ))}

      {seats.map((x) => <Person key={x} cx={x} cy={132} r={20} focus />)}
      <EmptySeat cx={EMPTY_X} cy={132} r={20} />

      <line x1={EMPTY_X} y1={156} x2={EMPTY_X} y2={180} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3 3" />
      <text x={EMPTY_X} y={198} textAnchor="middle" fontSize={13} fontWeight={700} fill={ACCENT}>ここが空いている</text>
    </svg>
  );
}

export function OrgChart() {
  return (
    <>
      <div className="hidden md:block"><OrgChartWide /></div>
      <div className="block md:hidden"><OrgChartNarrow /></div>
    </>
  );
}

/* ══ 職歴年表（提案のしくみ） ═══════════════════════════════════════════ */

/**
 * ⚠️★**この経歴は実在の個人ではない。** 変えるときも実データを写さないこと。
 *    上が新しい。ノードの塗りは 100% → 60% → 35% で「さかのぼる」ことを示す。
 */
const STEPS = [
  { title: "外資SaaS　法人営業",             sub: "2年　現職", opacity: 1 },
  { title: "国内SaaS　インサイドセールス",   sub: "2年",       opacity: 0.6 },
  { title: "SIer　システム提案営業",         sub: "3年　新卒", opacity: 0.35 },
];

function CareerMatchWide() {
  const AXIS = 40;
  const nodeY = [100, 176, 252];
  const teamSeats = [471, 517, 563];
  const EMPTY_X = 609;
  const TEAM_CX = 540;
  return (
    <svg viewBox="0 0 680 300" style={svgBox} role="img"
      aria-label="ある人の職歴が下から上へ3段に並び、そこから自社の営業チームの空席へ破線がつながっている。">

      {/* ── 左: 人物の要約 ── */}
      <Person cx={AXIS} cy={30} r={22} focus />
      <text x={74} y={26} fontSize={14} fontWeight={700} fill="var(--ink)">SaaS 法人営業　7年</text>
      <text x={74} y={46} fontSize={12} fill={MUTE}>東京 ／ 在職中</text>

      {/* ── 左: 職歴の軸とノード ── */}
      <line x1={AXIS} y1={72} x2={AXIS} y2={264} stroke={LINE} strokeWidth={1.5} />
      {STEPS.map((s, i) => (
        <g key={s.title}>
          <circle cx={AXIS} cy={nodeY[i]} r={7} fill={ACCENT} fillOpacity={s.opacity} />
          <rect x={64} y={nodeY[i] - 26} width={272} height={52} rx={8} fill={CARD} />
          <text x={80} y={nodeY[i] - 5} fontSize={12.5} fontWeight={700} fill="var(--ink)">{s.title}</text>
          <text x={80} y={nodeY[i] + 14} fontSize={11} fill={MUTE}>{s.sub}</text>
        </g>
      ))}

      {/* ── 右: 自社の営業チームの断片 ── */}
      <text x={TEAM_CX} y={104} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>営業</text>
      <line x1={TEAM_CX} y1={112} x2={TEAM_CX} y2={130} stroke={LINE} strokeWidth={1.5} />
      <line x1={471} y1={130} x2={EMPTY_X} y2={130} stroke={LINE} strokeWidth={1.5} />
      {[...teamSeats, EMPTY_X].map((x) => (
        <line key={x} x1={x} y1={130} x2={x} y2={151} stroke={LINE} strokeWidth={1.5} />
      ))}
      {teamSeats.map((x) => <Person key={x} cx={x} cy={168} r={17} focus />)}
      <EmptySeat cx={EMPTY_X} cy={168} r={17} />
      <text x={TEAM_CX} y={218} textAnchor="middle" fontSize={12} fill={MUTE}>自社の営業チーム</text>

      {/* ── 職歴 → 空席 ── */}
      <path d="M 340 104 C 400 104, 410 168, 584 168" fill="none"
        stroke={ACCENT} strokeWidth={1.75} strokeDasharray="4 4" />
      <polygon points="590,168 579,162.5 579,173.5" fill={ACCENT} />

      {/* 破線の中間のラベル。下地を白で抜いて線と重ならないようにする */}
      <rect x={376} y={125} width={88} height={23} rx={11.5} fill="#fff" stroke={SOFT} strokeWidth={1} />
      <text x={420} y={140} textAnchor="middle" fontSize={12} fontWeight={700} fill={ACCENT}>ここに収まる</text>
    </svg>
  );
}

/** 狭い画面用。左右ではなく**縦に積む**（横に並べると文字が読めなくなる）。 */
function CareerMatchNarrow() {
  const AXIS = 26;
  const nodeY = [82, 140, 198];
  const seats = [61, 127, 193];
  const EMPTY_X = 259;
  return (
    <svg viewBox="0 0 320 430" style={svgBox} role="img"
      aria-label="ある人の職歴が3段に並び、その下の自社の営業チームの空席へ破線がつながっている。">

      <Person cx={AXIS} cy={26} r={18} focus />
      <text x={54} y={22} fontSize={13.5} fontWeight={700} fill="var(--ink)">SaaS 法人営業　7年</text>
      <text x={54} y={40} fontSize={11.5} fill={MUTE}>東京 ／ 在職中</text>

      <line x1={AXIS} y1={60} x2={AXIS} y2={210} stroke={LINE} strokeWidth={1.5} />
      {STEPS.map((s, i) => (
        <g key={s.title}>
          <circle cx={AXIS} cy={nodeY[i]} r={6} fill={ACCENT} fillOpacity={s.opacity} />
          <rect x={46} y={nodeY[i] - 22} width={260} height={44} rx={8} fill={CARD} />
          <text x={58} y={nodeY[i] - 3} fontSize={12} fontWeight={700} fill="var(--ink)">{s.title}</text>
          <text x={58} y={nodeY[i] + 14} fontSize={10.5} fill={MUTE}>{s.sub}</text>
        </g>
      ))}

      {/* 職歴 → 空席（縦向き） */}
      <line x1={160} y1={240} x2={160} y2={292} stroke={ACCENT} strokeWidth={1.75} strokeDasharray="4 4" />
      <polygon points="160,298 154.5,287 165.5,287" fill={ACCENT} />
      <rect x={116} y={256} width={88} height={23} rx={11.5} fill="#fff" stroke={SOFT} strokeWidth={1} />
      <text x={160} y={271} textAnchor="middle" fontSize={12} fontWeight={700} fill={ACCENT}>ここに収まる</text>

      <text x={160} y={322} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>営業</text>
      <line x1={160} y1={330} x2={160} y2={344} stroke={LINE} strokeWidth={1.5} />
      <line x1={61} y1={344} x2={EMPTY_X} y2={344} stroke={LINE} strokeWidth={1.5} />
      {[...seats, EMPTY_X].map((x) => (
        <line key={x} x1={x} y1={344} x2={x} y2={355} stroke={LINE} strokeWidth={1.5} />
      ))}
      {seats.map((x) => <Person key={x} cx={x} cy={374} r={19} focus />)}
      <EmptySeat cx={EMPTY_X} cy={374} r={19} />
      <text x={160} y={418} textAnchor="middle" fontSize={11.5} fill={MUTE}>自社の営業チーム</text>
    </svg>
  );
}

export function CareerMatch() {
  return (
    <>
      <div className="hidden md:block"><CareerMatchWide /></div>
      <div className="block md:hidden"><CareerMatchNarrow /></div>
    </>
  );
}
