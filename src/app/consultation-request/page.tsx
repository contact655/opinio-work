"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TIME_OPTIONS = [
  "朝（9〜12時）",
  "昼（12〜18時）",
  "夜（18時以降）",
  "土日",
];

function ConsultationRequestForm() {
  const searchParams = useSearchParams();
  const mentorId = searchParams.get("mentor_id");
  const mentorName = searchParams.get("mentor_name") || "メンター";
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signup");
      return;
    }

    // Get user profile name
    const { data: profile } = await supabase
      .from("ow_profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();

    const userName = profile?.name || user.user_metadata?.full_name || "";

    // 1. Save to Supabase
    const { error: insertErr } = await supabase
      .from("consultation_requests")
      .insert({
        user_id: user.id,
        user_name: userName,
        user_email: user.email || "",
        mentor_id: mentorId,
        mentor_name: mentorName,
        message: message.slice(0, 500),
        preferred_time: preferredTime || null,
      });

    if (insertErr) {
      setError("送信に失敗しました。もう一度お試しください。");
      setLoading(false);
      return;
    }

    // 2. Send notification emails
    try {
      await fetch("/api/consultation-request/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          userEmail: user.email || "",
          mentorName,
          message: message.slice(0, 500),
          preferredTime: preferredTime || null,
        }),
      });
    } catch {
      // Email failure is non-blocking
    }

    setDone(true);
    setLoading(false);
  };

  // Completion screen
  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#f0fdf4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10l4 4 8-8"
              stroke="#059669"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
          申し込みを受け付けました
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
          内容を確認の上、3営業日以内にメールでご連絡します。
          <br />
          しばらくお待ちください。
        </p>
        <button
          onClick={() => router.push("/career-consultation")}
          style={{
            fontSize: 14,
            color: "#059669",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          メンター一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>相談を申し込む</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          {mentorName}さんへの相談
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
          内容を確認後、3営業日以内にご連絡します。営業は一切ありません。
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Message */}
        <div>
          <label
            style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}
          >
            相談したい内容 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="例：SIer営業5年目です。SaaSに転職したいのですが、未経験でも可能か、どのように進めればいいか相談したいです。"
            rows={5}
            style={{
              width: "100%",
              border: "1.5px solid #e5e7eb",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              color: "#111827",
              resize: "none",
              outline: "none",
              lineHeight: 1.7,
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#059669";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          />
          <div style={{ textAlign: "right", fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {message.length} / 500字
          </div>
        </div>

        {/* Preferred time */}
        <div>
          <label
            style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}
          >
            面談の希望時間帯
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setPreferredTime(preferredTime === time ? "" : time)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: preferredTime === time ? 600 : 500,
                  background: preferredTime === time ? "#059669" : "#fff",
                  color: preferredTime === time ? "#fff" : "#6b7280",
                  border:
                    preferredTime === time
                      ? "1.5px solid #059669"
                      : "1.5px solid #d1d5db",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        {/* Notice */}
        <div
          style={{
            background: "#f9fafb",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 12,
            color: "#6b7280",
            lineHeight: 1.7,
          }}
        >
          申し込み後、Opinio運営がご相談内容を確認し、メンターとのマッチングを判断します。
          マッチングが確定した場合のみ、メールにて面談日程をご案内します。
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!message.trim() || loading}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            background: message.trim() ? "#111827" : "#d1d5db",
            color: message.trim() ? "#fff" : "#9ca3af",
            border: "none",
            cursor: message.trim() ? "pointer" : "default",
            transition: "background 0.15s",
          }}
        >
          {loading ? "送信中..." : "申し込む"}
        </button>
      </div>
    </div>
  );
}

export default function ConsultationRequestPage() {
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <Suspense
          fallback={
            <div style={{ textAlign: "center", padding: 80, color: "#9ca3af", fontSize: 14 }}>
              読み込み中...
            </div>
          }
        >
          <ConsultationRequestForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
