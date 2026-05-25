"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
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
  startedAt: string;   // YYYY-MM
  endedAt?: string;    // YYYY-MM
  isCurrent: boolean;
  description?: string;
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

function formatGroupPeriod(group: StintGroup): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  const start = fmt(group.earliestStart);
  const end = group.latestEnd === null ? "現在" : fmt(group.latestEnd);
  const duration = formatDuration(group.totalMonths);
  return `${start} 〜 ${end} · ${duration}`;
}

type StintDraft = {
  companyName: string;
  companyId: string | null;  // 候補選択時のみ非null、＋登録・自由入力時は null
  isAnon: boolean;
  roleCategoryId: string;
  roleTitle: string;
  startedAt: string;
  endedAt: string;
  isCurrent: boolean;
  description: string;
};

const EMPTY_DRAFT: StintDraft = {
  companyName: "",
  companyId: null,
  isAnon: false,
  roleCategoryId: "",
  roleTitle: "",
  startedAt: "",
  endedAt: "",
  isCurrent: false,
  description: "",
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

const AVATAR_COLORS = ["#4F46E5", "#059669", "#DC2626", "#D97706", "#0891B2", "#7C3AED"];
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
                <Fragment key={parent.id}>
                  <option value="" disabled>── {parent.name} ──</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </Fragment>
              );
            })}
        </select>
      </div>

      {/* Role title (optional) */}
      <div>
        <label style={labelStyle()}>役職タイトル（任意）</label>
        <input
          type="text"
          value={draft.roleTitle}
          onChange={(e) => set("roleTitle", e.target.value)}
          placeholder="例: プロダクトマネージャー（Bakuraku事業）"
          disabled={isSaving}
          style={fieldStyle()}
        />
      </div>

      {/* Period */}
      <div>
        <label style={labelStyle()}>期間 *</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="month"
            value={draft.startedAt}
            onChange={(e) => set("startedAt", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), width: "auto", flex: "1 1 130px" }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-mute)", flexShrink: 0 }}>〜</span>
          <input
            type="month"
            value={draft.isCurrent ? "" : draft.endedAt}
            onChange={(e) => set("endedAt", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            style={{ ...fieldStyle(), width: "auto", flex: "1 1 130px", opacity: draft.isCurrent ? 0.4 : 1 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={draft.isCurrent}
              onChange={(e) => set("isCurrent", e.target.checked)}
              style={{ accentColor: "var(--royal)" }}
            />
            現在も在籍中
          </label>
        </div>
        {periodInvalid && (
          <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            終了年月は開始年月以降に設定してください
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
        padding: "10px 12px",
        background: "#fff",
        borderRadius: 8,
        border: "1px solid var(--line-soft)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Role + 現在 badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {stint.roleTitle || stint.roleLabel}
            </span>
            {stint.showCurrentBadge && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", flexShrink: 0 }}>
                現在
              </span>
            )}
          </div>
          {/* Period */}
          <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            {formatPeriod(stint.startedAt, stint.endedAt, stint.isCurrent)}
          </div>
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
        </div>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
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
}: {
  initialExperiences?: Stint[];
  roles?: { id: string; name: string; parent_id: string | null; display_order: number }[];
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
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? "",
    isCurrent: s.isCurrent,
    description: s.description ?? "",
  }), []);

  const draftFromGroup = useCallback((group: StintGroup): StintDraft => ({
    companyName: group.companyType === "anon"
      ? (group.companyAnonymized ?? "非公開企業")
      : group.displayCompanyName,
    companyId: group.companyType === "master" ? (group.companyId ?? null) : null,
    isAnon: group.companyType === "anon",
    roleCategoryId: "",
    roleTitle: "",
    startedAt: group.earliestStart,       // そのグループの開始年月をプリフィル
    endedAt: group.latestEnd ?? "",        // 現職グループは "" (isCurrent チェックで制御)
    isCurrent: false,
    description: "",
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
        display_order: stints.length,
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

  return (
    <div>
      {/* グループ一覧 */}
      {groups.map((group, gIdx) => {
        const showBadgeId = group.positions[0]?.isCurrent ? group.positions[0].id : null;
        const avatarColor = getAvatarColor(group.displayCompanyName);
        const avatarInitial = group.displayCompanyName.charAt(0);

        return (
          <div
            key={group.key}
            style={{
              background: `${avatarColor}0F`,
              borderLeft: `4px solid ${avatarColor}`,
              borderRadius: 10,
              marginBottom: gIdx < groups.length - 1 ? 12 : 16,
              overflow: "hidden",
            }}
          >
            {/* グループヘッダー: アバター + 会社名 + 期間（通常の黒文字） */}
            <div
              style={{
                padding: "14px 16px 10px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: avatarColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                }}
              >
                {avatarInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  {group.displayCompanyName}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
                  {formatGroupPeriod(group)}
                </div>
              </div>
            </div>

            {/* ポジション群（白カード） */}
            <div style={{ padding: "0 16px 14px" }}>
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
                    padding: "4px 0",
                    background: "transparent",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-mute)",
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
