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
            <h1 className="text-2xl font-bold mb-1">ダッシュボード</h1>
            <p className="text-sm text-gray-500">
              {user.email} でログイン中
            </p>
          </div>

          {/* Current Roles */}
          <div className="grid gap-4 mb-8">
            {/* Candidate Role */}
            {hasCandidate && (
              <div className="bg-white rounded-card-lg border border-card-border p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">求職者として使う</h2>
                      <p className="text-sm text-gray-500">
                        {data.profile ? `${data.profile.name} さん` : "プロフィール未設定"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/companies"
                      className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
                    >
                      企業を探す
                    </Link>
                    <Link
                      href="/jobs"
                      className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-full hover:bg-primary-light transition-colors"
                    >
                      求人を見る
                    </Link>
                  </div>
                </div>
                <div className="mt-4 flex gap-3 text-sm">
                  <Link href="/mypage/applications" className="text-gray-500 hover:text-primary">応募管理</Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/scout" className="text-gray-500 hover:text-primary">スカウト</Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/onboarding" className="text-gray-500 hover:text-primary">プロフィール編集</Link>
                </div>
              </div>
            )}

            {/* Company Role */}
            {hasCompany && data.companies.length > 0 && (
              <div className="bg-white rounded-card-lg border border-card-border p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">企業担当者として使う</h2>
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
                    </div>
                  </div>
                  <Link
                    href="/company/edit"
                    className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
                  >
                    企業管理
                  </Link>
                </div>
                <div className="mt-4 flex gap-3 text-sm">
                  <Link href="/company/edit" className="text-gray-500 hover:text-primary">企業情報編集</Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/company/jobs/new" className="text-gray-500 hover:text-primary">求人作成</Link>
                </div>
              </div>
            )}

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

          {/* Add Roles */}
          {(!hasCandidate || !hasCompany) && (
            <div>
              <h2 className="text-sm font-bold text-gray-500 mb-3">役割を追加</h2>
              <div className="grid gap-3">
                {!hasCandidate && (
                  <Link
                    href="/onboarding"
                    className="flex items-center gap-4 p-5 bg-white rounded-card-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary-light/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 group-hover:text-primary">求職者として登録する</p>
                      <p className="text-xs text-gray-400">プロフィールを作成して、企業からスカウトを受け取れます</p>
                    </div>
                  </Link>
                )}

                {!hasCompany && (
                  <Link
                    href="/company/register"
                    className="flex items-center gap-4 p-5 bg-white rounded-card-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary-light/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                      <svg className="w-5 h-5 text-green-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 group-hover:text-primary">企業担当者として登録する</p>
                      <p className="text-xs text-gray-400">企業情報を登録して求人を掲載できます</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
