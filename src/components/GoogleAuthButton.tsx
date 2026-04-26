"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleAuthButton({ mode }: { mode: "signin" | "signup" }) {
  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2.5 mb-4 transition-colors hover:bg-gray-50"
        style={{
          padding: "12px 16px",
          border: "0.5px solid #d1d5db",
          borderRadius: 9,
          background: "#fff",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.17z" fill="#4285F4"/>
          <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
          <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
          <path d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" fill="#EA4335"/>
        </svg>
        Googleで{mode === "signup" ? "登録" : "ログイン"}する
      </button>

      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex-1" style={{ height: "0.5px", background: "#e5e7eb" }} />
        <span className="text-[11px] text-gray-600">またはメールで</span>
        <div className="flex-1" style={{ height: "0.5px", background: "#e5e7eb" }} />
      </div>
    </>
  );
}
