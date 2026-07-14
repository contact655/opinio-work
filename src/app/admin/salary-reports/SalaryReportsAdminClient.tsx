"use client";

import { useState, useTransition } from "react";

interface Report {
  id: string;
  company_id: string;
  user_id: string | null;
  role_id: string;
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
  achievement_rate: number | null;
  years_of_experience: number | null;
  employment_status: string;
  prefecture: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  proxy_note: string | null;
  created_at: string;
  company_name: string | null;
  role_name: string | null;
  user_name: string | null;
}

interface Company { id: string; name: string; }
interface Role { id: string; name: string; parent_id: string | null; }

function fmtYen(yen: number | null) {
  if (!yen) return null;
  return `${Math.round(yen / 10000).toLocaleString()}万円`;
}
function fmtMan(yen: number | null) {
  if (!yen) return null;
  return `${Math.round(yen / 10000)}万`;
}
function primarySalary(r: Report) {
  return r.ote ?? r.annual_salary;
}

const PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const YEARS = Array.from({ length: 15 }, (_, i) => String(new Date().getFullYear() - i));

function YMPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string; }) {
  const [year, month] = value ? value.split("-") : ["", ""];
  function update(y: string, m: string) {
    if (y && m) onChange(`${y}-${m}`);
    else onChange("");
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {placeholder && !value && <span style={{ fontSize: 11, color: "var(--ink-mute)", marginRight: 4 }}>{placeholder}</span>}
      <select value={year} onChange={(e) => update(e.target.value, month)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12, background: "#fff" }}>
        <option value="">年</option>
        {YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select value={month} onChange={(e) => update(year, e.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12, background: "#fff" }}>
        <option value="">月</option>
        {MONTHS.map((m) => <option key={m} value={m}>{parseInt(m)}月</option>)}
      </select>
    </div>
  );
}

const PROXY_EMPTY = {
  company_id: "",
  role_id: "",
  ote: "",
  base_salary: "",
  bonus_salary: "",
  incentive: "",
  stock_options: "",
  allowances: "",
  fixed_overtime: "",
  achievement_rate: "",
  start_year_month: "",
  end_year_month: "",
  grade: "",
  employment_status: "current",
  years_of_experience: "",
  prefecture: "東京都",
  proxy_note: "",
};

// Per-record inline edit state
interface EditState {
  start_year_month: string;
  end_year_month: string;
  grade: string;
  ote: string;
  achievement_rate: string;
  allowances: string;
  fixed_overtime: string;
  base_salary: string;
  bonus_salary: string;
  incentive: string;
  stock_options: string;
}

function makeEditState(r: Report): EditState {
  const manStr = (yen: number | null) => yen ? String(Math.round(yen / 10000)) : "";
  return {
    start_year_month: r.start_year_month ?? "",
    end_year_month: r.end_year_month ?? "",
    grade: r.grade ?? "",
    ote: manStr(r.ote),
    achievement_rate: r.achievement_rate ? String(r.achievement_rate) : "",
    allowances: manStr(r.allowances),
    fixed_overtime: manStr(r.fixed_overtime),
    base_salary: manStr(r.base_salary),
    bonus_salary: manStr(r.bonus_salary),
    incentive: manStr(r.incentive),
    stock_options: manStr(r.stock_options),
  };
}

export default function SalaryReportsAdminClient({
  reports: initial,
  companies,
  roles,
}: {
  reports: Report[];
  companies: Company[];
  roles: Role[];
}) {
  const [reports, setReports] = useState<Report[]>(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "flagged">("all");
  const [, startTransition] = useTransition();

  // Proxy form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(PROXY_EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Per-record edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function setF(key: keyof typeof PROXY_EMPTY, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setSubmitError(null);
    setSubmitSuccess(false);
  }

  async function submitProxy(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id) { setSubmitError("企業を選択してください"); return; }
    if (!form.role_id) { setSubmitError("職種を選択してください"); return; }
    if (!form.ote || parseInt(form.ote, 10) < 100) { setSubmitError("想定年収（OTE）を100万円以上で入力してください"); return; }
    if (!form.start_year_month) { setSubmitError("開始年月は必須です"); return; }
    if (!form.proxy_note.trim()) { setSubmitError("代理投稿メモは必須です（本人名・同意確認を記入）"); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const oteMan = parseInt(form.ote, 10);
      const body: Record<string, unknown> = {
        company_id: form.company_id,
        role_id: form.role_id,
        ote: oteMan,
        start_year_month: form.start_year_month || null,
        end_year_month: form.end_year_month || null,
        grade: form.grade || null,
        employment_status: form.employment_status,
        years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience, 10) : null,
        prefecture: form.prefecture || null,
        proxy_note: form.proxy_note.trim(),
      };
      if (form.base_salary)     body.base_salary     = parseInt(form.base_salary, 10);
      if (form.bonus_salary)    body.bonus_salary     = parseInt(form.bonus_salary, 10);
      if (form.incentive)       body.incentive        = parseInt(form.incentive, 10);
      if (form.stock_options)   body.stock_options    = parseInt(form.stock_options, 10);
      if (form.allowances)      body.allowances       = parseInt(form.allowances, 10);
      if (form.fixed_overtime)  body.fixed_overtime   = parseInt(form.fixed_overtime, 10);
      if (form.achievement_rate) body.achievement_rate = parseInt(form.achievement_rate, 10);

      const res = await fetch("/api/admin/salary-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setSubmitError(json.error ?? "投稿に失敗しました"); return; }

      const company = companies.find((c) => c.id === form.company_id);
      const role = roles.find((r) => r.id === form.role_id);
      const man2yen = (s: string) => s ? parseInt(s, 10) * 10000 : null;
      const newReport: Report = {
        id: json.id ?? crypto.randomUUID(),
        company_id: form.company_id,
        user_id: null,
        role_id: form.role_id,
        ote: oteMan * 10000,
        annual_salary: oteMan * 10000,
        base_salary: man2yen(form.base_salary),
        bonus_salary: man2yen(form.bonus_salary),
        incentive: man2yen(form.incentive),
        stock_options: man2yen(form.stock_options),
        allowances: man2yen(form.allowances),
        fixed_overtime: man2yen(form.fixed_overtime),
        start_year_month: form.start_year_month || null,
        end_year_month: form.end_year_month || null,
        grade: form.grade || null,
        achievement_rate: form.achievement_rate ? parseInt(form.achievement_rate, 10) : null,
        years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience, 10) : null,
        employment_status: form.employment_status,
        prefecture: form.prefecture || null,
        proxy_note: form.proxy_note.trim(),
        is_approved: true,
        is_flagged: false,
        created_at: new Date().toISOString(),
        company_name: company?.name ?? null,
        role_name: role?.name ?? null,
        user_name: null,
      };
      startTransition(() => setReports((prev) => [newReport, ...prev]));
      setSubmitSuccess(true);
      setForm(PROXY_EMPTY);
      setTimeout(() => setSubmitSuccess(false), 5000);
    } finally {
      setSubmitting(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/salary-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { alert("更新に失敗しました"); return false; }
    startTransition(() => setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...body as Partial<Report> } : r)));
    return true;
  }

  async function del(id: string) {
    if (!confirm("このデータを削除しますか？")) return;
    await fetch(`/api/admin/salary-reports/${id}`, { method: "DELETE" });
    startTransition(() => setReports((prev) => prev.filter((r) => r.id !== id)));
  }

  function startEdit(r: Report) {
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
    setEditSaving(true);
    setEditError(null);
    const man2yen = (s: string) => s ? parseInt(s, 10) * 10000 : null;
    const body: Record<string, unknown> = {
      start_year_month: editState.start_year_month || null,
      end_year_month: editState.end_year_month || null,
      grade: editState.grade || null,
      ote: editState.ote ? parseInt(editState.ote, 10) * 10000 : null,
      achievement_rate: editState.achievement_rate ? parseInt(editState.achievement_rate, 10) : null,
      allowances: man2yen(editState.allowances),
      fixed_overtime: man2yen(editState.fixed_overtime),
      base_salary: man2yen(editState.base_salary),
      bonus_salary: man2yen(editState.bonus_salary),
      incentive: man2yen(editState.incentive),
      stock_options: man2yen(editState.stock_options),
    };
    const ok = await patch(id, body);
    setEditSaving(false);
    if (ok) { setEditingId(null); setEditState(null); }
    else setEditError("保存に失敗しました");
  }

  const displayed = reports.filter((r) => {
    if (filter === "pending") return !r.is_approved;
    if (filter === "flagged") return r.is_flagged;
    return true;
  });

  const pendingCount = reports.filter((r) => !r.is_approved).length;
  const flaggedCount = reports.filter((r) => r.is_flagged).length;

  const inp: React.CSSProperties = {
    padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const inpW: React.CSSProperties = { ...inp, width: "100%" };

  return (
    <div>
      {/* ── Proxy Post Form ───────────────────────────────────────── */}
      <div style={{ marginBottom: 28, border: "2px solid var(--royal-100)", borderRadius: 14, overflow: "hidden" }}>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            width: "100%", textAlign: "left", padding: "14px 20px",
            background: showForm ? "var(--royal)" : "var(--royal-50)",
            color: showForm ? "#fff" : "var(--royal)",
            border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span>＋ 代理投稿（実データを聞き取り入力）</span>
          <span style={{ fontSize: 18 }}>{showForm ? "▲" : "▼"}</span>
        </button>

        {showForm && (
          <form onSubmit={(e) => { void submitProxy(e); }} style={{ padding: "24px 24px 20px", background: "#fafcff" }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16, padding: "10px 14px", background: "var(--warm-soft)", borderRadius: 8, lineHeight: 1.7 }}>
              ⚠️ <strong>実在する方から実際に聞いた年収のみを入力してください。</strong>架空データ・推測値は絶対に入力しないこと。
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
              {/* 企業 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  企業 <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <select value={form.company_id} onChange={(e) => setF("company_id", e.target.value)} style={inpW} required>
                  <option value="">選択してください</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* 職種 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  職種 <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <select value={form.role_id} onChange={(e) => setF("role_id", e.target.value)} style={inpW} required>
                  <option value="">選択してください</option>
                  {roles.filter((r) => r.parent_id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {/* 期間 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  開始年月 <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <YMPicker value={form.start_year_month} onChange={(v) => setF("start_year_month", v)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  終了年月（現職なら空欄）
                </label>
                <YMPicker value={form.end_year_month} onChange={(v) => setF("end_year_month", v)} />
              </div>

              {/* OTE */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  想定年収（OTE） <span style={{ color: "var(--error)" }}>*</span>
                  <span style={{ fontWeight: 400, color: "var(--ink-mute)", marginLeft: 6, fontSize: 11 }}>フル稼働時の想定年収（万円単位）</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number" min="100" max="100000" placeholder="例: 1200"
                    value={form.ote}
                    onChange={(e) => setF("ote", e.target.value)}
                    style={{ ...inp, width: 140 }}
                  />
                  <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>万円</span>
                  {form.ote && !isNaN(parseInt(form.ote)) && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>{parseInt(form.ote).toLocaleString()}万円</span>
                  )}
                </div>
              </div>

              {/* グレード */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>グレード（任意）</label>
                <input
                  type="text" placeholder="例: Grade 4 / Senior AE"
                  value={form.grade} onChange={(e) => setF("grade", e.target.value)}
                  maxLength={50}
                  style={{ ...inp, width: "100%" }}
                />
              </div>

              {/* 達成率 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>達成率（%、任意）</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number" min="0" max="500" placeholder="例: 120"
                    value={form.achievement_rate} onChange={(e) => setF("achievement_rate", e.target.value)}
                    style={{ ...inp, width: 90 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>%</span>
                </div>
              </div>

              {/* 内訳 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  内訳（万円、任意）
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {([
                    ["base_salary", "固定給"],
                    ["bonus_salary", "賞与"],
                    ["incentive", "インセンティブ"],
                    ["stock_options", "株式(RSU/SO)"],
                    ["allowances", "手当"],
                    ["fixed_overtime", "固定残業代"],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 4 }}>{label}</div>
                      <input
                        type="number" min="0" max="99999" placeholder="0"
                        value={form[key]} onChange={(e) => setF(key, e.target.value)}
                        style={{ ...inp, width: "100%" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 在籍状況・経験年数・勤務地 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>在籍状況</label>
                <select value={form.employment_status} onChange={(e) => setF("employment_status", e.target.value)} style={inpW}>
                  <option value="current">現役（在籍中）</option>
                  <option value="alumni">OB/OG（退職済み）</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>経験年数（任意）</label>
                <input type="number" min="0" max="50" placeholder="例: 3" value={form.years_of_experience} onChange={(e) => setF("years_of_experience", e.target.value)} style={inpW} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>勤務地</label>
                <select value={form.prefecture} onChange={(e) => setF("prefecture", e.target.value)} style={{ ...inp, width: 200 }}>
                  <option value="">未回答</option>
                  {PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 代理メモ */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  代理投稿メモ <span style={{ color: "var(--error)" }}>*</span>
                  <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-mute)", marginLeft: 8 }}>
                    本人名・確認日・同意を得た旨を記入（管理者のみ閲覧、公開されません）
                  </span>
                </label>
                <textarea
                  value={form.proxy_note} onChange={(e) => setF("proxy_note", e.target.value)}
                  placeholder="例: 山田太郎さん（元Salesforce / AE）から2026-07-15に口頭確認。本人同意済み。"
                  rows={2} style={{ ...inpW, resize: "vertical" }} required
                />
              </div>
            </div>

            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "10px 28px", background: submitting ? "var(--line)" : "var(--success)",
                  color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting ? "投稿中..." : "✓ 代理投稿（即公開）"}
              </button>
              {submitSuccess && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>✓ 投稿しました</span>}
              {submitError && <span style={{ fontSize: 13, color: "var(--error)" }}>⚠ {submitError}</span>}
            </div>
          </form>
        )}
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          ["all", `全件 (${reports.length})`],
          ["pending", `承認待ち (${pendingCount})`],
          ["flagged", `フラグあり (${flaggedCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: filter === key ? "var(--royal)" : "#fff",
              color: filter === key ? "#fff" : "var(--ink-soft)",
              borderColor: filter === key ? "var(--royal)" : "var(--line)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-mute)", fontSize: 14 }}>
          該当するデータはありません
        </div>
      )}

      {/* ── Report list ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayed.map((r) => {
          const isProxy = r.user_id === null;
          const isEditing = editingId === r.id;
          const salaryYen = primarySalary(r);
          return (
            <div
              key={r.id}
              style={{
                background: r.is_flagged ? "#FEF3C7" : isProxy ? "#f0fdf4" : "#fff",
                border: `1px solid ${r.is_flagged ? "#FCD34D" : isProxy ? "#A7F3D0" : "var(--line)"}`,
                borderRadius: 12, padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    {isProxy && <span style={{ fontSize: 10, fontWeight: 700, background: "#D1FAE5", color: "#065F46", padding: "2px 7px", borderRadius: 100 }}>代理投稿</span>}
                    {r.is_flagged && <span style={{ fontSize: 10, fontWeight: 700, background: "#FDE68A", color: "#92400E", padding: "2px 7px", borderRadius: 100 }}>⚠ 要確認</span>}
                    {r.is_approved
                      ? <span style={{ fontSize: 10, fontWeight: 700, background: "var(--success-soft)", color: "var(--success)", padding: "2px 7px", borderRadius: 100 }}>✓ 公開中</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, background: "var(--line-soft)", color: "var(--ink-mute)", padding: "2px 7px", borderRadius: 100 }}>承認待ち</span>
                    }
                  </div>

                  {/* Company + Role */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    {r.company_name ?? "不明な企業"} — {r.role_name ?? "不明な職種"}
                  </div>

                  {/* Primary salary */}
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
                    {fmtYen(salaryYen) ?? "—"}
                    {r.ote && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginLeft: 6 }}>OTE</span>}
                  </div>

                  {/* Period + Grade */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap", fontSize: 12, color: "var(--ink-soft)" }}>
                    {r.start_year_month && (
                      <span>{r.start_year_month} 〜 {r.end_year_month ?? "現在"}</span>
                    )}
                    {!r.start_year_month && (
                      <span style={{ color: "var(--error)" }}>⚠ 期間未設定</span>
                    )}
                    {r.grade && <span style={{ background: "var(--royal-50)", color: "var(--royal)", fontWeight: 600, borderRadius: 6, padding: "1px 7px" }}>{r.grade}</span>}
                    {r.achievement_rate != null && <span>達成率 {r.achievement_rate}%</span>}
                  </div>

                  {/* Breakdown */}
                  {(r.base_salary || r.bonus_salary || r.incentive || r.stock_options || r.allowances || r.fixed_overtime) && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {r.base_salary && <span style={tagStyle}>固定給 {fmtMan(r.base_salary)}万</span>}
                      {r.bonus_salary && <span style={tagStyle}>賞与 {fmtMan(r.bonus_salary)}万</span>}
                      {r.incentive && <span style={tagStyle}>インセンティブ {fmtMan(r.incentive)}万</span>}
                      {r.stock_options && <span style={tagStyle}>株式報酬 {fmtMan(r.stock_options)}万</span>}
                      {r.allowances && <span style={tagStyle}>手当 {fmtMan(r.allowances)}万</span>}
                      {r.fixed_overtime && <span style={tagStyle}>固定残業代 {fmtMan(r.fixed_overtime)}万</span>}
                    </div>
                  )}

                  {/* Meta */}
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-soft)", flexWrap: "wrap" }}>
                    <span>{r.employment_status === "current" ? "現役" : "OB/OG"}</span>
                    {r.years_of_experience != null && <span>経験 {r.years_of_experience}年</span>}
                    {r.prefecture && <span>{r.prefecture}</span>}
                    {!isProxy && <span>投稿者: {r.user_name ?? "不明"}</span>}
                    <span>{new Date(r.created_at).toLocaleDateString("ja-JP")}</span>
                  </div>

                  {r.proxy_note && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#065F46", background: "#D1FAE5", borderRadius: 6, padding: "5px 10px" }}>
                      📝 {r.proxy_note}
                    </div>
                  )}

                  {/* Inline Edit Panel */}
                  {isEditing && editState && (
                    <div style={{ marginTop: 16, padding: "16px", background: "var(--royal-50)", borderRadius: 10, border: "1px solid var(--royal-100)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 12 }}>✏ 編集モード</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>開始年月 *</div>
                          <YMPicker value={editState.start_year_month} onChange={(v) => setEditState((s) => s ? { ...s, start_year_month: v } : s)} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>終了年月</div>
                          <YMPicker value={editState.end_year_month} onChange={(v) => setEditState((s) => s ? { ...s, end_year_month: v } : s)} placeholder="未設定" />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>OTE（万円）</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input type="number" min="100" max="100000" value={editState.ote} onChange={(e) => setEditState((s) => s ? { ...s, ote: e.target.value } : s)} style={{ ...inp, width: 100 }} />
                            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>万円</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>グレード</div>
                          <input type="text" maxLength={50} value={editState.grade} onChange={(e) => setEditState((s) => s ? { ...s, grade: e.target.value } : s)} style={{ ...inp, width: "100%" }} placeholder="例: Grade 4" />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>達成率 (%)</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input type="number" min="0" max="500" value={editState.achievement_rate} onChange={(e) => setEditState((s) => s ? { ...s, achievement_rate: e.target.value } : s)} style={{ ...inp, width: 80 }} />
                            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>%</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 10 }}>
                        {([
                          ["base_salary", "固定給"],
                          ["bonus_salary", "賞与"],
                          ["incentive", "インセンティブ"],
                          ["stock_options", "株式"],
                          ["allowances", "手当"],
                          ["fixed_overtime", "固定残業"],
                        ] as const).map(([key, label]) => (
                          <div key={key}>
                            <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 3 }}>{label}（万）</div>
                            <input
                              type="number" min="0" max="99999" placeholder="0"
                              value={editState[key]}
                              onChange={(e) => setEditState((s) => s ? { ...s, [key]: e.target.value } : s)}
                              style={{ ...inp, width: "100%" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                        <button
                          onClick={() => { void saveEdit(r.id); }}
                          disabled={editSaving}
                          style={{ padding: "7px 18px", background: "var(--success)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: editSaving ? "default" : "pointer" }}
                        >
                          {editSaving ? "保存中..." : "保存"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: "7px 14px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                        >
                          キャンセル
                        </button>
                        {editError && <span style={{ fontSize: 12, color: "var(--error)" }}>{editError}</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 100 }}>
                  {!r.is_approved ? (
                    <button
                      onClick={() => { void patch(r.id, { is_approved: true, is_flagged: false }); }}
                      style={{ padding: "7px 14px", background: "var(--success)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      承認する
                    </button>
                  ) : (
                    <button
                      onClick={() => { void patch(r.id, { is_approved: false }); }}
                      style={{ padding: "7px 14px", background: "var(--line-soft)", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
                    >
                      承認取消
                    </button>
                  )}
                  {r.is_flagged && (
                    <button
                      onClick={() => { void patch(r.id, { is_flagged: false }); }}
                      style={{ padding: "7px 14px", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      フラグ解除
                    </button>
                  )}
                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(r)}
                      style={{ padding: "7px 14px", background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      ✏ 編集
                    </button>
                  ) : (
                    <button
                      onClick={cancelEdit}
                      style={{ padding: "7px 14px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      ✕ 閉じる
                    </button>
                  )}
                  <button
                    onClick={() => { void del(r.id); }}
                    style={{ padding: "7px 14px", background: "var(--error-soft)", color: "var(--error)", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const tagStyle: React.CSSProperties = {
  fontSize: 11, background: "var(--bg-tint)", border: "1px solid var(--line)",
  borderRadius: 6, padding: "2px 8px", color: "var(--ink-soft)",
};
