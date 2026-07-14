"use client";

import { useState, useTransition } from "react";

interface Report {
  id: string;
  company_id: string;
  user_id: string | null;
  role_id: string;
  annual_salary: number;
  base_salary: number | null;
  bonus_salary: number | null;
  incentive: number | null;
  stock_options: number | null;
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

function fmt(yen: number) {
  return `${Math.round(yen / 10000)}万円`;
}
function fmtMan(yen: number | null) {
  if (!yen) return null;
  return `${Math.round(yen / 10000)}万`;
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

const EMPTY_FORM = {
  company_id: "",
  role_id: "",
  base_salary: "",
  bonus_salary: "",
  incentive: "",
  stock_options: "",
  annual_salary_override: "", // 合計を手動入力する場合
  employment_status: "current",
  years_of_experience: "",
  prefecture: "東京都",
  proxy_note: "",
};

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

  // Proxy form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Computed annual salary from breakdown (万円)
  const computedAnnual =
    (parseInt(form.base_salary || "0", 10) || 0) +
    (parseInt(form.bonus_salary || "0", 10) || 0) +
    (parseInt(form.incentive || "0", 10) || 0) +
    (parseInt(form.stock_options || "0", 10) || 0);

  const annualForSubmit = form.annual_salary_override
    ? parseInt(form.annual_salary_override, 10)
    : computedAnnual;

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setSubmitError(null);
    setSubmitSuccess(false);
  }

  async function submitProxy(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id) { setSubmitError("企業を選択してください"); return; }
    if (!form.role_id) { setSubmitError("職種を選択してください"); return; }
    if (!annualForSubmit || annualForSubmit < 100) { setSubmitError("年収は100万円以上で入力してください"); return; }
    if (!form.proxy_note.trim()) { setSubmitError("代理投稿メモは必須です（本人名・同意確認を記入）"); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        company_id: form.company_id,
        role_id: form.role_id,
        annual_salary: annualForSubmit,
        employment_status: form.employment_status,
        years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience, 10) : null,
        prefecture: form.prefecture || null,
        proxy_note: form.proxy_note.trim(),
      };
      if (form.base_salary)    body.base_salary    = parseInt(form.base_salary, 10);
      if (form.bonus_salary)   body.bonus_salary   = parseInt(form.bonus_salary, 10);
      if (form.incentive)      body.incentive      = parseInt(form.incentive, 10);
      if (form.stock_options)  body.stock_options  = parseInt(form.stock_options, 10);

      const res = await fetch("/api/admin/salary-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setSubmitError(json.error ?? "投稿に失敗しました"); return; }

      // Optimistic add to list
      const company = companies.find((c) => c.id === form.company_id);
      const role = roles.find((r) => r.id === form.role_id);
      const newReport: Report = {
        id: json.id ?? crypto.randomUUID(),
        company_id: form.company_id,
        user_id: null,
        role_id: form.role_id,
        annual_salary: annualForSubmit * 10000,
        base_salary: form.base_salary ? parseInt(form.base_salary, 10) * 10000 : null,
        bonus_salary: form.bonus_salary ? parseInt(form.bonus_salary, 10) * 10000 : null,
        incentive: form.incentive ? parseInt(form.incentive, 10) * 10000 : null,
        stock_options: form.stock_options ? parseInt(form.stock_options, 10) * 10000 : null,
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
      startTransition(() => {
        setReports((prev) => [newReport, ...prev]);
      });
      setSubmitSuccess(true);
      setForm(EMPTY_FORM);
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
    if (!res.ok) { alert("更新に失敗しました"); return; }
    startTransition(() => {
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...body as Partial<Report> } : r));
    });
  }

  async function del(id: string) {
    if (!confirm("このデータを削除しますか？")) return;
    await fetch(`/api/admin/salary-reports/${id}`, { method: "DELETE" });
    startTransition(() => {
      setReports((prev) => prev.filter((r) => r.id !== id));
    });
  }

  const displayed = reports.filter((r) => {
    if (filter === "pending") return !r.is_approved;
    if (filter === "flagged") return r.is_flagged;
    return true;
  });

  const pendingCount = reports.filter((r) => !r.is_approved).length;
  const flaggedCount = reports.filter((r) => r.is_flagged).length;

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div>
      {/* ── Proxy Post Form ────────────────────────────────────────────── */}
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
              代理投稿メモに「本人の氏名・確認日・同意を得た旨」を必ず記入してください。
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
              {/* 企業 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  企業 <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} style={inp} required>
                  <option value="">選択してください</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* 職種 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  職種 <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <select value={form.role_id} onChange={(e) => set("role_id", e.target.value)} style={inp} required>
                  <option value="">選択してください</option>
                  {roles.filter((r) => r.parent_id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {/* 年収内訳 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  年収内訳（万円）— 合計が自動計算されます
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {([
                    ["base_salary", "固定給"],
                    ["bonus_salary", "賞与"],
                    ["incentive", "インセンティブ"],
                    ["stock_options", "株式報酬(RSU/SO)"],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>{label}</div>
                      <input
                        type="number" min="0" max="99999" placeholder="0"
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        style={inp}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>合計（自動）:</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                    {computedAnnual > 0 ? `${computedAnnual}万円` : "—"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>|</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>手動入力:</span>
                    <input
                      type="number" min="100" max="100000" placeholder="例: 1200"
                      value={form.annual_salary_override}
                      onChange={(e) => set("annual_salary_override", e.target.value)}
                      style={{ ...inp, width: 100 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>万円</span>
                  </div>
                </div>
              </div>

              {/* 在籍状況 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>在籍状況</label>
                <select value={form.employment_status} onChange={(e) => set("employment_status", e.target.value)} style={inp}>
                  <option value="current">現役（在籍中）</option>
                  <option value="alumni">OB/OG（退職済み）</option>
                </select>
              </div>

              {/* 経験年数 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>在籍時の経験年数（任意）</label>
                <input
                  type="number" min="0" max="50" placeholder="例: 3"
                  value={form.years_of_experience}
                  onChange={(e) => set("years_of_experience", e.target.value)}
                  style={inp}
                />
              </div>

              {/* 勤務地 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>勤務地</label>
                <select value={form.prefecture} onChange={(e) => set("prefecture", e.target.value)} style={inp}>
                  <option value="">未回答</option>
                  {PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 代理投稿メモ */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 5 }}>
                  代理投稿メモ <span style={{ color: "var(--error)" }}>*</span>
                  <span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-mute)", marginLeft: 8 }}>
                    本人名・確認日・同意を得た旨を記入（管理者のみ閲覧、公開されません）
                  </span>
                </label>
                <textarea
                  value={form.proxy_note}
                  onChange={(e) => set("proxy_note", e.target.value)}
                  placeholder="例: 山田太郎さん（元Salesforce / AE）から2026-07-15に口頭確認。本人同意済み。"
                  rows={2}
                  style={{ ...inp, resize: "vertical" as const }}
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="submit"
                disabled={submitting || !annualForSubmit}
                style={{
                  padding: "10px 28px", background: submitting ? "var(--line)" : "var(--success)",
                  color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting ? "投稿中..." : "✓ 代理投稿（即公開）"}
              </button>
              {submitSuccess && (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>✓ 投稿しました</span>
              )}
              {submitError && (
                <span style={{ fontSize: 13, color: "var(--error)" }}>⚠ {submitError}</span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
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

      {/* ── Report list ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayed.map((r) => {
          const isProxy = r.user_id === null;
          return (
            <div
              key={r.id}
              style={{
                background: r.is_flagged ? "#FEF3C7" : isProxy ? "#f0fdf4" : "#fff",
                border: `1px solid ${r.is_flagged ? "#FCD34D" : isProxy ? "#A7F3D0" : "var(--line)"}`,
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  {/* Status badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    {isProxy && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#D1FAE5", color: "#065F46", padding: "2px 7px", borderRadius: 100 }}>
                        代理投稿
                      </span>
                    )}
                    {r.is_flagged && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#FDE68A", color: "#92400E", padding: "2px 7px", borderRadius: 100 }}>
                        ⚠ 要確認
                      </span>
                    )}
                    {r.is_approved ? (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--success-soft)", color: "var(--success)", padding: "2px 7px", borderRadius: 100 }}>
                        ✓ 公開中
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--line-soft)", color: "var(--ink-mute)", padding: "2px 7px", borderRadius: 100 }}>
                        承認待ち
                      </span>
                    )}
                  </div>

                  {/* Company + Role */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    {r.company_name ?? "不明な企業"} — {r.role_name ?? "不明な職種"}
                  </div>

                  {/* Annual salary */}
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>
                    {fmt(r.annual_salary)}
                  </div>

                  {/* Breakdown */}
                  {(r.base_salary || r.bonus_salary || r.incentive || r.stock_options) && (
                    <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      {r.base_salary && <span style={{ fontSize: 11, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 8px", color: "var(--ink-soft)" }}>固定給 {fmtMan(r.base_salary)}万</span>}
                      {r.bonus_salary && <span style={{ fontSize: 11, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 8px", color: "var(--ink-soft)" }}>賞与 {fmtMan(r.bonus_salary)}万</span>}
                      {r.incentive && <span style={{ fontSize: 11, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 8px", color: "var(--ink-soft)" }}>インセンティブ {fmtMan(r.incentive)}万</span>}
                      {r.stock_options && <span style={{ fontSize: 11, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 8px", color: "var(--ink-soft)" }}>株式報酬 {fmtMan(r.stock_options)}万</span>}
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

                  {/* Proxy note */}
                  {r.proxy_note && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#065F46", background: "#D1FAE5", borderRadius: 6, padding: "5px 10px" }}>
                      📝 {r.proxy_note}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
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
