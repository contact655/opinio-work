"use client";

import { useState, useMemo } from "react";
import { DESIRED_WORK_STYLE_LABELS } from "@/lib/constants/careerPreferences";

/**
 * 社会人年数の帯（2026-08-20）。**年齢の帯の置き換え。**
 *
 * ⚠️ 元は `ow_experiences` の最も古い `started_at` から `calcTotalExperience` で
 *    その都度算出している（page.tsx）。列にもトリガーにもしない。
 */
const TENURE_BANDS = [
  { value: "lt1",  label: "1年未満",   minMonths: 0,   maxMonths: 11 },
  { value: "1to3", label: "1〜3年",    minMonths: 12,  maxMonths: 35 },
  { value: "3to5", label: "3〜5年",    minMonths: 36,  maxMonths: 59 },
  { value: "5to10", label: "5〜10年",  minMonths: 60,  maxMonths: 119 },
  { value: "gte10", label: "10年以上", minMonths: 120, maxMonths: Number.MAX_SAFE_INTEGER },
] as const;

/** 月数 → カードに出す1行。未算出（null）は**何も出さない**（「0年」と書かない） */
function formatTenure(months: number | null): string | null {
  if (months == null) return null;
  if (months < 12) return "社会人1年未満";
  return `社会人${Math.floor(months / 12)}年`;
}

type Candidate = {
  id: string;
  name: string;
  location: string | null;
  isMentor: boolean;
  /** ★「積極的に検討中」（`ow_profiles.career_stance = 'active'`）。2026-08-26 に改名。
   *  ⚠️ 旧名 `isOpenToWork` は `ow_users.is_open_to_work`（boolean）由来だった。
   *     列を移したので名前も合わせる。**列名で grep したときに残らないようにする。** */
  isActivelyLooking: boolean;
  /** 社会人年数（月数）。**職歴が0件なら null＝未算出。0 ではない** */
  tenureMonths: number | null;
  currentRole: string | null;
  currentCompany: string | null;
  employmentType: string | null;
  startedAt: string | null;
  /** ow_roles の職種名。子階層があれば子、無ければ大分類 */
  roleName: string | null;
  /** ow_roles の9大分類名 */
  topRoleName: string | null;
  /** 希望職種。**祖先まで展開済み**の role_id（絞り込み用） */
  desiredRoleIds: string[];
  /** 表示用。本人が選んだ職種名（展開前） */
  desiredRoleNames: string[];
  workStyles: string[] | null;
  desiredPrefectures: string[] | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  onboardingCompleted: boolean;
  alreadyScouted: boolean;
  createdAt: string;
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "パート・アルバイト",
  freelance: "フリーランス",
  intern: "インターン",
};


const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, var(--success), #10b981)",
  "linear-gradient(135deg, #7C3AED, #a78bfa)",
  "linear-gradient(135deg, #d97706, #f59e0b)",
  "linear-gradient(135deg, #dc2626, #f87171)",
  "linear-gradient(135deg, #0891b2, #22d3ee)",
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}



// 都道府県を location 文字列から抽出（先頭の都道府県部分）
function extractPrefecture(location: string | null): string | null {
  if (!location) return null;
  const PREFS = [
    "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
    "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
    "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
    "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
    "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
    "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
    "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
  ];
  return PREFS.find((p) => location.startsWith(p)) ?? null;
}


// サイドバー内セクションラベル
function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

// 汎用ピルボタン
function Pill({
  active, onClick, color = "royal", children,
}: {
  active: boolean;
  onClick: () => void;
  color?: "royal" | "warm" | "purple";
  children: React.ReactNode;
}) {
  const palette = {
    royal:  { bg: "var(--royal-50)",   border: "var(--royal)",   text: "var(--royal)" },
    warm:   { bg: "var(--warm-soft)",  border: "#F59E0B",        text: "var(--warm-ink)" },
    purple: { bg: "var(--purple-soft)", border: "var(--purple)", text: "var(--purple)" },
  }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
        fontFamily: "inherit", whiteSpace: "nowrap" as const, transition: "all 0.12s",
        fontWeight: active ? 700 : 400,
        border: active ? `1.5px solid ${palette.border}` : "1px solid var(--line)",
        background: active ? palette.bg : "#fff",
        color: active ? palette.text : "var(--ink-soft)",
      }}
    >
      {children}
    </button>
  );
}

type ScoutQuota = {
  monthlyLimit: number;
  bonusCredits: number;
  usedThisMonth: number;
  remaining: number;
};

type JobOption = { id: string; title: string };

export default function CandidatesClient({
  candidates,
  scoutQuota,
  jobOptions = [],
  roleFilterTree = [],
  scoutSendingEnabled = false,
}: {
  candidates: Candidate[];
  scoutQuota?: ScoutQuota;
  jobOptions?: JobOption[];
  /** 職種フィルタの階層（ow_roles の大分類＋子）。サーバーで組む */
  roleFilterTree?: { id: string; name: string; children: { id: string; name: string }[] }[];
  /** スカウト送信が有効か。⚠️ 2026-08-09 時点は停止中（受信側の画面が無いため）。
   *  false のときは送信ボタンを**出さない**。押せてAPIが 503 を返す形にすると、
   *  企業には「失敗した」ようにしか見えない。 */
  scoutSendingEnabled?: boolean;
}) {
  // ── フリーワード ────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");

  // ── 経歴・雇用形態 ──────────────────────────────────────────────────
  const [topRoleId, setTopRoleId] = useState<string | null>(null);
  const [childRoleId, setChildRoleId] = useState<string | null>(null);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);

  // ── 希望条件 ────────────────────────────────────────────────────────
  const [workStyle, setWorkStyle] = useState("");
  // 0 = 指定なし（万円単位）
  const [salaryMin, setSalaryMin] = useState(0);
  // デフォルトON: 年収未設定の候補者も通す
  const [includeNoSalary, setIncludeNoSalary] = useState(true);

  // ── 属性 ────────────────────────────────────────────────────────────
  /* ★年齢の絞り込みは 2026-08-20 に撤去した。社会人年数に置き換えている。
     ⚠️ **年齢の select や birthYear をここに戻さないこと。**
        労働施策総合推進法9条で募集・採用時の年齢制限は原則禁止で、
        **年齢で絞り込む機能**は禁止行為を直接手助けする形になる（有料職業紹介の許可事業者）。
        「経験年数で絞る」は職務要件なので性質が違う。
     ⚠️ 撤去前の実装は `if (!c.birthYear) return false` で、
        生年月日が未入力の10人（実ユーザー14人中）を**無条件に落としていた**。
        同じ失敗を繰り返さないため、未算出の人は落とさない（下の tenureBand）。 */
  const [tenureBand, setTenureBand] = useState("");
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([]);

  // ── その他 ──────────────────────────────────────────────────────────
  const [hideAlreadyScouted, setHideAlreadyScouted] = useState(false);

  // ── モバイル サイドバー開閉 ─────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Scout modal ─────────────────────────────────────────────────────
  const [scoutTarget, setScoutTarget] = useState<Candidate | null>(null);
  const [scoutMessage, setScoutMessage] = useState("");
  const [scoutJobId, setScoutJobId] = useState<string>("");
  const [scoutSending, setScoutSending] = useState(false);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutSuccess, setScoutSuccess] = useState(false);

  function openScout(c: Candidate) {
    setScoutTarget(c);
    setScoutMessage("");
    setScoutJobId("");
    setScoutError(null);
    setScoutSuccess(false);
  }

  async function sendScout() {
    if (!scoutTarget || !scoutMessage.trim()) return;
    setScoutSending(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/biz/scouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: scoutTarget.id,
          message: scoutMessage.trim(),
          job_id: scoutJobId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setScoutError(data.error ?? "送信に失敗しました"); return; }
      setScoutSuccess(true);
    } catch {
      setScoutError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setScoutSending(false);
    }
  }

  function selectTopRole(id: string | null) {
    setTopRoleId(id);
    setChildRoleId(null);
  }

  // ── 都道府県・スキルタグを candidates から動的生成 ───────────────────
  const uniquePrefectures = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      const p = extractPrefecture(c.location);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
  }, [candidates]);

  // ── フィルター適用 ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = candidates;

    if (hideAlreadyScouted) list = list.filter((c) => !c.alreadyScouted);

    // フリーワード（スペース区切りAND）
    if (q.trim()) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((c) =>
        terms.every((t) =>
          c.name.toLowerCase().includes(t) ||
          (c.currentRole ?? "").toLowerCase().includes(t) ||
          (c.currentCompany ?? "").toLowerCase().includes(t) ||
          (c.location ?? "").includes(t) ||
          (c.roleName ?? "").toLowerCase().includes(t) ||
          (c.topRoleName ?? "").toLowerCase().includes(t)
        )
      );
    }

    // 職種タイトル
    if (roleQuery.trim()) {
      const r = roleQuery.toLowerCase();
      list = list.filter((c) => (c.currentRole ?? "").toLowerCase().includes(r));
    }

    // 会社名
    if (companyQuery.trim()) {
      const co = companyQuery.toLowerCase();
      list = list.filter((c) => (c.currentCompany ?? "").toLowerCase().includes(co));
    }

    // 雇用形態（OR）
    if (selectedEmploymentTypes.length > 0) {
      list = list.filter((c) => c.employmentType && selectedEmploymentTypes.includes(c.employmentType));
    }

    // 勤務スタイル: 複数希望のうち1つでも一致すれば残す
    if (workStyle) list = list.filter((c) => (c.workStyles ?? []).includes(workStyle));

    /* 職種: 候補者側が祖先まで展開済みなので、大分類でも子でも includes() で当たる */
    const wantRole = childRoleId ?? topRoleId;
    if (wantRole) list = list.filter((c) => c.desiredRoleIds.includes(wantRole));


    /* 社会人年数
       ⚠️ **未算出（職歴0件）の人は落とさない。** 落とすと「絞り込んだ瞬間に
          候補者が激減する」という、年齢絞り込みで起きていたのと同じ形になる。
          何名が年数不明のまま残っているかは、一覧の上に注記で出している。 */
    if (tenureBand) {
      const band = TENURE_BANDS.find((b) => b.value === tenureBand);
      if (band) {
        list = list.filter((c) => {
          if (c.tenureMonths == null) return true; // 未算出は通す
          return c.tenureMonths >= band.minMonths && c.tenureMonths <= band.maxMonths;
        });
      }
    }

    // 居住地（OR・前方一致）
    if (selectedPrefectures.length > 0) {
      list = list.filter((c) =>
        selectedPrefectures.some((p) => (c.location ?? "").startsWith(p))
      );
    }

    // 希望年収
    if (salaryMin > 0) {
      list = list.filter((c) => {
        const salaryVal = c.desiredSalaryMax ?? c.desiredSalaryMin;
        if (salaryVal === null) return includeNoSalary;
        return salaryVal >= salaryMin;
      });
    }

    return list;
  }, [
    candidates, q, roleQuery, companyQuery, workStyle, topRoleId, childRoleId,
    hideAlreadyScouted,
    tenureBand, selectedPrefectures,
    selectedEmploymentTypes, salaryMin, includeNoSalary,
  ]);

  /** 絞り込み後に残っている「社会人年数が未算出」の人数。注記に出す */
  const unknownTenureCount = useMemo(
    () => filtered.filter((c) => c.tenureMonths == null).length,
    [filtered]
  );

  const jobTypeFilterActive = topRoleId !== null;
  const activeFilterCount = [
    q.trim() ? "x" : "",
    roleQuery.trim() ? "x" : "",
    companyQuery.trim() ? "x" : "",
    workStyle,
    jobTypeFilterActive ? "x" : "",
    selectedEmploymentTypes.length ? "x" : "",
    hideAlreadyScouted ? "x" : "",
    tenureBand ? "x" : "",
    selectedPrefectures.length ? "x" : "",
    salaryMin > 0 ? "x" : "",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setQ("");
    setRoleQuery("");
    setCompanyQuery("");
    setWorkStyle("");
    setTopRoleId(null);
    setChildRoleId(null);
    setSelectedEmploymentTypes([]);
    setHideAlreadyScouted(false);
    setTenureBand("");
    setSelectedPrefectures([]);
    setSalaryMin(0);
    setIncludeNoSalary(true);
  }

  function toggleMulti<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  const selectedTop = roleFilterTree.find((t) => t.id === topRoleId);
  const alreadyScoutedCount = candidates.filter((c) => c.alreadyScouted).length;
  const showQuota = scoutQuota && scoutQuota.usedThisMonth > 0;

  // ── サイドバーの中身（デスクトップ・モバイル共用） ────────────────────
  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── フリーワード ─────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        <SidebarLabel>フリーワード</SidebarLabel>
        <div style={{ position: "relative" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・職種・会社"
            style={{
              width: "100%", height: 34, padding: "0 28px 0 28px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 12, outline: "none", fontFamily: "inherit",
              color: "var(--ink)", boxSizing: "border-box" as const,
            }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")}
              style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 14, lineHeight: 1, padding: 2 }}>
              ×
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4, lineHeight: 1.5 }}>
          スペース区切りでAND検索
        </div>
      </div>

      {/* ── 経歴・職種 ────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        <SidebarLabel>現在の職種タイトル</SidebarLabel>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type="text"
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
            placeholder="例：営業マネージャー、エンジニア"
            style={{
              width: "100%", height: 34, padding: roleQuery ? "0 28px 0 10px" : "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 12, outline: "none", fontFamily: "inherit",
              color: "var(--ink)", boxSizing: "border-box" as const,
            }}
          />
          {roleQuery && (
            <button type="button" onClick={() => setRoleQuery("")}
              style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
          )}
        </div>

        <SidebarLabel>現在の会社名</SidebarLabel>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type="text"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="例：株式会社○○、Salesforce"
            style={{
              width: "100%", height: 34, padding: companyQuery ? "0 28px 0 10px" : "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 12, outline: "none", fontFamily: "inherit",
              color: "var(--ink)", boxSizing: "border-box" as const,
            }}
          />
          {companyQuery && (
            <button type="button" onClick={() => setCompanyQuery("")}
              style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
          )}
        </div>

        <SidebarLabel>職種カテゴリ</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {roleFilterTree.map((top) => (
            <button key={top.id} type="button"
              aria-pressed={topRoleId === top.id}
              onClick={() => selectTopRole(topRoleId === top.id ? null : top.id)}
              style={{
                padding: "4px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap" as const,
                fontWeight: topRoleId === top.id ? 700 : 400,
                border: topRoleId === top.id ? "1.5px solid var(--royal)" : "1px solid var(--line)",
                background: topRoleId === top.id ? "var(--royal-50)" : "#fff",
                color: topRoleId === top.id ? "var(--royal)" : "var(--ink-soft)",
              }}>
              {top.name}
            </button>
          ))}
        </div>
        {selectedTop && selectedTop.children.length > 0 && (
          <div style={{ padding: "8px 10px", background: "var(--royal-50)", borderRadius: 8, border: "1px solid var(--royal-100)", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
              {selectedTop.name} の職種
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selectedTop.children.map((child) => (
                <button key={child.id} type="button"
                  aria-pressed={childRoleId === child.id}
                  onClick={() => setChildRoleId(childRoleId === child.id ? null : child.id)}
                  style={{
                    padding: "3px 8px", borderRadius: 999, fontSize: 10, cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: childRoleId === child.id ? 700 : 400,
                    border: childRoleId === child.id ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    background: childRoleId === child.id ? "#fff" : "var(--bg-tint)",
                    color: childRoleId === child.id ? "var(--accent)" : "var(--ink-soft)",
                  }}>
                  {child.name}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => selectTopRole(null)}
              style={{ marginTop: 6, fontSize: 10, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
              ✕ カテゴリを解除
            </button>
          </div>
        )}

        <SidebarLabel>雇用形態</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
            <Pill key={v} active={selectedEmploymentTypes.includes(v)} color="royal"
              onClick={() => setSelectedEmploymentTypes(toggleMulti(selectedEmploymentTypes, v))}>
              {l}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── 希望条件 ──────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        <SidebarLabel>勤務スタイル</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          <Pill active={workStyle === ""} onClick={() => setWorkStyle("")}>全て</Pill>
          {/* ⚠️ ラベルは careerPreferences.ts の1箇所で決める。ここに直書きしない。
              求人の勤務形態（workStyle.ts）とは意味が違うので混ぜない。 */}
          {Object.entries(DESIRED_WORK_STYLE_LABELS).map(([v, l]) => (
            <Pill key={v} active={workStyle === v} onClick={() => setWorkStyle(workStyle === v ? "" : v)}>{l}</Pill>
          ))}
        </div>

        {/* ⚠️★「希望企業フェーズ」の絞り込みは 2026-08-27 に削除した。
               ⚠️ **同日に本人側の入力欄を消した**ので、残すと
                  「本人が直せない値で企業が絞り込む」ことになる。
               ⚠️ 入力欄を戻すなら、ここも一緒に戻すこと。 */}

        <SidebarLabel>希望年収（下限）</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {([
            { value: 0,    label: "指定なし" },
            { value: 400,  label: "400万〜" },
            { value: 600,  label: "600万〜" },
            { value: 800,  label: "800万〜" },
            { value: 1000, label: "1000万〜" },
            { value: 1200, label: "1200万〜" },
          ] as const).map(({ value, label }) => (
            <Pill key={value} active={salaryMin === value} color="royal"
              onClick={() => setSalaryMin(value)}>
              {label}
            </Pill>
          ))}
        </div>
        {salaryMin > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeNoSalary}
              onChange={(e) => setIncludeNoSalary(e.target.checked)}
              style={{ width: 13, height: 13, accentColor: "var(--royal)", cursor: "pointer" }}
            />
            <span style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4 }}>
              年収未設定の候補者も含む
            </span>
          </label>
        )}
      </div>

      {/* ── 属性 ──────────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        <SidebarLabel>社会人年数</SidebarLabel>
        <select
          value={tenureBand}
          onChange={(e) => setTenureBand(e.target.value)}
          style={{ width: "100%", height: 32, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "#fff", color: "var(--ink)" }}
        >
          <option value="">指定なし</option>
          {TENURE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        {tenureBand && unknownTenureCount > 0 && (
          /* ⚠️ 黙って減らさない・黙って混ぜない。**何名が年数不明のまま残っているか**を出す。 */
          <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: "var(--ink-mute)" }}>
            職歴が未登録の {unknownTenureCount} 名は年数を算出できないため、そのまま表示しています。
          </div>
        )}

        {uniquePrefectures.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SidebarLabel>居住地</SidebarLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {uniquePrefectures.map((p) => (
                <Pill key={p} active={selectedPrefectures.includes(p)}
                  onClick={() => setSelectedPrefectures(toggleMulti(selectedPrefectures, p))}>
                  {p}
                </Pill>
              ))}
            </div>
            {selectedPrefectures.length > 0 && (
              <button type="button" onClick={() => setSelectedPrefectures([])}
                style={{ marginTop: 4, fontSize: 10, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
                クリア
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── その他 ────────────────────────────────────────────────────── */}
      {alreadyScoutedCount > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={hideAlreadyScouted}
            onChange={(e) => setHideAlreadyScouted(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "var(--royal)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            スカウト済みを除く（{alreadyScoutedCount}人）
          </span>
        </label>
      )}

      {/* フィルタークリア */}
      {activeFilterCount > 0 && (
        <button type="button" onClick={clearAllFilters}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 8,
            border: "1px solid var(--line)", background: "#fff",
            fontSize: 12, color: "var(--ink-soft)", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 600,
          }}>
          フィルターをクリア（{activeFilterCount}件）
        </button>
      )}
    </div>
  );

  return (
    <div style={{ padding: "16px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* ── ヘッダー ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>候補者を探す</h1>
        {showQuota && (
          <div style={{
            background: scoutQuota.remaining === 0 ? "var(--error-soft)" : "var(--bg-tint)",
            border: `1px solid ${scoutQuota.remaining === 0 ? "#FECACA" : "var(--line)"}`,
            borderRadius: 8, padding: "6px 12px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>残り</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)", color: scoutQuota.remaining === 0 ? "var(--error)" : "var(--ink)" }}>
              {scoutQuota.remaining}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>/ {scoutQuota.monthlyLimit + scoutQuota.bonusCredits} 通</span>
          </div>
        )}
      </div>

      {/* ── モバイル：フィルタートグルボタン ─────────────────────────── */}
      <div className="candidates-mobile-toggle" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => setSidebarOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 16px", borderRadius: 10, cursor: "pointer",
            border: activeFilterCount > 0 ? "1.5px solid var(--royal)" : "1px solid var(--line)",
            background: activeFilterCount > 0 ? "var(--royal-50)" : "#fff",
            color: activeFilterCount > 0 ? "var(--royal)" : "var(--ink-soft)",
            fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          フィルター{activeFilterCount > 0 ? ` (${activeFilterCount}件)` : ""}
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.7 }}>{sidebarOpen ? "▲" : "▼"}</span>
        </button>
        {sidebarOpen && (
          <div style={{
            marginTop: 8, padding: 16, background: "#fff",
            border: "1px solid var(--line)", borderRadius: 12,
          }}>
            {sidebarContent}
          </div>
        )}
      </div>

      {/* ── 2カラムレイアウト ──────────────────────────────────────────── */}
      <div className="candidates-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* ── サイドバー（デスクトップのみ） ───────────────────────────── */}
        <aside className="candidates-sidebar" style={{
          width: 280, flexShrink: 0,
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 12, padding: "18px 16px",
          position: "sticky", top: 80,
        }}>
          {sidebarContent}
        </aside>

        {/* ── メインカラム ─────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* 件数バー */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              <strong style={{ fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)", color: "var(--royal)" }}>{filtered.length}</strong>
              {" "}件 / 全{candidates.length}件
            </span>
            {/* アクティブフィルターチップ */}
            {selectedPrefectures.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {selectedPrefectures.map((p) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)", fontSize: 11, fontWeight: 700 }}>
                    {p}
                    <button type="button" onClick={() => setSelectedPrefectures(selectedPrefectures.filter((v) => v !== p))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 候補者リスト */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "72px 0", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>条件に合う候補者が見つかりませんでした</p>
              <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                {candidates.length === 0
                  ? "現在、スカウトを受け取る設定をしている求職者はいません"
                  : "フィルター条件を変えてみてください"}
              </p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAllFilters}
                  style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "var(--ink-soft)" }}>
                  フィルターをクリア
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((c) => {
                const tenure = formatTenure(c.tenureMonths);
                const grad = getGradient(c.id);
                return (
                  <div key={c.id}
                    style={{
                      background: "#fff",
                      border: c.alreadyScouted ? "1px solid var(--line-soft)" : "1px solid var(--line)",
                      borderRadius: 14,
                      overflow: "hidden",
                      opacity: c.alreadyScouted ? 0.82 : 1,
                      display: "flex",
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,35,102,0.09)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    {/* 左アクセントバー */}
                    <div style={{ width: 4, flexShrink: 0, background: grad }} />

                    {/* カード本体 */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", minWidth: 0 }}>

                      {/* アバター */}
                      <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: grad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>
                        {c.name.charAt(0) || "?"}
                      </div>

                      {/* メイン情報 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 名前 + 年齢 + バッジ */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{c.name}</span>
                          {/* ⚠️ **年齢は出さない**（2026-08-20）。一覧に年齢を出さない方針。
                                 出すのは職務要件として意味のある社会人年数だけ。 */}
                          {tenure && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{tenure}</span>
                          )}
                          {c.isActivelyLooking && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--success-soft)", color: "var(--success-ink)", border: "1px solid #6EE7B7" }}>転職検討中</span>
                          )}
                          {c.isMentor && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--purple-soft)", color: "var(--purple)", border: "1px solid #DDD6FE" }}>メンター</span>
                          )}
                          {c.alreadyScouted && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>送信済み</span>
                          )}
                        </div>

                        {/* 職種 · 会社名 */}
                        {(c.currentRole || c.currentCompany || c.desiredRoleNames.length > 0) && (
                          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.4 }}>
                            {c.currentRole && <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.currentRole}</span>}
                            {c.currentRole && c.currentCompany && <span style={{ color: "var(--ink-mute)" }}> · </span>}
                            {c.currentCompany && <span>{c.currentCompany}</span>}
                            {/* 現職が分からないときだけ希望職種を出す。複数あれば並べる */}
                            {!c.currentRole && !c.currentCompany && c.desiredRoleNames.length > 0 && (
                              <span style={{ color: "var(--ink-mute)" }}>
                                希望: {c.desiredRoleNames.join("・")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 希望勤務地。⚠️ 表示のみ（絞り込みは別タスク）。
                            ⚠️ 空なら行ごと出さない。「未設定」とも書かない。 */}
                        {c.desiredPrefectures && c.desiredPrefectures.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.5 }}>
                            希望勤務地: {c.desiredPrefectures.join("・")}
                          </div>
                        )}

                        {/* ⚠️★「転職検討時期」の表示は 2026-08-27 に削除した。
                               ⚠️ **同日に本人側の入力欄を消した**ので、残すと
                                  「企業には見えるのに本人は直せない」状態になる。
                                  列（`transfer_timing`）と値は残してある。
                               ⚠️ 入力欄を戻すなら、ここも一緒に戻すこと。 */}

                        {/* タグ行: 職種・居住地。
                            職種は ow_roles 由来（2026-08-04）。
                            以前は自由記述のスキルタグを検索対象にしていたが、
                            表記揺れで絞り込みの精度が出ないためマスタの職種に置き換えた。
                            旧スキルタグはカードに表示していなかったので、ここは新規表示。 */}
                        {(c.roleName || c.location) && (
                          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                            {c.roleName && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)" }}>
                                {c.roleName}
                              </span>
                            )}
                            {c.location && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {extractPrefecture(c.location) ?? c.location}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 右: アクション
                          ⚠️ scoutSendingEnabled が false のときは送信ボタンを出さない。
                             出したままにすると押せてしまい、API が 503 を返して
                             企業には「失敗した」ようにしか見えない（2026-08-09）。 */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        {scoutSendingEnabled ? (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); openScout(c); }}
                          disabled={(scoutQuota?.remaining ?? 1) === 0}
                          style={{
                            fontSize: 12, padding: "7px 16px", borderRadius: 7, fontWeight: 700,
                            fontFamily: "inherit", whiteSpace: "nowrap" as const, cursor: (scoutQuota?.remaining ?? 1) === 0 ? "default" : "pointer",
                            background: (scoutQuota?.remaining ?? 1) === 0 ? "var(--bg-tint)" : c.alreadyScouted ? "#fff" : "var(--royal)",
                            color: (scoutQuota?.remaining ?? 1) === 0 ? "var(--ink-mute)" : c.alreadyScouted ? "var(--royal)" : "#fff",
                            border: c.alreadyScouted ? "1.5px solid var(--royal)" : "none",
                            boxShadow: !c.alreadyScouted && (scoutQuota?.remaining ?? 1) > 0 ? "0 2px 6px rgba(0,35,102,0.18)" : "none",
                          }}>
                          {c.alreadyScouted ? "再スカウト" : "スカウトを送る"}
                        </button>
                        ) : (
                          <span style={{
                            fontSize: 12, padding: "7px 14px", borderRadius: 7, fontWeight: 700,
                            background: "var(--bg-tint)", color: "var(--ink-mute)",
                            whiteSpace: "nowrap" as const, border: "1px solid var(--line)",
                          }}>
                            スカウト準備中
                          </span>
                        )}
                        <a href={`/u/${c.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
                          onClick={(e) => e.stopPropagation()}>
                          プロフィール
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>

      {/* ── Scout modal ─────────────────────────────────────────────── */}
      {scoutTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setScoutTarget(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            {scoutSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: "linear-gradient(135deg, var(--success), #34D399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>スカウトを送信しました</h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
                  {scoutTarget.name} さんへのスカウトを送信しました。<br />返信があればOPINIOから通知します。
                </p>
                <button type="button" onClick={() => { setScoutTarget(null); window.location.reload(); }}
                  style={{ background: "var(--royal)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{scoutTarget.name} さんにスカウトを送る</h3>
                  <button type="button" onClick={() => setScoutTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-mute)" }}>×</button>
                </div>
                {jobOptions.length > 0 && (
                  <label style={{ display: "block", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>求人を指定（任意）</div>
                    <select value={scoutJobId} onChange={(e) => setScoutJobId(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" }}>
                      <option value="">求人を指定しない（カジュアルな連絡）</option>
                      {jobOptions.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                    </select>
                  </label>
                )}
                <label style={{ display: "block", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    メッセージ <span style={{ color: "var(--error)" }}>*</span>
                  </div>
                  <textarea value={scoutMessage} onChange={(e) => setScoutMessage(e.target.value)}
                    placeholder={"はじめまして。〇〇株式会社の△△と申します。\nご経歴を拝見し、ぜひ一度お話しできればと思いご連絡しました。"}
                    rows={6}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" as const }}
                  />
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "right", marginTop: 4 }}>{scoutMessage.length} / 2000</div>
                </label>
                {scoutError && (
                  <div style={{ background: "var(--error-soft)", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--error-ink)", marginBottom: 16 }}>
                    {scoutError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setScoutTarget(null)}
                    style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                    キャンセル
                  </button>
                  <button type="button" onClick={sendScout} disabled={scoutSending || !scoutMessage.trim()}
                    style={{
                      background: scoutSending || !scoutMessage.trim() ? "var(--ink-mute)" : "var(--royal)",
                      color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
                      fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                      cursor: scoutSending || !scoutMessage.trim() ? "default" : "pointer",
                    }}>
                    {scoutSending ? "送信中..." : "スカウトを送る"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* モバイル/デスクトップ切り替えCSS */}
      <style>{`
        @media (min-width: 768px) {
          .candidates-mobile-toggle { display: none !important; }
        }
        @media (max-width: 767px) {
          .candidates-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
