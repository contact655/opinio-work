"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Link from "next/link";

// ─── Types & Constants ──────────────────────────────

const STAGES = [
  { key: "interested", label: "気になる", color: "#E6F1FB", text: "#185FA5" },
  { key: "applied", label: "話を聞く", color: "#FAEEDA", text: "#854F0B" },
  { key: "interviewing", label: "選考中", color: "#E1F5EE", text: "#0F6E56" },
  { key: "offered", label: "内定", color: "#FCEBEB", text: "#A32D2D" },
  { key: "accepted", label: "入社決定", color: "#1D9E75", text: "#fff" },
] as const;

const STATUS_TO_STAGE: Record<string, string> = {
  casual_requested: "applied",
  schedule_adjusting: "applied",
  casual_confirmed: "applied",
  interviewing: "interviewing",
  offer: "offered",
  accepted: "accepted",
};

type TrackingItem = {
  id: string;
  company: {
    id: string;
    name: string;
    industry: string | null;
    url: string | null;
    logo_url: string | null;
    brand_color: string | null;
  } | null;
  stage: string;
  lastMessage?: string | null;
  threadId?: string;
  updatedAt: string;
};

// ─── Logo Helper ────────────────────────────────────

function getLogoUrl(company: any): string | null {
  if (!company) return null;
  if (company.logo_url) return company.logo_url;
  if (company.url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(company.url).hostname}&sz=128`;
    } catch {}
  }
  return null;
}

// ─── Main Component ─────────────────────────────────

export default function JobTrackingPage() {
  const router = useRouter();
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/signin?redirect=/dashboard/job-tracking");
        return;
      }

      try {
        // 並列でスレッドとお気に入りを取得
        const [threadsResult, favoritesResult] = await Promise.all([
          supabase
            .from("ow_threads")
            .select("id, company_id, status, last_message, updated_at, company_name")
            .eq("candidate_id", user.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("ow_saved_companies")
            .select("company_id, created_at, ow_companies(id, name, industry, url, logo_url, brand_color)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        const threads = threadsResult.data ?? [];
        const favorites = favoritesResult.data ?? [];

        // スレッドに含まれる企業IDを収集
        const threadCompanyIds = new Set(threads.map((t: any) => t.company_id));

        // 企業情報を取得（スレッド用）
        const companyMap = new Map<string, any>();
        if (threadCompanyIds.size > 0) {
          const { data: companies } = await supabase
            .from("ow_companies")
            .select("id, name, industry, url, logo_url, brand_color")
            .in("id", Array.from(threadCompanyIds));
          for (const c of companies ?? []) {
            companyMap.set(c.id, c);
          }
        }

        const trackingItems: TrackingItem[] = [];

        // お気に入り → interested（スレッドがない場合のみ）
        for (const f of favorites) {
          if (threadCompanyIds.has(f.company_id)) continue;
          trackingItems.push({
            id: `fav-${f.company_id}`,
            company: (f as any).ow_companies ?? null,
            stage: "interested",
            updatedAt: f.created_at ?? new Date().toISOString(),
          });
        }

        // スレッド → ステータスに応じたステージ
        for (const t of threads) {
          trackingItems.push({
            id: `thread-${t.id}`,
            company: companyMap.get(t.company_id) ?? {
              id: t.company_id,
              name: t.company_name ?? "不明",
              industry: null,
              url: null,
              logo_url: null,
              brand_color: null,
            },
            stage: STATUS_TO_STAGE[t.status] ?? "applied",
            lastMessage: t.last_message,
            threadId: t.id,
            updatedAt: t.updated_at,
          });
        }

        setItems(trackingItems);
      } catch (err) {
        console.error("[job-tracking] Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-white flex items-center justify-center">
          <p className="text-[13px] text-gray-600">読み込み中...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
          {/* ヘッダー */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>
                転職活動の進捗
              </h1>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                {items.length}社の企業を管理中
              </p>
            </div>
            <Link
              href="/dashboard"
              style={{ fontSize: 12, color: "#1D9E75", textDecoration: "none" }}
            >
              ← マイページに戻る
            </Link>
          </div>

          {/* カンバンボード */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))`,
              gap: 12,
              overflowX: "auto",
            }}
          >
            {STAGES.map((stage) => {
              const stageItems = items.filter((i) => i.stage === stage.key);
              return (
                <div key={stage.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* カラムヘッダー */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: stage.color,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: stage.text }}>
                      {stage.label}
                    </span>
                    <span style={{ fontSize: 12, color: stage.text, opacity: 0.8 }}>
                      {stageItems.length}
                    </span>
                  </div>

                  {/* カード */}
                  {stageItems.map((item) => {
                    const logo = getLogoUrl(item.company);
                    const href = `/companies/${item.company?.id}`;

                    return (
                      <Link
                        key={item.id}
                        href={href}
                        style={{
                          display: "block",
                          background: "#fff",
                          border: "0.5px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          textDecoration: "none",
                          color: "inherit",
                          transition: "border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#5DCAA5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          {logo ? (
                            <img
                              src={logo}
                              width={28}
                              height={28}
                              alt=""
                              style={{ borderRadius: 6, flexShrink: 0, objectFit: "contain" }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                flexShrink: 0,
                                background: item.company?.brand_color ?? "#1D9E75",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              {item.company?.name?.[0] ?? "?"}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.company?.name ?? "不明"}
                            </div>
                            {item.company?.industry && (
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>
                                {item.company.industry}
                              </div>
                            )}
                          </div>
                        </div>
                        {item.lastMessage && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "#6b7280",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.lastMessage}
                          </div>
                        )}
                      </Link>
                    );
                  })}

                  {/* 空の場合 */}
                  {stageItems.length === 0 && (
                    <div
                      style={{
                        border: "1px dashed #d1d5db",
                        borderRadius: 10,
                        padding: "16px 12px",
                        textAlign: "center",
                        color: "#9ca3af",
                        fontSize: 11,
                      }}
                    >
                      {stage.key === "interested"
                        ? "気になる企業をブックマーク"
                        : "まだありません"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
