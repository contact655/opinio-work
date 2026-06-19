"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Eye, EyeOff, Save, ChevronDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string | null;
  email: string;
  visibility: string | null;
};

type Experience = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  employment_type: string | null;
  salary_man: number | null;
  visibility_company: "real" | "masked" | "hidden";
  visibility_salary: boolean;
  visibility_reason: boolean;
  display_order: number;
  join_reason: string | null;
};

type CareerProfile = {
  id: string;
  user_id: string;
  headline: string | null;
  years_of_experience: number | null;
  is_published: boolean;
  updated_at: string;
  gender: string | null;
  birth_year: number | null;
} | null;

type Company = { id: string; name: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriod(exp: Experience) {
  const start = exp.started_at?.slice(0, 7) ?? "?";
  const end = exp.is_current ? "現在" : (exp.ended_at?.slice(0, 7) ?? "?");
  return `${start} 〜 ${end}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CareerEditorClient({
  user,
  experiences,
  profile,
  companies,
}: {
  user: User;
  experiences: Experience[];
  profile: CareerProfile;
  companies: Company[];
}) {
  // ── Profile state ──
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [yearsExp, setYearsExp] = useState<string>(
    profile?.years_of_experience?.toString() ?? ""
  );
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [birthYear, setBirthYear] = useState<string>(
    profile?.birth_year?.toString() ?? ""
  );
  const [isPublished, setIsPublished] = useState(profile?.is_published ?? false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Experience rows state ──
  const [rows, setRows] = useState<Experience[]>(experiences);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ── Save profile ──
  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await fetch("/api/admin/career/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          headline: headline || null,
          yearsOfExperience: yearsExp ? parseInt(yearsExp) : null,
          gender: gender || null,
          birthYear: birthYear ? parseInt(birthYear) : null,
          isPublished,
        }),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setProfileSaving(false);
    }
  }, [user.id, headline, yearsExp, gender, birthYear, isPublished]);

  // ── Save single experience row ──
  const saveExperience = useCallback(async (exp: Experience) => {
    setSavingId(exp.id);
    setSavedId(null);
    try {
      await fetch(`/api/admin/career/experience/${exp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle: exp.role_title,
          salaryMan: exp.salary_man,
          companyAnonymized: exp.company_anonymized,
          visibilityCompany: exp.visibility_company,
          visibilitySalary: exp.visibility_salary,
          visibilityReason: exp.visibility_reason,
        }),
      });
      setSavedId(exp.id);
      setTimeout(() => setSavedId(null), 2500);
    } finally {
      setSavingId(null);
    }
  }, []);

  // ── Update row field ──
  const updateRow = (id: string, field: keyof Experience, value: unknown) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      {/* Back link */}
      <Link
        href="/admin/career"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--ink-soft)", textDecoration: "none", marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} /> キャリア軌跡一覧に戻る
      </Link>

      {/* ── User header ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {user.name?.[0] ?? "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            {user.name ?? "名前未設定"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>{user.email}</div>
        </div>
        <Link
          href={`/u/${user.id}`}
          target="_blank"
          style={{
            fontSize: 12, color: "var(--royal)", textDecoration: "none", fontWeight: 600,
            padding: "6px 12px", border: "1px solid var(--royal-100)", borderRadius: 6,
          }}
        >
          公開プロフィール →
        </Link>
      </div>

      {/* ── Career Profile section ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            キャリアプロフィール
          </h2>
          {/* Public toggle */}
          <button
            onClick={() => {
              setIsPublished((v) => !v);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: isPublished ? "#7C3AED" : "var(--line-soft)",
              color: isPublished ? "#fff" : "var(--ink-soft)",
              fontWeight: 700, fontSize: 13, transition: "all 0.15s",
            }}
          >
            {isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
            {isPublished ? "公開中" : "非公開"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
              見出し（例：リクルート → Salesforce → OPINIO創業）
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="キャリアの軌跡を一行で..."
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7,
                border: "1px solid var(--line)", fontSize: 14, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
              経験年数
            </label>
            <input
              type="number"
              value={yearsExp}
              onChange={(e) => setYearsExp(e.target.value)}
              min={0}
              max={50}
              placeholder="例: 8"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7,
                border: "1px solid var(--line)", fontSize: 14, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
              性別（カード表示用）
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7,
                border: "1px solid var(--line)", fontSize: 14, outline: "none",
                background: "#fff", boxSizing: "border-box",
              }}
            >
              <option value="">非表示</option>
              <option value="男性">男性</option>
              <option value="女性">女性</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
              生まれ年
            </label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              min={1960}
              max={2005}
              placeholder="例: 1992"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7,
                border: "1px solid var(--line)", fontSize: 14, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: profileSaved ? "var(--success)" : "var(--royal)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              opacity: profileSaving ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            {profileSaved ? <CheckCircle size={14} /> : <Save size={14} />}
            {profileSaving ? "保存中..." : profileSaved ? "保存済み" : "プロフィールを保存"}
          </button>
          {!profile && (
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              初回保存でプロフィールが作成されます
            </span>
          )}
        </div>
      </div>

      {/* ── Experiences section ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            職歴ステップ ({rows.length}件)
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            ステップごとに年収・公開設定を入力して「保存」を押してください
          </span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-mute)", fontSize: 14 }}>
            職歴データがありません
          </div>
        ) : (
          rows.map((exp) => (
            <ExperienceRow
              key={exp.id}
              exp={exp}
              companies={companies}
              isSaving={savingId === exp.id}
              isSaved={savedId === exp.id}
              onUpdate={updateRow}
              onSave={saveExperience}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ExperienceRow ────────────────────────────────────────────────────────────

function ExperienceRow({
  exp,
  companies,
  isSaving,
  isSaved,
  onUpdate,
  onSave,
}: {
  exp: Experience;
  companies: Company[];
  isSaving: boolean;
  isSaved: boolean;
  onUpdate: (id: string, field: keyof Experience, value: unknown) => void;
  onSave: (exp: Experience) => void;
}) {
  const companyLabel =
    companies.find((c) => c.id === exp.company_id)?.name ??
    exp.company_text ??
    "企業名未設定";

  const VIS_OPTIONS: { value: "real" | "masked" | "hidden"; label: string; color: string }[] = [
    { value: "real",   label: "実名表示",   color: "var(--success)" },
    { value: "masked", label: "匿名表示",   color: "var(--warm)" },
    { value: "hidden", label: "非公開",     color: "var(--error)" },
  ];

  const visOption = VIS_OPTIONS.find((o) => o.value === exp.visibility_company) ?? VIS_OPTIONS[1];

  return (
    <div style={{
      borderBottom: "1px solid var(--line-soft)",
      padding: "20px 24px",
    }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 2 }}>
            {companyLabel}
            {exp.is_current && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 700,
                background: "var(--success-soft)", color: "var(--success)",
                padding: "2px 7px", borderRadius: 100,
              }}>現職</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {exp.role_title ?? "役職未設定"} · {formatPeriod(exp)}
          </div>
        </div>
        <button
          onClick={() => onSave(exp)}
          disabled={isSaving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
            background: isSaved ? "var(--success)" : "var(--royal-50)",
            color: isSaved ? "#fff" : "var(--royal)",
            fontWeight: 700, fontSize: 12,
            opacity: isSaving ? 0.6 : 1, transition: "all 0.15s",
          }}
        >
          {isSaved ? <CheckCircle size={12} /> : <Save size={12} />}
          {isSaving ? "保存中..." : isSaved ? "保存済み" : "保存"}
        </button>
      </div>

      {/* Input fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr 1fr 1fr", gap: 16, alignItems: "start" }}>

        {/* role_title */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
            職種・役職名
          </label>
          <input
            value={exp.role_title ?? ""}
            onChange={(e) =>
              onUpdate(exp.id, "role_title", e.target.value || null)
            }
            placeholder="例: Account Executive、エンジニア"
            style={{
              width: "100%", padding: "8px 11px", borderRadius: 7,
              border: "1px solid var(--line)", fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* salary_man */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
            年収（万円）
          </label>
          <input
            type="number"
            value={exp.salary_man ?? ""}
            onChange={(e) =>
              onUpdate(exp.id, "salary_man", e.target.value ? parseInt(e.target.value) : null)
            }
            placeholder="例: 800"
            min={0}
            max={9999}
            style={{
              width: "100%", padding: "8px 11px", borderRadius: 7,
              border: "1px solid var(--line)", fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* company_anonymized */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
            匿名ラベル（masked 時に表示）
          </label>
          <input
            value={exp.company_anonymized ?? ""}
            onChange={(e) =>
              onUpdate(exp.id, "company_anonymized", e.target.value || null)
            }
            placeholder="例: 大手SaaS企業、国内ITスタートアップ"
            style={{
              width: "100%", padding: "8px 11px", borderRadius: 7,
              border: "1px solid var(--line)", fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* visibility_company */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 5 }}>
            企業名の公開設定
          </label>
          <div style={{ position: "relative" }}>
            <select
              value={exp.visibility_company}
              onChange={(e) =>
                onUpdate(exp.id, "visibility_company", e.target.value as "real" | "masked" | "hidden")
              }
              style={{
                width: "100%", padding: "8px 32px 8px 11px", borderRadius: 7,
                border: `2px solid ${visOption.color}`,
                fontSize: 13, fontWeight: 600, color: visOption.color,
                background: "#fff", outline: "none", appearance: "none",
                cursor: "pointer", boxSizing: "border-box",
              }}
            >
              {VIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: visOption.color }}
            />
          </div>
        </div>

        {/* visibility checkboxes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", display: "block", marginBottom: 9 }}>
            追加公開項目
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={exp.visibility_salary}
                onChange={(e) => onUpdate(exp.id, "visibility_salary", e.target.checked)}
                style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--success)" }}
              />
              <span style={{ color: exp.visibility_salary ? "var(--success)" : "var(--ink-mute)", fontWeight: exp.visibility_salary ? 600 : 400 }}>
                年収を公開
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={exp.visibility_reason}
                onChange={(e) => onUpdate(exp.id, "visibility_reason", e.target.checked)}
                style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--success)" }}
              />
              <span style={{ color: exp.visibility_reason ? "var(--success)" : "var(--ink-mute)", fontWeight: exp.visibility_reason ? 600 : 400 }}>
                転職理由を公開
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Preview: what will be shown publicly */}
      <div style={{
        marginTop: 12, padding: "10px 14px", borderRadius: 7,
        background: "var(--bg-tint)", border: "1px solid var(--line-soft)",
        fontSize: 12, color: "var(--ink-soft)",
        display: "flex", gap: 16, flexWrap: "wrap",
      }}>
        <span style={{ fontWeight: 600, color: "var(--ink-mute)" }}>公開プレビュー:</span>
        <span>
          企業:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {exp.visibility_company === "real"
              ? (companyLabel)
              : exp.visibility_company === "masked"
              ? (exp.company_anonymized ?? "匿名ラベル未設定")
              : "非公開（非表示）"}
          </strong>
        </span>
        <span>
          年収:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {exp.visibility_salary && exp.salary_man
              ? `${exp.salary_man}万円`
              : "非公開"}
          </strong>
        </span>
        <span>
          転職理由:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {exp.visibility_reason ? "公開" : "非公開"}
          </strong>
        </span>
      </div>
    </div>
  );
}
