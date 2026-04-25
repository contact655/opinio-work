"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BusinessLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/biz/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // すでにログイン済みなら次のページへ
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(next);
    });
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("メールアドレスまたはパスワードが間違っています");
        return;
      }
      router.replace(next);
    } catch {
      setError("ログインに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>Opinio</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1D9E75", padding: "2px 8px", borderRadius: 6, background: "#E1F5EE" }}>Business</span>
          </div>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: 12,
          border: "0.5px solid #e5e7eb",
          padding: 32,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8, textAlign: "center" }}>
            企業アカウントでログイン
          </h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24, textAlign: "center" }}>
            候補者向けサイトとは別アカウントです
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                メールアドレス
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 14,
                  border: "1.5px solid #e5e7eb", borderRadius: 8,
                  outline: "none", background: "#fff",
                }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                パスワード
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 14,
                  border: "1.5px solid #e5e7eb", borderRadius: 8,
                  outline: "none", background: "#fff",
                }}
              />
            </label>

            {error && (
              <div style={{ fontSize: 12, color: "#dc2626", padding: "8px 12px", background: "#fef2f2", borderRadius: 6 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "12px 0", borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                color: "#fff", background: "#1D9E75",
                border: "none", cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#6b7280" }}>
            企業アカウントをお持ちでない方は{" "}
            <Link href="/biz/auth/signup" style={{ color: "#1D9E75", fontWeight: 600, textDecoration: "none" }}>
              アカウント作成 →
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>
            ← 候補者サイトに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
