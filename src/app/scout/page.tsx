"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateMatchReasons } from "@/lib/matching";
import Header from "@/components/Header";
import Link from "next/link";

type Scout = {
  id: string;
  message: string;
  status: string;
  sent_at: string;
  ow_companies: {
    id: string;
    name: string;
    logo_url: string | null;
    industry: string | null;
    ow_company_photos: { photo_url: string }[];
  };
  ow_jobs: {
    id: string;
    title: string;
    salary_min: number | null;
    salary_max: number | null;
    work_style: string | null;
    ow_job_matching_tags: { tag_category: string; tag_value: string }[];
  };
};

const TABS = [
  { key: "unread", label: "未読" },
  { key: "all", label: "すべて" },
  { key: "replied", label: "返信済み" },
  { key: "declined", label: "辞退済み" },
];

export default function ScoutPage() {
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Load profile
    const { data: prof } = await supabase
      .from("ow_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    setProfile(prof);

    // Load scouts
    const { data } = await supabase
      .from("ow_scouts")
      .select(
        `*,
        ow_companies(id, name, logo_url, industry,
          ow_company_photos(photo_url)
        ),
        ow_jobs(id, title, salary_min, salary_max, work_style,
          ow_job_matching_tags(tag_category, tag_value)
        )`
      )
      .eq("candidate_id", user.id)
      .order("sent_at", { ascending: false });

    setScouts((data as Scout[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAction(scoutId: string, action: "replied" | "declined") {
    const supabase = createClient();
    await supabase
      .from("ow_scouts")
      .update({ status: action })
      .eq("id", scoutId);
    setScouts((prev) =>
      prev.map((s) => (s.id === scoutId ? { ...s, status: action } : s))
    );
  }

  const filtered = scouts.filter((s) => {
    if (activeTab === "unread") return s.status === "sent";
    if (activeTab === "replied") return s.status === "replied";
    if (activeTab === "declined") return s.status === "declined";
    return true;
  });

  const unreadCount = scouts.filter((s) => s.status === "sent").length;

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

  if (!profile) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">
              スカウトを受け取るにはプロフィール登録が必要です
            </p>
            <Link
              href="/auth/signup"
              className="text-primary hover:underline"
            >
              無料登録はこちら
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">スカウト</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-card-border hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.key === "unread" && unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-white text-primary text-[10px] rounded-full font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Scout List */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-2">
                {activeTab === "unread"
                  ? "未読のスカウトはありません"
                  : "スカウトはまだ届いていません"}
              </p>
              <p className="text-gray-400 text-sm">
                プロフィールを充実させるとスカウトが届きやすくなります
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((scout) => {
                const isUnread = scout.status === "sent";
                const company = scout.ow_companies;
                const job = scout.ow_jobs;
                const photos = company?.ow_company_photos || [];

                // Generate match reasons
                const matchReasons = profile && job
                  ? generateMatchReasons(profile, {
                      salary_min: job.salary_min,
                      salary_max: job.salary_max,
                      work_style: job.work_style,
                      matching_tags: job.ow_job_matching_tags || [],
                    })
                  : [];

                return (
                  <div
                    key={scout.id}
                    className={`bg-white rounded-card border border-card-border overflow-hidden ${
                      isUnread ? "border-l-4 border-l-primary" : ""
                    }`}
                  >
                    {/* Company photo strip */}
                    {photos.length > 0 && (
                      <div className="h-[72px] grid grid-cols-3">
                        {photos.slice(0, 3).map((p, i) => (
                          <div
                            key={i}
                            className="bg-gray-200 bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${p.photo_url})`,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                            {company?.logo_url ? (
                              <img
                                src={company.logo_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-gray-400">
                                {company?.name?.[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">
                              {company?.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {job?.title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(scout.sent_at).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {scout.message}
                      </p>

                      {/* Match Reasons */}
                      {matchReasons.length > 0 && (
                        <div className="p-3 bg-primary-light rounded-lg mb-3">
                          <p className="text-xs font-semibold text-primary mb-1">
                            おすすめの理由
                          </p>
                          <ul className="space-y-1">
                            {matchReasons.map((r, i) => (
                              <li
                                key={i}
                                className="text-xs text-gray-600 flex items-start gap-1.5"
                              >
                                <span className="text-primary mt-0.5">✓</span>
                                {r.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job?.salary_min && job?.salary_max && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {job.salary_min}〜{job.salary_max}万円
                          </span>
                        )}
                        {job?.work_style && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {job.work_style}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      {scout.status === "sent" && (
                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              handleAction(scout.id, "declined")
                            }
                            className="flex-1 py-2 border border-gray-300 text-gray-500 text-sm rounded-full hover:bg-gray-50"
                          >
                            辞退する
                          </button>
                          <button
                            onClick={() =>
                              handleAction(scout.id, "replied")
                            }
                            className="flex-1 py-2 bg-primary text-white text-sm rounded-full hover:bg-primary-dark"
                          >
                            返信する
                          </button>
                        </div>
                      )}
                      {scout.status === "replied" && (
                        <p className="text-xs text-primary font-medium">
                          ✓ 返信済み
                        </p>
                      )}
                      {scout.status === "declined" && (
                        <p className="text-xs text-gray-400">辞退済み</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
