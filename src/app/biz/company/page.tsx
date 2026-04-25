"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { ImageUpload } from "@/components/ui/ImageUpload";

const SECTIONS = [
  { id: "basic", label: "基本情報" },
  { id: "mission", label: "ミッション・紹介文" },
  { id: "members", label: "メンバー紹介" },
  { id: "culture", label: "カルチャー・働き方" },
  { id: "workstyle", label: "働き方・環境" },
  { id: "hiring", label: "採用情報" },
  { id: "selection", label: "選考情報" },
  { id: "compensation", label: "評価・報酬" },
  { id: "growth", label: "成長・キャリア" },
  { id: "organization", label: "組織・カルチャー" },
  { id: "benefits", label: "福利厚生" },
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
  const [flowInput, setFlowInput] = useState("");

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
          // 採用情報
          annual_hire_count: company.annual_hire_count,
          mid_career_ratio: company.mid_career_ratio,
          avg_tenure: company.avg_tenure,
          // 選考情報
          avg_selection_weeks: company.avg_selection_weeks,
          selection_count: company.selection_count,
          selection_flow: company.selection_flow,
          // 評価・報酬
          has_stock_option: company.has_stock_option,
          has_incentive: company.has_incentive,
          incentive_detail: company.incentive_detail,
          bonus_times: company.bonus_times,
          salary_raise_frequency: company.salary_raise_frequency,
          evaluation_system: company.evaluation_system,
          // 組織・カルチャー
          female_manager_ratio: company.female_manager_ratio,
          maternity_leave_female: company.maternity_leave_female,
          maternity_leave_male: company.maternity_leave_male,
          top_down_ratio: company.top_down_ratio,
          official_language: company.official_language,
          // v2: 基本情報
          engineer_ratio: company.engineer_ratio,
          funding_stage: company.funding_stage,
          arr_scale: company.arr_scale,
          ceo_name: company.ceo_name,
          office_count: company.office_count,
          // v2: 働き方
          flex_time: company.flex_time,
          core_time: company.core_time,
          office_days_per_week: company.office_days_per_week,
          annual_holiday_days: company.annual_holiday_days,
          side_job_ok: company.side_job_ok,
          // v2: 報酬・評価
          salary_review_times: company.salary_review_times,
          evaluation_cycle: company.evaluation_cycle,
          // v2: 成長・キャリア
          has_book_allowance: company.has_book_allowance,
          has_internal_transfer: company.has_internal_transfer,
          avg_tenure_years: company.avg_tenure_years,
          turnover_rate: company.turnover_rate,
          // v2: 組織・多様性
          female_ratio: company.female_ratio,
          management_style: company.management_style,
          one_on_one_freq: company.one_on_one_freq,
          // v2: 福利厚生
          childcare_leave_rate: company.childcare_leave_rate,
          has_housing_allowance: company.has_housing_allowance,
          has_meal_allowance: company.has_meal_allowance,
          has_learning_support: company.has_learning_support,
          has_health_support: company.has_health_support,
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
          <p className="text-gray-600">読み込み中...</p>
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
              href="/biz/auth/signup"
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
              href="/biz/auth/signup"
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
                <p className="text-xs text-gray-600 mb-2">完成度</p>
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
                  <div>
                    <label className="block text-sm font-medium mb-1">代表者名</label>
                    <input type="text" value={company.ceo_name || ""} onChange={(e) => updateCompany("ceo_name", e.target.value)} placeholder="例: 田中太郎" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">エンジニア比率</label>
                    <input type="text" value={company.engineer_ratio || ""} onChange={(e) => updateCompany("engineer_ratio", e.target.value)} placeholder="例: 約60%" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">調達ステージ</label>
                    <input type="text" value={company.funding_stage || ""} onChange={(e) => updateCompany("funding_stage", e.target.value)} placeholder="例: シリーズB" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">ARR規模</label>
                    <input type="text" value={company.arr_scale || ""} onChange={(e) => updateCompany("arr_scale", e.target.value)} placeholder="例: 10億円〜" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">拠点数</label>
                    <input type="text" value={company.office_count || ""} onChange={(e) => updateCompany("office_count", e.target.value)} placeholder="例: 3拠点" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
                      <span className="text-xs text-gray-600">{(company.description || "").length} 文字</span>
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
                    <p className="text-gray-600 text-sm mb-3">メンバーが登録されていません</p>
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
                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                          <ImageUpload
                            currentUrl={m.photo_url || null}
                            folder="members/photos"
                            onUpload={(url) => updateMember(i, "photo_url", url)}
                            shape="circle"
                            size={80}
                            label="顔写真"
                          />
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <input type="text" value={m.name} onChange={(e) => updateMember(i, "name", e.target.value)} placeholder="名前" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            <input type="text" value={m.role} onChange={(e) => updateMember(i, "role", e.target.value)} placeholder="役職" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            <input type="text" value={m.background} onChange={(e) => updateMember(i, "background", e.target.value)} placeholder="前職・経歴" className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          </div>
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

            {/* 働き方・環境 */}
            {activeSection === "workstyle" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">働き方・環境</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">フレックスタイム</label>
                    <select value={company.flex_time === true ? "true" : company.flex_time === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, flex_time: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">コアタイム</label>
                    <input type="text" value={company.core_time || ""} onChange={(e) => updateCompany("core_time", e.target.value)} placeholder="例: 10:00-15:00" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">週出社頻度</label>
                    <input type="text" value={company.office_days_per_week || ""} onChange={(e) => updateCompany("office_days_per_week", e.target.value)} placeholder="例: 週2-3日" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">年間休日数</label>
                    <input type="number" value={company.annual_holiday_days ?? ""} onChange={(e) => updateCompany("annual_holiday_days", e.target.value)} placeholder="例: 125" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">副業</label>
                    <select value={company.side_job_ok === true ? "true" : company.side_job_ok === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, side_job_ok: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">OK</option>
                      <option value="false">不可</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* 採用情報 */}
            {activeSection === "hiring" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">採用情報</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium mb-1">年間採用人数</label>
                    <input type="text" value={company.annual_hire_count || ""} onChange={(e) => updateCompany("annual_hire_count", e.target.value)} placeholder="例: 約50名" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium mb-1">中途比率 (%)</label>
                    <input type="number" min="0" max="100" value={company.mid_career_ratio ?? ""} onChange={(e) => updateCompany("mid_career_ratio", e.target.value)} placeholder="例: 70" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium mb-1">平均勤続年数</label>
                    <input type="text" value={company.avg_tenure || ""} onChange={(e) => updateCompany("avg_tenure", e.target.value)} placeholder="例: 3.8年" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
              </section>
            )}

            {/* 選考情報 */}
            {activeSection === "selection" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">選考情報</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">平均選考期間（週）</label>
                    <input type="number" value={company.avg_selection_weeks ?? ""} onChange={(e) => updateCompany("avg_selection_weeks", e.target.value)} placeholder="例: 3" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">選考回数</label>
                    <input type="number" value={company.selection_count ?? ""} onChange={(e) => updateCompany("selection_count", e.target.value)} placeholder="例: 3" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">選考フロー</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(company.selection_flow || []).map((step: string, i: number) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", background: "#E1F5EE", color: "#0F6E56", padding: "4px 12px", borderRadius: "999px" }}>
                        {step}
                        <button onClick={() => {
                          const newFlow = [...(company.selection_flow || [])];
                          newFlow.splice(i, 1);
                          setCompany((prev: any) => ({ ...prev, selection_flow: newFlow }));
                        }} style={{ marginLeft: "4px", fontSize: "14px", color: "#0F6E56", cursor: "pointer", background: "none", border: "none" }}>x</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={flowInput} onChange={(e) => setFlowInput(e.target.value)} onKeyDown={(e) => {
                      if (e.key === "Enter" && flowInput.trim()) {
                        e.preventDefault();
                        setCompany((prev: any) => ({ ...prev, selection_flow: [...(prev.selection_flow || []), flowInput.trim()] }));
                        setFlowInput("");
                      }
                    }} placeholder="例: 書類選考（Enterで追加）" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <button onClick={() => {
                      if (flowInput.trim()) {
                        setCompany((prev: any) => ({ ...prev, selection_flow: [...(prev.selection_flow || []), flowInput.trim()] }));
                        setFlowInput("");
                      }
                    }} className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark">追加</button>
                  </div>
                </div>
              </section>
            )}

            {/* 評価・報酬 */}
            {activeSection === "compensation" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">評価・報酬</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ストックオプション</label>
                    <select value={company.has_stock_option ? "true" : "false"} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_stock_option: e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="false">なし</option>
                      <option value="true">あり</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">インセンティブ</label>
                    <select value={company.has_incentive ? "true" : "false"} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_incentive: e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="false">なし</option>
                      <option value="true">あり</option>
                    </select>
                  </div>
                  {company.has_incentive && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">インセンティブ詳細</label>
                      <input type="text" value={company.incentive_detail || ""} onChange={(e) => updateCompany("incentive_detail", e.target.value)} placeholder="例: 目標達成率連動" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">賞与回数（年）</label>
                    <input type="number" value={company.bonus_times ?? ""} onChange={(e) => updateCompany("bonus_times", e.target.value)} placeholder="例: 2" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">昇給頻度</label>
                    <input type="text" value={company.salary_raise_frequency || ""} onChange={(e) => updateCompany("salary_raise_frequency", e.target.value)} placeholder="例: 年1回" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">昇給回数（年）</label>
                    <input type="number" value={company.salary_review_times ?? ""} onChange={(e) => updateCompany("salary_review_times", e.target.value)} placeholder="例: 2" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">評価サイクル</label>
                    <input type="text" value={company.evaluation_cycle || ""} onChange={(e) => updateCompany("evaluation_cycle", e.target.value)} placeholder="例: 半期ごと" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">評価制度</label>
                    <textarea value={company.evaluation_system || ""} onChange={(e) => updateCompany("evaluation_system", e.target.value)} rows={3} placeholder="評価制度の説明..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                  </div>
                </div>
              </section>
            )}

            {/* 成長・キャリア */}
            {activeSection === "growth" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">成長・キャリア</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">書籍購入補助</label>
                    <select value={company.has_book_allowance === true ? "true" : company.has_book_allowance === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_book_allowance: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">社内公募制度</label>
                    <select value={company.has_internal_transfer === true ? "true" : company.has_internal_transfer === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_internal_transfer: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">平均勤続年数</label>
                    <input type="text" value={company.avg_tenure_years || ""} onChange={(e) => updateCompany("avg_tenure_years", e.target.value)} placeholder="例: 3.5年" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">離職率</label>
                    <input type="text" value={company.turnover_rate || ""} onChange={(e) => updateCompany("turnover_rate", e.target.value)} placeholder="例: 8%" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
              </section>
            )}

            {/* 組織・カルチャー */}
            {activeSection === "organization" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">組織・カルチャー</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">女性管理職比率 (%)</label>
                    <input type="number" min="0" max="100" value={company.female_manager_ratio ?? ""} onChange={(e) => updateCompany("female_manager_ratio", e.target.value)} placeholder="例: 28" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">育休取得率・女性 (%)</label>
                    <input type="number" min="0" max="100" value={company.maternity_leave_female ?? ""} onChange={(e) => updateCompany("maternity_leave_female", e.target.value)} placeholder="例: 100" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">育休取得率・男性 (%)</label>
                    <input type="number" min="0" max="100" value={company.maternity_leave_male ?? ""} onChange={(e) => updateCompany("maternity_leave_male", e.target.value)} placeholder="例: 62" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">社内公用語</label>
                    <input type="text" value={company.official_language || ""} onChange={(e) => updateCompany("official_language", e.target.value)} placeholder="例: 日本語" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">女性比率</label>
                    <input type="text" value={company.female_ratio || ""} onChange={(e) => updateCompany("female_ratio", e.target.value)} placeholder="例: 35%" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">マネジメントスタイル</label>
                    <input type="text" value={company.management_style || ""} onChange={(e) => updateCompany("management_style", e.target.value)} placeholder="例: 1on1重視・コーチング型" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">1on1頻度</label>
                    <input type="text" value={company.one_on_one_freq || ""} onChange={(e) => updateCompany("one_on_one_freq", e.target.value)} placeholder="例: 週1回" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">意思決定スタイル（トップダウン度: {company.top_down_ratio ?? 50}%）</label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">ボトムアップ</span>
                      <input type="range" min="0" max="100" value={company.top_down_ratio ?? 50} onChange={(e) => setCompany((prev: any) => ({ ...prev, top_down_ratio: parseInt(e.target.value) }))} className="flex-1" style={{ accentColor: "#1D9E75" }} />
                      <span className="text-xs text-gray-500">トップダウン</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {/* 福利厚生 */}
            {activeSection === "benefits" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">福利厚生</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">育休取得率</label>
                    <input type="text" value={company.childcare_leave_rate || ""} onChange={(e) => updateCompany("childcare_leave_rate", e.target.value)} placeholder="例: 85%" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">住宅手当</label>
                    <select value={company.has_housing_allowance === true ? "true" : company.has_housing_allowance === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_housing_allowance: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">食事補助</label>
                    <select value={company.has_meal_allowance === true ? "true" : company.has_meal_allowance === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_meal_allowance: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">学習支援</label>
                    <select value={company.has_learning_support === true ? "true" : company.has_learning_support === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_learning_support: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">健康サポート</label>
                    <select value={company.has_health_support === true ? "true" : company.has_health_support === false ? "false" : ""} onChange={(e) => setCompany((prev: any) => ({ ...prev, has_health_support: e.target.value === "" ? null : e.target.value === "true" }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">未設定</option>
                      <option value="true">あり</option>
                      <option value="false">なし</option>
                    </select>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar - Preview */}
          <aside className="hidden xl:block w-[300px] flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs text-gray-600 mb-2">プレビュー</p>
              <div className="bg-white rounded-card border border-card-border overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary to-teal-500 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{company.name?.[0] || "?"}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 -mt-6 border-2 border-white">
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
