"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

type Bookmark = {
  id: string;
  type: "company" | "job";
  title: string;
  meta: string;
  badge_label: string;
  href: string;
};

function BookmarkCard({ bk }: { bk: Bookmark }) {
  return (
    <Link href={bk.href} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 12, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 6,
        transition: "border-color 0.12s, box-shadow 0.12s",
      }} className="bk-card-hover">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            padding: "2px 8px", borderRadius: 100,
          }}>{bk.badge_label}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{bk.title}</div>
        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{bk.meta}</div>
      </div>
    </Link>
  );
}

function BookmarkSection({ title, items }: { title: string; items: Bookmark[] }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
        {title}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginLeft: 8 }}>
          {items.length}件
        </span>
      </h2>
      {items.length === 0 ? (
        <div style={{
          background: "var(--bg-tint)", borderRadius: 12, padding: "32px 24px",
          textAlign: "center", color: "var(--ink-mute)", fontSize: 13,
        }}>
          まだブックマークがありません
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {items.map((bk) => <BookmarkCard key={bk.id} bk={bk} />)}
        </div>
      )}
    </div>
  );
}

export default function BookmarksPage() {
  const [companyBookmarks, setCompanyBookmarks] = useState<Bookmark[]>([]);
  const [jobBookmarks, setJobBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: owUserRows } = await supabase
        .from("ow_users").select("id").eq("auth_id", user.id).limit(1);
      const owUserId = owUserRows?.[0]?.id;
      if (!owUserId) { setLoading(false); return; }

      const { data: bmarks } = await supabase
        .from("ow_bookmarks")
        .select("id, target_id, target_type")
        .eq("user_id", owUserId)
        .in("target_type", ["company", "job"])
        .order("created_at", { ascending: false });

      if (!bmarks || bmarks.length === 0) { setLoading(false); return; }

      const companyBmarks = bmarks.filter((b) => b.target_type === "company");
      const jobBmarks = bmarks.filter((b) => b.target_type === "job");

      // company bookmarks
      if (companyBmarks.length > 0) {
        const ids = companyBmarks.map((b) => b.target_id as string);
        const { data: companies } = await supabase
          .from("ow_companies").select("id, name, industry, employee_count").in("id", ids);
        if (companies) {
          const map = new Map(companies.map((c) => [c.id, c]));
          setCompanyBookmarks(
            companyBmarks.map((b) => {
              const c = map.get(b.target_id as string);
              if (!c) return null;
              return {
                id: b.id as string, type: "company" as const,
                title: c.name as string,
                meta: [c.industry, c.employee_count ? `${c.employee_count}名` : null].filter(Boolean).join(" / "),
                badge_label: (c.industry as string) ?? "企業",
                href: `/companies/${c.id}`,
              };
            }).filter((x): x is Bookmark => x !== null)
          );
        }
      }

      // job bookmarks
      if (jobBmarks.length > 0) {
        const ids = jobBmarks.map((b) => b.target_id as string);
        const { data: jobs } = await supabase
          .from("ow_jobs").select("id, title, job_category, company_id").in("id", ids);
        if (jobs) {
          const companyIds = [...new Set(jobs.map((j) => j.company_id as string))];
          const { data: companies } = await supabase
            .from("ow_companies").select("id, name").in("id", companyIds);
          const cMap = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
          const jMap = new Map(jobs.map((j) => [j.id, j]));
          setJobBookmarks(
            jobBmarks.map((b) => {
              const j = jMap.get(b.target_id as string);
              if (!j) return null;
              return {
                id: b.id as string, type: "job" as const,
                title: j.title as string,
                meta: [cMap.get(j.company_id as string), j.job_category as string].filter(Boolean).join(" / "),
                badge_label: (j.job_category as string) ?? "求人",
                href: `/jobs/${j.id}`,
              };
            }).filter((x): x is Bookmark => x !== null)
          );
        }
      }

      setLoading(false);
    })();
  }, []);

  return (
    <MypageLayout activeKey="bookmarks">
      <div style={{ padding: "32px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 28 }}>
          ブックマーク
        </h1>
        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--ink-mute)" }}>
            読み込み中...
          </div>
        ) : (
          <>
            <BookmarkSection title="企業" items={companyBookmarks} />
            <BookmarkSection title="求人" items={jobBookmarks} />
          </>
        )}
      </div>
      <style>{`
        .bk-card-hover:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 4px 12px rgba(15,23,42,0.06) !important;
        }
      `}</style>
    </MypageLayout>
  );
}
