"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Header from "@/components/Header";

type RolesData = {
  roles: string[];
  profile: { id: string; name: string } | null;
  companies: { id: string; name: string; status: string }[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<RolesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser(user);

      const res = await fetch("/api/roles");
      const rolesData = await res.json();
      setData(rolesData);
      setLoading(false);
    }
    load();
  }, [router]);

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

  if (!data || !user) return null;

  const hasCandidate = data.roles.includes("candidate");
  const hasCompany = data.roles.includes("company");
  const hasAdmin = data.roles.includes("admin");

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">マイページ</h1>
            <p className="text-sm text-gray-500">
              {user.email}
            </p>
          </div>

          {/* Registered Roles */}
          <div className="grid gap-4 mb-8">
            {/* Candidate Role */}
            <div className="bg-white rounded-card-lg border border-card-border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasCandidate ? "bg-blue-100" : "bg-gray-100"}`}>
                    <svg className={`w-6 h-6 ${hasCandidate ? "text-blue-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg">求職者</h2>
                      {hasCandidate ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          登録済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                          追加
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {hasCandidate
                        ? (data.profile?.name ? `${data.profile.name} さん` : "プロフィール登録済み")
                        : "プロフィールを登録して求人に応募できます"}
                    </p>
                  </div>
                </div>
                {hasCandidate ? (
                  <Link
                    href="/companies"
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
                  >
                    企業を探す
                  </Link>
                ) : (
                  <Link
                    href="/onboarding"
                    className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-full hover:bg-primary-light transition-colors"
                  >
                    登録する
                  </Link>
                )}
              </div>
              {hasCandidate && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4 text-sm">
                  <Link href="/jobs" className="text-gray-500 hover:text-primary transition-colors">求人を見る</Link>
                  <Link href="/mypage/applications" className="text-gray-500 hover:text-primary transition-colors">応募管理</Link>
                  <Link href="/scout" className="text-gray-500 hover:text-primary transition-colors">スカウト</Link>
                  <Link href="/onboarding" className="text-gray-500 hover:text-primary transition-colors">プロフィール編集</Link>
                </div>
              )}
            </div>

            {/* Company Role */}
            <div className="bg-white rounded-card-lg border border-card-border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasCompany ? "bg-green-100" : "bg-gray-100"}`}>
                    <svg className={`w-6 h-6 ${hasCompany ? "text-green-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg">企業担当者</h2>
                      {hasCompany ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          登録済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                          追加
                        </span>
                      )}
                    </div>
                    {hasCompany && data.companies.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {data.companies.map((c) => (
                          <span key={c.id} className="text-sm text-gray-500 flex items-center gap-1">
                            {c.name}
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                              c.status === "active" ? "bg-green-100 text-green-700" :
                              c.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {c.status === "active" ? "承認済" : c.status === "pending" ? "審査中" : "停止"}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">企業を登録して求人を掲載できます</p>
                    )}
                  </div>
                </div>
                {hasCompany ? (
                  <Link
                    href="/company/dashboard"
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
                  >
                    企業管理
                  </Link>
                ) : (
                  <Link
                    href="/company/register"
                    className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-full hover:bg-primary-light transition-colors"
                  >
                    企業登録
                  </Link>
                )}
              </div>
              {hasCompany && data.companies.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4 text-sm">
                  <Link href="/company/dashboard" className="text-gray-500 hover:text-primary transition-colors">企業ダッシュボード</Link>
                  <Link href="/company/edit" className="text-gray-500 hover:text-primary transition-colors">企業情報編集</Link>
                  <Link href="/company/jobs/new" className="text-gray-500 hover:text-primary transition-colors">求人作成</Link>
                </div>
              )}
            </div>

            {/* Admin Role */}
            {hasAdmin && (
              <div className="bg-white rounded-card-lg border border-card-border p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">管理者</h2>
                      <p className="text-sm text-gray-500">システム全体の管理</p>
                    </div>
                  </div>
                  <Link
                    href="/admin"
                    className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-full hover:bg-gray-900 transition-colors"
                  >
                    管理画面
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
