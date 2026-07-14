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

// birth_year → 年代ラベル（nullなら null）
function toDecade(birthYear: number | null): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return "10代";
  const decade = Math.floor(age / 10) * 10;
  return `${decade}代`;
}

// started_at → 在籍開始年月表示
function formatStarted(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  return `${d.getFullYear()}年${d.getMonth() + 1}月〜`;
}

const PHASE_OPTIONS = ["シリーズA", "シリーズB", "シリーズC", "上場"];

const TRANSFER_TIMING_OPTIONS = [
  { value: "即時",       label: "即時" },
  { value: "1〜3ヶ月以内", label: "1〜3ヶ月以内" },
  { value: "半年以内",   label: "半年以内" },
  { value: "1年以内",    label: "1年以内" },
  { value: "情報収集中", label: "情報収集中" },
];

function catChipStyle(active: boolean): React.CSSProperties {
  return {
    height: 30, padding: "0 12px", borderRadius: 15,
    fontSize: 12, fontWeight: active ? 700 : 400,
    border: active ? "1.5px solid var(--royal)" : "1px solid var(--line)",
    background: active ? "var(--royal-50)" : "#fff",
    color: active ? "var(--royal)" : "var(--ink-soft)",
    cursor: "pointer", whiteSpace: "nowrap" as const,
    fontFamily: "inherit", transition: "all 0.15s",
    display: "inline-flex", alignItems: "center", gap: 4,
  };
}

function jobChipStyle(active: boolean): React.CSSProperties {
  return {
    height: 28, padding: "0 10px", borderRadius: 14,
    fontSize: 11, fontWeight: active ? 700 : 400,
    border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
    background: active ? "var(--royal-50)" : "var(--bg-tint)",
    color: active ? "var(--accent)" : "var(--ink-soft)",
    cursor: "pointer", whiteSpace: "nowrap" as const,
    fontFamily: "inherit", transition: "all 0.15s",
    display: "inline-flex", alignItems: "center",
  };
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
  const [q, setQ] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [hideAlreadyScouted, setHideAlreadyScouted] = useState(false);

  // Scout modal state
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
      if (!res.ok) {
        setScoutError(data.error ?? "送信に失敗しました");
        return;
      }
      setScoutSuccess(true);
    } catch {
      setScoutError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setScoutSending(false);
    }
  }

  const [jobCategoryKey, setJobCategoryKey] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState<string | null>(null);
  const [phase, setPhase] = useState("");
  const [transferTiming, setTransferTiming] = useState("");

  function selectCategory(key: string | null) {
    setJobCategoryKey(key);
    setSelectedJobType(null);
  }

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

    if (phase)          list = list.filter((c) => c.desiredPhase?.includes(phase));
    if (transferTiming) list = list.filter((c) => c.transferTiming === transferTiming);

    return list;
  }, [candidates, q, workStyle, jobCategoryKey, selectedJobType, phase, transferTiming, hideAlreadyScouted]);

  const jobTypeFilterActive = jobCategoryKey !== null;
  const activeFilterCount = [
    workStyle,
    jobTypeFilterActive ? "x" : "",
    phase,
    transferTiming,
    hideAlreadyScouted ? "x" : "",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setWorkStyle("");
    setJobCategoryKey(null);
    setSelectedJobType(null);
    setPhase("");
    setTransferTiming("");
    setHideAlreadyScouted(false);
  }

  const selectedCat = getVisibleCategories().find((c) => c.key === jobCategoryKey);
  const alreadyScoutedCount = candidates.filter((c) => c.alreadyScouted).length;
  const showQuota = scoutQuota && scoutQuota.usedThisMonth > 0;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
            候補者を探す
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            スカウトを受け取る設定をした求職者が表示されます。
          </p>
        </div>
        {/* Scout quota — 1通以上送った後のみ表示 */}
        {showQuota && (
          <div style={{
            background: scoutQuota.remaining === 0 ? "var(--error-soft)" : "var(--bg-tint)",
            border: `1px solid ${scoutQuota.remaining === 0 ? "#FECACA" : "var(--line)"}`,
            borderRadius: 8, padding: "8px 14px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>残り</span>
            <span style={{
              fontSize: 16, fontWeight: 800, fontFamily: "Inter, sans-serif",
              color: scoutQuota.remaining === 0 ? "var(--error)" : "var(--ink)",
            }}>
              {scoutQuota.remaining}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              / {scoutQuota.monthlyLimit + scoutQuota.bonusCredits} 通
            </span>
          </div>
        )}
      </div>

      {/* Scout modal */}
      {scoutTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={(e) => { if (e.target === e.currentTarget) setScoutTarget(null); }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 36px",
            width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          }}>
            {scoutSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
                  background: "linear-gradient(135deg, var(--success), #34D399)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>スカウトを送信しました</h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
                  {scoutTarget.name} さんへのスカウトを送信しました。<br />
                  返信があればOPINIOから通知します。
                </p>
                <button
                  type="button"
                  onClick={() => { setScoutTarget(null); window.location.reload(); }}
                  style={{ background: "var(--royal)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                    {scoutTarget.name} さんにスカウトを送る
                  </h3>
                  <button type="button" onClick={() => setScoutTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-mute)" }}>×</button>
                </div>
                {jobOptions.length > 0 && (
                  <label style={{ display: "block", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>求人を指定（任意）</div>
                    <select
                      value={scoutJobId}
                      onChange={(e) => setScoutJobId(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, background: "#fff", fontFamily: "inherit" }}
                    >
                      <option value="">求人を指定しない（カジュアルな連絡）</option>
                      {jobOptions.map((j) => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={{ display: "block", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                    メッセージ <span style={{ color: "var(--error)" }}>*</span>
                  </div>
                  <textarea
                    value={scoutMessage}
                    onChange={(e) => setScoutMessage(e.target.value)}
                    placeholder={"はじめまして。〇〇株式会社の△△と申します。\nご経歴を拝見し、ぜひ一度お話しできればと思いご連絡しました。"}
                    rows={6}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "right", marginTop: 4 }}>
                    {scoutMessage.length} / 2000
                  </div>
                </label>
                {scoutError && (
                  <div style={{ background: "var(--error-soft)", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--error)", marginBottom: 16 }}>
                    {scoutError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setScoutTarget(null)} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
                  <button
                    type="button"
                    onClick={sendScout}
                    disabled={scoutSending || !scoutMessage.trim()}
                    style={{
                      background: scoutSending || !scoutMessage.trim() ? "var(--ink-mute)" : "var(--royal)",
                      color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
                      fontSize: 14, fontWeight: 600,
                      cursor: scoutSending || !scoutMessage.trim() ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {scoutSending ? "送信中..." : "スカウトを送る"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 24,
      }}>
        {/* Row 1: search + work-style + count/clear */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="名前・職種・会社・スキル・地域で検索..."
              aria-label="候補者を検索"
              style={{
                width: "100%", height: 36, padding: q ? "0 32px 0 12px" : "0 12px",
                border: "1px solid var(--line)", borderRadius: 8,
                fontSize: 13, outline: "none", fontFamily: "inherit", color: "var(--ink)",
                boxSizing: "border-box",
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="検索をクリア"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            )}
          </div>
          <select
            value={workStyle}
            aria-label="勤務スタイルで絞り込み"
            onChange={(e) => setWorkStyle(e.target.value)}
            style={{
              height: 36, padding: "0 10px",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: workStyle ? "var(--ink)" : "var(--ink-soft)", background: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          >
            <option value="">勤務スタイル（全て）</option>
            {Object.entries(WORK_STYLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span aria-live="polite" aria-atomic="true" style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              <strong style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>{filtered.length}</strong>
              {" "}件
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--line)", background: "#fff",
                  color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                クリア ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* Row 2: 職種カテゴリ chip */}
        <div style={{ marginBottom: selectedCat ? 8 : 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", marginRight: 2 }}>職種:</span>
            {getVisibleCategories().map((cat) => (
              <button
                key={cat.key}
                type="button"
                aria-pressed={jobCategoryKey === cat.key}
                onClick={() => selectCategory(jobCategoryKey === cat.key ? null : cat.key)}
                style={catChipStyle(jobCategoryKey === cat.key)}
              >
                <span aria-hidden="true">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2b: 配下職種 chip */}
        {selectedCat && (
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
            padding: "8px 10px", marginBottom: 10,
            background: "var(--royal-50)", borderRadius: 8,
            border: "1px solid var(--royal-100)",
          }}>
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {selectedCat.emoji} {selectedCat.label}:
            </span>
            {selectedCat.types.map((jt) => (
              <button
                key={jt}
                type="button"
                aria-pressed={selectedJobType === jt}
                onClick={() => setSelectedJobType(selectedJobType === jt ? null : jt)}
                style={jobChipStyle(selectedJobType === jt)}
              >
                {JOB_TYPE_DISPLAY_LABELS[jt] ?? jt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectCategory(null)}
              style={{
                marginLeft: "auto", height: 24, padding: "0 8px", borderRadius: 6,
                fontSize: 11, border: "1px solid var(--royal-100)",
                background: "#fff", color: "var(--ink-mute)", cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              ✕ カテゴリを解除
            </button>
          </div>
        )}

        {/* Row 3: phase + transfer timing + 除外フィルタ */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>企業フェーズ:</span>
          {["", ...PHASE_OPTIONS].map((v) => (
            <button
              type="button"
              key={v || "all"}
              onClick={() => setPhase(v)}
              aria-pressed={phase === v}
              style={{
                height: 28, padding: "0 10px", borderRadius: 14,
                fontSize: 11, fontWeight: phase === v ? 700 : 400,
                border: phase === v ? "1.5px solid var(--royal)" : "1px solid var(--line)",
                background: phase === v ? "var(--royal-50)" : "#fff",
                color: phase === v ? "var(--royal)" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {v || "全て"}
            </button>
          ))}

          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>転職時期:</span>
          {["", ...TRANSFER_TIMING_OPTIONS.map((o) => o.value)].map((v) => (
            <button
              type="button"
              key={v || "all"}
              onClick={() => setTransferTiming(v)}
              aria-pressed={transferTiming === v}
              style={{
                height: 28, padding: "0 10px", borderRadius: 14,
                fontSize: 11, fontWeight: transferTiming === v ? 700 : 400,
                border: transferTiming === v ? "1.5px solid var(--warm)" : "1px solid var(--line)",
                background: transferTiming === v ? "var(--warm-soft)" : "#fff",
                color: transferTiming === v ? "#92400E" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {v || "全て"}
            </button>
          ))}

          {/* スカウト済み除外トグル */}
          {alreadyScoutedCount > 0 && (
            <button
              type="button"
              onClick={() => setHideAlreadyScouted(!hideAlreadyScouted)}
              aria-pressed={hideAlreadyScouted}
              style={{
                height: 28, padding: "0 10px", borderRadius: 14, marginLeft: "auto",
                fontSize: 11, fontWeight: hideAlreadyScouted ? 700 : 400,
                border: hideAlreadyScouted ? "1.5px solid var(--ink)" : "1px solid var(--line)",
                background: hideAlreadyScouted ? "var(--ink)" : "#fff",
                color: hideAlreadyScouted ? "#fff" : "var(--ink-soft)",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              スカウト済みを除く（{alreadyScoutedCount}人）
            </button>
          )}
        </div>
      </div>

      {/* Candidates grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "72px 0", background: "#fff",
          borderRadius: 16, border: "1px solid var(--line)",
        }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>
            条件に合う候補者が見つかりませんでした
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            {candidates.length === 0
              ? "現在、スカウトを受け取る設定をしている求職者はいません"
              : "フィルター条件を変えてみてください"}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.map((c) => {
            const decade = toDecade(c.birthYear);
            const startedLabel = formatStarted(c.startedAt);
            const empLabel = c.employmentType ? (EMPLOYMENT_TYPE_LABELS[c.employmentType] ?? c.employmentType) : null;
            return (
              <a
                key={c.id}
                href={`/u/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div
                  style={{
                    background: "#fff",
                    border: c.alreadyScouted ? "1px solid #E2E8F0" : "1px solid var(--line)",
                    borderRadius: 14, padding: "18px 20px",
                    transition: "box-shadow 0.15s, transform 0.15s",
                    cursor: "pointer",
                    height: "100%",
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
                  {/* スカウト済みバッジ */}
                  {c.alreadyScouted && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                      background: "var(--bg-tint)", color: "var(--ink-mute)",
                      border: "1px solid var(--line)",
                    }}>
                      送信済み
                    </div>
                  )}

                  {/* Avatar + name + badges */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: getGradient(c.id),
                      color: "#fff", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 17, fontWeight: 700,
                    }}>
                      {c.name.charAt(0) || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                          {c.name}
                        </span>
                        {decade && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 100,
                            background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-mute)",
                          }}>{decade}</span>
                        )}
                        {c.isOpenToWork && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100,
                            background: "var(--success-soft)", border: "1px solid #6EE7B7", color: "var(--success)",
                          }}>転職検討中</span>
                        )}
                        {c.isMentor && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100,
                            background: "var(--purple-soft)", border: "1px solid #DDD6FE", color: "var(--purple)",
                          }}>メンター</span>
                        )}
                      </div>
                      {/* 現職情報 */}
                      {(c.currentRole || c.currentCompany) ? (
                        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                          {c.currentRole && <span style={{ fontWeight: 600 }}>{c.currentRole}</span>}
                          {c.currentRole && c.currentCompany && <span style={{ color: "var(--ink-mute)" }}> @ </span>}
                          {c.currentCompany && <span>{c.currentCompany}</span>}
                          {(empLabel || startedLabel) && (
                            <span style={{ color: "var(--ink-mute)", fontSize: 11 }}>
                              {" "}·{" "}
                              {[empLabel, startedLabel].filter(Boolean).join("  ")}
                            </span>
                          )}
                        </div>
                      ) : c.jobType ? (
                        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          {JOB_TYPE_DISPLAY_LABELS[c.jobType] ?? c.jobType}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* スキルタグ（最大6件） */}
                  {c.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {c.skills.slice(0, 6).map((skill) => (
                        <span key={skill} style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 100,
                          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                          color: "var(--accent)", fontWeight: 600,
                        }}>
                          {skill}
                        </span>
                      ))}
                      {c.skills.length > 6 && (
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 100,
                          background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-mute)",
                        }}>
                          +{c.skills.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 属性タグ行 */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                    {c.location && (
                      <span style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 100,
                        background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)",
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {c.location}
                      </span>
                    )}
                    {c.workStyle && (
                      <span style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 100,
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--accent)",
                        fontWeight: 600,
                      }}>
                        {WORK_STYLE_LABELS[c.workStyle] ?? c.workStyle}
                      </span>
                    )}
                    {c.transferTiming && (
                      <span style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 100,
                        background: "var(--warm-soft)", border: "1px solid #FDE68A", color: "#92400E",
                        fontWeight: 600,
                      }}>
                        ⏱ {c.transferTiming}
                      </span>
                    )}
                  </div>

                  {/* Footer: スカウトボタン */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScout(c); }}
                      disabled={(scoutQuota?.remaining ?? 1) === 0}
                      style={{
                        fontSize: 12, padding: "6px 14px", borderRadius: 6,
                        background: (scoutQuota?.remaining ?? 1) === 0
                          ? "var(--bg-tint)"
                          : c.alreadyScouted
                            ? "#fff"
                            : "var(--royal)",
                        color: (scoutQuota?.remaining ?? 1) === 0
                          ? "var(--ink-mute)"
                          : c.alreadyScouted
                            ? "var(--royal)"
                            : "#fff",
                        border: c.alreadyScouted ? "1px solid var(--royal)" : "none",
                        cursor: (scoutQuota?.remaining ?? 1) === 0 ? "default" : "pointer",
                        fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
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

      <div style={{
        marginTop: 32, padding: "14px 18px", background: "var(--royal-50)",
        border: "1px solid var(--royal-100)", borderRadius: 10,
        fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
      }}>
        表示されるのは「スカウトを受け取る」設定をした求職者のみです。在籍企業・手動ブロック企業のスカウトは自動でブロックされます。
      </div>
    </div>
  );
}
