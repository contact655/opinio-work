"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_TABS = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "審査待ち" },
  { key: "active", label: "公開中" },
  { key: "draft", label: "下書き" },
  { key: "closed", label: "終了" },
];

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ow_jobs")
      .select("*, ow_companies(name)")
      .order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  async function handleStatusChange(jobId: string, newStatus: string) {
    setActionLoading(jobId);
    const supabase = createClient();
    await supabase
      .from("ow_jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
    setActionLoading(null);
  }

  const filtered = jobs.filter((j) => {
    if (activeTab === "all") return true;
    return j.status === activeTab;
  });

  const pendingCount = jobs.filter((j) => j.status === "pending").length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">求人審査</h1>
        {pendingCount > 0 && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
            {pendingCount}件の審査待ち
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-full border transition-colors ${
              activeTab === tab.key
                ? "bg-foreground text-white border-foreground"
                : "bg-white text-gray-600 border-card-border hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-card border border-card-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">求人タイトル</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">企業名</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">職種</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">年収</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">勤務地</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">勤務スタイル</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">作成日</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  求人が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((j) => (
                <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{j.title}</td>
                  <td className="px-4 py-3 text-gray-600">{j.ow_companies?.name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{j.job_category || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {j.salary_min || j.salary_max
                      ? `${j.salary_min || "?"}〜${j.salary_max || "?"}万`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{j.location || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{j.work_style || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      j.status === "active" ? "bg-green-100 text-green-700" :
                      j.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      j.status === "draft" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {j.status === "active" ? "公開中" :
                       j.status === "pending" ? "審査中" :
                       j.status === "draft" ? "下書き" : "終了"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(j.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    {j.status === "pending" ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusChange(j.id, "active")}
                          disabled={actionLoading === j.id}
                          className="px-2.5 py-1 bg-primary text-white text-xs rounded hover:bg-primary-dark disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleStatusChange(j.id, "closed")}
                          disabled={actionLoading === j.id}
                          className="px-2.5 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    ) : j.status === "active" ? (
                      <button
                        onClick={() => handleStatusChange(j.id, "closed")}
                        disabled={actionLoading === j.id}
                        className="px-2.5 py-1 border border-red-300 text-red-500 text-xs rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        終了
                      </button>
                    ) : j.status === "draft" ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(j.id, "active")}
                        disabled={actionLoading === j.id}
                        className="px-2.5 py-1 border border-primary text-primary text-xs rounded hover:bg-primary-light disabled:opacity-50"
                      >
                        再公開
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
