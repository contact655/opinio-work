"use client";

import { useEffect, useMemo, useState } from "react";
import SchoolLogoImg from "@/components/profile/SchoolLogoImg";
import { SCHOOL_LOGO_GRADIENT_PRESETS } from "@/lib/logoPresets";

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

  // logo_letter 候補チップ: 先頭1文字 + 先頭2文字(school_name から静的生成)
  const letterCandidates = useMemo(() => {
    const name = request.school_name.trim();
    if (!name) return [];
    const first = name.charAt(0);
    const firstTwo = name.length >= 2 ? name.slice(0, 2) : null;
    return firstTwo ? [first, firstTwo] : [first];
  }, [request.school_name]);

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
            {/* 候補チップ(先頭1文字 + 先頭2文字) */}
            {letterCandidates.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {letterCandidates.map((candidate) => {
                  const isSelected = logoLetter === candidate;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => setLogoLetter(candidate)}
                      disabled={submitting}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: isSelected
                          ? "1px solid var(--royal)"
                          : "1px solid var(--ink-mute)",
                        background: isSelected ? "var(--royal-50)" : "transparent",
                        color: isSelected ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 400,
                        cursor: submitting ? "default" : "pointer",
                        fontFamily: "inherit",
                        transition: "background 0.1s, color 0.1s",
                      }}
                    >
                      {candidate}
                    </button>
                  );
                })}
              </div>
            )}
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
            {/* プリセットスウォッチ(4列 × 2行) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 32px)",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {SCHOOL_LOGO_GRADIENT_PRESETS.map((preset) => {
                const isSelected = logoGradient === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => setLogoGradient(preset.value)}
                    disabled={submitting}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: preset.value,
                      border: isSelected
                        ? "2px solid var(--royal)"
                        : "2px solid transparent",
                      boxShadow: isSelected
                        ? "0 0 0 2px #fff, 0 0 0 4px var(--royal)"
                        : "0 1px 3px rgba(0,0,0,0.2)",
                      cursor: submitting ? "default" : "pointer",
                      padding: 0,
                      flexShrink: 0,
                      transition: "box-shadow 0.1s",
                    }}
                    aria-label={preset.label}
                    aria-pressed={isSelected}
                  />
                );
              })}
            </div>
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
            <SchoolLogoImg
              schoolMaster={{
                logo_url: null,
                logo_letter: logoLetter,
                logo_gradient: logoGradient,
              }}
              size={44}
            />
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
