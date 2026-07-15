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
  skills: string[];
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

function toDecade(birthYear: number | null): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return "10代";
  if (age >= 50) return "50代以上";
  const decade = Math.floor(age / 10) * 10;
  return `${decade}代`;
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

const DECADE_OPTIONS = ["20代", "30代", "40代", "50代以上"];

const PHASE_OPTIONS = ["シリーズA", "シリーズB", "シリーズC", "上場"];

const TRANSFER_TIMING_OPTIONS = [
  { value: "即時",        label: "即時" },
  { value: "1〜3ヶ月以内", label: "1〜3ヶ月" },
  { value: "半年以内",    label: "半年以内" },
  { value: "1年以内",     label: "1年以内" },
  { value: "情報収集中",  label: "情報収集中" },
];

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
  // ── 既存フィルター ──────────────────────────────────────────────────
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [jobCategoryKey, setJobCategoryKey] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState<string | null>(null);
  const [phase, setPhase] = useState("");
  const [transferTiming, setTransferTiming] = useState("");
  const [hideAlreadyScouted, setHideAlreadyScouted] = useState(false);

  // ── 新規フィルター ──────────────────────────────────────────────────
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([]);
  const [selectedSkillTags, setSelectedSkillTags] = useState<string[]>([]);
  // 0 = 指定なし（万円単位）
  const [salaryMin, setSalaryMin] = useState(0);
  // デフォルトON: 年収未設定の候補者も通す
  const [includeNoSalary, setIncludeNoSalary] = useState(true);

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

  const uniqueSkillTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      for (const s of c.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([s]) => s);
  }, [candidates]);

  // ── フィルター適用 ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = candidates;

    if (hideAlreadyScouted) list = list.filter((c) => !c.alreadyScouted);

    if (q.trim()) {
      const lower = q.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.currentRole ?? "").toLowerCase().includes(lower) ||
        (c.currentCompany ?? "").toLowerCase().includes(lower) ||
        (c.location ?? "").includes(lower) ||
        c.skills.some((s) => s.toLowerCase().includes(lower))
      );
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
    if (transferTiming) list = list.filter((c) => c.transferTiming === transferTiming);

    // 年代（OR）
    if (selectedDecades.length > 0) {
      list = list.filter((c) => {
        const d = toDecade(c.birthYear);
        return d ? selectedDecades.includes(d) : false;
      });
    }

    // 居住地（OR・前方一致）
    if (selectedPrefectures.length > 0) {
      list = list.filter((c) =>
        selectedPrefectures.some((p) => (c.location ?? "").startsWith(p))
      );
    }

    // スキルタグ（OR）
    if (selectedSkillTags.length > 0) {
      list = list.filter((c) =>
        selectedSkillTags.some((t) => c.skills.includes(t))
      );
    }

    // 希望年収フィルター
    // desired_salary_max を判定軸とする: 候補者の希望レンジ上限が選択下限以上なら「出せる候補」
    // desired_salary_min だけ設定されているケースは稀なので max 優先、max が null なら min で補完
    if (salaryMin > 0) {
      list = list.filter((c) => {
        const salaryVal = c.desiredSalaryMax ?? c.desiredSalaryMin;
        if (salaryVal === null) return includeNoSalary; // 未設定は includeNoSalary に従う
        return salaryVal >= salaryMin;
      });
    }

    return list;
  }, [
    candidates, q, workStyle, jobCategoryKey, selectedJobType,
    phase, transferTiming, hideAlreadyScouted,
    selectedDecades, selectedPrefectures, selectedSkillTags,
    salaryMin, includeNoSalary,
  ]);

  const jobTypeFilterActive = jobCategoryKey !== null;
  const activeFilterCount = [
    workStyle,
    jobTypeFilterActive ? "x" : "",
    phase,
    transferTiming,
    hideAlreadyScouted ? "x" : "",
    selectedDecades.length ? "x" : "",
    selectedPrefectures.length ? "x" : "",
    selectedSkillTags.length ? "x" : "",
    salaryMin > 0 ? "x" : "",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setQ("");
    setWorkStyle("");
    setJobCategoryKey(null);
    setSelectedJobType(null);
    setPhase("");
    setTransferTiming("");
    setHideAlreadyScouted(false);
    setSelectedDecades([]);
    setSelectedPrefectures([]);
    setSelectedSkillTags([]);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* フリーワード */}
      <div>
        <SidebarLabel>キーワード</SidebarLabel>
        <div style={{ position: "relative" }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・職種・会社・スキル・地域"
            style={{
              width: "100%", height: 34, padding: q ? "0 28px 0 10px" : "0 10px",
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
      </div>

      {/* 職種 */}
      <div>
        <SidebarLabel>職種カテゴリ</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
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
          <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--royal-50)", borderRadius: 8, border: "1px solid var(--royal-100)" }}>
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
      </div>

      {/* 勤務スタイル */}
      <div>
        <SidebarLabel>勤務スタイル</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Pill active={workStyle === ""} onClick={() => setWorkStyle("")}>全て</Pill>
          {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
            <Pill key={v} active={workStyle === v} onClick={() => setWorkStyle(workStyle === v ? "" : v)}>{l}</Pill>
          ))}
        </div>
      </div>

      {/* 企業フェーズ */}
      <div>
        <SidebarLabel>希望企業フェーズ</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Pill active={phase === ""} onClick={() => setPhase("")}>全て</Pill>
          {PHASE_OPTIONS.map((v) => (
            <Pill key={v} active={phase === v} onClick={() => setPhase(phase === v ? "" : v)}>{v}</Pill>
          ))}
        </div>
      </div>

      {/* 転職時期 */}
      <div>
        <SidebarLabel>転職時期</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <Pill active={transferTiming === ""} color="warm" onClick={() => setTransferTiming("")}>全て</Pill>
          {TRANSFER_TIMING_OPTIONS.map(({ value, label }) => (
            <Pill key={value} active={transferTiming === value} color="warm"
              onClick={() => setTransferTiming(transferTiming === value ? "" : value)}>
              {label}
            </Pill>
          ))}
        </div>
      </div>

      {/* 年代 — 複数選択 OR */}
      <div>
        <SidebarLabel>年代</SidebarLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {DECADE_OPTIONS.map((d) => (
            <Pill key={d} active={selectedDecades.includes(d)} color="purple"
              onClick={() => setSelectedDecades(toggleMulti(selectedDecades, d))}>
              {d}
            </Pill>
          ))}
        </div>
        {selectedDecades.length > 0 && (
          <button type="button" onClick={() => setSelectedDecades([])}
            style={{ marginTop: 5, fontSize: 10, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
            クリア
          </button>
        )}
      </div>

      {/* 居住地 — 複数選択 OR */}
      {uniquePrefectures.length > 0 && (
        <div>
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
              style={{ marginTop: 5, fontSize: 10, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
              クリア
            </button>
          )}
        </div>
      )}

      {/* 希望年収 */}
      <div>
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
        {/* 年収下限指定中のみ「未設定含む」チェックを表示 */}
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

      {/* スキルタグ — 複数選択 OR */}
      {uniqueSkillTags.length > 0 && (
        <div>
          <SidebarLabel>スキルタグ</SidebarLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {uniqueSkillTags.map((s) => (
              <Pill key={s} active={selectedSkillTags.includes(s)} color="royal"
                onClick={() => setSelectedSkillTags(toggleMulti(selectedSkillTags, s))}>
                {s}
              </Pill>
            ))}
          </div>
          {selectedSkillTags.length > 0 && (
            <button type="button" onClick={() => setSelectedSkillTags([])}
              style={{ marginTop: 5, fontSize: 10, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
              クリア
            </button>
          )}
        </div>
      )}

      {/* 区切り */}
      <div style={{ borderTop: "1px solid var(--line)" }} />

      {/* スカウト済み除外 */}
      {alreadyScoutedCount > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── ヘッダー ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 5px" }}>候補者を探す</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            スカウトを受け取る設定をした求職者が表示されます。
          </p>
        </div>
        {showQuota && (
          <div style={{
            background: scoutQuota.remaining === 0 ? "var(--error-soft)" : "var(--bg-tint)",
            border: `1px solid ${scoutQuota.remaining === 0 ? "#FECACA" : "var(--line)"}`,
            borderRadius: 8, padding: "8px 14px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 8,
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
          width: 220, flexShrink: 0,
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
            {(selectedDecades.length > 0 || selectedPrefectures.length > 0 || selectedSkillTags.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {selectedDecades.map((d) => (
                  <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: "var(--purple-soft)", border: "1px solid var(--purple)", color: "var(--purple)", fontSize: 11, fontWeight: 700 }}>
                    {d}
                    <button type="button" onClick={() => setSelectedDecades(selectedDecades.filter((v) => v !== d))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                {selectedPrefectures.map((p) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)", fontSize: 11, fontWeight: 700 }}>
                    {p}
                    <button type="button" onClick={() => setSelectedPrefectures(selectedPrefectures.filter((v) => v !== p))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                {selectedSkillTags.map((s) => (
                  <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 999, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--accent)", fontSize: 11, fontWeight: 700 }}>
                    {s}
                    <button type="button" onClick={() => setSelectedSkillTags(selectedSkillTags.filter((v) => v !== s))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 候補者グリッド */}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {filtered.map((c) => {
                const decade = toDecade(c.birthYear);
                const startedLabel = formatStarted(c.startedAt);
                const empLabel = c.employmentType ? (EMPLOYMENT_TYPE_LABELS[c.employmentType] ?? c.employmentType) : null;
                return (
                  <a key={c.id} href={`/u/${c.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none", display: "block" }}>
                    <div
                      style={{
                        background: "#fff",
                        border: c.alreadyScouted ? "1px solid #E2E8F0" : "1px solid var(--line)",
                        borderRadius: 14, padding: "16px 18px",
                        transition: "box-shadow 0.15s, transform 0.15s",
                        cursor: "pointer", height: "100%",
                        opacity: c.alreadyScouted ? 0.75 : 1,
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,35,102,0.10)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLDivElement).style.transform = "none";
                      }}
                    >
                      {c.alreadyScouted && (
                        <div style={{ position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 100, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)" }}>
                          送信済み
                        </div>
                      )}

                      {/* Avatar + name */}
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: getGradient(c.id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
                          {c.name.charAt(0) || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{c.name}</span>
                            {decade && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 100, background: "var(--purple-soft)", border: "1px solid #DDD6FE", color: "var(--purple)" }}>
                                {decade}
                              </span>
                            )}
                            {c.isOpenToWork && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 100, background: "var(--success-soft)", border: "1px solid #6EE7B7", color: "var(--success)" }}>転職検討中</span>
                            )}
                            {c.isMentor && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 100, background: "var(--purple-soft)", border: "1px solid #DDD6FE", color: "var(--purple)" }}>メンター</span>
                            )}
                          </div>
                          {(c.currentRole || c.currentCompany) ? (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                              {c.currentRole && <span style={{ fontWeight: 600 }}>{c.currentRole}</span>}
                              {c.currentRole && c.currentCompany && <span style={{ color: "var(--ink-mute)" }}> @ </span>}
                              {c.currentCompany && <span>{c.currentCompany}</span>}
                              {(empLabel || startedLabel) && (
                                <span style={{ color: "var(--ink-mute)", fontSize: 11 }}> · {[empLabel, startedLabel].filter(Boolean).join("  ")}</span>
                              )}
                            </div>
                          ) : c.jobType ? (
                            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{JOB_TYPE_DISPLAY_LABELS[c.jobType] ?? c.jobType}</div>
                          ) : null}
                        </div>
                      </div>

                      {/* スキルタグ */}
                      {c.skills.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                          {c.skills.slice(0, 6).map((skill) => (
                            <span key={skill} style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 100,
                              background: selectedSkillTags.includes(skill) ? "var(--royal)" : "var(--royal-50)",
                              border: `1px solid ${selectedSkillTags.includes(skill) ? "var(--royal)" : "var(--royal-100)"}`,
                              color: selectedSkillTags.includes(skill) ? "#fff" : "var(--accent)",
                              fontWeight: 600,
                            }}>
                              {skill}
                            </span>
                          ))}
                          {c.skills.length > 6 && (
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-mute)" }}>
                              +{c.skills.length - 6}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 属性タグ */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                        {c.location && (
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {c.location}
                          </span>
                        )}
                        {c.workStyle && (
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--accent)", fontWeight: 600 }}>
                            {WORK_STYLE_LABELS[c.workStyle] ?? c.workStyle}
                          </span>
                        )}
                        {c.transferTiming && (
                          <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 100, background: "var(--warm-soft)", border: "1px solid #FDE68A", color: "#92400E", fontWeight: 600 }}>
                            ⏱ {c.transferTiming}
                          </span>
                        )}
                      </div>

                      {/* スカウトボタン */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <button type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScout(c); }}
                          disabled={(scoutQuota?.remaining ?? 1) === 0}
                          style={{
                            fontSize: 12, padding: "6px 14px", borderRadius: 6, fontWeight: 600,
                            fontFamily: "inherit", whiteSpace: "nowrap" as const,
                            background: (scoutQuota?.remaining ?? 1) === 0 ? "var(--bg-tint)" : c.alreadyScouted ? "#fff" : "var(--royal)",
                            color: (scoutQuota?.remaining ?? 1) === 0 ? "var(--ink-mute)" : c.alreadyScouted ? "var(--royal)" : "#fff",
                            border: c.alreadyScouted ? "1px solid var(--royal)" : "none",
                            cursor: (scoutQuota?.remaining ?? 1) === 0 ? "default" : "pointer",
                          }}>
                          {c.alreadyScouted ? "再スカウト" : "スカウトを送る"}
                        </button>
                        <span style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600 }}>詳細 →</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 28, padding: "12px 16px", background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 10, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            表示されるのは「スカウトを受け取る」設定をした求職者のみです。在籍企業・手動ブロック企業のスカウトは自動でブロックされます。
          </div>
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
