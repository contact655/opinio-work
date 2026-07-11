"use client";

import { useState } from "react";
import Link from "next/link";

type Company = { id: string; name: string; industry: string | null; phase: string | null };

const RATING_AXES = [
  { key: "rating_culture",      label: "社風・カルチャー" },
  { key: "rating_growth",       label: "成長・学習機会" },
  { key: "rating_wlb",          label: "ワークライフバランス" },
  { key: "rating_compensation", label: "報酬・評価制度" },
] as const;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 2,
            fontSize: 28, lineHeight: 1,
            color: n <= (hover || value) ? "#F59E0B" : "#e2e8f0",
            transition: "color 0.1s",
          }}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span style={{ fontSize: 13, color: "#64748b", marginLeft: 6, alignSelf: "center" }}>
          {["", "低い", "やや低い", "普通", "やや高い", "高い"][value]}
        </span>
      )}
    </div>
  );
}

export default function ReviewForm({ company }: { company: Company }) {
  const [employmentStatus, setEmploymentStatus] = useState<"current" | "alumni">("current");
  const [jobType, setJobType] = useState("");
  const [ratingOverall, setRatingOverall] = useState(0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratingOverall === 0) { setError("総合評価を選択してください"); return; }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/company-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: company.id,
        employment_status: employmentStatus,
        rating_overall: ratingOverall,
        rating_culture: ratings.rating_culture || null,
        rating_growth: ratings.rating_growth || null,
        rating_wlb: ratings.rating_wlb || null,
        rating_compensation: ratings.rating_compensation || null,
        pros: pros.trim() || null,
        cons: cons.trim() || null,
        job_type: jobType.trim() || null,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "送信に失敗しました");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
            口コミを送信しました
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 28 }}>
            ありがとうございます。<br />
            編集部が確認後、承認した口コミを企業ページに掲載します。
          </p>
          <Link
            href={`/companies/${company.id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: "linear-gradient(135deg, var(--royal), var(--accent))",
              color: "#fff", textDecoration: "none",
            }}
          >
            {company.name} のページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ヘッダー */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/companies/${company.id}`} style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none" }}>
            ← {company.name} に戻る
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "12px 0 4px", fontFamily: "'Noto Serif JP', serif" }}>
            {company.name} の口コミを書く
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
            実際の経験をもとに、同じ業界を目指す人の参考になる情報を教えてください。
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* 在籍状況 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 16, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>在籍状況</h2>
          <div style={{ display: "flex", gap: 10 }}>
            {([["current", "現在在籍中"], ["alumni", "退職・転職済み"]] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setEmploymentStatus(val)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: `2px solid ${employmentStatus === val ? "var(--royal)" : "var(--line)"}`,
                  background: employmentStatus === val ? "var(--royal-50)" : "#fff",
                  color: employmentStatus === val ? "var(--royal)" : "var(--ink-soft)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 職種 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 16, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            担当していた職種 <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)" }}>（任意）</span>
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 12 }}>例: フィールドセールス、プロダクトマネージャー、カスタマーサクセス</p>
          <input
            type="text"
            value={jobType}
            onChange={e => setJobType(e.target.value)}
            placeholder="職種を入力"
            style={{ width: "100%", fontSize: 14, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", boxSizing: "border-box", outline: "none" }}
          />
        </section>

        {/* 総合評価 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 16, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
            総合評価 <span style={{ color: "var(--error)", fontSize: 12 }}>*必須</span>
          </h2>
          <StarPicker value={ratingOverall} onChange={setRatingOverall} />
        </section>

        {/* 軸別評価 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 16, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
            軸別評価 <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)" }}>（任意）</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {RATING_AXES.map(({ key, label }) => (
              <div key={key}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{label}</div>
                <StarPicker value={ratings[key] ?? 0} onChange={v => setRatings(r => ({ ...r, [key]: v }))} />
              </div>
            ))}
          </div>
        </section>

        {/* 良かった点 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 16, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            良かった点 <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)" }}>（任意）</span>
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10 }}>入社して良かったこと、この会社ならではの強みなどを教えてください</p>
          <textarea
            value={pros}
            onChange={e => setPros(e.target.value)}
            rows={4}
            placeholder="例: 裁量が大きくオーナーシップを持って仕事ができる。チームの心理的安全性が高い。"
            style={{ width: "100%", fontSize: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }}
          />
        </section>

        {/* 気になった点 */}
        <section style={{ background: "#fff", borderRadius: 14, padding: "24px", marginBottom: 24, border: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            気になった点・改善点 <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-mute)" }}>（任意）</span>
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10 }}>転職する際に考慮した点や、入社後に気になったことなど</p>
          <textarea
            value={cons}
            onChange={e => setCons(e.target.value)}
            rows={4}
            placeholder="例: 組織規模が拡大中のため、社内プロセスが整備されていない部分もある。"
            style={{ width: "100%", fontSize: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }}
          />
        </section>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--error-soft)", color: "var(--error)", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16, lineHeight: 1.6 }}>
          ※ 送信された口コミは編集部が確認後、承認したものを掲載します。<br />
          ※ 個人が特定される情報は含めないようにしてください。
        </div>

        <button
          type="submit"
          disabled={submitting || ratingOverall === 0}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 800,
            background: ratingOverall > 0 ? "linear-gradient(135deg, var(--royal), var(--accent))" : "var(--line)",
            color: ratingOverall > 0 ? "#fff" : "var(--ink-mute)",
            border: "none", cursor: ratingOverall > 0 ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow: ratingOverall > 0 ? "0 2px 12px rgba(0,35,102,0.20)" : "none",
          }}
        >
          {submitting ? "送信中..." : "口コミを送信する"}
        </button>
      </form>
    </div>
  );
}
