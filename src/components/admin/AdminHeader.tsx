"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminHeader() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header
      style={{
        borderBottom: "2px solid #F97316",
        background: "#fff",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link
          href="/admin"
          style={{ fontWeight: 700, fontSize: 18, textDecoration: "none", color: "var(--ink)" }}
        >
          Opinio Admin
        </Link>
        <span
          style={{
            fontSize: 11,
            background: "#F97316",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          STAFF
        </span>
      </div>
      <button
        type="button"
        onClick={() => { void handleLogout(); }}
        style={{
          background: "transparent",
          border: "1px solid var(--ink-mute)",
          color: "var(--ink-mute)",
          padding: "6px 12px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "inherit",
        }}
      >
        ログアウト
      </button>
    </header>
  );
}
