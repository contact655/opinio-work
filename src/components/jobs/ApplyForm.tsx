"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  jobId: string;
  jobTitle: string;
  companyName: string;
};

export function ApplyForm({ jobId, jobTitle, companyName }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [step, setStep] = useState<"form" | "done">("form");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async () => {
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("ow_job_applications").insert({
      job_id: jobId,
      user_id: user?.id ?? null,
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: form.message,
      status: "pending",
    });

    if (error) {
      alert("応募に失敗しました。もう一度お試しください。");
      setSubmitting(false);
      return;
    }

    // Resendでメール送信
    try {
      await fetch("/api/apply/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          companyName,
          ...form,
        }),
      });
    } catch {
      // メール送信失敗は無視
    }

    setStep("done");
    setSubmitting(false);
  };

  if (step === "done") {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          応募が完了しました
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "#666",
            marginBottom: 24,
            lineHeight: 1.7,
          }}
        >
          {form.email} に確認メールを送りました。
          <br />
          Opinioから3営業日以内にご連絡します。
        </p>
        <button
          onClick={() => router.push("/jobs")}
          style={{
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 24px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          求人一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>
        {jobTitle}に応募する
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label
            style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}
          >
            お名前 <span style={{ color: "#cf1322" }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="山田 太郎"
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}
          >
            メールアドレス <span style={{ color: "#cf1322" }}>*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="taro@example.com"
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}
          >
            電話番号
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="090-0000-0000"
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}
          >
            志望動機・メッセージ
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="この求人に応募した理由や、自己PRをご記入ください"
            rows={4}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              fontSize: 14,
              resize: "vertical",
              lineHeight: 1.7,
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!form.name || !form.email || submitting}
          style={{
            width: "100%",
            padding: "14px",
            background: "#2d7a4f",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: form.name && form.email ? "pointer" : "not-allowed",
            opacity: form.name && form.email ? 1 : 0.4,
          }}
        >
          {submitting ? "送信中..." : "この求人に応募する"}
        </button>

        <p
          style={{
            fontSize: 12,
            color: "#aaa",
            textAlign: "center",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          応募後、Opinioが内容を確認し
          <br />
          3営業日以内にご連絡します
        </p>
      </div>
    </div>
  );
}
