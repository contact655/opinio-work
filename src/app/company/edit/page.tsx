"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";

const SECTIONS = [
  { id: "basic", label: "基本情報" },
  { id: "mission", label: "ミッション・紹介文" },
  { id: "members", label: "メンバー紹介" },
  { id: "culture", label: "カルチャー・働き方" },
];

const CULTURE_CHIPS: Record<string, string[]> = {
  work_style: [
    "フルリモート",
    "リモート中心",
    "ハイブリッド",
    "出社中心",
    "フレックスタイム",
  ],
  culture: [
    "フラットな組織",
    "裁量が大きい",
    "チームワーク重視",
    "成果主義",
    "挑戦を歓迎",
    "ワークライフバランス",
    "スピード重視",
    "英語環境",
    "IPO準備中",
    "CEO直下",
    "女性活躍推進",
    "服装自由",
    "ペット可",
  ],
  benefits: [
    "ストックオプション",
    "書籍購入補助",
    "資格取得支援",
    "副業OK",
    "育休・産休実績あり",
    "社内勉強会",
    "1on1面談",
  ],
};

type Member = {
  id?: string;
  name: string;
  role: string;
  background: string;
  photo_url: string;
};

export default function CompanyEditPage() {
  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cultureTags, setCultureTags] = useState<
    { tag_category: string; tag_value: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("basic");

  const loadCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/company/me");
      const result = await res.json();

      if (!res.ok) {
        console.error("[company/edit] load error:", result);
        setError(result.error || "データの取得に失敗しました");
        setLoading(false);
        return;
      }

      const data = result.company;
      if (data) {
        setCompany(data);
        setMembers(
          data.ow_company_members?.map((m: any) => ({
            id: m.id,
            name: m.name || "",
            role: m.role || "",
            background: m.background || "",
            photo_url: m.photo_url || "",
          })) || []
        );
        setCultureTags(
          data.ow_company_culture_tags?.map((t: any) => ({
            tag_category: t.tag_category,
            tag_value: t.tag_value,
          })) || []
        );
      }
    } catch (err) {
      console.error("[company/edit] fetch error:", err);
      setError("通信エラーが発生しました");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  function updateCompany(key: string, value: string) {
    setCompany((prev: any) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleTag(category: string, value: string) {
    setCultureTags((prev) => {
      const exists = prev.some(
        (t) => t.tag_category === category && t.tag_value === value
      );
      if (exists) {
        return prev.filter(
          (t) => !(t.tag_category === category && t.tag_value === value)
        );
      }
      return [...prev, { tag_category: category, tag_value: value }];
    });
  }

  function addMember() {
    setMembers((prev) => [
      ...prev,
      { name: "", role: "", background: "", photo_url: "" },
    ]);
  }

  function updateMember(index: number, key: keyof Member, value: string) {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [key]: value } : m))
    );
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!company) return;
    setSaving(true);

    try {
      const res = await fetch("/api/company/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: company.id,
          name: company.name,
          name_en: company.name_en,
          founded_at: company.founded_at,
          employee_count: company.employee_count,
          location: company.location,
          industry: company.industry,
          phase: company.phase,
          url: company.url,
          mission: company.mission,
          description: company.description,
          logo_url: company.logo_url,
          members,
          cultureTags,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("[company/edit] save error:", result);
        setToast("保存に失敗しました");
      } else {
        setToast("保存しました");
      }
    } catch (err) {
      console.error("[company/edit] save fetch error:", err);
      setToast("通信エラーが発生しました");
    }

    setSaving(false);
    setTimeout(() => setToast(""), 3000);
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <a
              href="/company/register"
              className="text-primary hover:underline"
            >
              企業登録はこちら
            </a>
          </div>
        </main>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">企業情報が見つかりません</p>
            <a
              href="/company/register"
              className="text-primary hover:underline"
            >
              企業登録はこちら
            </a>
          </div>
        </main>
      </>
    );
  }

  const completeness = [
    company.name,
    company.description,
    company.mission,
    company.industry,
    company.location,
    members.length > 0,
    cultureTags.length > 0,
  ].filter(Boolean).length;
  const completenessPercent = Math.round((completeness / 7) * 100);

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg ${
            toast.includes("失敗") || toast.includes("エラー")
              ? "bg-red-500 text-white"
              : "bg-primary text-white"
          }`}>
            {toast}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
          {/* Left Sidebar - Section Nav */}
          <aside className="hidden lg:block w-[220px] flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">完成度</p>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${completenessPercent}%` }}
                  />
                </div>
                <p className="text-xs text-primary mt-1">
                  {completenessPercent}%
                </p>
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === s.id
                        ? "bg-primary-light text-primary font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? "保存中..." : "変更を保存"}
              </button>
            </div>
          </aside>

          {/* Center - Edit Form */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Basic Info */}
            {(activeSection === "basic" || !activeSection) && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">基本情報</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">会社名</label>
                    <input type="text" value={company.name || ""} onChange={(e) => updateCompany("name", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">設立年</label>
                    <input type="text" value={company.founded_at || ""} onChange={(e) => updateCompany("founded_at", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">従業員数</label>
                    <input type="text" value={company.employee_count || ""} onChange={(e) => updateCompany("employee_count", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">所在地</label>
                    <input type="text" value={company.location || ""} onChange={(e) => updateCompany("location", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">業界</label>
                    <input type="text" value={company.industry || ""} onChange={(e) => updateCompany("industry", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">フェーズ</label>
                    <input type="text" value={company.phase || ""} onChange={(e) => updateCompany("phase", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL</label>
                    <input type="url" value={company.url || ""} onChange={(e) => updateCompany("url", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
              </section>
            )}

            {/* Mission */}
            {activeSection === "mission" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">ミッション・紹介文</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">キャッチコピー・ミッション</label>
                    <input type="text" value={company.mission || ""} onChange={(e) => updateCompany("mission", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="企業のミッションやビジョン" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium">企業紹介文</label>
                      <span className="text-xs text-gray-400">{(company.description || "").length} 文字</span>
                    </div>
                    <textarea value={company.description || ""} onChange={(e) => updateCompany("description", e.target.value)} rows={8} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="企業の特徴、事業内容、働く環境などを詳しく記載してください" />
                  </div>
                </div>
              </section>
            )}

            {/* Members */}
            {activeSection === "members" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">メンバー紹介</h2>
                  <button onClick={addMember} className="text-sm text-primary hover:underline">
                    + メンバーを追加
                  </button>
                </div>
                {members.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-3">メンバーが登録されていません</p>
                    <button onClick={addMember} className="px-4 py-2 bg-primary text-white text-sm rounded-full hover:bg-primary-dark">メンバーを追加</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {members.map((m, i) => (
                      <div key={i} className="p-4 border border-gray-100 rounded-lg">
                        <div className="flex justify-between mb-3">
                          <span className="text-sm font-medium text-gray-500">メンバー {i + 1}</span>
                          <button onClick={() => removeMember(i)} className="text-xs text-red-500 hover:underline">削除</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" value={m.name} onChange={(e) => updateMember(i, "name", e.target.value)} placeholder="名前" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <input type="text" value={m.role} onChange={(e) => updateMember(i, "role", e.target.value)} placeholder="役職" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <input type="text" value={m.background} onChange={(e) => updateMember(i, "background", e.target.value)} placeholder="前職・経歴" className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Culture */}
            {activeSection === "culture" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">カルチャー・働き方</h2>
                {Object.entries(CULTURE_CHIPS).map(([category, chips]) => (
                  <div key={category} className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      {category === "work_style" ? "働き方" : category === "culture" ? "組織文化" : "福利厚生"}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => toggleTag(category, chip)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            cultureTags.some((t) => t.tag_category === category && t.tag_value === chip)
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>

          {/* Right Sidebar - Preview */}
          <aside className="hidden xl:block w-[300px] flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs text-gray-400 mb-2">プレビュー</p>
              <div className="bg-white rounded-card border border-card-border overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary to-teal-500 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{company.name?.[0] || "?"}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 -mt-6 border-2 border-white">
                      {company.name?.[0] || "?"}
                    </div>
                    <h3 className="text-sm font-bold">{company.name || "会社名"}</h3>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{company.description || "企業紹介文がここに表示されます"}</p>
                  <div className="flex flex-wrap gap-1">
                    {cultureTags.slice(0, 3).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary-light text-primary text-[10px] rounded-full">{t.tag_value}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile Save Button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-card-border p-4">
          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark disabled:opacity-50">
            {saving ? "保存中..." : "変更を保存"}
          </button>
        </div>
      </main>
    </>
  );
}
