"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompanyMembershipNewPage() {
  const router = useRouter();
  const supabase = createClient();

  // Company search
  const [companyQuery, setCompanyQuery] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Form fields
  const [status, setStatus] = useState<"current" | "alumni">("alumni");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [joinedYear, setJoinedYear] = useState("");
  const [leftYear, setLeftYear] = useState("");
  const [experience, setExperience] = useState("");
  const [goodPoints, setGoodPoints] = useState("");
  const [hardPoints, setHardPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search companies
  useEffect(() => {
    if (companyQuery.length < 1) {
      setCompanies([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("ow_companies")
        .select("id, name")
        .ilike("name", `%${companyQuery}%`)
        .limit(10);
      setCompanies(data || []);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [companyQuery]);

  const handleSubmit = async () => {
    if (!selectedCompany || !role || !joinedYear) return;
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signup");
      return;
    }

    const { data: profile } = await supabase
      .from("ow_profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    const userName = profile?.name || user.user_metadata?.full_name || "匿名";

    const { error: insertErr } = await supabase.from("company_members").insert({
      user_id: user.id,
      company_id: selectedCompany.id,
      name: userName,
      status,
      role,
      department: department || null,
      joined_year: parseInt(joinedYear),
      left_year: status === "current" ? null : leftYear ? parseInt(leftYear) : null,
      experience: experience || null,
      good_points: goodPoints || null,
      hard_points: hardPoints || null,
    });

    if (insertErr) {
      if (insertErr.message.includes("unique") || insertErr.message.includes("duplicate")) {
        setError("この企業には既に登録されています。");
      } else {
        setError("登録に失敗しました。もう一度お試しください。");
      }
      setLoading(false);
      return;
    }

    router.push(`/companies/${selectedCompany.id}`);
  };

  const canSubmit = selectedCompany && role && joinedYear && !loading;

  const inputStyle = {
    width: "100%",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <main className="min-h-screen bg-white">
        <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              企業での経験を登録する
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
              あなたの経験が、転職を考えている人の参考になります。
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* 企業選択 */}
            <div style={{ position: "relative" }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                企業名 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {selectedCompany ? (
                <div
                  className="flex items-center justify-between"
                  style={{
                    ...inputStyle,
                    background: "#f0fdf4",
                    borderColor: "#bbf7d0",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#15803d" }}>{selectedCompany.name}</span>
                  <button
                    onClick={() => { setSelectedCompany(null); setCompanyQuery(""); }}
                    style={{ background: "none", border: "none", fontSize: 13, color: "#6b7280", cursor: "pointer" }}
                  >
                    変更
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                    placeholder="企業名を検索..."
                    style={inputStyle}
                    onFocus={() => companies.length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  />
                  {showDropdown && companies.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        zIndex: 10,
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onMouseDown={() => {
                            setSelectedCompany(c);
                            setShowDropdown(false);
                            setCompanyQuery("");
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 16px",
                            fontSize: 14,
                            color: "#111827",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 在籍状況 */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                在籍状況 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { value: "current" as const, label: "現役（在籍中）" },
                  { value: "alumni" as const, label: "OB・OG（退社済み）" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: status === opt.value ? 600 : 500,
                      background: status === opt.value ? "var(--success)" : "#fff",
                      color: status === opt.value ? "#fff" : "#6b7280",
                      border: `1.5px solid ${status === opt.value ? "var(--success)" : "#d1d5db"}`,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 役職・職種 */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                役職・職種 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="例: フィールドセールス、CSマネージャー"
                style={inputStyle}
              />
            </div>

            {/* 部署 */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                部署・チーム
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例: エンタープライズ営業部"
                style={inputStyle}
              />
            </div>

            {/* 在籍期間 */}
            <div style={{ display: "grid", gridTemplateColumns: status === "alumni" ? "1fr 1fr" : "1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  入社年 <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="number"
                  value={joinedYear}
                  onChange={(e) => setJoinedYear(e.target.value)}
                  placeholder="2020"
                  min="1980"
                  max={new Date().getFullYear()}
                  style={inputStyle}
                />
              </div>
              {status === "alumni" && (
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                    退社年
                  </label>
                  <input
                    type="number"
                    value={leftYear}
                    onChange={(e) => setLeftYear(e.target.value)}
                    placeholder="2023"
                    min="1980"
                    max={new Date().getFullYear()}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>

            {/* 社内での経験 */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                社内での経験
              </label>
              <textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value.slice(0, 500))}
                placeholder="どんな仕事をしていたか、どんなことを経験したかを教えてください。"
                rows={4}
                style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
              />
              <div style={{ textAlign: "right", fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                {experience.length} / 500字
              </div>
            </div>

            {/* 良かったこと */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                入社して良かったこと
              </label>
              <textarea
                value={goodPoints}
                onChange={(e) => setGoodPoints(e.target.value.slice(0, 300))}
                placeholder="この会社に入って良かったと思うことを教えてください。"
                rows={3}
                style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
              />
            </div>

            {/* 大変だったこと */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                大変だったこと・注意点
              </label>
              <textarea
                value={hardPoints}
                onChange={(e) => setHardPoints(e.target.value.slice(0, 300))}
                placeholder="転職を考えている人に知っておいてほしいことを教えてください。"
                rows={3}
                style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
              />
            </div>

            {/* 注意書き */}
            <div
              style={{
                background: "#f9fafb",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 12,
                color: "#6b7280",
                lineHeight: 1.7,
              }}
            >
              登録した内容は企業詳細ページに公開されます。個人が特定される情報は含めないようにしてください。非公開にしたい場合はマイページから変更できます。
            </div>

            {/* エラー */}
            {error && (
              <p style={{ fontSize: 13, color: "var(--error)" }}>{error}</p>
            )}

            {/* 送信ボタン */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                background: canSubmit ? "#111827" : "#d1d5db",
                color: canSubmit ? "#fff" : "#9ca3af",
                border: "none",
                cursor: canSubmit ? "pointer" : "default",
                transition: "background 0.15s",
              }}
            >
              {loading ? "登録中..." : "登録する"}
            </button>
          </div>
        </div>
      </main>
  );
}
