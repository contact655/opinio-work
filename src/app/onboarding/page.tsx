"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";

const STEPS = ["基本情報", "経験・スキル", "希望条件", "完了"];

const JOB_TYPES = [
  "営業（フィールドセールス）",
  "インサイドセールス",
  "カスタマーサクセス",
  "マーケティング",
  "事業開発・BizDev",
  "プロダクトマネージャー",
  "その他",
];

const EXPERIENCE_OPTIONS = [
  "1年未満",
  "1〜3年",
  "3〜5年",
  "5〜10年",
  "10年以上",
];

const SKILL_OPTIONS = [
  "Salesforce",
  "HubSpot",
  "Marketo",
  "Tableau",
  "SQL",
  "Google Analytics",
  "Slack",
  "Notion",
  "Figma",
  "JIRA",
];

const WORK_STYLES = [
  { value: "remote", label: "フルリモート" },
  { value: "hybrid", label: "ハイブリッド" },
  { value: "office", label: "出社" },
];

const PHASES = [
  { value: "startup", label: "スタートアップ" },
  { value: "middle", label: "ミドルステージ" },
  { value: "listed", label: "上場企業" },
  { value: "foreign", label: "外資系" },
];

const TIMINGS = [
  { value: "asap", label: "すぐにでも" },
  { value: "3months", label: "3ヶ月以内" },
  { value: "6months", label: "6ヶ月以内" },
  { value: "exploring", label: "情報収集中" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [form, setForm] = useState({
    name: "",
    name_kana: "",
    location: "",
    job_type: "",
    experience_years: "",
    skills: [] as string[],
    tools: [] as string[],
    bio: "",
    desired_work_style: "",
    desired_salary_min: "",
    desired_salary_max: "",
    desired_phase: [] as string[],
    transfer_timing: "",
  });

  function updateForm(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(key: string, item: string) {
    setForm((prev) => {
      const arr = prev[key as keyof typeof prev] as string[];
      return {
        ...prev,
        [key]: arr.includes(item)
          ? arr.filter((i) => i !== item)
          : [...arr, item],
      };
    });
  }

  async function handleSubmit() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // 既存プロフィールをチェック（upsertで対応）
    const { data: existing } = await supabase
      .from("ow_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let profileError;
    if (existing) {
      // 既存プロフィールを更新
      const { error } = await supabase.from("ow_profiles").update({
        name: form.name,
        name_kana: form.name_kana,
        location: form.location,
        job_type: form.job_type,
        experience_years: form.experience_years,
        skills: form.skills,
        tools: form.tools,
        bio: form.bio,
        desired_work_style: form.desired_work_style,
        desired_salary_min: form.desired_salary_min
          ? parseInt(form.desired_salary_min)
          : null,
        desired_salary_max: form.desired_salary_max
          ? parseInt(form.desired_salary_max)
          : null,
        desired_phase: form.desired_phase,
        transfer_timing: form.transfer_timing,
        photo_url: photoUrl || null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      profileError = error;
    } else {
      // 新規プロフィール作成
      const { error } = await supabase.from("ow_profiles").insert({
        user_id: user.id,
        name: form.name,
        name_kana: form.name_kana,
        location: form.location,
        job_type: form.job_type,
        experience_years: form.experience_years,
        skills: form.skills,
        tools: form.tools,
        bio: form.bio,
        desired_work_style: form.desired_work_style,
        desired_salary_min: form.desired_salary_min
          ? parseInt(form.desired_salary_min)
          : null,
        desired_salary_max: form.desired_salary_max
          ? parseInt(form.desired_salary_max)
          : null,
        desired_phase: form.desired_phase,
        transfer_timing: form.transfer_timing,
        photo_url: photoUrl || null,
      });
      profileError = error;
    }

    if (profileError) {
      console.error("Profile save error:", profileError);
      setLoading(false);
      return;
    }

    // candidateロールを付与
    const roleRes = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "candidate" }),
    });
    if (!roleRes.ok) {
      console.error("[onboarding] role assign failed:", await roleRes.text());
    }

    setStep(3); // Complete step
    setLoading(false);
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => i < step && setStep(i)}
                  className={`text-xs font-medium ${
                    i <= step ? "text-primary" : "text-gray-400"
                  } ${i < step ? "cursor-pointer" : "cursor-default"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-card-lg p-8 border border-card-border">
            {/* Step 1: Basic Info */}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">基本情報</h2>
                <ImageUpload
                  currentUrl={photoUrl || null}
                  onUpload={(url) => setPhotoUrl(url)}
                  folder="profiles"
                  label="プロフィール写真"
                  hint="PNG・JPG、5MB以内"
                  shape="circle"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      氏名
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      フリガナ
                    </label>
                    <input
                      type="text"
                      value={form.name_kana}
                      onChange={(e) => updateForm("name_kana", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="ヤマダ タロウ"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    居住地
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => updateForm("location", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="東京都"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    現在の職種
                  </label>
                  <select
                    value={form.job_type}
                    onChange={(e) => updateForm("job_type", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    {JOB_TYPES.map((jt) => (
                      <option key={jt} value={jt}>
                        {jt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    社会人歴
                  </label>
                  <select
                    value={form.experience_years}
                    onChange={(e) =>
                      updateForm("experience_years", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">選択してください</option>
                    {EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors"
                >
                  次へ
                </button>
              </div>
            )}

            {/* Step 2: Skills */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">経験・スキル</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    使用ツール・スキル
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleArrayItem("tools", s)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          form.tools.includes(s)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    自己PR
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => updateForm("bio", e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="これまでの経験や強みを教えてください"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(0)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50 transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preferences */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">希望条件</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    希望の働き方
                  </label>
                  <div className="flex gap-2">
                    {WORK_STYLES.map((ws) => (
                      <button
                        key={ws.value}
                        onClick={() =>
                          updateForm("desired_work_style", ws.value)
                        }
                        className={`flex-1 py-2.5 text-sm rounded-lg border transition-colors ${
                          form.desired_work_style === ws.value
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {ws.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    希望年収（万円）
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      value={form.desired_salary_min}
                      onChange={(e) =>
                        updateForm("desired_salary_min", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="下限 例: 500"
                    />
                    <input
                      type="number"
                      value={form.desired_salary_max}
                      onChange={(e) =>
                        updateForm("desired_salary_max", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="上限 例: 800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    希望する企業フェーズ（複数選択可）
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PHASES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() =>
                          toggleArrayItem("desired_phase", p.value)
                        }
                        className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                          form.desired_phase.includes(p.value)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    転職希望時期
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIMINGS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() =>
                          updateForm("transfer_timing", t.value)
                        }
                        className={`py-2.5 text-sm rounded-lg border transition-colors ${
                          form.transfer_timing === t.value
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50 transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {loading ? "保存中..." : "登録を完了する"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">
                  登録が完了しました！
                </h2>
                <p className="text-sm text-gray-500 mb-8">
                  あなたにおすすめの企業を探してみましょう
                </p>
                <button
                  onClick={() => router.push("/companies")}
                  className="px-8 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors"
                >
                  企業一覧を見る
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
