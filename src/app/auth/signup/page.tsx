"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

export default function SignUpPage() {
  const router = useRouter();
  const [role, setRole] = useState<"candidate" | "company" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo =
      role === "company"
        ? `${window.location.origin}/company/dashboard`
        : `${window.location.origin}/onboarding`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    // 「既に登録済み」の場合はログインを試行
    if (signUpError && signUpError.message.includes("already registered")) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        setError(
          "このメールアドレスは既に登録されています。ログインページからお試しください。"
        );
        setLoading(false);
        return;
      }
      // ログイン成功 → ロール付与してリダイレクト
      const roleRes = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!roleRes.ok) {
        console.error("[signup] role assign failed:", await roleRes.text());
      }
      router.push(role === "company" ? "/company/dashboard" : "/onboarding");
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

    // signUpが成功してもidentitiesが空の場合 = 既存ユーザー
    if (signUpData.user && signUpData.user.identities?.length === 0) {
      setError(
        "このメールアドレスは既に登録されています。ログインページからお試しください。"
      );
      setLoading(false);
      return;
    }

    // ロール付与
    const roleRes = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!roleRes.ok) {
      console.error("[signup] role assign failed:", await roleRes.text());
    }
    router.push(role === "company" ? "/company/dashboard" : "/onboarding");
  }

  // メール確認送信完了
  if (sent) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#E1F5EE" }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="#1D9E75"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">確認メールを送りました</h2>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              {email} に確認メールを送りました。
              <br />
              メール内のリンクをクリックして登録を完了してください。
            </p>
            <Link href="/" className="text-sm" style={{ color: "#1D9E75" }}>
              TOPに戻る
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-card-lg p-8 border border-card-border">
            {/* ─── ロール選択 ─── */}
            {role === null ? (
              <>
                <h1 className="text-2xl font-bold text-center mb-2">
                  会員登録
                </h1>
                <p className="text-sm text-gray-500 text-center mb-8">
                  登録する方を選んでください
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => setRole("candidate")}
                    className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 hover:border-primary transition-colors"
                    style={{ background: "#fff" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#E1F5EE" }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="#1D9E75"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[15px] font-medium">
                          求職者として登録
                        </div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          企業への転職・キャリア相談をしたい方
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setRole("company")}
                    className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 hover:border-primary transition-colors"
                    style={{ background: "#fff" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "#E6F1FB" }}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="#185FA5"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[15px] font-medium">
                          採用担当者として登録
                        </div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          求人掲載・人材採用をしたい方
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                <p className="mt-6 text-center text-sm text-gray-500">
                  既にアカウントをお持ちですか？{" "}
                  <Link href="/auth/login" className="text-primary hover:underline">
                    ログイン
                  </Link>
                </p>
              </>
            ) : (
              <>
                {/* ─── メール・パスワード入力 ─── */}
                <button
                  onClick={() => setRole(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4"
                >
                  ← 戻る
                </button>

                <h1 className="text-2xl font-bold text-center mb-2">
                  {role === "candidate"
                    ? "求職者として登録"
                    : "採用担当者として登録"}
                </h1>
                <p className="text-sm text-gray-500 text-center mb-8">
                  {role === "candidate"
                    ? "カルチャーで選ぶ、新しい転職体験を始めましょう"
                    : "ミスマッチのない採用を、opinio.workで始めましょう"}
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

                <p className="mt-4 text-center text-[11px] text-gray-400 leading-relaxed">
                  <Link href="/privacy" className="text-gray-400 hover:underline">
                    プライバシーポリシー
                  </Link>
                  ・
                  <Link href="/terms" className="text-gray-400 hover:underline">
                    利用規約
                  </Link>
                  に同意して登録
                </p>

                <p className="mt-4 text-center text-sm text-gray-500">
                  既にアカウントをお持ちですか？{" "}
                  <Link href="/auth/login" className="text-primary hover:underline">
                    ログイン
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
