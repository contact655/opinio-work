"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  companyId: string;
  companyName: string;
  isLoggedIn: boolean;
};

/**
 * Fix 17 (Scout opt-in functional) + Fix 18 (Compare list) + Fix 20 (Follow for jobs)
 */
export function CompanyActionButtons({ companyId, companyName, isLoggedIn }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [scoutEnabled, setScoutEnabled] = useState(false);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Read initial states
  useEffect(() => {
    if (isLoggedIn) {
      fetch(`/api/follow-company?company_id=${companyId}`)
        .then((r) => r.ok ? r.json() : { following: false })
        .then((j) => setFollowing(!!j.following))
        .catch(() => { /* ignore */ });

      fetch(`/api/scout-opt-in?company_id=${companyId}`)
        .then((r) => r.ok ? r.json() : { enabled: false })
        .then((j) => setScoutEnabled(!!j.enabled))
        .catch(() => { /* ignore */ });
    }
    try {
      const raw = localStorage.getItem("ow_compare_ids");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setCompareIds(ids);
    } catch { /* ignore */ }
  }, [companyId, isLoggedIn]);

  const inCompare = compareIds.includes(companyId);
  const compareCount = compareIds.length;

  const toggleFollow = async () => {
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch("/api/follow-company", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const j = await res.json();
      setFollowing(!!j.following);
    } catch { /* ignore */ } finally {
      setFollowLoading(false);
    }
  };

  const toggleScout = async () => {
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    if (scoutLoading) return;
    setScoutLoading(true);
    try {
      const method = scoutEnabled ? "DELETE" : "POST";
      const res = await fetch("/api/scout-opt-in", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const j = await res.json();
      setScoutEnabled(!!j.enabled);
    } catch { /* ignore */ } finally {
      setScoutLoading(false);
    }
  };

  const toggleCompare = () => {
    try {
      const raw = localStorage.getItem("ow_compare_ids");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      if (ids.includes(companyId)) {
        next = ids.filter((x) => x !== companyId);
      } else {
        if (ids.length >= 3) {
          alert("比較リストは最大3社までです。他の企業を外してください。");
          return;
        }
        next = [...ids, companyId];
      }
      localStorage.setItem("ow_compare_ids", JSON.stringify(next));
      setCompareIds(next);
    } catch { /* ignore */ }
  };

  const gotoCompare = () => {
    try {
      const raw = localStorage.getItem("ow_compare_ids");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      router.push(ids.length > 0 ? `/compare?ids=${ids.join(",")}` : "/compare");
    } catch {
      router.push("/compare");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Fix 20: Follow for new jobs */}
      <button
        onClick={toggleFollow}
        disabled={followLoading}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: following ? "#0F6E56" : "#0f172a",
          background: following ? "#E1F5EE" : "#fff",
          border: `1.5px solid ${following ? "#1D9E75" : "#d0d0d0"}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%",
        }}
        title={companyName + "の求人を追う"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {following ? (
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />
          ) : (
            <>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </>
          )}
        </svg>
        {following ? "求人通知を受け取り中" : "新しい求人が出たら通知"}
      </button>

      {/* Fix 18: Compare list */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={toggleCompare}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: inCompare ? "#1D9E75" : "#0f172a",
            background: "#fff",
            border: `1.5px solid ${inCompare ? "#1D9E75" : "#d0d0d0"}`,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          {inCompare ? `✓ 比較リスト（${compareCount}/3）` : "+ 比較に追加"}
        </button>
        {compareCount > 0 && (
          <button
            onClick={gotoCompare}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              background: "#1D9E75",
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            比較を見る →
          </button>
        )}
      </div>

      {/* Fix 17: Scout opt-in (functional) */}
      <button
        onClick={toggleScout}
        disabled={scoutLoading}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: scoutEnabled ? "#0F6E56" : "#0f172a",
          background: scoutEnabled ? "#E1F5EE" : "#fff",
          border: `1.5px solid ${scoutEnabled ? "#1D9E75" : "#d0d0d0"}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          width: "100%",
        }}
        title={companyName + "からスカウトを受け取る"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {scoutEnabled ? "✓ スカウト受信中" : "この企業からスカウトを受け取る"}
      </button>
    </div>
  );
}
