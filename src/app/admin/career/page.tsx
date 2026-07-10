"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type CareerProfileRow = {
  user_id: string;
  headline: string | null;
  years_of_experience: number | null;
  is_published: boolean;
  updated_at: string;
  user_name: string | null;
  job_type: string | null;
};

export default function AdminCareerPage() {
  const [profiles, setProfiles] = useState<CareerProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState("");
  const [editYears, setEditYears] = useState<number | null>(null);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("ow_career_profiles")
      .select("user_id, headline, years_of_experience, is_published, updated_at, ow_users(name, job_type)")
      .order("updated_at", { ascending: false });

    const rows: CareerProfileRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const u = r.ow_users as { name: string | null; job_type: string | null } | null;
      return {
        user_id: r.user_id as string,
        headline: r.headline as string | null,
        years_of_experience: r.years_of_experience as number | null,
        is_published: r.is_published as boolean,
        updated_at: r.updated_at as string,
        user_name: u?.name ?? null,
        job_type: u?.job_type ?? null,
      };
    });
    setProfiles(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function togglePublish(userId: string, current: boolean) {
    startTransition(async () => {
      const { error } = await supabase
        .from("ow_career_profiles")
        .update({ is_published: !current })
        .eq("user_id", userId);
      if (error) { showToast("エラー: " + error.message); return; }
      setProfiles(p => p.map(r => r.user_id === userId ? { ...r, is_published: !current } : r));
      showToast(!current ? "✓ 公開しました" : "非公開にしました");
    });
  }

  async function saveEdit(userId: string) {
    startTransition(async () => {
      const { error } = await supabase
        .from("ow_career_profiles")
        .update({ headline: editHeadline || null, years_of_experience: editYears })
        .eq("user_id", userId);
      if (error) { showToast("エラー: " + error.message); return; }
      setProfiles(p => p.map(r => r.user_id === userId ? { ...r, headline: editHeadline || null, years_of_experience: editYears } : r));
      setEditingId(null);
      showToast("✓ 保存しました");
    });
  }

  const publishedCount = profiles.filter(p => p.is_published).length;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>キャリア軌跡 管理</h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
          background: "#eff3fc", color: "#002366", border: "1px solid #dce5f7",
        }}>
          公開中 {publishedCount} / {profiles.length} 件
        </span>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>読み込み中...</div>
      ) : profiles.length === 0 ? (
        <div style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>
          キャリアプロフィールがまだありません
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {profiles.map(p => (
            <div key={p.user_id} style={{
              background: "#fff", borderRadius: 12, padding: "18px 20px",
              border: `1px solid ${p.is_published ? "#dce5f7" : "#e2e8f0"}`,
              boxShadow: p.is_published ? "0 1px 6px rgba(0,35,102,0.07)" : "none",
            }}>
              {editingId === p.user_id ? (
                /* ── 編集モード ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.user_name ?? "（名前なし）"}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => saveEdit(p.user_id)}
                        disabled={isPending}
                        style={{ fontSize: 13, fontWeight: 700, padding: "6px 16px", borderRadius: 8, background: "#002366", color: "#fff", border: "none", cursor: "pointer" }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>ヘッドライン</label>
                    <textarea
                      value={editHeadline}
                      onChange={e => setEditHeadline(e.target.value)}
                      rows={3}
                      style={{ width: "100%", fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>経験年数</label>
                    <input
                      type="number"
                      value={editYears ?? ""}
                      onChange={e => setEditYears(e.target.value ? parseInt(e.target.value) : null)}
                      min={0}
                      max={50}
                      style={{ width: 100, fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>年</span>
                  </div>
                </div>
              ) : (
                /* ── 表示モード ── */
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  {/* アバター */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #002366, #3b5fd9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 16,
                  }}>
                    {(p.user_name ?? "?")[0]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{p.user_name ?? "（名前なし）"}</span>
                      {p.job_type && <span style={{ fontSize: 12, color: "#64748b" }}>{p.job_type}</span>}
                      {p.years_of_experience && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "#eff3fc", color: "#002366", border: "1px solid #dce5f7" }}>
                          経験 {p.years_of_experience}年
                        </span>
                      )}
                      {p.is_published && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                          公開中
                        </span>
                      )}
                    </div>

                    {p.headline ? (
                      <p style={{ fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.headline}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>ヘッドライン未設定</p>
                    )}

                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                      更新: {new Date(p.updated_at).toLocaleDateString("ja-JP")}
                      {" · "}
                      <a href={`/career-trajectories/${p.user_id}`} target="_blank" rel="noreferrer" style={{ color: "#002366", textDecoration: "none" }}>
                        公開ページ ↗
                      </a>
                      {" · "}
                      <a href={`/u/${p.user_id}`} target="_blank" rel="noreferrer" style={{ color: "#002366", textDecoration: "none" }}>
                        プロフィール ↗
                      </a>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setEditingId(p.user_id);
                        setEditHeadline(p.headline ?? "");
                        setEditYears(p.years_of_experience);
                      }}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", cursor: "pointer" }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => togglePublish(p.user_id, p.is_published)}
                      disabled={isPending}
                      style={{
                        fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, cursor: "pointer", border: "none",
                        background: p.is_published ? "#fee2e2" : "#002366",
                        color: p.is_published ? "#dc2626" : "#fff",
                        minWidth: 80,
                      }}
                    >
                      {p.is_published ? "非公開にする" : "公開する"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#fff", padding: "10px 20px", borderRadius: 10,
          fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
