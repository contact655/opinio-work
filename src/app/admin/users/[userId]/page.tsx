"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Experience = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  linked_company_name: string | null;
};

type Company = {
  id: string;
  name: string;
  is_published: boolean;
};

type UserInfo = {
  id: string;
  name: string | null;
  email: string;
};

export default function AdminUserExperiencesPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}/experiences`)
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setExperiences(d.experiences ?? []);
        setCompanies(d.companies ?? []);
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async (expId: string, companyId: string | null) => {
    setSaving((s) => ({ ...s, [expId]: true }));
    await fetch(`/api/admin/experiences/${expId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId || null }),
    });
    setSaving((s) => ({ ...s, [expId]: false }));
    setSaved((s) => ({ ...s, [expId]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [expId]: false })), 2000);
    setExperiences((prev) =>
      prev.map((e) =>
        e.id === expId
          ? {
              ...e,
              company_id: companyId || null,
              linked_company_name: companies.find((c) => c.id === companyId)?.name ?? null,
            }
          : e
      )
    );
  };

  if (loading) return <div style={{ padding: 40, color: "var(--ink-soft)" }}>読み込み中...</div>;
  if (!user) return <div style={{ padding: 40, color: "var(--error)" }}>ユーザーが見つかりません</div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      <Link href="/admin/candidates" style={{ fontSize: 13, color: "var(--royal)", textDecoration: "none" }}>
        ← 候補者一覧へ戻る
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "16px 0 4px", color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
        経歴の企業紐付け
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 28px" }}>
        <strong>{user.name ?? user.email}</strong> の経歴に企業マスタを紐付けます。
        紐付けた企業の公開ページに「現役社員」「OB・OG」として表示されます。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {experiences.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-mute)", border: "1px dashed var(--line)", borderRadius: 10 }}>
            経歴データがありません
          </div>
        )}
        {experiences.map((exp) => (
          <div
            key={exp.id}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "16px 20px",
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              {/* 経歴情報 */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {exp.role_title || "役職未設定"}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2 }}>
                  {exp.started_at?.slice(0, 7)} 〜 {exp.is_current ? "現在" : (exp.ended_at?.slice(0, 7) ?? "")}
                  {exp.is_current && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px" }}>
                      在籍中
                    </span>
                  )}
                </div>
                {/* 現在の会社情報 */}
                {exp.company_text && !exp.company_id && (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    テキスト入力: <span style={{ fontStyle: "italic" }}>{exp.company_text}</span>
                  </div>
                )}
                {exp.company_anonymized && !exp.company_id && !exp.company_text && (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    非公開（{exp.company_anonymized}）
                  </div>
                )}
              </div>

              {/* company_id セレクター */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 4 }}>企業マスタ紐付け</div>
                  <select
                    defaultValue={exp.company_id ?? ""}
                    onChange={(e) => handleSave(exp.id, e.target.value || null)}
                    style={{
                      fontSize: 13,
                      padding: "6px 10px",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      background: "#fff",
                      color: "var(--ink)",
                      minWidth: 260,
                      cursor: "pointer",
                    }}
                  >
                    <option value="">紐付けなし（テキスト表示）</option>
                    <optgroup label="公開中">
                      {companies.filter((c) => c.is_published).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="非公開">
                      {companies.filter((c) => !c.is_published).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div style={{ marginTop: 20 }}>
                  {saving[exp.id] && (
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>保存中...</span>
                  )}
                  {saved[exp.id] && (
                    <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700 }}>✓ 保存</span>
                  )}
                </div>
              </div>
            </div>

            {/* 現在の紐付け状態 */}
            {exp.linked_company_name && (
              <div style={{ marginTop: 10, fontSize: 12, padding: "6px 10px", background: "var(--royal-50)", borderRadius: 6, color: "var(--royal)" }}>
                現在の紐付け: <strong>{exp.linked_company_name}</strong>
                {!companies.find((c) => c.id === exp.company_id)?.is_published && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--ink-mute)" }}>（非公開企業）</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
