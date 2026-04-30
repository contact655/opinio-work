"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Reservation = {
  id: string;
  mentor_id: string | null;
  themes: string[] | null;
  current_situation: string | null;
  questions: string | null;
  contact_email: string;
  preferred_days: string[] | null;
  preferred_times: string[] | null;
  preferred_platform: string | null;
  status: string;
  editor_note: string | null;
  scheduled_at: string | null;
  created_at: string;
  // joined
  mentor_name?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_review: { label: "転送待ち", className: "bg-purple-100 text-purple-700" },
  approved:       { label: "転送済",   className: "bg-blue-100 text-blue-700" },
  rejected:       { label: "却下",     className: "bg-red-100 text-red-700" },
  scheduled:      { label: "日程確定", className: "bg-green-100 text-green-700" },
  completed:      { label: "完了",     className: "bg-gray-100 text-gray-500" },
  cancelled:      { label: "キャンセル", className: "bg-gray-100 text-gray-400" },
};

const STATUS_TABS = [
  { key: "all",           label: "すべて" },
  { key: "pending_review", label: "転送待ち" },
  { key: "approved",      label: "転送済" },
  { key: "scheduled",     label: "日程確定" },
  { key: "completed",     label: "完了" },
];

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const supabase = createClient();

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }, []);

  useEffect(() => {
    supabase
      .from("ow_mentor_reservations")
      .select(`
        id, mentor_id, themes, current_situation, questions,
        contact_email, preferred_days, preferred_times, preferred_platform,
        status, editor_note, scheduled_at, created_at,
        ow_mentors(name)
      `)
      .order("status", { ascending: true })   // pending_review sorts first alphabetically? No, let's sort by created_at desc but put pending_review first via client
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("[admin/reservations]", error);
        const rows: Reservation[] = (data || []).map((r: any) => ({
          ...r,
          mentor_name: r.ow_mentors?.name ?? null,
        }));
        // Sort: pending_review first, then by created_at desc
        rows.sort((a, b) => {
          if (a.status === "pending_review" && b.status !== "pending_review") return -1;
          if (a.status !== "pending_review" && b.status === "pending_review") return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setReservations(rows);
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, newStatus: string) => {
    setActioning(id);
    const { error } = await supabase
      .from("ow_mentor_reservations")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    setActioning(null);

    if (!error) {
      setReservations((prev) =>
        prev
          .map((r) => (r.id === id ? { ...r, status: newStatus } : r))
          .sort((a, b) => {
            if (a.status === "pending_review" && b.status !== "pending_review") return -1;
            if (a.status !== "pending_review" && b.status === "pending_review") return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
      );
      showFlash(
        newStatus === "approved"
          ? "転送済みにしました"
          : newStatus === "rejected"
          ? "却下しました"
          : "更新しました"
      );
    } else {
      showFlash("更新に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  const pendingCount = reservations.filter((r) => r.status === "pending_review").length;

  const filtered =
    activeTab === "all"
      ? reservations
      : reservations.filter((r) => r.status === activeTab);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">相談予約管理</h1>
          <p className="text-sm text-gray-500 mt-1">メンター相談の申込を精査してメンターに転送します</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
              転送待ち {pendingCount}件
            </span>
          )}
          <span className="text-sm text-gray-500">{reservations.length}件</span>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#065F46", color: "#fff", padding: "12px 28px",
          borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {flash}
        </div>
      )}

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
            {tab.key === "pending_review" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-card border border-card-border p-12 text-center text-gray-400 text-sm">
          予約が見つかりません
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => {
            const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, className: "bg-gray-100 text-gray-500" };
            const isExpanded = expandedId === r.id;

            return (
              <div
                key={r.id}
                className="bg-white rounded-card border border-card-border overflow-hidden"
              >
                {/* Row header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Status */}
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>

                  {/* Mentor */}
                  <div className="flex-shrink-0 min-w-[120px]">
                    <p className="text-xs text-gray-400">メンター</p>
                    <p className="text-sm font-medium text-gray-800">{r.mentor_name ?? "未設定"}</p>
                  </div>

                  {/* Email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">申込者メール</p>
                    <p className="text-sm text-gray-700 truncate">{r.contact_email}</p>
                  </div>

                  {/* Themes */}
                  <div className="hidden lg:flex flex-wrap gap-1 max-w-[240px]">
                    {(r.themes || []).slice(0, 3).map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {t}
                      </span>
                    ))}
                    {(r.themes || []).length > 3 && (
                      <span className="text-xs text-gray-400">+{(r.themes || []).length - 3}</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">申込日</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {r.status === "pending_review" && (
                      <>
                        <button
                          onClick={() => updateStatus(r.id, "approved")}
                          disabled={actioning === r.id}
                          className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded hover:bg-primary-dark disabled:opacity-50 transition-colors"
                        >
                          {actioning === r.id ? "..." : "転送する"}
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, "rejected")}
                          disabled={actioning === r.id}
                          className="px-3 py-1.5 border border-red-300 text-red-500 text-xs rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          却下
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="px-3 py-1.5 border border-card-border text-gray-500 text-xs rounded hover:bg-gray-50 transition-colors"
                    >
                      {isExpanded ? "閉じる" : "詳細"}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">現在の状況</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{r.current_situation || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">相談したいこと</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{r.questions || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">希望曜日</p>
                      <p className="text-gray-700">{(r.preferred_days || []).join(" / ") || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">希望時間帯</p>
                      <p className="text-gray-700">{(r.preferred_times || []).join(" / ") || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">希望ツール</p>
                      <p className="text-gray-700">{r.preferred_platform || "-"}</p>
                    </div>
                    {r.editor_note && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">編集部メモ</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{r.editor_note}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">相談テーマ（全件）</p>
                      <div className="flex flex-wrap gap-1">
                        {(r.themes || []).map((t) => (
                          <span key={t} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
