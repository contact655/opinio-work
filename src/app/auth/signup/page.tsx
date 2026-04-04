"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });

    // 「既に登録済み」の場合はログインを試行
    if (signUpError && signUpError.message.includes("already registered")) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        setError("このメールアドレスは既に登録されています。ログインページからお試しください。");
        setLoading(false);
        return;
      }
      // ログイン成功 → ロール付与してリダイレクト
      const roleRes = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      });
      if (!roleRes.ok) {
        console.error("[signup] role assign failed:", await roleRes.text());
      }
      router.push("/onboarding");
      return;
    }

    if (signUpError) {
      const msg = signUpError.message.includes("Password")
        ? "パスワードは8文字以上で入力してください"
        : signUpError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // signUpが成功してもidentitiesが空の場合 = 既存ユーザー（Supabaseのセキュリティ対策）
    if (signUpData.user && signUpData.user.identities?.length === 0) {
      setError("このメールアドレスは既に登録されています。ログインページからお試しください。");
      setLoading(false);
      return;
    }

    // candidateロールを付与
    const roleRes = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "candidate" }),
    });
    if (!roleRes.ok) {
      console.error("[signup] role assign failed:", await roleRes.text());
    }
    router.push("/onboarding");
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-card-lg p-8 border border-card-border">
            <h1 className="text-2xl font-bold text-center mb-2">無料会員登録</h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              カルチャーで選ぶ、新しい転職体験を始めましょう
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="8文字以上"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {loading ? "登録中..." : "無料で登録する"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              既にアカウントをお持ちですか？{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                ログイン
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
