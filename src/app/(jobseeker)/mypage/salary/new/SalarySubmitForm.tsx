"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RoleChild { id: string; name: string; }
interface RoleGroup { id: string; name: string; children: RoleChild[]; }

interface Props {
  grouped: RoleGroup[];
  prefillCompanyId?: string;
  prefillCompanyName?: string;
}

const PREFECTURES = [
  "東京都","神奈川県","大阪府","愛知県","埼玉県","千葉県","兵庫県","福岡県",
  "北海道","京都府","宮城県","広島県","茨城県","栃木県","群馬県","静岡県",
  "岡山県","奈良県","長野県","新潟県","その他",
];

export default function SalarySubmitForm({ grouped, prefillCompanyId, prefillCompanyName }: Props) {
  const router = useRouter();
  const [companyId] = useState(prefillCompanyId ?? "");
  const [companySearch, setCompanySearch] = useState(prefillCompanyName ?? "");
  const [roleParent, setRoleParent] = useState("");
  const [roleId, setRoleId] = useState("");
  const [salaryMan, setSalaryMan] = useState("");
  const [yoe, setYoe] = useState("");
  const [status, setStatus] = useState<"current" | "alumni">("current");
  const [prefecture, setPrefecture] = useState("東京都");
  const [companySuggestions, setCompanySuggestions] = useState<{ id: string; name: string }[]>([]);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(companyId);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const selectedParent = grouped.find((g) => g.id === roleParent);

  const searchCompany = useCallback(async (q: string) => {
    if (q.length < 2) { setCompanySuggestions([]); return; }
    const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q)}&limit=6`);
    if (!res.ok) return;
    const data = await res.json() as { results: { id: string; name: string }[] };
    setCompanySuggestions(data.results ?? []);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!resolvedCompanyId) { setError("企業を選択してください"); return; }
    if (!roleId) { setError("職種を選択してください"); return; }
    const sal = parseInt(salaryMan, 10);
    if (!salaryMan || isNaN(sal) || sal < 100 || sal > 50000) {
      setError("年収を正しく入力してください（100万〜50000万円）");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/salary-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: resolvedCompanyId,
        role_id: roleId,
        annual_salary_man: sal,
        years_of_experience: yoe ? parseInt(yoe, 10) : null,
        employment_status: status,
        prefecture,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setError(d.error ?? "送信に失敗しました");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "var(--success)" }}>投稿を受け付けました</h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24 }}>
          管理者が確認後、5件以上集まったグループから公開されます。ありがとうございます。
        </p>
        <button
          onClick={() => router.push("/salary")}
          style={{ padding: "10px 24px", background: "var(--royal)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}
        >
          給与データ一覧を見る
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Company */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          企業名 <span style={{ color: "var(--error)" }}>*</span>
        </label>
        {prefillCompanyId ? (
          <div style={{ padding: "10px 14px", background: "var(--line-soft)", borderRadius: 10, fontSize: 14, color: "var(--ink)", border: "1px solid var(--line)" }}>
            {prefillCompanyName}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => { setCompanySearch(e.target.value); searchCompany(e.target.value); setResolvedCompanyId(""); }}
              placeholder="企業名を入力"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, boxSizing: "border-box" }}
            />
            {companySuggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.08)", zIndex: 50 }}>
                {companySuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCompanySearch(c.name); setResolvedCompanyId(c.id); setCompanySuggestions([]); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "var(--ink)" }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role — 2-step: parent → child */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          職種カテゴリ <span style={{ color: "var(--error)" }}>*</span>
        </label>
        <select
          value={roleParent}
          onChange={(e) => { setRoleParent(e.target.value); setRoleId(""); }}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
        >
          <option value="">カテゴリを選択</option>
          {grouped.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {selectedParent && (
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
            職種 <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
          >
            <option value="">職種を選択</option>
            <option value={selectedParent.id}>{selectedParent.name}（その他）</option>
            {selectedParent.children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Annual salary */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          年収 <span style={{ color: "var(--error)" }}>*</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={salaryMan}
            onChange={(e) => setSalaryMan(e.target.value)}
            placeholder="例: 800"
            min={100}
            max={50000}
            style={{ width: 160, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>万円</span>
          {salaryMan && !isNaN(parseInt(salaryMan)) && (
            <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
              = {parseInt(salaryMan).toLocaleString()}万円
            </span>
          )}
        </div>
      </div>

      {/* Employment status */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>在籍状況</label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["current", "alumni"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              style={{
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid",
                background: status === s ? "var(--royal)" : "#fff",
                color: status === s ? "#fff" : "var(--ink-soft)",
                borderColor: status === s ? "var(--royal)" : "var(--line)",
              }}
            >
              {s === "current" ? "現役社員" : "OB/OG"}
            </button>
          ))}
        </div>
      </div>

      {/* Years of experience */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          業界経験年数（任意）
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={yoe}
            onChange={(e) => setYoe(e.target.value)}
            placeholder="例: 5"
            min={0}
            max={50}
            style={{ width: 100, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>年</span>
        </div>
      </div>

      {/* Prefecture */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          勤務都道府県（任意）
        </label>
        <select
          value={prefecture}
          onChange={(e) => setPrefecture(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
        >
          {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "var(--error-soft)", color: "var(--error)", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ paddingTop: 8 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%", padding: "14px", background: submitting ? "var(--line)" : "var(--success)",
            color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中..." : "投稿する（匿名）"}
        </button>
        <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
          投稿データは匿名集計にのみ使用されます。管理者の承認後、5件以上で公開されます。
        </p>
      </div>
    </form>
  );
}
