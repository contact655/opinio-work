"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function WorkHistoryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCompanyId = searchParams.get("company_id");
  const supabase = createClient();

  const [companyId, setCompanyId] = useState(presetCompanyId ?? "");
  const [companyName, setCompanyName] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<"current" | "alumni">("alumni");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [joinedYear, setJoinedYear] = useState("");
  const [leftYear, setLeftYear] = useState("");
  const [goodPoints, setGoodPoints] = useState("");
  const [hardPoints, setHardPoints] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // company_idがURLにあれば企業名を自動取得
  useEffect(() => {
    if (!presetCompanyId) return;
    supabase
      .from("ow_companies")
      .select("id, name")
      .eq("id", presetCompanyId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCompanyId(data.id);
          setCompanyName(data.name);
          setCompanyQuery(data.name);
        }
      });
  }, [presetCompanyId]);

  // Company search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!companyQuery || companyQuery.length < 1) {
      setCompanySuggestions([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("ow_companies")
        .select("id, name")
        .ilike("name", `%${companyQuery}%`)
        .limit(10);
      setCompanySuggestions(data || []);
      setShowDropdown(true);
    }, 300);
  }, [companyQuery]);

  const handleSelectCompany = (id: string, name: string) => {
    setCompanyId(id);
    setCompanyName(name);
    setCompanyQuery(name);
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    if (!companyId || !role || !joinedYear) return;
    if (status === "alumni" && !leftYear) return;
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setLoading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("work_histories").insert({
      user_id: user.id,
      company_id: companyId,
      status,
      role,
      department: department || null,
      joined_year: parseInt(joinedYear),
      left_year: status === "current" ? null : parseInt(leftYear),
      good_points: goodPoints || null,
      hard_points: hardPoints || null,
      is_public: isPublic,
    });

    if (insertErr) {
      if (insertErr.message.includes("unique") || insertErr.message.includes("duplicate")) {
        setError("この企業の職歴は既に登録されています。");
      } else {
        setError("登録に失敗しました: " + insertErr.message);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-6 py-12">
          <h1 className="text-xl font-medium text-gray-900 mb-2">職歴を登録する</h1>
          <p className="text-sm text-gray-400 mb-8">
            登録すると、その企業のページにあなたの情報が表示されます。
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-5">
            {/* 企業選択 */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">企業名 *</label>
              {companyId ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                  <span className="text-sm font-medium text-green-800">{companyName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyId("");
                      setCompanyName("");
                      setCompanyQuery("");
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
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
                    onFocus={() => companySuggestions.length > 0 && setShowDropdown(true)}
                    placeholder="企業名を入力して検索..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {showDropdown && companySuggestions.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {companySuggestions.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCompany(c.id, c.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">在籍状況 *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "current" as const, label: "現役（在籍中）" },
                  { value: "alumni" as const, label: "OB・OG（退社済み）" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`py-3 rounded-xl text-sm border transition-all ${
                      status === opt.value
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 役職・職種 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">役職・職種 *</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="例: フィールドセールス、CSマネージャー"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* 部署 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">部署（任意）</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例: エンタープライズ営業部"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* 在籍期間 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">入社年 *</label>
                <input
                  type="number"
                  value={joinedYear}
                  onChange={(e) => setJoinedYear(e.target.value)}
                  placeholder="2020"
                  min="1980"
                  max={new Date().getFullYear()}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {status === "alumni" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">退社年 *</label>
                  <input
                    type="number"
                    value={leftYear}
                    onChange={(e) => setLeftYear(e.target.value)}
                    placeholder="2023"
                    min="1980"
                    max={new Date().getFullYear()}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
            </div>

            {/* 良かったこと */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                入社して良かったこと
                <span className="text-gray-400 font-normal ml-1">（任意・企業ページに表示）</span>
              </label>
              <textarea
                value={goodPoints}
                onChange={(e) => setGoodPoints(e.target.value)}
                placeholder="この会社に入って良かったと思うことを教えてください。"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {/* 大変だったこと */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                大変だったこと・注意点
                <span className="text-gray-400 font-normal ml-1">（任意・企業ページに表示）</span>
              </label>
              <textarea
                value={hardPoints}
                onChange={(e) => setHardPoints(e.target.value)}
                placeholder="転職を考えている人に知っておいてほしいことを教えてください。"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {/* 公開設定 */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700 cursor-pointer">
                企業ページに公開する
                <span className="text-xs text-gray-400 block mt-0.5">
                  オフにすると自分だけに表示されます
                </span>
              </label>
            </div>

            {/* 送信ボタン */}
            <button
              onClick={handleSubmit}
              disabled={!companyId || !role || !joinedYear || (status === "alumni" && !leftYear) || loading}
              className="w-full bg-gray-900 text-white py-4 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "登録中..." : "登録する"}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function WorkHistoryNewPage() {
  return (
    <Suspense>
      <WorkHistoryForm />
    </Suspense>
  );
}
