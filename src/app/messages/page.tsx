"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

type Thread = {
  id: string;
  company_id: string;
  company_name: string;
  company_logo: string | null;
  status: string;
  last_message: string | null;
  updated_at: string;
};

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login?redirect=/messages");
        return;
      }

      try {
        const { data: threadData } = await supabase
          .from("ow_threads")
          .select("id, company_id, status, updated_at")
          .eq("candidate_id", user.id)
          .order("updated_at", { ascending: false });

        if (threadData && threadData.length > 0) {
          const companyIds = Array.from(
            new Set(threadData.map((t: any) => t.company_id))
          );
          const { data: companies } = await supabase
            .from("ow_companies")
            .select("id, name, logo_url, url")
            .in("id", companyIds);

          const companyMap = new Map(
            (companies || []).map((c: any) => [c.id, c])
          );

          const enrichedThreads: Thread[] = threadData.map((t: any) => {
            const company = companyMap.get(t.company_id) || {};
            let logoUrl = (company as any).logo_url || null;
            if (!logoUrl && (company as any).url) {
              try {
                logoUrl = `https://logo.clearbit.com/${new URL((company as any).url).hostname}`;
              } catch {}
            }
            return {
              id: t.id,
              company_id: t.company_id,
              company_name: (company as any).name || "不明な企業",
              company_logo: logoUrl,
              status: t.status,
              last_message: null,
              updated_at: t.updated_at,
            };
          });

          setThreads(enrichedThreads);
        }
      } catch {
        // ow_threads table might not exist yet
      }

      setLoading(false);
    }
    load();
  }, [router]);

  const statusLabel = (status: string) => {
    switch (status) {
      case "casual_requested":
        return {
          text: "リクエスト中",
          bg: "bg-yellow-100",
          color: "text-yellow-700",
        };
      case "casual_accepted":
        return {
          text: "面談確定",
          bg: "bg-green-100",
          color: "text-green-700",
        };
      case "active":
        return {
          text: "やり取り中",
          bg: "bg-blue-100",
          color: "text-blue-700",
        };
      default:
        return { text: status, bg: "bg-gray-100", color: "text-gray-500" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-gray-500 text-sm mb-2">
          メッセージはまだありません
        </p>
        <p className="text-gray-400 text-xs mb-6">
          企業にカジュアル面談をリクエストすると、ここにスレッドが表示されます
        </p>
        <button
          onClick={() => router.push("/companies")}
          className="px-5 py-2 bg-[#1D9E75] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
        >
          企業を探す
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => {
        const s = statusLabel(thread.status);
        const isActive = threadParam === thread.id;
        return (
          <button
            key={thread.id}
            onClick={() => router.push(`/messages?thread=${thread.id}`)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors ${
              isActive
                ? "bg-[#E1F5EE] border border-[#5DCAA5]"
                : "bg-white border border-gray-100 hover:border-gray-200"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
              {thread.company_logo ? (
                <img
                  src={thread.company_logo}
                  alt=""
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-gray-400 text-sm font-bold">
                  {thread.company_name[0]}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 truncate">
                  {thread.company_name}
                </span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full ${s.bg} ${s.color}`}
                >
                  {s.text}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(thread.updated_at).toLocaleDateString("ja-JP")}
              </p>
            </div>
            <svg
              className="w-4 h-4 text-gray-300 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-xl font-bold mb-6">メッセージ</h1>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-400">読み込み中...</p>
              </div>
            }
          >
            <MessagesContent />
          </Suspense>
        </div>
      </main>
    </>
  );
}
