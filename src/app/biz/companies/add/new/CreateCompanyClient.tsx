"use client";

import { useState } from "react";

const INDUSTRY_OPTIONS = [
  "IT / SaaS",
  "コンサルティング",
  "金融 / FinTech",
  "製造業",
  "小売 / EC",
  "メディア",
  "医療 / ヘルスケア",
  "その他",
];

const EMPLOYEE_COUNT_OPTIONS = [
  "1-10名",
  "11-50名",
  "51-100名",
  "101-300名",
  "301-1,000名",
  "1,001名以上",
];

export function CreateCompanyClient() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("会社名を入力してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/company/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry || null,
          employee_count: employeeCount || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "会社の作成に失敗しました");
        return;
      }
      window.location.href = data.redirectTo ?? "/biz/dashboard";
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim() !== "" && !loading;

  return (
    <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
      {/* 戻るリンク */}
      <a
        href="/biz/companies/add"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
          marginBottom: 32,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        追加方法を選ぶ
      </a>

      {/* アイコン */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--royal-50)", color: "var(--royal)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: "var(--font-noto-serif)",
        fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 8,
      }}>
        新しい会社を作成
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
        あなたが代表となる新しい会社を Opinio に登録します。
        詳細な企業情報は作成後に会社設定ページから編集できます。
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 会社名 */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
            会社名 <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="株式会社〇〇"
            style={{
              display: "block", width: "100%", padding: "11px 14px",
              fontSize: 13,
              border: "1.5px solid var(--line)",
              borderRadius: 8, outline: "none",
              color: "var(--ink)", background: "#fff",
              boxSizing: "border-box",
              fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
            }}
          />
        </div>

        {/* 業界 + 会社規模 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
              業界
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{
                display: "block", width: "100%", padding: "11px 14px",
                fontSize: 13,
                border: "1.5px solid var(--line)",
                borderRadius: 8, outline: "none",
                color: industry ? "var(--ink)" : "var(--ink-mute)",
                background: "#fff",
                boxSizing: "border-box",
                fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: 32,
              } as React.CSSProperties}
            >
              <option value="">選択してください</option>
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
              会社規模
            </label>
            <select
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              style={{
                display: "block", width: "100%", padding: "11px 14px",
                fontSize: 13,
                border: "1.5px solid var(--line)",
                borderRadius: 8, outline: "none",
                color: employeeCount ? "var(--ink)" : "var(--ink-mute)",
                background: "#fff",
                boxSizing: "border-box",
                fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: 32,
              } as React.CSSProperties}
            >
              <option value="">選択してください</option>
              {EMPLOYEE_COUNT_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: 12, color: "var(--error)",
            padding: "9px 12px", background: "var(--error-soft)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: "block", width: "100%",
              padding: "13px",
              background: canSubmit ? "var(--royal)" : "var(--ink-mute)",
              color: "#fff",
              border: "none", borderRadius: 10,
              fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
              fontSize: 14, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s",
              boxShadow: canSubmit ? "0 4px 14px rgba(0,35,102,0.2)" : "none",
              boxSizing: "border-box",
            } as React.CSSProperties}
          >
            {loading ? "作成中..." : "作成する"}
          </button>

          <a
            href="/biz/companies/add"
            style={{
              display: "block", textAlign: "center",
              fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
              padding: "8px",
            }}
          >
            キャンセル
          </a>
        </div>
      </form>
    </div>
  );
}
