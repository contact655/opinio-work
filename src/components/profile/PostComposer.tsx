"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 500;

export function PostComposer({
  avatarColor,
  initial,
  avatarUrl,
}: {
  avatarColor: string;
  initial: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = MAX - content.length;
  const canSubmit = content.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    // ⚠️ 投稿の作成口は /api/jobseeker/posts に一本化してある（2026-08-05）。
    //    以前ここだけ /api/posts を叩いており、rate limit も文字数チェックも無かった。
    //    ルート名が jobseeker 配下なのは、company_members だけが投稿できる現状と
    //    合っていない。リネームは影響範囲が読めないので今回は据え置き。
    const res = await fetch("/api/jobseeker/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSubmitting(false);
    if (res.ok) {
      setContent("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "投稿に失敗しました");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--bg-tint)",
        border: "1.5px solid var(--line)",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: avatarUrl ? undefined : avatarColor,
          overflow: avatarUrl ? "hidden" : "visible",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, color: "#fff",
        }}>
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            : initial}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            placeholder="今考えていることや、業界の知見をシェアしましょう..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1.5px solid var(--line)",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--ink)",
              background: "#fff",
              resize: "vertical",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
              color: remaining < 50 ? "var(--error)" : "var(--ink-mute)",
              fontWeight: remaining < 50 ? 700 : 400,
            }}>
              {remaining < 100 ? `あと${remaining}文字` : ""}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {error && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</span>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: "7px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: canSubmit
                    ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
                    : "var(--line)",
                  color: canSubmit ? "#fff" : "var(--ink-mute)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "投稿中…" : "投稿する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
