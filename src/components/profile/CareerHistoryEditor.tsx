"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import StoryAccordion from "./StoryAccordion";


// ── Types ─────────────────────────────────────────────────────────────────────

export type Stint = {
  id: string;
  displayCompanyName: string;
  companyType: "master" | "custom" | "anon";
  companyId?: string;
  companyText?: string;
  companyAnonymized?: string;
  roleCategoryId: string;
  roleLabel: string;
  roleTitle?: string;
  department?: string;
  startedAt: string;   // YYYY-MM
  endedAt?: string;    // YYYY-MM
  isCurrent: boolean;
  description?: string;
  joinReason?: string;
  rank?: "none" | "leader" | "manager" | "general_manager" | "executive" | null;
  employmentType?: string;
  salaryBase?: number | null;
  salaryBonus?: number | null;
  salaryStock?: number | null;
  salaryMan?: number | null;
  visibilityCompany?: "real" | "masked" | "hidden";
  visibilityCompanyProfile?: "real" | "masked" | "hidden";
  visibilitySalary?: boolean;
  visibilityReason?: boolean;
};

// ── Group types and helpers ───────────────────────────────────────────────────

type StintGroup = {
  key: string;
  companyType: "master" | "custom" | "anon";
  companyId?: string;
  companyText?: string;
  companyAnonymized?: string;
  displayCompanyName: string;
  positions: Stint[];
  earliestStart: string;
  latestEnd: string | null;
  totalMonths: number;
};

function diffInMonths(startYM: string, endYM: string): number {
  const [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths}ヶ月`;
  if (remainingMonths === 0) return `${years}年`;
  return `${years}年${remainingMonths}ヶ月`;
}

function groupKey(s: Stint): string {
  if (s.companyType === "master" && s.companyId) return `m:${s.companyId}`;
  if (s.companyType === "custom" && s.companyText) return `c:${s.companyText}`;
  return `a:${s.companyAnonymized ?? s.displayCompanyName}`;
}

function groupStints(stints: Stint[]): StintGroup[] {
  if (stints.length === 0) return [];

  const groups: StintGroup[] = [];
  // 出戻りパターン対応: 同一 baseKey が複数グループになる場合に key を一意化するカウンタ
  const keyCount = new Map<string, number>();
  let i = 0;

  while (i < stints.length) {
    const first = stints[i];
    const baseKey = groupKey(first);
    // 連続する同一会社エントリを積む（非連続 = 出戻りは別ループで別グループになる）
    const positions: Stint[] = [first];
    let j = i + 1;
    while (j < stints.length && groupKey(stints[j]) === baseKey) {
      positions.push(stints[j]);
      j++;
    }

    // key 一意化: 出戻りで同一 baseKey が2度目以降に現れる場合は "#1", "#2" を付与
    const count = keyCount.get(baseKey) ?? 0;
    const uniqueKey = count === 0 ? baseKey : `${baseKey}#${count}`;
    keyCount.set(baseKey, count + 1);

    // positions は sortStints() 済みの順序をそのまま維持（追加ソート不要）
    const earliestStart = positions.reduce(
      (acc, p) => (p.startedAt < acc ? p.startedAt : acc),
      positions[0].startedAt
    );
    const hasCurrent = positions.some((p) => p.isCurrent);
    let latestEnd: string | null;
    if (hasCurrent) {
      latestEnd = null;
    } else {
      latestEnd = positions.reduce<string>((acc, p) => {
        const end = p.endedAt ?? p.startedAt;
        return end > acc ? end : acc;
      }, positions[0].endedAt ?? positions[0].startedAt);
    }
    const endForCalc = latestEnd ?? (() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      return `${yyyy}-${mm}`;
    })();
    const totalMonths = diffInMonths(earliestStart, endForCalc);

    groups.push({
      key: uniqueKey,
      companyType: first.companyType,
      companyId: first.companyId,
      companyText: first.companyText,
      companyAnonymized: first.companyAnonymized,
      displayCompanyName: first.displayCompanyName,
      positions,
      earliestStart,
      latestEnd,
      totalMonths,
    });

    i = j;
  }

  // 現職グループを先頭、以降は earliestStart DESC（連続走査後の念のためソート）
  return groups.sort((a, b) => {
    const aHasCurrent = a.latestEnd === null;
    const bHasCurrent = b.latestEnd === null;
    if (aHasCurrent !== bHasCurrent) return aHasCurrent ? -1 : 1;
    return b.earliestStart.localeCompare(a.earliestStart);
  });
}

function isOverlapping(a: StintGroup, b: StintGroup): boolean {
  const aEnd = a.latestEnd ?? "9999-12";
  const bEnd = b.latestEnd ?? "9999-12";
  return a.earliestStart <= bEnd && b.earliestStart <= aEnd;
}

function buildTimelineRows(groups: StintGroup[]): StintGroup[][] {
  const rows: StintGroup[][] = [];
  const placed = new Set<string>();
  for (let i = 0; i < groups.length; i++) {
    if (placed.has(groups[i].key)) continue;
    const row: StintGroup[] = [groups[i]];
    placed.add(groups[i].key);
    for (let j = i + 1; j < groups.length; j++) {
      if (placed.has(groups[j].key)) continue;
      if (row.length < 2 && isOverlapping(groups[i], groups[j])) {
        row.push(groups[j]);
        placed.add(groups[j].key);
      }
    }
    rows.push(row);
  }
  return rows;
}

function formatGroupDateRange(group: StintGroup): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  const start = fmt(group.earliestStart);
  const end = group.latestEnd === null ? "現在" : fmt(group.latestEnd);
  return `${start} 〜 ${end}`;
}

type StintDraft = {
  companyName: string;
  companyId: string | null;  // 候補選択時のみ非null、＋登録・自由入力時は null
  isAnon: boolean;
  roleCategoryId: string;
  roleTitle: string;
  department: string;
  rank: string;
  startedAt: string;
  endedAt: string;
  isCurrent: boolean;
  description: string;
  joinReason: string;
  employmentType: string;
  salaryBase: string;
  salaryBonus: string;
  salaryStock: string;
  salaryMan: string;           // 自動計算 = salaryBase + salaryBonus + salaryStock
  visibilityCompany: "real" | "masked" | "hidden";
  visibilityCompanyProfile: "real" | "masked" | "hidden";
  visibilitySalary: boolean;
  visibilityReason: boolean;
};

// ── Select options ────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => CURRENT_YEAR - i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** "YYYY-MM" ↔ { year, month } 変換ヘルパー */
function parseYearMonth(ym: string): { year: string; month: string } {
  if (!ym) return { year: "", month: "" };
  const [y, m] = ym.split("-");
  return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "" };
}
function buildYearMonth(year: string, month: string): string {
  if (!year || !month) return "";
  return `${year}-${month.padStart(2, "0")}`;
}

const RANK_OPTIONS = [
  { value: "", label: "選択してください" },
  { value: "none", label: "役職なし" },
  { value: "leader", label: "係長・リーダークラス" },
  { value: "manager", label: "課長・マネージャークラス" },
  { value: "general_manager", label: "部長・ゼネラルマネージャークラス" },
  { value: "executive", label: "役員クラス" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "選択してください" },
  { value: "正社員", label: "正社員" },
  { value: "契約社員", label: "契約社員" },
  { value: "派遣社員", label: "派遣社員" },
  { value: "業務委託", label: "業務委託" },
  { value: "アルバイト・パート", label: "アルバイト・パート" },
  { value: "その他", label: "その他" },
];

const EMPTY_DRAFT: StintDraft = {
  companyName: "",
  companyId: null,
  isAnon: false,
  roleCategoryId: "",
  roleTitle: "",
  department: "",
  rank: "",
  startedAt: "",
  endedAt: "",
  isCurrent: false,
  description: "",
  joinReason: "",
  employmentType: "",
  salaryBase: "",
  salaryBonus: "",
  salaryStock: "",
  salaryMan: "",
  visibilityCompany: "real",
  visibilityCompanyProfile: "real",
  visibilitySalary: false,
  visibilityReason: true,
};

// ── Company body helpers ──────────────────────────────────────────────────────

/** 保存 body 用: company_id / company_text / company_anonymized の3者排他を保証 */
function buildCompanyBody(
  draft: Pick<StintDraft, "isAnon" | "companyId" | "companyName">
): Record<string, string> {
  if (draft.isAnon) {
    return { company_anonymized: draft.companyName || "非公開企業" };
  } else if (draft.companyId) {
    // null も "" も falsy → company_text 経路へ
    return { company_id: draft.companyId };
  } else {
    return { company_text: draft.companyName };
  }
}

/** 楽観的更新用: StintDraft から Stint の会社名フィールドを組み立てる */
function optimisticCompanyFields(
  draft: Pick<StintDraft, "isAnon" | "companyId" | "companyName">
): Pick<Stint, "displayCompanyName" | "companyType" | "companyId" | "companyText" | "companyAnonymized"> {
  if (draft.isAnon) {
    return {
      displayCompanyName: draft.companyName || "非公開企業",
      companyType: "anon",
      companyId: undefined,
      companyText: undefined,
      companyAnonymized: draft.companyName || "非公開企業",
    };
  } else if (draft.companyId) {
    return {
      displayCompanyName: draft.companyName,
      companyType: "master",
      companyId: draft.companyId,
      companyText: undefined,
      companyAnonymized: undefined,
    };
  } else {
    return {
      displayCompanyName: draft.companyName,
      companyType: "custom",
      companyId: undefined,
      companyText: draft.companyName,
      companyAnonymized: undefined,
    };
  }
}

// ── Sort helper: isCurrent first, then startedAt DESC ────────────────────────

function sortStints(arr: Stint[]): Stint[] {
  return [...arr].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeriod(startedAt: string, endedAt?: string, isCurrent?: boolean): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  if (isCurrent) return `${fmt(startedAt)} 〜 現在`;
  if (endedAt) return `${fmt(startedAt)} 〜 ${fmt(endedAt)}`;
  return `${fmt(startedAt)} 〜`;
}

function fieldStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "1.5px solid var(--line)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    color: "var(--ink)",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--ink-mute)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  };
}

// ── IconButton ────────────────────────────────────────────────────────────────

function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: hovered
          ? danger ? "var(--error-soft)" : "var(--line-soft)"
          : "transparent",
        borderRadius: 5,
        fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer",
        transition: "background 0.12s",
        padding: 0,
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── CompanySearch ─────────────────────────────────────────────────────────────

type CompanySuggestion = {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  employee_count: string | null;
};

const AVATAR_COLORS = ["#4F46E5", "var(--success)", "#DC2626", "#D97706", "#0891B2", "#7C3AED"];
function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function CompanySearch({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (companyId: string | null, companyName: string) => void;
}) {
  const [results, setResults] = useState<CompanySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click outside → close dropdown
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(null, q); // companyId をキーストローク毎にリセット
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(q.trim())}&limit=10`
        );
        if (res.ok) {
          const data = (await res.json()) as { results?: CompanySuggestion[] };
          setResults(data.results ?? []);
        }
      } catch {
        // fetch 失敗時も ＋新規登録行は維持するため results を空のままにする
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleSelect(c: CompanySuggestion) {
    onChange(c.id, c.name);
    setResults([]);
    setOpen(false);
  }

  function handleNew() {
    onChange(null, value); // companyId=null、companyName=入力テキストで確定
    setResults([]);
    setOpen(false);
  }

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <style>{`
        .ched-suggest-row:hover { background: var(--royal-50) !important; }
        .ched-suggest-new:hover { background: var(--royal-50) !important; }
      `}</style>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={() => { if (value.trim().length > 0) setOpen(true); }}
        placeholder="株式会社〇〇"
        disabled={disabled}
        style={fieldStyle()}
      />
      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(15,23,42,0.1)", zIndex: 30,
          maxHeight: 260, overflowY: "auto",
        }}>
          {/* ローディング表示（結果0件かつロード中のみ） */}
          {loading && results.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--ink-mute)" }}>
              検索中…
            </div>
          )}

          {/* 候補リスト */}
          {results.map((c) => {
            const avatarColor = getAvatarColor(c.name);
            return (
              <div
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                style={{
                  padding: "9px 12px", display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", borderBottom: "1px solid var(--line-soft)",
                }}
                className="ched-suggest-row"
              >
                {/* アバター: logo_url があれば画像、無ければイニシャル+固定色 */}
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  overflow: "hidden",
                  background: c.logo_url ? "#f5f7fa" : avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {c.logo_url ? (
                    <Image src={c.logo_url} alt={c.name} width={36} height={36} style={{ objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
                      {c.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                  {(c.industry || c.employee_count) && (
                    <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 1 }}>
                      {[c.industry, c.employee_count ? `${c.employee_count}名` : null].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ＋ 新規登録 — 入力がある限り常時表示 */}
          <div
            onMouseDown={(e) => { e.preventDefault(); handleNew(); }}
            style={{
              padding: "9px 12px", display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer",
              borderTop: results.length > 0 ? "1px solid var(--line-soft)" : "none",
            }}
            className="ched-suggest-new"
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: "var(--royal-50)", border: "1.5px dashed var(--royal)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
              「{value}」を新規登録
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StintForm ─────────────────────────────────────────────────────────────────

function StintForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
  roles,
  companyLocked = false,
}: {
  draft: StintDraft;
  onDraftChange: (d: StintDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  companyLocked?: boolean;
}) {
  const set = useCallback(
    (key: keyof StintDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange]
  );

  const descLen = draft.description.length;
  const descOver = descLen > 500;
  // 期間バリデーション: ended_at が入力済みかつ現職フラグなし の場合のみ started_at <= ended_at を検証
  // YYYY-MM 文字列の辞書順比較で正しく動作（例: "2024-04" > "2023-04"）
  const periodInvalid = !draft.isCurrent && !!draft.endedAt && draft.startedAt > draft.endedAt;
  const isValid = !!draft.companyName.trim() && !!draft.roleCategoryId && !!draft.startedAt;
  const canSave = isValid && !descOver && !periodInvalid && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  return (
    <div
      style={{
        background: "var(--bg-tint)",
        border: "1.5px solid var(--royal)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
      }}
    >
      {/* Company name + anon toggle */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={labelStyle()}>会社名 *</label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: companyLocked ? "var(--ink-mute)" : "var(--ink-soft)", cursor: companyLocked ? "default" : "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={draft.isAnon}
              disabled={companyLocked}
              onChange={(e) =>
                // isAnon 切替時に companyId もリセット（XOR整合のため）
                onDraftChange({ ...draft, isAnon: e.target.checked, companyId: null })
              }
              style={{ accentColor: "var(--royal)" }}
            />
            非公開にする
          </label>
        </div>
        {draft.isAnon ? (
          /* 匿名経路: company_anonymized に保存 → プレーン input のまま */
          <input
            type="text"
            value={draft.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="非公開企業（任意）"
            disabled={isSaving || companyLocked}
            style={fieldStyle()}
          />
        ) : (
          /* マスタ/カスタム経路: company_id or company_text に保存 */
          <CompanySearch
            value={draft.companyName}
            disabled={isSaving || companyLocked}
            onChange={(id, name) =>
              onDraftChange({ ...draft, companyId: id, companyName: name })
            }
          />
        )}
      </div>

      {/* Role category */}
      <div>
        <label style={labelStyle()}>役職カテゴリ *</label>
        <select
          aria-label="役職カテゴリ"
          value={draft.roleCategoryId}
          onChange={(e) => set("roleCategoryId", e.target.value)}
          disabled={isSaving}
          style={fieldStyle()}
        >
          <option value="">選択してください</option>
          {roles
            .filter((r) => r.parent_id === null)
            .sort((a, b) => a.display_order - b.display_order)
            .map((parent) => {
              const children = roles
                .filter((r) => r.parent_id === parent.id)
                .sort((a, b) => a.display_order - b.display_order);
              if (children.length === 0) {
                // 子なし → 親を選択可
                return (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                );
              }
              // 子あり → 親は見出し（選択不可）+ 子のみ選択可
              return (
                <optgroup key={parent.id} label={parent.name}>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
        </select>
      </div>

      {/* 役職 + 雇用形態（2カラム） */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle()}>役職</label>
          <select
            value={draft.rank}
            onChange={(e) => set("rank", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle() }}
          >
            {RANK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>雇用形態</label>
          <select
            value={draft.employmentType}
            onChange={(e) => set("employmentType", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle() }}
          >
            {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* グレード・等級名 + 部署名（2カラム） */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle()}>グレード・等級名（任意）</label>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 6, lineHeight: 1.4 }}>
            社内職名・グレード（例: M2、AE、シニアAM）
          </div>
          <input
            type="text"
            value={draft.roleTitle}
            onChange={(e) => set("roleTitle", e.target.value)}
            placeholder="例: アカウントエグゼクティブ"
            disabled={isSaving}
            style={fieldStyle()}
          />
        </div>
        <div>
          <label style={labelStyle()}>部署名（任意）</label>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 6, lineHeight: 1.4 }}>
            所属部門・チーム名
          </div>
          <input
            type="text"
            value={draft.department}
            onChange={(e) => set("department", e.target.value)}
            placeholder="例: エンタープライズ営業本部"
            disabled={isSaving}
            style={fieldStyle()}
            maxLength={100}
          />
        </div>
      </div>

      {/* Period — 年/月 separate selects */}
      <div>
        <label style={labelStyle()}>入社年月 *</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={parseYearMonth(draft.startedAt).year}
            onChange={(e) => set("startedAt", buildYearMonth(e.target.value, parseYearMonth(draft.startedAt).month))}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">年</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <select
            value={parseYearMonth(draft.startedAt).month}
            onChange={(e) => set("startedAt", buildYearMonth(parseYearMonth(draft.startedAt).year, e.target.value))}
            disabled={isSaving}
            style={{ ...fieldStyle(), flex: 1 }}
          >
            <option value="">月</option>
            {MONTH_OPTIONS.map((m) => <option key={m} value={String(m)}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* 現職 or 退職年月 */}
      <div>
        <label style={labelStyle()}>現職 or 退職年月 *</label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.isCurrent}
            onChange={(e) => set("isCurrent", e.target.checked)}
            style={{ accentColor: "var(--royal)" }}
          />
          現在も勤務している
        </label>
        {!draft.isCurrent && (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={parseYearMonth(draft.endedAt).year}
              onChange={(e) => set("endedAt", buildYearMonth(e.target.value, parseYearMonth(draft.endedAt).month))}
              disabled={isSaving}
              style={{ ...fieldStyle(), flex: 1 }}
            >
              <option value="">年</option>
              {YEAR_OPTIONS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
            </select>
            <select
              value={parseYearMonth(draft.endedAt).month}
              onChange={(e) => set("endedAt", buildYearMonth(parseYearMonth(draft.endedAt).year, e.target.value))}
              disabled={isSaving}
              style={{ ...fieldStyle(), flex: 1 }}
            >
              <option value="">月</option>
              {MONTH_OPTIONS.map((m) => <option key={m} value={String(m)}>{m}月</option>)}
            </select>
          </div>
        )}
        {periodInvalid && (
          <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            退職年月は入社年月以降に設定してください
          </div>
        )}
      </div>

      {/* Description (業務内容) */}
      <div>
        <label style={labelStyle()}>業務内容（任意）</label>
        <textarea
          aria-label="業務内容"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="業務内容や成果、チームの規模など"
          disabled={isSaving}
          rows={3}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ fontSize: 11, color: descOver ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {descOver ? `${descLen - 500} 文字超過` : `残り ${500 - descLen} 文字`}
        </div>
      </div>

      {/* Join reason (なぜこの会社を選んだか) */}
      <div>
        <label style={labelStyle()}>
          <span>なぜこの会社を選んだか（任意）</span>
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: "var(--purple)", background: "var(--purple-soft)", padding: "1px 7px", borderRadius: 100, letterSpacing: "0.04em" }}>
            公開プロフィールに表示
          </span>
        </label>
        <textarea
          aria-label="なぜこの会社を選んだか"
          value={draft.joinReason}
          onChange={(e) => set("joinReason", e.target.value)}
          placeholder="例: 〇〇な課題を解決したくて。前職でできなかった〇〇に挑戦するため"
          disabled={isSaving}
          rows={2}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7, borderColor: "var(--purple-soft)" }}
        />
        <div style={{ fontSize: 11, color: draft.joinReason.length > 300 ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {draft.joinReason.length > 300 ? `${draft.joinReason.length - 300} 文字超過` : `残り ${300 - draft.joinReason.length} 文字`}
        </div>
      </div>

      {/* 年収（内訳） */}
      {(() => {
        const base = draft.salaryBase ? parseInt(draft.salaryBase, 10) : 0;
        const bonus = draft.salaryBonus ? parseInt(draft.salaryBonus, 10) : 0;
        const stock = draft.salaryStock ? parseInt(draft.salaryStock, 10) : 0;
        const total = base + bonus + stock;
        return (
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em" }}>年収（任意）</div>

            {/* 3カラム横並び */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* ベースの給与 */}
              <div>
                <label style={{ ...labelStyle(), fontSize: 11 }}>ベースの給与</label>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, lineHeight: 1.3 }}>基本給＋残業代</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    value={draft.salaryBase}
                    onChange={(e) => set("salaryBase", e.target.value)}
                    placeholder="500"
                    disabled={isSaving}
                    min={0} max={10000}
                    style={{ ...fieldStyle(), minWidth: 0, width: "100%" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", flexShrink: 0 }}>万円</span>
                </div>
              </div>

              {/* 賞与・インセンティブ */}
              <div>
                <label style={{ ...labelStyle(), fontSize: 11 }}>賞与・インセンティブ</label>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, lineHeight: 1.3 }}>年間合計（なし=0）</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    value={draft.salaryBonus}
                    onChange={(e) => set("salaryBonus", e.target.value)}
                    placeholder="80"
                    disabled={isSaving}
                    min={0} max={10000}
                    style={{ ...fieldStyle(), minWidth: 0, width: "100%" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", flexShrink: 0 }}>万円</span>
                </div>
              </div>

              {/* 株式報酬 */}
              <div>
                <label style={{ ...labelStyle(), fontSize: 11 }}>株式報酬（任意）</label>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginBottom: 4, lineHeight: 1.3 }}>RSU/SO 年間換算</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    value={draft.salaryStock}
                    onChange={(e) => set("salaryStock", e.target.value)}
                    placeholder="100"
                    disabled={isSaving}
                    min={0} max={10000}
                    style={{ ...fieldStyle(), minWidth: 0, width: "100%" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", flexShrink: 0 }}>万円</span>
                </div>
              </div>
            </div>

            {/* 合計表示 */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, textAlign: "right" }}>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>年収 </span>
              <span style={{ fontSize: 20, fontWeight: 800, color: total > 0 ? "var(--success)" : "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                {total.toLocaleString()}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}> 万円</span>
            </div>
          </div>
        );
      })()}

      {/* 公開設定 */}
      <div style={{
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em" }}>
          公開設定（キャリア軌跡ページへの表示）
        </div>

        {/* 会社名公開設定（2カラム） */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ ...labelStyle(), marginBottom: 4, fontSize: 11 }}>キャリア軌跡ページ</label>
            <select
              value={draft.visibilityCompany}
              onChange={(e) => set("visibilityCompany", e.target.value as "real" | "masked" | "hidden")}
              disabled={isSaving}
              style={{ ...fieldStyle() }}
            >
              <option value="real">実名で表示する</option>
              <option value="masked">業界・規模で表示する</option>
              <option value="hidden">含めない</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle(), marginBottom: 4, fontSize: 11 }}>プロフィールページ</label>
            <select
              value={draft.visibilityCompanyProfile}
              onChange={(e) => set("visibilityCompanyProfile", e.target.value as "real" | "masked" | "hidden")}
              disabled={isSaving}
              style={{ ...fieldStyle() }}
            >
              <option value="real">実名で表示する</option>
              <option value="masked">業界・規模で表示する</option>
              <option value="hidden">含めない</option>
            </select>
          </div>
        </div>

        {/* 年収を公開するか */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div
            onClick={() => set("visibilitySalary", !draft.visibilitySalary)}
            style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0,
              background: draft.visibilitySalary ? "var(--royal)" : "var(--line)",
              position: "relative", cursor: "pointer", transition: "background 0.2s",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: draft.visibilitySalary ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
          <span style={{ fontSize: 13, color: "var(--ink)" }}>年収を公開する</span>
        </label>

        {/* 入社理由を公開するか */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div
            onClick={() => set("visibilityReason", !draft.visibilityReason)}
            style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0,
              background: draft.visibilityReason ? "var(--royal)" : "var(--line)",
              position: "relative", cursor: "pointer", transition: "background 0.2s",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: draft.visibilityReason ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
          <span style={{ fontSize: 13, color: "var(--ink)" }}>入社理由を公開する</span>
        </label>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px", minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ── StintCard ─────────────────────────────────────────────────────────────────

function StintCard({
  stint,
  onEdit,
  onDelete,
}: {
  stint: Stint & { showCurrentBadge?: boolean };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 14px",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--line)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Role + 現在 badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {stint.roleTitle || stint.roleLabel}
            </span>
            {stint.showCurrentBadge && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", flexShrink: 0 }}>
                現在
              </span>
            )}
          </div>
          {/* Period */}
          <div style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
            {formatPeriod(stint.startedAt, stint.endedAt, stint.isCurrent)}
          </div>
          {/* Employment type badge */}
          {stint.employmentType && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              fontSize: 10, fontWeight: 600, color: "var(--ink-soft)",
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              padding: "1px 7px", borderRadius: 100,
              marginTop: 4,
            }}>
              {stint.employmentType}
            </span>
          )}
          {/* Description snippet */}
          {stint.description && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                marginTop: 6,
                paddingLeft: 8,
                borderLeft: "2px solid var(--line)",
                lineHeight: 1.65,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {stint.description}
            </div>
          )}
          {/* Join reason snippet */}
          {stint.joinReason && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "flex-start", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
              <span style={{ fontSize: 11, color: "var(--purple)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {stint.joinReason}
              </span>
            </div>
          )}
        </div>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0.45, transition: "opacity 0.15s", flexShrink: 0 }}>
          <IconButton onClick={onEdit} title="編集">✎</IconButton>
          <IconButton onClick={onDelete} title="削除" danger>×</IconButton>
        </div>
      </div>
      {/* ストーリーアコーディオン */}
      <StoryAccordion experienceId={stint.id} />
    </div>
  );
}

// ── Main: CareerHistoryEditor ─────────────────────────────────────────────────

export default function CareerHistoryEditor({
  initialExperiences = [],
  roles = [],
  birthDate,
}: {
  initialExperiences?: Stint[];
  roles?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  birthDate?: string | null;
}) {
  const [stints, setStints] = useState<Stint[]>(() => sortStints(initialExperiences));

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<StintDraft>(EMPTY_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);

  // Add state
  const [addingForCompanyKey, setAddingForCompanyKey] = useState<string | null>(null);
  const [addDraft,     setAddDraft]     = useState<StintDraft>(EMPTY_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Stint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");


  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback(
    (msg: string, variant: "default" | "error" = "default") => {
      setToastVariant(variant);
      setToastMsg(msg);
    },
    []
  );

  // ── Draft from stint ─────────────────────────────────────────────────────────
  const draftFromStint = useCallback((s: Stint): StintDraft => ({
    companyName: s.companyType === "anon" ? (s.companyAnonymized ?? "非公開企業") : s.displayCompanyName,
    companyId: s.companyType === "master" ? (s.companyId ?? null) : null,
    isAnon: s.companyType === "anon",
    roleCategoryId: s.roleCategoryId,
    roleTitle: s.roleTitle ?? "",
    department: s.department ?? "",
    rank: s.rank ?? "",
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? "",
    isCurrent: s.isCurrent,
    description: s.description ?? "",
    joinReason: s.joinReason ?? "",
    employmentType: s.employmentType ?? "",
    salaryBase: s.salaryBase != null ? String(s.salaryBase) : "",
    salaryBonus: s.salaryBonus != null ? String(s.salaryBonus) : "",
    salaryStock: s.salaryStock != null ? String(s.salaryStock) : "",
    salaryMan: s.salaryMan != null ? String(s.salaryMan) : "",
    visibilityCompany: s.visibilityCompany ?? "real",
    visibilityCompanyProfile: s.visibilityCompanyProfile ?? "real",
    visibilitySalary: s.visibilitySalary ?? false,
    visibilityReason: s.visibilityReason ?? true,
  }), []);

  const draftFromGroup = useCallback((group: StintGroup): StintDraft => ({
    companyName: group.companyType === "anon"
      ? (group.companyAnonymized ?? "非公開企業")
      : group.displayCompanyName,
    companyId: group.companyType === "master" ? (group.companyId ?? null) : null,
    isAnon: group.companyType === "anon",
    roleCategoryId: "",
    roleTitle: "",
    department: "",
    rank: "",
    startedAt: group.earliestStart,       // そのグループの開始年月をプリフィル
    endedAt: group.latestEnd ?? "",        // 現職グループは "" (isCurrent チェックで制御)
    isCurrent: false,
    description: "",
    joinReason: "",
    employmentType: "",
    salaryBase: "",
    salaryBonus: "",
    salaryStock: "",
    salaryMan: "",
    visibilityCompany: "real",
    visibilityCompanyProfile: "real",
    visibilitySalary: false,
    visibilityReason: true,
  }), []);

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEdit = useCallback((s: Stint) => {
    setEditingId(s.id);
    setEditDraft(draftFromStint(s));
  }, [draftFromStint]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: editDraft.roleCategoryId,
        role_title: editDraft.roleTitle || undefined,
        started_at: editDraft.startedAt,
        ended_at: editDraft.isCurrent ? undefined : editDraft.endedAt || undefined,
        is_current: editDraft.isCurrent,
        description: editDraft.description || undefined,
        join_reason: editDraft.joinReason || undefined,
        employment_type: editDraft.employmentType || undefined,
        salary_base: editDraft.salaryBase ? parseInt(editDraft.salaryBase, 10) : null,
        salary_bonus: editDraft.salaryBonus ? parseInt(editDraft.salaryBonus, 10) : null,
        salary_stock: editDraft.salaryStock ? parseInt(editDraft.salaryStock, 10) : null,
        salary_man: (() => {
          const b = editDraft.salaryBase ? parseInt(editDraft.salaryBase, 10) : 0;
          const bo = editDraft.salaryBonus ? parseInt(editDraft.salaryBonus, 10) : 0;
          const st = editDraft.salaryStock ? parseInt(editDraft.salaryStock, 10) : 0;
          const total = b + bo + st;
          return total > 0 ? total : null;
        })(),
        department: editDraft.department || null,
        rank: editDraft.rank || null,
        visibility_company: editDraft.visibilityCompany,
        visibility_company_profile: editDraft.visibilityCompanyProfile,
        visibility_salary: editDraft.visibilitySalary,
        visibility_reason: editDraft.visibilityReason,
      };
      Object.assign(body, buildCompanyBody(editDraft));

      const res = await fetch(`/api/jobseeker/experiences/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      // Optimistic update + re-sort
      setStints((prev) =>
        sortStints(prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                ...optimisticCompanyFields(editDraft),
                roleCategoryId: editDraft.roleCategoryId,
                roleLabel: roles.find((r) => r.id === editDraft.roleCategoryId)?.name ?? editDraft.roleCategoryId,
                roleTitle: editDraft.roleTitle || undefined,
                startedAt: editDraft.startedAt,
                endedAt: editDraft.isCurrent ? undefined : editDraft.endedAt || undefined,
                isCurrent: editDraft.isCurrent,
                description: editDraft.description || undefined,
                joinReason: editDraft.joinReason || undefined,
                employmentType: editDraft.employmentType || undefined,
                salaryBase: editDraft.salaryBase ? parseInt(editDraft.salaryBase, 10) : null,
                salaryBonus: editDraft.salaryBonus ? parseInt(editDraft.salaryBonus, 10) : null,
                salaryStock: editDraft.salaryStock ? parseInt(editDraft.salaryStock, 10) : null,
                salaryMan: (() => { const t = (editDraft.salaryBase ? parseInt(editDraft.salaryBase,10):0)+(editDraft.salaryBonus ? parseInt(editDraft.salaryBonus,10):0)+(editDraft.salaryStock ? parseInt(editDraft.salaryStock,10):0); return t>0?t:null; })(),
                department: editDraft.department || undefined,
                rank: (editDraft.rank || null) as Stint["rank"],
                visibilityCompany: editDraft.visibilityCompany,
                visibilityCompanyProfile: editDraft.visibilityCompanyProfile,
                visibilitySalary: editDraft.visibilitySalary,
                visibilityReason: editDraft.visibilityReason,
              }
            : s
        ))
      );
      showToast("職歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelEdit();
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, cancelEdit, showToast]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAddingForCompanyKey(null);
    setAddDraft(EMPTY_DRAFT);
  }, []);

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: addDraft.roleCategoryId,
        role_title: addDraft.roleTitle || undefined,
        started_at: addDraft.startedAt,
        ended_at: addDraft.isCurrent ? undefined : addDraft.endedAt || undefined,
        is_current: addDraft.isCurrent,
        description: addDraft.description || undefined,
        join_reason: addDraft.joinReason || undefined,
        employment_type: addDraft.employmentType || undefined,
        display_order: stints.length,
        salary_base: addDraft.salaryBase ? parseInt(addDraft.salaryBase, 10) : null,
        salary_bonus: addDraft.salaryBonus ? parseInt(addDraft.salaryBonus, 10) : null,
        salary_stock: addDraft.salaryStock ? parseInt(addDraft.salaryStock, 10) : null,
        salary_man: (() => {
          const b = addDraft.salaryBase ? parseInt(addDraft.salaryBase, 10) : 0;
          const bo = addDraft.salaryBonus ? parseInt(addDraft.salaryBonus, 10) : 0;
          const st = addDraft.salaryStock ? parseInt(addDraft.salaryStock, 10) : 0;
          const total = b + bo + st;
          return total > 0 ? total : null;
        })(),
        department: addDraft.department || null,
        rank: addDraft.rank || null,
        visibility_company: addDraft.visibilityCompany,
        visibility_company_profile: addDraft.visibilityCompanyProfile,
        visibility_salary: addDraft.visibilitySalary,
        visibility_reason: addDraft.visibilityReason,
      };
      Object.assign(body, buildCompanyBody(addDraft));

      const res = await fetch("/api/jobseeker/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };

      const newStint: Stint = {
        id,
        ...optimisticCompanyFields(addDraft),
        roleCategoryId: addDraft.roleCategoryId,
        roleLabel: roles.find((r) => r.id === addDraft.roleCategoryId)?.name ?? addDraft.roleCategoryId,
        roleTitle: addDraft.roleTitle || undefined,
        startedAt: addDraft.startedAt,
        endedAt: addDraft.isCurrent ? undefined : addDraft.endedAt || undefined,
        isCurrent: addDraft.isCurrent,
        description: addDraft.description || undefined,
        joinReason: addDraft.joinReason || undefined,
        employmentType: addDraft.employmentType || undefined,
        salaryBase: addDraft.salaryBase ? parseInt(addDraft.salaryBase, 10) : null,
        salaryBonus: addDraft.salaryBonus ? parseInt(addDraft.salaryBonus, 10) : null,
        salaryStock: addDraft.salaryStock ? parseInt(addDraft.salaryStock, 10) : null,
        salaryMan: (() => { const t = (addDraft.salaryBase ? parseInt(addDraft.salaryBase,10):0)+(addDraft.salaryBonus ? parseInt(addDraft.salaryBonus,10):0)+(addDraft.salaryStock ? parseInt(addDraft.salaryStock,10):0); return t>0?t:null; })(),
        visibilityCompany: addDraft.visibilityCompany,
        department: addDraft.department || undefined,
        rank: (addDraft.rank || null) as Stint["rank"],
        visibilityCompanyProfile: addDraft.visibilityCompanyProfile,
        visibilitySalary: addDraft.visibilitySalary,
        visibilityReason: addDraft.visibilityReason,
      };

      setStints((prev) => sortStints([...prev, newStint]));
      showToast("職歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelAdd();
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, stints.length, cancelAdd, showToast]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/experiences/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStints((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("職歴を削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const groups = groupStints(stints);
  const rows = buildTimelineRows(groups);

  // 年区切り用ヘルパー
  function rowStartYear(row: StintGroup[]): number | null {
    const earliest = row.reduce((e, g) => (g.earliestStart < e ? g.earliestStart : e), row[0].earliestStart);
    const y = parseInt(earliest.slice(0, 4), 10);
    return isNaN(y) ? null : y;
  }
  function ageAtYear(year: number): number | null {
    if (!birthDate) return null;
    const birthYear = parseInt(birthDate.slice(0, 4), 10);
    const age = year - birthYear;
    return age > 0 && age < 100 ? age : null;
  }

  return (
    <div>
      <style>{`
        .career-row { display: flex; gap: 12px; }
        @media (max-width: 640px) { .career-row { flex-direction: column; } }
      `}</style>

      {/* グループ一覧（並行在籍は横並び） */}
      {rows.map((row, rowIdx) => {
        const year = rowStartYear(row);
        const prevYear = rowIdx > 0 ? rowStartYear(rows[rowIdx - 1]) : null;
        const showYearSep = year !== null && year !== prevYear;
        const age = year !== null ? ageAtYear(year) : null;
        return (
        <div key={row.map(g => g.key).join("|")}>
          {showYearSep && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              margin: rowIdx === 0 ? "0 0 10px" : "4px 0 10px",
            }}>
              <div style={{
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 100,
                padding: "2px 9px",
                fontSize: 11, fontWeight: 700,
                color: "var(--royal)",
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}>
                {year}年
              </div>
              {age !== null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                  {age}歳
                </span>
              )}
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
          )}
          <div
            className="career-row"
            style={{ marginBottom: rowIdx < rows.length - 1 ? 14 : 0 }}
          >
          {row.map((group) => {
            const showBadgeId = group.positions[0]?.isCurrent ? group.positions[0].id : null;
            const avatarColor = getAvatarColor(group.displayCompanyName);
            const avatarInitial = group.displayCompanyName.charAt(0);

            return (
              <div
                key={group.key}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                }}
              >
                {/* グループヘッダー: アバター + 会社名 + 期間 */}
                <div
                  style={{
                    padding: "16px 18px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      color: "#fff",
                      fontFamily: "Inter, sans-serif",
                      flexShrink: 0,
                      boxShadow: `0 2px 8px ${avatarColor}55`,
                    }}
                  >
                    {avatarInitial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>
                      {group.displayCompanyName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                        {formatGroupDateRange(group)}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: "var(--royal)", background: "var(--royal-50)",
                        borderRadius: 100, padding: "1px 9px",
                        fontFamily: "Inter, sans-serif", flexShrink: 0,
                      }}>
                        {formatDuration(group.totalMonths)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ポジション群 */}
                <div style={{ padding: "0 18px 16px" }}>
                  {group.positions.map((s, pIdx) => (
                    <div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 8 : 0 }}>
                      {editingId === s.id ? (
                        <StintForm
                          draft={editDraft}
                          onDraftChange={setEditDraft}
                          isSaving={editSaving}
                          justSaved={editJustSaved}
                          onSave={() => { void saveEdit(); }}
                          onCancel={cancelEdit}
                          roles={roles}
                        />
                      ) : (
                        <StintCard
                          stint={{ ...s, showCurrentBadge: s.id === showBadgeId }}
                          onEdit={() => startEdit(s)}
                          onDelete={() => setDeleteTarget(s)}
                        />
                      )}
                    </div>
                  ))}

                  {/* グループ内追加フォーム */}
                  {addingForCompanyKey === group.key && (
                    <div style={{ marginTop: 10 }}>
                      <StintForm
                        draft={addDraft}
                        onDraftChange={setAddDraft}
                        isSaving={addSaving}
                        justSaved={addJustSaved}
                        onSave={() => { void saveAdd(); }}
                        onCancel={cancelAdd}
                        roles={roles}
                        companyLocked={true}
                      />
                    </div>
                  )}

                  {/* 「+ このポジションに役割を追加」テキストリンク */}
                  {addingForCompanyKey !== group.key && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddDraft(draftFromGroup(group));
                        setAddingForCompanyKey(group.key);
                      }}
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        background: "var(--royal-50)",
                        border: "1px dashed var(--royal-100)",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--royal)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
                      このポジションに役割を追加
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      );
      })}

      {/* Empty state */}
      {stints.length === 0 && addingForCompanyKey === null && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          職歴はまだ登録されていません
        </div>
      )}

      {/* 新規会社の追加フォーム */}
      {addingForCompanyKey === "__new__" && (
        <div style={{ marginTop: stints.length > 0 ? 12 : 0 }}>
          <StintForm
            draft={addDraft}
            onDraftChange={setAddDraft}
            isSaving={addSaving}
            justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }}
            onCancel={cancelAdd}
            roles={roles}
            companyLocked={false}
          />
        </div>
      )}

      {/* 新規会社用「+ 経歴を追加」ボタン */}
      {addingForCompanyKey === null && (
        <button
          type="button"
          onClick={() => {
            setAddDraft(EMPTY_DRAFT);
            setAddingForCompanyKey("__new__");
          }}
          style={{
            marginTop: stints.length > 0 ? 10 : 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "8px 14px",
            width: "100%",
            background: "transparent",
            border: "1px dashed var(--line)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          経歴を追加
        </button>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="職歴を削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.displayCompanyName}」での職歴を削除します。この操作は取り消せません。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}
