"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

const JOB_CATEGORIES = [
  "フィールドセールス",
  "インサイドセールス",
  "カスタマーサクセス",
  "マーケティング",
  "事業開発・BizDev",
  "プロダクトマネージャー",
  "エンジニア",
  "デザイナー",
  "コーポレート",
  "その他",
];

const EMPLOYMENT_TYPES = ["正社員", "契約社員", "業務委託", "インターン"];

const WORK_STYLES = [
  "フルリモート",
  "リモート中心",
  "ハイブリッド",
  "出社中心",
  "フル出社",
];

const MATCHING_TAG_OPTIONS = [
  "Salesforce経験",
  "HubSpot経験",
  "SaaS営業経験",
  "CS経験",
  "マーケティング経験",
  "0→1が好き",
  "1→10のフェーズ",
  "大手企業出身",
  "スタートアップ経験",
  "マネジメント経験",
  "英語力",
  "外資系経験",
  "フルリモート",
  "リモート可",
];

const SECTIONS = [
  { id: "basic", label: "基本情報" },
  { id: "description", label: "仕事内容" },
  { id: "requirements", label: "応募要件" },
  { id: "conditions", label: "勤務条件" },
  { id: "process", label: "選考フロー" },
  { id: "matching", label: "マッチングタグ" },
];

type Requirement = { type: "must" | "want"; content: string };

export default function JobCreatePage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activeSection, setActiveSection] = useState("basic");

  const [form, setForm] = useState({
    title: "",
    job_category: "",
    employment_type: "",
    description: "",
    appeal: "",
    salary_min: "",
    salary_max: "",
    location: "",
    work_style: "",
  });

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectionProcess, setSelectionProcess] = useState<string[]>([
    "書類選考",
    "カジュアル面談",
    "1次面接",
    "最終面接",
    "内定",
  ]);
  const [matchingTags, setMatchingTags] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("ow_companies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (data) setCompanyId(data.id);
      setLoading(false);
    }
    load();
  }, []);

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addRequirement(type: "must" | "want") {
    setRequirements((prev) => [...prev, { type, content: "" }]);
  }

  function updateRequirement(index: number, content: string) {
    setRequirements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, content } : r))
    );
  }

  function removeRequirement(index: number) {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProcessStep(index: number, value: string) {
    setSelectionProcess((prev) =>
      prev.map((s, i) => (i === index ? value : s))
    );
  }

  function addProcessStep() {
    setSelectionProcess((prev) => [...prev, ""]);
  }

  function removeProcessStep(index: number) {
    setSelectionProcess((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleMatchingTag(tag: string) {
    setMatchingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSave(status: "draft" | "active") {
    if (!companyId || !form.title) return;
    setSaving(true);

    const supabase = createClient();

    const { data: job, error } = await supabase
      .from("ow_jobs")
      .insert({
        company_id: companyId,
        title: form.title,
        job_category: form.job_category,
        employment_type: form.employment_type,
        description: form.description,
        appeal: form.appeal,
        salary_min: form.salary_min ? parseInt(form.salary_min) : null,
        salary_max: form.salary_max ? parseInt(form.salary_max) : null,
        location: form.location,
        work_style: form.work_style,
        selection_process: selectionProcess.filter(Boolean),
        status,
      })
      .select()
      .single();

    if (error || !job) {
      setSaving(false);
      return;
    }

    // Insert requirements
    const reqs = requirements
      .filter((r) => r.content)
      .map((r, i) => ({
        job_id: job.id,
        requirement_type: r.type,
        content: r.content,
        display_order: i,
      }));
    if (reqs.length > 0) {
      await supabase.from("ow_job_requirements").insert(reqs);
    }

    // Insert matching tags
    const tags = matchingTags.map((t) => ({
      job_id: job.id,
      tag_category: "skill",
      tag_value: t,
    }));
    if (tags.length > 0) {
      await supabase.from("ow_job_matching_tags").insert(tags);
    }

    setSaving(false);
    setToast(status === "draft" ? "下書き保存しました" : "求人を公開しました");
    setTimeout(() => {
      router.push("/biz/dashboard");
    }, 1500);
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

  if (!companyId) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">先に企業登録を完了してください</p>
            <a href="/biz/auth/signup" className="text-primary hover:underline">企業登録はこちら</a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        {toast && (
          <div className="fixed top-20 right-4 z-50 bg-primary text-white px-4 py-2 rounded-lg text-sm shadow-lg">
            {toast}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
          {/* Left Nav */}
          <aside className="hidden lg:block w-[220px] flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <h2 className="text-sm font-bold text-gray-500">求人作成</h2>
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
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleSave("draft")}
                  disabled={saving}
                  className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 disabled:opacity-50"
                >
                  下書き保存
                </button>
                <button
                  onClick={() => handleSave("active")}
                  disabled={saving || !form.title}
                  className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark disabled:opacity-50"
                >
                  求人を公開する
                </button>
              </div>
            </div>
          </aside>

          {/* Center Form */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Basic */}
            {activeSection === "basic" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">基本情報</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">求人タイトル <span className="text-red-500">*</span></label>
                    <input type="text" value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="例：エンタープライズセールス（SaaS）" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">職種カテゴリ</label>
                      <select value={form.job_category} onChange={(e) => updateForm("job_category", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">選択</option>
                        {JOB_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">雇用形態</label>
                      <select value={form.employment_type} onChange={(e) => updateForm("employment_type", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">選択</option>
                        {EMPLOYMENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Description */}
            {activeSection === "description" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">仕事内容</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">業務内容</label>
                    <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={8} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="具体的な業務内容を記載してください" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">このポジションの魅力</label>
                    <textarea value={form.appeal} onChange={(e) => updateForm("appeal", e.target.value)} rows={4} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="このポジションならではの魅力を記載してください" />
                  </div>
                </div>
              </section>
            )}

            {/* Requirements */}
            {activeSection === "requirements" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">応募要件</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">必須</span>
                      </h3>
                      <button onClick={() => addRequirement("must")} className="text-xs text-primary hover:underline">+ 追加</button>
                    </div>
                    {requirements.filter((r) => r.type === "must").length === 0 && (
                      <button onClick={() => addRequirement("must")} className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary hover:text-primary">+ 必須要件を追加</button>
                    )}
                    {requirements.map((r, i) =>
                      r.type === "must" ? (
                        <div key={i} className="flex gap-2 mb-2">
                          <input type="text" value={r.content} onChange={(e) => updateRequirement(i, e.target.value)} placeholder="例：法人営業経験3年以上" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <button onClick={() => removeRequirement(i)} className="text-red-400 hover:text-red-600 px-2">×</button>
                        </div>
                      ) : null
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">歓迎</span>
                      </h3>
                      <button onClick={() => addRequirement("want")} className="text-xs text-primary hover:underline">+ 追加</button>
                    </div>
                    {requirements.filter((r) => r.type === "want").length === 0 && (
                      <button onClick={() => addRequirement("want")} className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary hover:text-primary">+ 歓迎要件を追加</button>
                    )}
                    {requirements.map((r, i) =>
                      r.type === "want" ? (
                        <div key={i} className="flex gap-2 mb-2">
                          <input type="text" value={r.content} onChange={(e) => updateRequirement(i, e.target.value)} placeholder="例：SaaS業界での経験" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                          <button onClick={() => removeRequirement(i)} className="text-red-400 hover:text-red-600 px-2">×</button>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Conditions */}
            {activeSection === "conditions" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">勤務条件</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">年収下限（万円）</label>
                    <input type="number" value={form.salary_min} onChange={(e) => updateForm("salary_min", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">年収上限（万円）</label>
                    <input type="number" value={form.salary_max} onChange={(e) => updateForm("salary_max", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="800" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">勤務地</label>
                    <input type="text" value={form.location} onChange={(e) => updateForm("location", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="東京都渋谷区" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">勤務スタイル</label>
                    <select value={form.work_style} onChange={(e) => updateForm("work_style", e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">選択</option>
                      {WORK_STYLES.map((w) => (<option key={w} value={w}>{w}</option>))}
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* Selection Process */}
            {activeSection === "process" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-4">選考フロー</h2>
                <div className="space-y-2">
                  {selectionProcess.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <input type="text" value={step} onChange={(e) => updateProcessStep(i, e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      {selectionProcess.length > 1 && (
                        <button onClick={() => removeProcessStep(i)} className="text-red-400 hover:text-red-600 px-1">×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addProcessStep} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary hover:text-primary mt-2">+ ステップを追加</button>
                </div>
              </section>
            )}

            {/* Matching Tags */}
            {activeSection === "matching" && (
              <section className="bg-white rounded-card p-6 border border-card-border">
                <h2 className="text-lg font-bold mb-2">マッチングタグ</h2>
                <p className="text-xs text-gray-500 mb-4">ここで設定したタグが求職者へのマッチ理由として表示されます</p>
                <div className="flex flex-wrap gap-2">
                  {MATCHING_TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleMatchingTag(tag)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        matchingTags.includes(tag)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {matchingTags.length > 0 && (
                  <div className="mt-4 p-3 bg-primary-light rounded-lg">
                    <p className="text-xs font-semibold text-primary mb-1">選択中のタグ（{matchingTags.length}件）</p>
                    <p className="text-xs text-gray-600">{matchingTags.join("、")}</p>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right Preview */}
          <aside className="hidden xl:block w-[300px] flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs text-gray-600 mb-2">求人プレビュー</p>
              <div className="bg-white rounded-card border border-card-border p-5 space-y-3">
                <div className="flex gap-2">
                  {form.job_category && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">{form.job_category}</span>}
                  {form.employment_type && <span className="px-2 py-0.5 bg-primary-light text-primary text-[10px] rounded-full">{form.employment_type}</span>}
                </div>
                <h3 className="text-sm font-bold">{form.title || "求人タイトル"}</h3>
                <div className="text-xs text-gray-500 space-y-1">
                  {(form.salary_min || form.salary_max) && <p>💰 {form.salary_min || "?"}〜{form.salary_max || "?"}万円</p>}
                  {form.location && <p>📍 {form.location}</p>}
                  {form.work_style && <p>🏠 {form.work_style}</p>}
                </div>
                {matchingTags.length > 0 && (
                  <div className="p-2 bg-primary-light rounded-lg">
                    <p className="text-[10px] font-semibold text-primary mb-1">マッチングタグ</p>
                    <div className="flex flex-wrap gap-1">
                      {matchingTags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 bg-white text-primary text-[9px] rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile Buttons */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-card-border p-4 flex gap-3">
          <button onClick={() => handleSave("draft")} disabled={saving} className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full">下書き保存</button>
          <button onClick={() => handleSave("active")} disabled={saving || !form.title} className="flex-1 py-3 bg-primary text-white font-medium rounded-full disabled:opacity-50">求人を公開</button>
        </div>
      </main>
    </>
  );
}
