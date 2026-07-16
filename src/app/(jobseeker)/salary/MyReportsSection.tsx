"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MySalaryReportForEdit {
  id: string;
  company_name: string | null;
  role_id: string;
  role_name: string | null;
  ote: number | null;
  annual_salary: number | null;
  base_salary: number | null;
  bonus_salary: number | null;
  incentive: number | null;
  stock_options: number | null;
  allowances: number | null;
  fixed_overtime: number | null;
  start_year_month: string | null;
  end_year_month: string | null;
  grade: string | null;
  years_of_experience: number | null;
  employment_status: string;
  prefecture: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
}

export interface RoleOptionForEdit {
  id: string;
  name: string;
  parent_id: string | null;
}

// ─── YMPicker ─────────────────────────────────────────────────────────────────

function YMPicker({
  value,
  onChange,
  placeholder = "選択",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [year, setYear] = useState(() => value ? value.split("-")[0] ?? "" : "");
  const [month, setMonth] = useState(() => value ? value.split("-")[1] ?? "" : "");

  function handleYear(y: string) {
    setYear(y);
    if (y && month) onChange(`${y}-${month}`);
    else if (!y) onChange("");
  }
  function handleMonth(m: string) {
    setMonth(m);
    if (year && m) onChange(`${year}-${m}`);
    else if (!m) onChange("");
  }

  const sel: React.CSSProperties = {
    padding: "7px 8px", borderRadius: 8, border: "1px solid var(--line)",
    fontSize: 13, fontFamily: "inherit", background: "#fff",
  };
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 35 }, (_, i) => currentYear - i);

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select value={year} onChange={(e) => handleYear(e.target.value)} style={sel}>
        <option value="">年</option>
        {years.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
      </select>
      <select value={month} onChange={(e) => handleMonth(e.target.value)} style={sel}>
        <option value="">{placeholder}</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={String(m).padStart(2, "0")}>{m}月</option>
        ))}
      </select>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtYen(yen: number | null) {
  if (!yen) return null;
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}
function manStr(yen: number | null) {
  return yen ? String(Math.round(yen / 10000)) : "";
}

const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県","リモート",
];

interface EditState {
  role_id: string;
  ote: string;
  start_year_month: string;
  end_year_month: string;
  grade: string;
  base_salary: string;
  bonus_salary: string;
  incentive: string;
  stock_options: string;
  allowances: string;
  fixed_overtime: string;
  years_of_experience: string;
  employment_status: string;
  prefecture: string;
}

function makeEditState(r: MySalaryReportForEdit): EditState {
  return {
    role_id: r.role_id,
    ote: manStr(r.ote ?? r.annual_salary),
    start_year_month: r.start_year_month ?? "",
    end_year_month: r.end_year_month ?? "",
    grade: r.grade ?? "",
    base_salary: manStr(r.base_salary),
    bonus_salary: manStr(r.bonus_salary),
    incentive: manStr(r.incentive),
    stock_options: manStr(r.stock_options),
    allowances: manStr(r.allowances),
    fixed_overtime: manStr(r.fixed_overtime),
    years_of_experience: r.years_of_experience != null ? String(r.years_of_experience) : "",
    employment_status: r.employment_status,
    prefecture: r.prefecture ?? "東京都",
  };
}

// ─── MyReportsSection ─────────────────────────────────────────────────────────

export default function MyReportsSection({
  reports: initial,
  roles,
}: {
  reports: MySalaryReportForEdit[];
  roles: RoleOptionForEdit[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState<MySalaryReportForEdit[]>(initial);
  const [, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const parents = roles.filter((r) => !r.parent_id);
  const children = roles.filter((r) => r.parent_id);

  function startEdit(r: MySalaryReportForEdit) {
    setEditingId(r.id);
    setEditState(makeEditState(r));
    setEditError(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!editState) return;
    if (!editState.start_year_month) { setEditError("開始年月は必須です"); return; }
    const ote = parseInt(editState.ote, 10);
    if (!editState.ote || isNaN(ote) || ote < 100 || ote > 50000) {
      setEditError("想定年収（OTE）を正しく入力してください（100万〜50000万円）");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/salary-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: editState.role_id,
          ote_man: ote,
          start_year_month: editState.start_year_month,
          end_year_month: editState.end_year_month || null,
          grade: editState.grade || null,
          base_salary_man: editState.base_salary ? parseInt(editState.base_salary, 10) : null,
          bonus_salary_man: editState.bonus_salary ? parseInt(editState.bonus_salary, 10) : null,
          incentive_man: editState.incentive ? parseInt(editState.incentive, 10) : null,
          stock_options_man: editState.stock_options ? parseInt(editState.stock_options, 10) : null,
          allowances_man: editState.allowances ? parseInt(editState.allowances, 10) : null,
          fixed_overtime_man: editState.fixed_overtime ? parseInt(editState.fixed_overtime, 10) : null,
          years_of_experience: editState.years_of_experience ? parseInt(editState.years_of_experience, 10) : null,
          employment_status: editState.employment_status,
          prefecture: editState.prefecture || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setEditError(d.error ?? "保存に失敗しました");
        return;
      }
      const roleName = roles.find((r) => r.id === editState.role_id)?.name ?? null;
      startTransition(() => setReports((prev) => prev.map((r) => r.id === id ? {
        ...r,
        role_id: editState.role_id,
        role_name: roleName,
        ote: ote * 10000,
        annual_salary: ote * 10000,
        start_year_month: editState.start_year_month,
        end_year_month: editState.end_year_month || null,
        grade: editState.grade || null,
        base_salary: editState.base_salary ? parseInt(editState.base_salary, 10) * 10000 : null,
        bonus_salary: editState.bonus_salary ? parseInt(editState.bonus_salary, 10) * 10000 : null,
        incentive: editState.incentive ? parseInt(editState.incentive, 10) * 10000 : null,
        stock_options: editState.stock_options ? parseInt(editState.stock_options, 10) * 10000 : null,
        allowances: editState.allowances ? parseInt(editState.allowances, 10) * 10000 : null,
        fixed_overtime: editState.fixed_overtime ? parseInt(editState.fixed_overtime, 10) * 10000 : null,
        years_of_experience: editState.years_of_experience ? parseInt(editState.years_of_experience, 10) : null,
        employment_status: editState.employment_status,
        prefecture: editState.prefecture || null,
      } : r)));
      setEditingId(null);
      setEditState(null);
      // 集計データを再取得
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/salary-reports/${id}`, { method: "DELETE" });
      if (!res.ok) { alert("削除に失敗しました"); return; }
      startTransition(() => setReports((prev) => prev.filter((r) => r.id !== id)));
      setDeletingId(null);
      // 集計データを再取得
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  if (reports.length === 0) return null;

  const inp: React.CSSProperties = {
    padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, background: "var(--warm-soft)",
          color: "#92400E", padding: "3px 10px", borderRadius: 100,
          border: "1px solid #FDE68A",
        }}>
          あなたの投稿
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
          編集・削除できます
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reports.map((r) => {
          const isEditing = editingId === r.id;
          const isDeleting = deletingId === r.id;
          const salaryYen = r.ote ?? r.annual_salary;

          return (
            <div key={r.id} style={{
              background: "#FFFBF0",
              border: `1px solid ${isEditing ? "var(--royal)" : "#FDE68A"}`,
              borderRadius: 14, padding: "16px 20px",
              boxShadow: isEditing ? "0 0 0 3px var(--royal-50)" : undefined,
            }}>
              {/* Top: status + actions */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: isEditing ? 12 : 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {r.is_approved ? (
                    <span style={{ fontSize: 11, fontWeight: 700, background: "var(--success-soft)", color: "var(--success)", padding: "3px 10px", borderRadius: 100 }}>公開中</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, background: "var(--warm-soft)", color: "#92400E", padding: "3px 10px", borderRadius: 100 }}>承認待ち</span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    投稿日: {new Date(r.created_at).toLocaleDateString("ja-JP")}
                  </span>
                </div>
                {!isEditing && !isDeleting && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(r)}
                      title="編集"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, padding: 0,
                        background: "var(--royal-50)", color: "var(--royal)",
                        border: "1px solid var(--royal-100)", borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingId(r.id)}
                      title="削除"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, padding: 0,
                        background: "#fff", color: "var(--error)",
                        border: "1px solid #FECACA", borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Summary view */}
              {!isEditing && !isDeleting && (
                <>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 2 }}>{r.company_name ?? "—"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{r.role_name ?? "—"}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
                    {fmtYen(salaryYen) ?? "—"}
                    {r.ote && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-mute)", marginLeft: 6 }}>OTE</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink-soft)" }}>
                    {r.start_year_month ? (
                      <span>{r.start_year_month} 〜 {r.end_year_month ?? "現在"}</span>
                    ) : (
                      <span style={{ color: "var(--error)" }}>⚠ 期間未設定</span>
                    )}
                    {r.grade && <span style={{ background: "var(--royal-50)", color: "var(--royal)", borderRadius: 6, padding: "1px 7px", fontWeight: 600 }}>{r.grade}</span>}
                    <span>{r.employment_status === "current" ? "現役" : "OB/OG"}</span>
                    {r.years_of_experience != null && <span>経験 {r.years_of_experience}年</span>}
                    {r.prefecture && <span>{r.prefecture}</span>}
                  </div>
                  {!r.is_approved && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#92400E", background: "var(--warm-soft)", borderRadius: 8, padding: "7px 12px" }}>
                      現在、編集部が内容を確認中です。承認されると集計に反映されます。
                    </div>
                  )}
                </>
              )}

              {/* Delete confirmation */}
              {isDeleting && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--error)", marginBottom: 8 }}>このデータを削除しますか？</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
                    {r.company_name} / {r.role_name} / {fmtYen(r.ote ?? r.annual_salary)} を削除します。この操作は取り消せません。
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { void confirmDelete(r.id); }}
                      disabled={deleteLoading}
                      style={{ padding: "7px 18px", background: "var(--error)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: deleteLoading ? "default" : "pointer" }}
                    >
                      {deleteLoading ? "削除中..." : "削除する"}
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      style={{ padding: "7px 14px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {isEditing && editState && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12 }}>
                    企業: <strong style={{ color: "var(--ink)" }}>{r.company_name ?? "—"}</strong>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 8 }}>（企業の変更は削除して再投稿してください）</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                    {/* 職種 */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>職種カテゴリ</label>
                      <select
                        value={editState.role_id}
                        onChange={(e) => setEditState((s) => s ? { ...s, role_id: e.target.value } : s)}
                        style={{ ...inp, width: "100%" }}
                      >
                        <option value="">選択してください</option>
                        {parents.map((parent) => (
                          <optgroup key={parent.id} label={parent.name}>
                            {children.filter((c) => c.parent_id === parent.id).map((child) => (
                              <option key={child.id} value={child.id}>{child.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* OTE */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                        想定年収 OTE（万円）<span style={{ color: "var(--error)" }}> *</span>
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number" min="100" max="50000" placeholder="例: 700"
                          value={editState.ote}
                          onChange={(e) => setEditState((s) => s ? { ...s, ote: e.target.value } : s)}
                          style={{ ...inp, width: 120 }}
                        />
                        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>万円</span>
                      </div>
                    </div>

                    {/* グレード */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>グレード（任意）</label>
                      <input
                        type="text" maxLength={50} placeholder="例: Grade 4"
                        value={editState.grade}
                        onChange={(e) => setEditState((s) => s ? { ...s, grade: e.target.value } : s)}
                        style={{ ...inp, width: "100%" }}
                      />
                    </div>

                    {/* 開始年月 */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                        開始年月<span style={{ color: "var(--error)" }}> *</span>
                      </label>
                      <YMPicker
                        value={editState.start_year_month}
                        onChange={(v) => setEditState((s) => s ? { ...s, start_year_month: v } : s)}
                      />
                    </div>

                    {/* 終了年月 */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>終了年月（退職・異動後の場合）</label>
                      <YMPicker
                        value={editState.end_year_month}
                        onChange={(v) => setEditState((s) => s ? { ...s, end_year_month: v } : s)}
                        placeholder="未設定"
                      />
                    </div>

                    {/* 在籍状況 */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>在籍状況</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["current", "alumni"] as const).map((s) => (
                          <button
                            key={s} type="button"
                            onClick={() => setEditState((st) => st ? { ...st, employment_status: s } : st)}
                            style={{
                              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: editState.employment_status === s ? "2px solid var(--success)" : "1px solid var(--line)",
                              background: editState.employment_status === s ? "var(--success-soft)" : "#fff",
                              color: editState.employment_status === s ? "var(--success)" : "var(--ink-soft)",
                            }}
                          >
                            {s === "current" ? "現役" : "OB/OG"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 経験年数 */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>業界経験年数</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number" min="0" max="50" placeholder="例: 5"
                          value={editState.years_of_experience}
                          onChange={(e) => setEditState((s) => s ? { ...s, years_of_experience: e.target.value } : s)}
                          style={{ ...inp, width: 80 }}
                        />
                        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>年</span>
                      </div>
                    </div>

                    {/* 都道府県 */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>勤務都道府県</label>
                      <select
                        value={editState.prefecture}
                        onChange={(e) => setEditState((s) => s ? { ...s, prefecture: e.target.value } : s)}
                        style={{ ...inp, width: "100%" }}
                      >
                        {PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* 内訳 */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>内訳（万円、任意）</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        {([
                          ["base_salary", "固定給"],
                          ["bonus_salary", "賞与"],
                          ["incentive", "インセンティブ"],
                          ["stock_options", "株式(RSU/SO)"],
                          ["allowances", "手当"],
                          ["fixed_overtime", "固定残業代"],
                        ] as const).map(([key, label]) => (
                          <div key={key}>
                            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>{label}</div>
                            <input
                              type="number" min="0" max="99999" placeholder="0"
                              value={editState[key]}
                              onChange={(e) => setEditState((s) => s ? { ...s, [key]: e.target.value } : s)}
                              style={{ ...inp, width: "100%" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {editError && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "var(--error)" }}>{editError}</div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button
                      onClick={() => { void saveEdit(r.id); }}
                      disabled={editSaving}
                      style={{ padding: "9px 22px", background: "var(--success)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: editSaving ? "default" : "pointer" }}
                    >
                      {editSaving ? "保存中..." : "保存する"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ padding: "9px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
