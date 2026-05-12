"use client";

import { useEffect, useState } from "react";

// デフォルトのロゴグラデーション(紺紫系、既存 ow_schools の雰囲気に合わせる)
const DEFAULT_GRADIENT = "linear-gradient(135deg, #4A4A7A, #6A5A8A)";

type SchoolRequest = {
  id: string;
  school_name: string;
  school_name_kana: string | null;
};

type Props = {
  request: SchoolRequest;
  onClose: () => void;
  onSuccess: () => void;
};

/**
 * 学校追加リクエスト承認モーダル
 *
 * - logo_letter / logo_gradient を入力して POST approve を呼び出す
 * - デフォルト: logo_letter = school_name の最初の 1 文字
 * - プレビュー: 入力値をリアルタイムに反映する簡易表示
 * - Escape キー / 背景クリックでキャンセル
 */
export default function ApproveSchoolRequestModal({
  request,
  onClose,
  onSuccess,
}: Props) {
  const [logoLetter, setLogoLetter] = useState(
    request.school_name.charAt(0) || "校"
  );
  const [logoGradient, setLogoGradient] = useState(DEFAULT_GRADIENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Escape キーでキャンセル
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [submitting, onClose]);

  const handleSubmit = async () => {
    if (!logoLetter.trim() || !logoGradient.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/school-requests/${request.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo_letter: logoLetter.trim(),
            logo_gradient: logoGradient.trim(),
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          (body as { error?: string }).error ?? "承認に失敗しました"
        );
        setSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setError("ネットワークエラーが発生しました");
      setSubmitting(false);
    }
  };

  const canSubmit = logoLetter.trim().length > 0 && logoGradient.trim().length > 0 && !submitting;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 背景オーバーレイ */}
      <div
        onClick={submitting ? undefined : onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,42,0.45)",
          backdropFilter: "blur(2px)",
          cursor: submitting ? "default" : "pointer",
        }}
      />

      {/* モーダルパネル */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 24px",
          maxWidth: 440,
          width: "calc(100% - 48px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* ヘッダー */}
        <p
          id="approve-modal-title"
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 6,
            fontFamily: "inherit",
          }}
        >
          学校を承認する
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            marginBottom: 20,
            fontFamily: "inherit",
          }}
        >
          「{request.school_name}」を学校マスターに追加します
        </p>

        {/* フォーム */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* logo_letter */}
          <div>
            <label
              htmlFor="logo-letter"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-soft)",
                marginBottom: 6,
                fontFamily: "inherit",
              }}
            >
              ロゴ文字（1 文字推奨）
            </label>
            <input
              id="logo-letter"
              type="text"
              value={logoLetter}
              onChange={(e) => setLogoLetter(e.target.value)}
              maxLength={3}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--ink)",
                fontFamily: "inherit",
                background: submitting ? "var(--bg-tint)" : "#fff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* logo_gradient */}
          <div>
            <label
              htmlFor="logo-gradient"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-soft)",
                marginBottom: 6,
                fontFamily: "inherit",
              }}
            >
              ロゴ背景（CSS gradient）
            </label>
            <input
              id="logo-gradient"
              type="text"
              value={logoGradient}
              onChange={(e) => setLogoGradient(e.target.value)}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ink)",
                fontFamily: "monospace",
                background: submitting ? "var(--bg-tint)" : "#fff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* プレビュー */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: "var(--bg-tint)",
              borderRadius: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                fontFamily: "inherit",
              }}
            >
              プレビュー
            </span>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
                background: logoGradient,
                flexShrink: 0,
              }}
            >
              {logoLetter || "？"}
            </div>
            <span
              style={{
                fontSize: 13,
                color: "var(--ink)",
                fontFamily: "inherit",
              }}
            >
              {request.school_name}
            </span>
          </div>

          {/* エラー表示 */}
          {error && (
            <p
              style={{
                fontSize: 12,
                color: "var(--error)",
                fontFamily: "inherit",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* アクションボタン */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 22,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "8px 20px",
              background: canSubmit ? "var(--royal)" : "var(--line)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {submitting ? "承認中…" : "承認する"}
          </button>
        </div>
      </div>
    </div>
  );
}
