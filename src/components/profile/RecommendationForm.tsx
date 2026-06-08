"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RELATIONSHIP_OPTIONS = [
  { value: "", label: "関係を選択（任意）" },
  { value: "colleague", label: "同僚" },
  { value: "manager", label: "上司（相手が部下）" },
  { value: "report", label: "部下（相手が上司）" },
  { value: "client", label: "顧客・取引先" },
  { value: "mentor", label: "メンター" },
  { value: "other", label: "その他" },
];

const MAX = 1000;

export function RecommendationForm({
  targetUserId,
  targetName,
  defaultName,
  defaultTitle,
  defaultCompany,
}: {
  targetUserId: string;
  targetName: string;
  defaultName: string;
  defaultTitle?: string;
  defaultCompany?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [company, setCompany] = useState(defaultCompany ?? "");
  const [relationship, setRelationship] = useState("");
  const [content, setContent] = useState("");

  const remaining = MAX - content.length;
  const canSubmit = name.trim().length > 0 && content.trim().length >= 10 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: targetUserId,
        recommender_name: name,
        recommender_title: title || null,
        recommender_company: company || null,
        relationship: relationship || null,
        content,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "送信に失敗しました");
    }
  }

  if (submitted) {
    return (
      <div style={{
        padding: "20px 24px", borderRadius: 12, textAlign: "center",
        background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
        border: "1px solid #A7F3D0",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>
          推薦文を送信しました！
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {targetName}さんのプロフィールに表示されます
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", padding: "14px 20px",
          borderRadius: 12, border: "1.5px dashed var(--royal-100)",
          background: "var(--royal-50)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 14, fontWeight: 700, color: "var(--royal)",
          fontFamily: "inherit", transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--royal-100)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--royal-50)"; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        {targetName}さんへ推薦文を書く
      </button>
    );
  }

  return (
    <div style={{
      borderRadius: 12, border: "1.5px solid var(--royal-100)",
      background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          推薦文を書く
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* あなたの情報 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4, letterSpacing: "0.04em" }}>
              お名前 <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              required
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 7,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4, letterSpacing: "0.04em" }}>
              職種・役職（任意）
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="プロダクトマネージャー"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 7,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4, letterSpacing: "0.04em" }}>
              会社・組織（任意）
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="株式会社〇〇"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 7,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4, letterSpacing: "0.04em" }}>
              関係性（任意）
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 7,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
                outline: "none", appearance: "auto",
              }}
            >
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 推薦文本文 */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4, letterSpacing: "0.04em" }}>
            推薦文 <span style={{ color: "var(--error)" }}>*</span>
            <span style={{ fontWeight: 400, marginLeft: 6 }}>（10〜1000文字）</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX))}
            placeholder={`${targetName}さんと一緒に働いた経験から、特に印象的だったことや強みを教えてください...`}
            rows={5}
            required
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 7,
              border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
              background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
              outline: "none", resize: "vertical", lineHeight: 1.7,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: content.length < 10 ? "var(--error)" : "var(--ink-mute)" }}>
              {content.length < 10 ? `あと${10 - content.length}文字` : ""}
            </span>
            <span style={{ fontSize: 11, color: remaining < 100 ? "var(--error)" : "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
              {remaining < 200 ? `${remaining}文字残り` : ""}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "var(--error)", padding: "8px 12px", background: "#FEE2E2", borderRadius: 7 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              padding: "9px 18px", borderRadius: 8,
              border: "1.5px solid var(--line)", background: "#fff",
              color: "var(--ink-soft)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "9px 22px", borderRadius: 8, border: "none",
              background: canSubmit
                ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
                : "var(--line)",
              color: canSubmit ? "#fff" : "var(--ink-mute)",
              fontSize: 13, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            {submitting ? "送信中…" : "推薦文を送信する"}
          </button>
        </div>
      </form>
    </div>
  );
}
