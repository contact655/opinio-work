"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FavoriteJobButton({
  jobId,
  initialFavorited = false,
}: {
  jobId: string;
  initialFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth/signup";
      return;
    }

    if (favorited) {
      await supabase
        .from("ow_job_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", jobId);
    } else {
      await supabase
        .from("ow_job_favorites")
        .insert({ user_id: user.id, job_id: jobId });
    }

    setFavorited(!favorited);
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0"
      style={{
        background: favorited ? "#FCEBEB" : "transparent",
        border: `0.5px solid ${favorited ? "#F09595" : "#e5e7eb"}`,
        cursor: "pointer",
      }}
      title={favorited ? "気になるを解除" : "気になる"}
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill={favorited ? "#E24B4A" : "none"}
        stroke={favorited ? "#E24B4A" : "#9ca3af"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 13.5S2 9.5 2 5.5C2 3.5 3.5 2 5.5 2c1 0 2 .5 2.5 1.5C8.5 2.5 9.5 2 10.5 2 12.5 2 14 3.5 14 5.5c0 4-6 8-6 8z" />
      </svg>
    </button>
  );
}
