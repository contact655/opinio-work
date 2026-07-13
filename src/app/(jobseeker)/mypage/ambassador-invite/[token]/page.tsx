"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";

type InviteInfo = {
  id: string;
  display_consent: boolean;
  is_public: boolean;
  role_title: string | null;
  invited_at: string | null;
  company_id: string;
  company_name: string;
};

export default function AmbassadorInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    fetch(`/api/mypage/ambassador-invite?token=${token}`)
      .then(async (r) => {
        if (r.status === 401) {
          router.push(`/auth?next=/mypage/ambassador-invite/${token}`);
          return;
        }
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "エラーが発生しました");
          setLoading(false);
          return;
        }
        setInfo(data);
        setRoleTitle(data.role_title ?? "");
        setLoading(false);
      })
      .catch(() => {
        setError("通信エラーが発生しました");
        setLoading(false);
      });
  }, [token, router]);

  async function handleSubmit(accept: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/mypage/ambassador-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accept, role_title: roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        setSubmitting(false);
        return;
      }
      setDone(accept ? "accepted" : "declined");
    } catch {
      setError("通信エラーが発生しました");
      setSubmitting(false);
    }
  }

  return (
    <>
      <JobseekerHeader />
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "48px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>

          {loading && (
            <div style={{ textAlign: "center", color: "var(--ink-mute)", paddingTop: 64 }}>
              読み込み中...
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: "var(--error-soft)",
              border: "1px solid #fca5a5",
              borderRadius: 12,
              padding: "24px 28px",
              color: "var(--error)",
            }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>エラー</div>
              <div>{error}</div>
            </div>
          )}

          {done === "accepted" && (
            <div style={{
              background: "var(--success-soft)",
              border: "1px solid #6ee7b7",
              borderRadius: 12,
              padding: "32px 28px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--success)", marginBottom: 8 }}>
                承認しました
              </div>
              <div style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
                OPINIOの「話せる人」一覧に表示されます。<br />
                設定はマイページからいつでも変更できます。
              </div>
              <button
                onClick={() => router.push("/mypage")}
                style={{
                  background: "var(--royal)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 28px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                マイページへ
              </button>
            </div>
          )}

          {done === "declined" && (
            <div style={{
              background: "#f8fafc",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "32px 28px",
              textAlign: "center",
            }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: "var(--ink)" }}>
                見送りました
              </div>
              <div style={{ color: "var(--ink-soft)", marginBottom: 24 }}>
                あなたの情報は公開されません。
              </div>
              <button
                onClick={() => router.push("/mypage")}
                style={{
                  background: "var(--line-soft)",
                  color: "var(--ink)",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 28px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                マイページへ
              </button>
            </div>
          )}

          {info && done === null && !loading && (
            <div style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "36px 32px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}>
              <div style={{
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>🏢</span>
                <span style={{ fontWeight: 700, color: "var(--royal)", fontSize: 15 }}>
                  {info.company_name}
                </span>
              </div>

              <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px" }}>
                面談対応者に選ばれました
              </h1>
              <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "0 0 24px", lineHeight: 1.7 }}>
                {info.company_name}の採用担当者から、あなたをOPINIOの「面談対応者」に指名する申請がありました。
              </p>

              <div style={{
                background: "var(--bg-tint)",
                borderRadius: 10,
                padding: "16px 20px",
                marginBottom: 24,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>
                  面談対応者になると：
                </div>
                {[
                  "「話せる人」一覧にあなたのプロフィールが表示されます",
                  "転職を検討している方から、カジュアル面談の申込みが届きます",
                  "あなたの氏名・役職・所属企業が公開されます",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ color: "var(--royal)", fontWeight: 700, flexShrink: 0 }}>・</span>
                    <span style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 6 }}>
                  役職（公開されます）
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="例：バックエンドエンジニア"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1.5px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "var(--ink)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
                  ※ 採用担当者が入力した内容です。変更できます。
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting || !roleTitle.trim()}
                  style={{
                    flex: 1,
                    background: submitting || !roleTitle.trim() ? "#94a3b8" : "var(--royal)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "13px 0",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: submitting || !roleTitle.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "処理中..." : "承認する"}
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: "#fff",
                    color: "var(--ink-soft)",
                    border: "1.5px solid var(--line)",
                    borderRadius: 8,
                    padding: "13px 0",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  今回は見送る
                </button>
              </div>

              <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                ※ 承認後も、いつでも設定を解除できます。<br />
                ※ 管理画面へのアクセス権は付与されません。
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
