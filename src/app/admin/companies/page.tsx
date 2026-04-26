"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const STATUS_TABS = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "審査待ち" },
  { key: "active", label: "承認済み" },
  { key: "rejected", label: "却下" },
];

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ow_companies")
      .select("*, ow_jobs(id)")
      .order("created_at", { ascending: false });
    setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleStatusChange(companyId: string, newStatus: string) {
    setActionLoading(companyId);
    const supabase = createClient();
    await supabase
      .from("ow_companies")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", companyId);
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, status: newStatus } : c))
    );
    setActionLoading(null);
  }

  const filtered = companies.filter((c) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  const pendingCount = companies.filter((c) => c.status === "pending").length;

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
        <h1 className="text-2xl font-bold">企業審査</h1>
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
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">企業名</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">業界</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">所在地</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">従業員数</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">プラン</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">求人数</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">登録日</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  企業が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/companies/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.industry || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.location || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.employee_count || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.plan === "standard" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {c.plan === "standard" ? "スタンダード" : "フリー"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.ow_jobs?.length || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      c.status === "active" ? "bg-green-100 text-green-700" :
                      c.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {c.status === "active" ? "承認済" : c.status === "pending" ? "審査中" : "却下"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "pending" ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusChange(c.id, "active")}
                          disabled={actionLoading === c.id}
                          className="px-2.5 py-1 bg-primary text-white text-xs rounded hover:bg-primary-dark disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleStatusChange(c.id, "rejected")}
                          disabled={actionLoading === c.id}
                          className="px-2.5 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    ) : c.status === "active" ? (
                      <button
                        onClick={() => handleStatusChange(c.id, "rejected")}
                        disabled={actionLoading === c.id}
                        className="px-2.5 py-1 border border-red-300 text-red-500 text-xs rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        停止
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(c.id, "active")}
                        disabled={actionLoading === c.id}
                        className="px-2.5 py-1 border border-primary text-primary text-xs rounded hover:bg-primary-light disabled:opacity-50"
                      >
                        再承認
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
