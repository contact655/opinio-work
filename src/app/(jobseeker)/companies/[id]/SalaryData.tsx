"use client";

import { useState, useEffect } from "react";

type SalarySummary = { avg: number; min: number; max: number; count: number };
type ByJobType = Record<string, { count: number; avg: number }>;

function fmt(n: number) {
  return Math.round(n / 10000) + "万円";
}

const JOB_TYPES = [
  "営業", "マーケティング", "カスタマーサクセス", "プロダクトマネージャー",
  "エンジニア（バックエンド）", "エンジニア（フロントエンド）", "エンジニア（インフラ/SRE）",
  "デザイナー", "事業開発", "コーポレート", "経営幹部", "その他"
];

export default function SalaryDataSection({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [byJobType, setByJobType] = useState<ByJobType>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // form state
  const [jobType, setJobType] = useState("");
  const [years, setYears] = useState("");
  const [salary, setSalary] = useState("");
  const [empStatus, setEmpStatus] = useState<"current" | "alumni">("current");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/salary-reports?company_id=${companyId}`)
      .then((r) => r.json())
      .then((d) => { setSummary(d.summary); setByJobType(d.byJobType ?? {}); })
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobType || !salary) return;
    setSubmitting(true);
    const res = await fetch("/api/salary-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        job_type: jobType,
        years_of_experience: years ? parseInt(years) : null,
        annual_salary: parseInt(salary) * 10000,
        employment_status: empStatus,
      }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setSubmitted(true);
    setShowForm(false);
  }

  const jobTypeEntries = Object.entries(byJobType).sort((a, b) => b[1].avg - a[1].avg);
  const maxAvg = jobTypeEntries[0]?.[1].avg ?? 1;

  return (
    <section id="salary" style={{ padding: "32px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: 0 }}>給与データ</h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>
            在籍者・OBが匿名で投稿した実績給与
          </p>
        </div>
        {!submitted && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid var(--royal)", background: showForm ? "var(--royal)" : "#fff", color: showForm ? "#fff" : "var(--royal)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {showForm ? "閉じる" : "給与を投稿"}
          </button>
        )}
      </div>

      {/* 投稿フォーム */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "var(--royal-50)", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid var(--royal-100)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            {companyName} での給与を匿名投稿
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>雇用ステータス</label>
              <select value={empStatus} onChange={(e) => setEmpStatus(e.target.value as "current" | "alumni")}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
                <option value="current">現職</option>
                <option value="alumni">元社員・OB</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>経験年数</label>
              <select value={years} onChange={(e) => setYears(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
                <option value="">選択しない</option>
                {[1,2,3,4,5,6,7,8,9,10,15,20].map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>職種 *</label>
            <select value={jobType} onChange={(e) => setJobType(e.target.value)} required
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
              <option value="">選択してください</option>
              {JOB_TYPES.map(jt => <option key={jt} value={jt}>{jt}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>年収（万円） *</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} required min={200} max={10000} placeholder="例: 700"
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 }} />
              <span style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>万円</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 16 }}>
            ※ 投稿内容は編集部確認後に公開されます。個人が特定される情報は掲載されません。
          </div>
          <button type="submit" disabled={submitting || !jobType || !salary}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: submitting ? "var(--line)" : "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}>
            {submitting ? "送信中..." : "匿名で投稿する"}
          </button>
        </form>
      )}

      {submitted && (
        <div style={{ background: "var(--success-soft)", border: "1px solid #6EE7B7", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#065F46" }}>
          ✓ 投稿を受け付けました。編集部確認後に公開されます。
        </div>
      )}

      {loading ? (
        <div style={{ height: 120, background: "var(--line-soft)", borderRadius: 12, animation: "shimmer 1.5s infinite" }} />
      ) : summary ? (
        <>
          {/* サマリー */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "平均年収", value: fmt(summary.avg), color: "var(--success)" },
              { label: "最低", value: fmt(summary.min), color: "var(--ink-soft)" },
              { label: "最高", value: fmt(summary.max), color: "var(--ink-soft)" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "Inter, sans-serif" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 16 }}>
            {summary.count}件の投稿に基づく
          </div>

          {/* 職種別 */}
          {jobTypeEntries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jobTypeEntries.map(([jt, d]) => (
                <div key={jt} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 140, fontSize: 12, color: "var(--ink)", flexShrink: 0 }}>{jt}</div>
                  <div style={{ flex: 1, background: "var(--line-soft)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${(d.avg / maxAvg) * 100}%`, height: "100%", background: "var(--success)", borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 70, textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{fmt(d.avg)}</div>
                  <div style={{ width: 30, fontSize: 11, color: "var(--ink-mute)" }}>{d.count}件</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ background: "var(--bg-tint)", border: "1.5px dashed var(--line)", borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            まだ給与データがありません
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            在籍者・OBの方はぜひ投稿してください
          </div>
        </div>
      )}
    </section>
  );
}
