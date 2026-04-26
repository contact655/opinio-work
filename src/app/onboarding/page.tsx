"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  {
    id: "job_type",
    question: "あなたの職種は？",
    sub: "最も近いものを選んでください",
    options: [
      "フィールドセールス",
      "インサイドセールス",
      "カスタマーサクセス",
      "マーケティング",
      "事業開発・BizDev",
      "その他",
    ],
  },
  {
    id: "experience_years",
    question: "社会人経験は何年ですか？",
    sub: "キャリアの長さを教えてください",
    options: ["1〜2年", "3〜5年", "6〜10年", "11年以上"],
  },
  {
    id: "worry",
    question: "今一番の悩みは？",
    sub: "相談したいテーマに近いもの",
    options: [
      "転職すべきか迷っている",
      "年収を大幅に上げたい",
      "外資・グローバル企業に行きたい",
      "キャリアチェンジを考えている",
      "スタートアップに興味がある",
      "まず話を聞いてみたい",
    ],
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const current = STEPS[step];

  const select = async (value: string) => {
    const newAnswers = { ...answers, [current.id]: value };
    setAnswers(newAnswers);

    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    // 最終ステップ → 保存してリダイレクト
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // ow_profiles に既存レコードがあるかチェック
      const { data: existing } = await supabase
        .from("ow_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ow_profiles")
          .update({
            job_type: newAnswers.job_type,
            experience_years: newAnswers.experience_years,
            worry: newAnswers.worry,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } else {
        await supabase.from("ow_profiles").insert({
          user_id: user.id,
          job_type: newAnswers.job_type,
          experience_years: newAnswers.experience_years,
          worry: newAnswers.worry,
          onboarding_completed: true,
        });
      }

      // candidateロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      });
    }

    router.push("/?welcome=1");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#FAFAF9",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* ロゴ */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <a
            href="/"
            style={{
              fontSize: 20,
              fontWeight: 500,
              textDecoration: "none",
              color: "#1a1a1a",
            }}
          >
            opinio<span style={{ color: "#1D9E75" }}>.work</span>
          </a>
        </div>

        {/* プログレスバー */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "#1D9E75" : "#e5e7eb",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* 質問カード */}
        <div
          style={{
            background: "#fff",
            border: "0.5px solid #e5e7eb",
            borderRadius: 16,
            padding: "28px 24px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#1D9E75",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            {step + 1} / {STEPS.length}
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 500,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {current.question}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9ca3af",
              marginBottom: 20,
            }}
          >
            {current.sub}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {current.options.map((opt) => (
              <button
                key={opt}
                onClick={() => select(opt)}
                disabled={saving}
                style={{
                  padding: "13px 16px",
                  border: "0.5px solid #d1d5db",
                  borderRadius: 10,
                  background: "#fff",
                  color: "#1a1a1a",
                  fontSize: 14,
                  cursor: saving ? "wait" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#1D9E75";
                  e.currentTarget.style.background = "#E1F5EE";
                  e.currentTarget.style.color = "#0F6E56";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.color = "#1a1a1a";
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              fontSize: 12,
              color: "#9ca3af",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            スキップする
          </button>
        </div>
      </div>
    </div>
  );
}
