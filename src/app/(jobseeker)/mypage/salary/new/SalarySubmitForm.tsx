"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const YEARS = Array.from({ length: 15 }, (_, i) => String(new Date().getFullYear() - i));

function YearMonthPicker({
  label, required, value, onChange,
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
}) {
  const [year, setYear] = useState(() => value ? value.split("-")[0] ?? "" : "");
  const [month, setMonth] = useState(() => value ? value.split("-")[1] ?? "" : "");
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setYear(value ? value.split("-")[0] ?? "" : "");
      setMonth(value ? value.split("-")[1] ?? "" : "");
    }
  }, [value]);
  function handleYear(y: string) {
    setYear(y);
    if (y && month) onChange(`${y}-${month}`);
  }
  function handleMonth(m: string) {
    setMonth(m);
    if (year && m) onChange(`${year}-${m}`);
  }
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "var(--error)" }}>*</span>}
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={year}
          onChange={(e) => handleYear(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
        >
          <option value="">年</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => handleMonth(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, background: "#fff" }}
        >
          <option value="">月</option>
          {MONTHS.map((m) => <option key={m} value={m}>{parseInt(m)}月</option>)}
        </select>
      </div>
    </div>
  );
}

export default function SalarySubmitForm({ grouped, prefillCompanyId, prefillCompanyName }: Props) {
  const router = useRouter();

  // 企業・職種
  const [companySearch, setCompanySearch] = useState(prefillCompanyName ?? "");
  const [resolvedCompanyId, setResolvedCompanyId] = useState(prefillCompanyId ?? "");
  const [companySuggestions, setCompanySuggestions] = useState<{ id: string; name: string }[]>([]);
  const [roleParent, setRoleParent] = useState("");
  const [roleId, setRoleId] = useState("");

  // 期間
  const [startYM, setStartYM] = useState("");
  const [endYM, setEndYM] = useState("");

  // 想定年収・OTE
  const [oteMan, setOteMan] = useState("");

  // グレード
  const [grade, setGrade] = useState("");

  // 内訳（任意）
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [baseMan, setBaseMan] = useState("");
  const [incentiveMan, setIncentiveMan] = useState("");
  const [bonusMan, setBonusMan] = useState("");
  const [stockMan, setStockMan] = useState("");
  const [allowancesMan, setAllowancesMan] = useState("");
  const [fixedOTMan, setFixedOTMan] = useState("");

  // その他
  const [status, setStatus] = useState<"current" | "alumni">("alumni");
  const [yoe, setYoe] = useState("");
  const [prefecture, setPrefecture] = useState("東京都");

  // UI状態
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
    if (!startYM) { setError("開始年月を選択してください"); return; }
    const ote = parseInt(oteMan, 10);
    if (!oteMan || isNaN(ote) || ote < 100 || ote > 50000) {
      setError("想定年収（OTE）を正しく入力してください（100万〜50000万円）");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/salary-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: resolvedCompanyId,
        role_id: roleId,
        ote_man: ote,
        start_year_month: startYM,
        end_year_month: endYM || null,
        grade: grade || null,
        base_salary_man:    baseMan       ? parseInt(baseMan, 10)       : null,
        incentive_man:      incentiveMan  ? parseInt(incentiveMan, 10)  : null,
        bonus_salary_man:   bonusMan      ? parseInt(bonusMan, 10)      : null,
        stock_options_man:  stockMan      ? parseInt(stockMan, 10)      : null,
        allowances_man:     allowancesMan ? parseInt(allowancesMan, 10) : null,
        fixed_overtime_man: fixedOTMan    ? parseInt(fixedOTMan, 10)    : null,
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
          管理者が確認後、集計データとして公開されます。ありがとうございます。
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

  const inp: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14,
    background: "#fff", width: "100%", boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── 説明 ── */}
      <div style={{ padding: "14px 18px", background: "var(--royal-50)", borderRadius: 12, border: "1px solid var(--royal-100)", fontSize: 13, color: "var(--royal)", lineHeight: 1.8 }}>
        <strong>入力のポイント:</strong> 入社年・退職年は源泉徴収票が月割りになるため、実際の年収水準とずれます。
        その職位で<strong>フル稼働した場合の想定年収（OTE）</strong>を入力してください。
        「同じ会社で職種が変わった場合は、職種ごとに分けて登録するとキャリアの軌跡がわかりやすくなります。まとめて1件でも登録できます。」
      </div>

      {/* ── 企業 ── */}
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
              placeholder="企業名を入力して検索"
              style={inp}
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

      {/* ── 職種 ── */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          職種カテゴリ <span style={{ color: "var(--error)" }}>*</span>
        </label>
        <select
          value={roleParent}
          onChange={(e) => { setRoleParent(e.target.value); setRoleId(""); }}
          style={inp}
        >
          <option value="">カテゴリを選択</option>
          {grouped.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {selectedParent && (
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
            職種 <span style={{ color: "var(--error)" }}>*</span>
          </label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={inp}>
            <option value="">職種を選択</option>
            <option value={selectedParent.id}>{selectedParent.name}（その他）</option>
            {selectedParent.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* ── 期間 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <YearMonthPicker label="開始年月" required value={startYM} onChange={setStartYM} />
        <YearMonthPicker label="終了年月（現職なら空欄）" value={endYM} onChange={setEndYM} />
      </div>

      {/* ── 想定年収（OTE）── */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
          その職位での、フル稼働1年間の想定年収（OTE）<span style={{ color: "var(--error)" }}>*</span>
        </label>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "0 0 8px", lineHeight: 1.6 }}>
          外資SaaS営業の場合は「基本給 ＋ インセンティブ目標額」の合計（＝ OTE）を入力してください。
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={oteMan}
            onChange={(e) => setOteMan(e.target.value)}
            placeholder="例: 1200"
            min={100}
            max={50000}
            style={{ width: 160, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>万円</span>
          {oteMan && !isNaN(parseInt(oteMan)) && (
            <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
              = {parseInt(oteMan).toLocaleString()}万円
            </span>
          )}
        </div>
      </div>

      {/* ── グレード（任意）── */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
          グレード・等級（任意）
        </label>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "0 0 8px" }}>
          例: Grade 4、L5、主任、Senior AE など（自由入力）
        </p>
        <input
          type="text"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="例: Grade 4"
          maxLength={50}
          style={{ ...inp, width: 240 }}
        />
      </div>

      {/* ── 内訳（任意・折りたたみ）── */}
      <div>
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
        >
          {showBreakdown ? "▼" : "▶"} 内訳・実支給を詳しく入力する（任意）
        </button>

        {showBreakdown && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16, padding: "16px", background: "var(--bg-tint)", borderRadius: 12, border: "1px solid var(--line)" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: 0, lineHeight: 1.7 }}>
              内訳を入力することで、他のユーザーが「基本給の割合」「インセンティブ比率」を把握しやすくなります。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
              {([
                ["固定給（基本給）", baseMan, setBaseMan],
                ["インセンティブ目標額", incentiveMan, setIncentiveMan],
                ["賞与", bonusMan, setBonusMan],
                ["株式報酬（RSU/SO）", stockMan, setStockMan],
                ["手当（住宅・家族等）", allowancesMan, setAllowancesMan],
                ["固定残業代", fixedOTMan, setFixedOTMan],
              ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, setter]) => (
                <div key={label}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4 }}>{label}（万円）</div>
                  <input
                    type="number" min="0" max="99999" placeholder="—"
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 在籍状況 ── */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>在籍状況</label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["alumni", "current"] as const).map((s) => (
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
              {s === "current" ? "現役社員" : "OB/OG（退職済み）"}
            </button>
          ))}
        </div>
      </div>

      {/* ── 経験年数・勤務地（任意）── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
            業界経験年数（任意）
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number" value={yoe} onChange={(e) => setYoe(e.target.value)}
              placeholder="例: 5" min={0} max={50}
              style={{ width: 90, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
            />
            <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>年</span>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
            勤務都道府県（任意）
          </label>
          <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} style={inp}>
            {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
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
            width: "100%", padding: "14px",
            background: submitting ? "var(--line)" : "var(--success)",
            color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中..." : "投稿する（匿名）"}
        </button>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
          投稿データは匿名集計にのみ使用されます。管理者の承認後に公開されます。
        </p>
      </div>
    </form>
  );
}
