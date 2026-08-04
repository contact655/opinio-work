"use client";

import { useState, useMemo } from "react";
import { JOB_TYPE_DISPLAY_LABELS, getVisibleCategories } from "@/lib/constants/jobTypes";

type Candidate = {
  id: string;
  name: string;
  location: string | null;
  isMentor: boolean;
  isOpenToWork: boolean;
  birthYear: number | null;
  currentRole: string | null;
  currentCompany: string | null;
  employmentType: string | null;
  startedAt: string | null;
  /** ow_roles の職種名。子階層があれば子、無ければ大分類 */
  roleName: string | null;
  /** ow_roles の9大分類名 */
  topRoleName: string | null;
  jobType: string | null;
  workStyle: string | null;
  desiredPhase: string[] | null;
  transferTiming: string | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  onboardingCompleted: boolean;
  alreadyScouted: boolean;
  createdAt: string;
};

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  hybrid: "ハイブリッド",
  on_site: "出社希望",
  flexible: "柔軟に対応",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "パート・アルバイト",
  freelance: "フリーランス",
  intern: "インターン",
};

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "インサイドセールス": "sales",
  "エンジニア":        "engineering",
  "事業開発・BizDev":  "management",
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


function formatStarted(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  return `${d.getFullYear()}年${d.getMonth() + 1}月〜`;
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

const PHASE_OPTIONS = ["シリーズA", "シリーズB", "シリーズC", "上場"];


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
    warm:   { bg: "var(--warm-soft)",  border: "#F59E0B",        text: "#92400E" },
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
}: {
  candidates: Candidate[];
  scoutQuota?: ScoutQuota;
  jobOptions?: JobOption[];
}) {
  // ── フリーワード ────────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");

  // ── 経歴・雇用形態 ──────────────────────────────────────────────────
  const [jobCategoryKey, setJobCategoryKey] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState<string | null>(null);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);

  // ── 希望条件 ────────────────────────────────────────────────────────
  const [workStyle, setWorkStyle] = useState("");
  const [phase, setPhase] = useState("");
  // 0 = 指定なし（万円単位）
  const [salaryMin, setSalaryMin] = useState(0);
  // デフォルトON: 年収未設定の候補者も通す
  const [includeNoSalary, setIncludeNoSalary] = useState(true);

  // ── 属性 ────────────────────────────────────────────────────────────
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(0);
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

  function selectCategory(key: string | null) {
    setJobCategoryKey(key);
    setSelectedJobType(null);
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

    if (workStyle) list = list.filter((c) => c.workStyle === workStyle);

    if (selectedJobType) {
      list = list.filter((c) => c.jobType === selectedJobType);
    } else if (jobCategoryKey) {
      const cat = getVisibleCategories().find((c) => c.key === jobCategoryKey);
      const types = (cat?.types ?? []) as readonly string[];
      const legacyForCat = Object.entries(LEGACY_CATEGORY_MAP)
        .filter(([, catKey]) => catKey === jobCategoryKey)
        .map(([jt]) => jt);
      list = list.filter(
        (c) => c.jobType && (types.includes(c.jobType) || legacyForCat.includes(c.jobType))
      );
    }

    if (phase) list = list.filter((c) => c.desiredPhase?.includes(phase));

    // 年齢レンジ
    if (ageMin > 0 || ageMax > 0) {
      const now = new Date().getFullYear();
      list = list.filter((c) => {
        if (!c.birthYear) return false;
        const age = now - c.birthYear;
        if (ageMin > 0 && age < ageMin) return false;
        if (ageMax > 0 && age > ageMax) return false;
        return true;
      });
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
    candidates, q, roleQuery, companyQuery, workStyle, jobCategoryKey, selectedJobType,
    phase, hideAlreadyScouted,
    ageMin, ageMax, selectedPrefectures,
    selectedEmploymentTypes, salaryMin, includeNoSalary,
  ]);

  const jobTypeFilterActive = jobCategoryKey !== null;
  const activeFilterCount = [
    q.trim() ? "x" : "",
    roleQuery.trim() ? "x" : "",
    companyQuery.trim() ? "x" : "",
    workStyle,
    jobTypeFilterActive ? "x" : "",
    phase,
    selectedEmploymentTypes.length ? "x" : "",
    hideAlreadyScouted ? "x" : "",
    ageMin > 0 ? "x" : "",
    ageMax > 0 ? "x" : "",
    selectedPrefectures.length ? "x" : "",
    salaryMin > 0 ? "x" : "",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setQ("");
    setRoleQuery("");
    setCompanyQuery("");
    setWorkStyle("");
    setJobCategoryKey(null);
    setSelectedJobType(null);
    setPhase("");
    setSelectedEmploymentTypes([]);
    setHideAlreadyScouted(false);
    setAgeMin(0);
    setAgeMax(0);
    setSelectedPrefectures([]);
    setSalaryMin(0);
    setIncludeNoSalary(true);
  }

  function toggleMulti<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  const selectedCat = getVisibleCategories().find((c) => c.key === jobCategoryKey);
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
          {getVisibleCategories().map((cat) => (
            <button key={cat.key} type="button"
              aria-pressed={jobCategoryKey === cat.key}
              onClick={() => selectCategory(jobCategoryKey === cat.key ? null : cat.key)}
              style={{
                padding: "4px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap" as const,
                fontWeight: jobCategoryKey === cat.key ? 700 : 400,
                border: jobCategoryKey === cat.key ? "1.5px solid var(--royal)" : "1px solid var(--line)",
                background: jobCategoryKey === cat.key ? "var(--royal-50)" : "#fff",
                color: jobCategoryKey === cat.key ? "var(--royal)" : "var(--ink-soft)",
              }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        {selectedCat && (
          <div style={{ padding: "8px 10px", background: "var(--royal-50)", borderRadius: 8, border: "1px solid var(--royal-100)", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
              {selectedCat.emoji} {selectedCat.label} の職種
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {selectedCat.types.map((jt) => (
                <button key={jt} type="button"
                  aria-pressed={selectedJobType === jt}
                  onClick={() => setSelectedJobType(selectedJobType === jt ? null : jt)}
                  style={{
                    padding: "3px 8px", borderRadius: 999, fontSize: 10, cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: selectedJobType === jt ? 700 : 400,
                    border: selectedJobType === jt ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    background: selectedJobType === jt ? "#fff" : "var(--bg-tint)",
                    color: selectedJobType === jt ? "var(--accent)" : "var(--ink-soft)",
                  }}>
                  {JOB_TYPE_DISPLAY_LABELS[jt] ?? jt}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => selectCategory(null)}
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
          {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
            <Pill key={v} active={workStyle === v} onClick={() => setWorkStyle(workStyle === v ? "" : v)}>{l}</Pill>
          ))}
        </div>

        <SidebarLabel>希望企業フェーズ</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          <Pill active={phase === ""} onClick={() => setPhase("")}>全て</Pill>
          {PHASE_OPTIONS.map((v) => (
            <Pill key={v} active={phase === v} onClick={() => setPhase(phase === v ? "" : v)}>{v}</Pill>
          ))}
        </div>

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
        <SidebarLabel>年齢</SidebarLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value))}
            style={{ flex: 1, height: 32, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "#fff", color: "var(--ink)" }}
          >
            <option value={0}>下限なし</option>
            {[20,22,25,28,30,32,35,38,40,45,50].map((v) => (
              <option key={v} value={v}>{v}歳</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "var(--ink-mute)", flexShrink: 0 }}>〜</span>
          <select
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value))}
            style={{ flex: 1, height: 32, padding: "0 6px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "#fff", color: "var(--ink)" }}
          >
            <option value={0}>上限なし</option>
            {[25,28,30,32,35,38,40,45,50,55,60].map((v) => (
              <option key={v} value={v}>{v}歳</option>
            ))}
          </select>
        </div>

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
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "Inter, sans-serif", color: scoutQuota.remaining === 0 ? "var(--error)" : "var(--ink)" }}>
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
              <strong style={{ fontSize: 16, fontFamily: "Inter, sans-serif", color: "var(--royal)" }}>{filtered.length}</strong>
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
                const age = c.birthYear ? (2026 - c.birthYear) : null;
                const _startedLabel = formatStarted(c.startedAt);
                const _empLabel = c.employmentType ? (EMPLOYMENT_TYPE_LABELS[c.employmentType] ?? c.employmentType) : null;
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
                          {age && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>{age}歳</span>
                          )}
                          {c.isOpenToWork && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--success-soft)", color: "var(--success)", border: "1px solid #6EE7B7" }}>転職検討中</span>
                          )}
                          {c.isMentor && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--purple-soft)", color: "var(--purple)", border: "1px solid #DDD6FE" }}>メンター</span>
                          )}
                          {c.alreadyScouted && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>送信済み</span>
                          )}
                        </div>

                        {/* 職種 · 会社名 */}
                        {(c.currentRole || c.currentCompany || c.jobType) && (
                          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6, lineHeight: 1.4 }}>
                            {c.currentRole && <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.currentRole}</span>}
                            {c.currentRole && c.currentCompany && <span style={{ color: "var(--ink-mute)" }}> · </span>}
                            {c.currentCompany && <span>{c.currentCompany}</span>}
                            {!c.currentRole && !c.currentCompany && c.jobType && (
                              <span style={{ color: "var(--ink-mute)" }}>{JOB_TYPE_DISPLAY_LABELS[c.jobType] ?? c.jobType}</span>
                            )}
                          </div>
                        )}

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

                      {/* 右: アクション */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
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
                  <div style={{ background: "var(--error-soft)", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--error)", marginBottom: 16 }}>
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
