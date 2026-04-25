"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";

const STEPS_FULL = [
  "アカウント作成",
  "企業情報",
  "社員写真",
  "カルチャー・働き方",
  "プラン選択",
];

const STEPS_LOGGEDIN = [
  "企業情報",
  "社員写真",
  "カルチャー・働き方",
  "プラン選択",
];

const INDUSTRIES = [
  "SaaS",
  "CRM/MA",
  "HR Tech",
  "FinTech",
  "HealthTech",
  "EdTech",
  "EC/リテール",
  "メディア/広告",
  "コンサルティング",
  "その他IT",
];

const PHASES = [
  { value: "early", label: "アーリーステージ" },
  { value: "middle", label: "ミドルステージ" },
  { value: "listed", label: "上場企業" },
  { value: "foreign", label: "外資系" },
];

const WORK_STYLE_OPTIONS = [
  "フルリモート",
  "リモート中心（週1出社）",
  "ハイブリッド（週2-3出社）",
  "出社中心",
  "フル出社",
];

const CULTURE_OPTIONS = [
  "フラットな組織",
  "裁量が大きい",
  "チームワーク重視",
  "成果主義",
  "挑戦を歓迎",
  "ワークライフバランス",
  "スピード重視",
  "丁寧なオンボーディング",
  "英語環境",
  "IPO準備中",
  "CEO直下",
  "女性活躍推進",
  "服装自由",
  "ペット可",
];

const BENEFIT_OPTIONS = [
  "ストックオプション",
  "書籍購入補助",
  "資格取得支援",
  "副業OK",
  "フレックスタイム",
  "育休・産休実績あり",
  "社内勉強会",
  "1on1面談",
];

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // step は実質ステップ（ログイン済みなら0=企業情報, 未ログインなら0=アカウント作成）
  const [step, setStep] = useState(0);

  // Step: Account (未ログイン時のみ)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step: Company Info
  const [form, setForm] = useState({
    name: "",
    name_en: "",
    founded_at: "",
    employee_count: "",
    location: "",
    industry: "",
    phase: "",
    url: "",
    mission: "",
    description: "",
  });

  // Step: Photos
  const [logoUrl, setLogoUrl] = useState("");

  // Step: Culture
  const [workStyles, setWorkStyles] = useState<string[]>([]);
  const [cultures, setCultures] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);

  // Step: Plan
  const [plan, setPlan] = useState("free");

  // 初回：ログイン状態をチェック
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setStep(0); // ログイン済みならステップ0=企業情報
      } else {
        setIsLoggedIn(false);
        setStep(0); // 未ログインならステップ0=アカウント作成
      }
      setCheckingAuth(false);
    }
    checkAuth();
  }, []);

  const STEPS = isLoggedIn ? STEPS_LOGGEDIN : STEPS_FULL;

  // ログイン済みの場合のステップオフセット
  // 未ログイン: 0=account, 1=info, 2=photos, 3=culture, 4=plan
  // ログイン済み: 0=info, 1=photos, 2=culture, 3=plan
  const infoStep = isLoggedIn ? 0 : 1;
  const photosStep = isLoggedIn ? 1 : 2;
  const cultureStep = isLoggedIn ? 2 : 3;
  const planStep = isLoggedIn ? 3 : 4;

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleItem(
    arr: string[],
    setArr: (v: string[]) => void,
    item: string
  ) {
    setArr(
      arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]
    );
  }

  async function handleAccountCreate() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);
    setStep(infoStep);
    setLoading(false);
  }

  async function handleFinalSubmit() {
    setLoading(true);
    setError("");

    // カルチャータグを構築
    const tags = [
      ...workStyles.map((v) => ({ tag_category: "work_style", tag_value: v })),
      ...cultures.map((v) => ({ tag_category: "culture", tag_value: v })),
      ...benefits.map((v) => ({ tag_category: "benefits", tag_value: v })),
    ];

    try {
      const res = await fetch("/api/company/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          logo_url: logoUrl || null,
          plan,
          tags,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("[company register] API error:", result);
        setError(result.error || "企業登録に失敗しました");
        setLoading(false);
        return;
      }

      console.log("[company register] SUCCESS:", result);
      setLoading(false);
      router.push("/biz/dashboard");
    } catch (err) {
      console.error("[company register] fetch error:", err);
      setError("通信エラーが発生しました。もう一度お試しください。");
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <p className="text-gray-600">読み込み中...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`text-xs font-medium ${
                    i <= step ? "text-primary" : "text-gray-600"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* ログイン済み通知 */}
          {isLoggedIn && step === infoStep && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ログイン済みのアカウントに企業を追加登録します
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="bg-white rounded-card-lg p-8 border border-card-border">
            {/* Step: Account (未ログイン時のみ) */}
            {!isLoggedIn && step === 0 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">企業アカウント作成</h2>
                <p className="text-sm text-gray-500">
                  会社のメールアドレスで登録してください
                </p>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  すでにアカウントをお持ちですか？{" "}
                  <button
                    onClick={() => router.push("/biz/auth")}
                    className="text-primary font-medium hover:underline"
                  >
                    ログイン
                  </button>
                  してから企業登録できます。
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    会社メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="8文字以上"
                  />
                </div>
                <button
                  onClick={handleAccountCreate}
                  disabled={loading}
                  className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {loading ? "作成中..." : "アカウントを作成"}
                </button>
              </div>
            )}

            {/* Step: Company Info */}
            {step === infoStep && (isLoggedIn || step !== 0) && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">企業情報</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      会社名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="株式会社〇〇"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      設立年
                    </label>
                    <input
                      type="text"
                      value={form.founded_at}
                      onChange={(e) => updateForm("founded_at", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="2020年"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      従業員数
                    </label>
                    <input
                      type="text"
                      value={form.employee_count}
                      onChange={(e) =>
                        updateForm("employee_count", e.target.value)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      所在地
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => updateForm("location", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="東京都渋谷区"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      業界
                    </label>
                    <select
                      value={form.industry}
                      onChange={(e) => updateForm("industry", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">選択</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      フェーズ
                    </label>
                    <select
                      value={form.phase}
                      onChange={(e) => updateForm("phase", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">選択</option>
                      {PHASES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      コーポレートURL
                    </label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => updateForm("url", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      ミッション
                    </label>
                    <input
                      type="text"
                      value={form.mission}
                      onChange={(e) => updateForm("mission", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="企業のミッションやビジョン"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      企業紹介文
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        updateForm("description", e.target.value)
                      }
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="企業の特徴や魅力を教えてください"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  {!isLoggedIn && (
                    <button
                      onClick={() => setStep(0)}
                      className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50"
                    >
                      戻る
                    </button>
                  )}
                  <button
                    onClick={() => setStep(photosStep)}
                    disabled={!form.name}
                    className={`${isLoggedIn ? "w-full" : "flex-1"} py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark disabled:opacity-50`}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* Step: Photos */}
            {step === photosStep && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">社員写真・ロゴ</h2>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <p className="font-semibold mb-1">撮影ガイドライン</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>カメラを見ていない自然な表情</li>
                    <li>自然光での撮影推奨</li>
                    <li>バストアップ〜顔アップ</li>
                    <li>3名の写真を推奨</li>
                  </ul>
                </div>
                <ImageUpload
                  bucketName="company-covers"
                  currentUrl={logoUrl || null}
                  onUpload={(url) => setLogoUrl(url)}
                  shape="rectangle"
                  placeholder="企業ロゴをアップロード（PNG・JPG、5MB以内）"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(infoStep)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => setStep(cultureStep)}
                    className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* Step: Culture */}
            {step === cultureStep && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">カルチャー・働き方</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    勤務スタイル
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_STYLE_OPTIONS.map((w) => (
                      <button
                        key={w}
                        onClick={() => toggleItem(workStyles, setWorkStyles, w)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          workStyles.includes(w)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    組織文化
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CULTURE_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => toggleItem(cultures, setCultures, c)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          cultures.includes(c)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    福利厚生・待遇
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BENEFIT_OPTIONS.map((b) => (
                      <button
                        key={b}
                        onClick={() => toggleItem(benefits, setBenefits, b)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          benefits.includes(b)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-primary"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(photosStep)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => setStep(planStep)}
                    className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}

            {/* Step: Plan */}
            {step === planStep && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold">プラン選択</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPlan("free")}
                    className={`p-6 rounded-card border-2 text-left transition-colors ${
                      plan === "free"
                        ? "border-primary bg-primary-light"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-lg font-bold">フリー</p>
                    <p className="text-2xl font-bold mt-1">¥0</p>
                    <p className="text-xs text-gray-500 mt-1">月額</p>
                    <ul className="mt-4 space-y-1 text-xs text-gray-600">
                      <li>✓ 企業ページ掲載</li>
                      <li>✓ 求人掲載 3件まで</li>
                      <li>✓ 応募者管理</li>
                    </ul>
                  </button>
                  <button
                    onClick={() => setPlan("standard")}
                    className={`p-6 rounded-card border-2 text-left transition-colors relative ${
                      plan === "standard"
                        ? "border-primary bg-primary-light"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="absolute -top-2 right-4 px-2 py-0.5 bg-primary text-white text-[10px] rounded-full">
                      おすすめ
                    </span>
                    <p className="text-lg font-bold">スタンダード</p>
                    <p className="text-2xl font-bold mt-1">¥49,800</p>
                    <p className="text-xs text-gray-500 mt-1">月額</p>
                    <ul className="mt-4 space-y-1 text-xs text-gray-600">
                      <li>✓ フリープランの全機能</li>
                      <li>✓ 求人掲載 無制限</li>
                      <li>✓ スカウト送信</li>
                      <li>✓ 優先表示</li>
                    </ul>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(cultureStep)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-full hover:bg-gray-50"
                  >
                    戻る
                  </button>
                  <button
                    onClick={handleFinalSubmit}
                    disabled={loading}
                    className="flex-1 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading ? "登録中..." : "企業登録を完了する"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
