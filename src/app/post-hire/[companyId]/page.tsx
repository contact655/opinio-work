"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

const QUESTIONS = [
  { key: "culture_match", label: "カルチャーの一致度", desc: "入社前のイメージ通りでしたか？" },
  { key: "workstyle_match", label: "働き方の一致度", desc: "リモート・残業など実態はどうでしたか？" },
  { key: "salary_match", label: "年収・評価の一致度", desc: "期待通りの年収・評価でしたか？" },
  { key: "overall_satisfaction", label: "総合満足度", desc: "転職してよかったと思いますか？" },
];

export default function PostHireReportPage({
  params,
}: {
  params: { companyId: string };
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [goodPoints, setGoodPoints] = useState("");
  const [concerns, setConcerns] = useState("");
  const [gap, setGap] = useState("");
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [months, setMonths] = useState<3 | 6 | 12>(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { error } = await supabase.from("ow_post_hire_reports").insert({
      user_id: user.id,
      company_id: params.companyId,
      months_after: months,
      ...scores,
      good_points: goodPoints || null,
      concerns: concerns || null,
      gap_from_expectation: gap || null,
      would_recommend: recommend,
    });

    if (error) {
      console.error("[post-hire] Submit error:", error);
      alert("送信に失敗しました。もう一度お試しください。");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-white">
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              レポートを送信しました
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              あなたの体験が次の転職者の役に立ちます。ありがとうございます。
            </p>
            <button
              onClick={() => router.push(`/companies/${params.companyId}`)}
              style={{
                padding: "10px 24px",
                background: "#1D9E75",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              企業ページに戻る
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            入社後レポートを投稿する
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 28 }}>
            匿名で公開されます。あなたの体験が次の転職者の役に立ちます。
          </p>

          {/* 入社後何ヶ月 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              入社後どれくらい経ちましたか？
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {([3, 6, 12] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    border: `0.5px solid ${months === m ? "#1D9E75" : "#e5e7eb"}`,
                    background: months === m ? "#E1F5EE" : "transparent",
                    color: months === m ? "#0F6E56" : "#6b7280",
                    fontFamily: "inherit",
                    fontWeight: months === m ? 600 : 400,
                  }}
                >
                  {m}ヶ月
                </button>
              ))}
            </div>
          </div>

          {/* スコア評価 */}
          {QUESTIONS.map((q) => (
            <div key={q.key} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                {q.label}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                {q.desc}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScores((prev) => ({ ...prev, [q.key]: n }))}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      border: `0.5px solid ${scores[q.key] === n ? "#1D9E75" : "#e5e7eb"}`,
                      background: scores[q.key] === n ? "#1D9E75" : "transparent",
                      color: scores[q.key] === n ? "#fff" : "#6b7280",
                      fontFamily: "inherit",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* テキスト入力 */}
          {[
            { label: "良かった点", value: goodPoints, onChange: setGoodPoints, placeholder: "カルチャー・働き方・成長機会など" },
            { label: "気になった点", value: concerns, onChange: setConcerns, placeholder: "入社後に気づいたこと" },
            { label: "入社前とのギャップ", value: gap, onChange: setGap, placeholder: "イメージと違った点があれば" },
          ].map((field) => (
            <div key={field.label} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                {field.label}
              </div>
              <textarea
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  border: "0.5px solid #e5e7eb",
                  background: "#fafaf8",
                  color: "#111",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          {/* おすすめ度 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              この会社を友人に薦めますか？
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { v: true, label: "薦める" },
                { v: false, label: "薦めない" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => setRecommend(opt.v)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "inherit",
                    border: `0.5px solid ${recommend === opt.v ? "#1D9E75" : "#e5e7eb"}`,
                    background: recommend === opt.v ? "#E1F5EE" : "transparent",
                    color: recommend === opt.v ? "#0F6E56" : "#6b7280",
                    fontWeight: recommend === opt.v ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting || Object.keys(scores).length < 4}
            style={{
              width: "100%",
              padding: 14,
              background: "#1D9E75",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: submitting || Object.keys(scores).length < 4 ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: Object.keys(scores).length < 4 ? 0.5 : 1,
            }}
          >
            {submitting ? "送信中..." : "匿名で投稿する"}
          </button>
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
            個人が特定される情報は含まれません
          </p>
        </div>
      </main>
    </>
  );
}
