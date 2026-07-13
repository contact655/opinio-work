"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ログイン済みで scout_enabled = null の求職者にスカウト設定を促すモーダル。
// セッション内で「あとで決める」を押した場合は sessionStorage に記録して非表示にする。
// 次回ログイン（新しいセッション）では再表示される。
export function ScoutPromptModal() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState<boolean>(true); // デフォルト「受け取る」
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // onboarding / auth 画面では表示しない
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth")) return;
    // このセッションで「あとで決める」を押した場合はスキップ
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("scout_prompt_dismissed")) return;

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("scout_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      // scout_enabled が null（未設定）の場合のみ表示
      if (profile && profile.scout_enabled === null) {
        setShow(true);
      }
    }).catch(() => {});
  }, [pathname]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/jobseeker/scout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_enabled: selected }),
      });
      setSaved(true);
      setTimeout(() => setShow(false), 800);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }, [selected]);

  const handleDismiss = useCallback(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("scout_prompt_dismissed", "1");
    }
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <>
      {/* オーバーレイ：クリックしても閉じない */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
      }} />

      {/* モーダル本体 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scout-prompt-title"
        style={{
          position: "fixed", inset: 0, zIndex: 1001,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
      >
        <div style={{
          background: "#fff", borderRadius: 16, padding: "32px 28px",
          maxWidth: 440, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}>
          {/* ヘッダー */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 100, marginBottom: 12,
              background: "linear-gradient(135deg, var(--royal-50), #ede9fe)",
              border: "1px solid var(--royal-100)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l1.27-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--royal)" }}>スカウト機能が追加されました</span>
            </div>
            <h2 id="scout-prompt-title" style={{
              fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 8, lineHeight: 1.4,
            }}>
              企業からのスカウトを<br />受け取りますか?
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              設定をお選びください。あとから変更できます。
            </p>
          </div>

          {/* 選択肢 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {/* 受け取る */}
            <div
              role="radio"
              aria-checked={selected === true}
              onClick={() => setSelected(true)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                background: selected === true ? "var(--royal-50)" : "var(--bg-tint)",
                border: `1.5px solid ${selected === true ? "var(--royal)" : "var(--line)"}`,
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                border: `2px solid ${selected === true ? "var(--royal)" : "var(--line)"}`,
                background: selected === true ? "var(--royal)" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selected === true && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>受け取る（推奨）</div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5 }}>
                  企業があなたのプロフィールを見て、直接連絡できるようになります
                </div>
              </div>
            </div>

            {/* 受け取らない */}
            <div
              role="radio"
              aria-checked={selected === false}
              onClick={() => setSelected(false)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                background: selected === false ? "var(--bg-tint)" : "#fff",
                border: `1.5px solid ${selected === false ? "var(--ink-mute)" : "var(--line)"}`,
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                border: `2px solid ${selected === false ? "var(--ink-mute)" : "var(--line)"}`,
                background: selected === false ? "var(--ink-mute)" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selected === false && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>受け取らない</div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5 }}>
                  企業からは一切見えません
                </div>
              </div>
            </div>
          </div>

          {/* 在籍企業ブロックの説明 */}
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 20,
            background: "var(--success-soft)", border: "1px solid #a7f3d0",
          }}>
            <div style={{ fontSize: 12, color: "#065F46", lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>✓ 今の会社・過去に在籍した会社からは、自動的にブロックされます。</span><br />
              職務経歴に登録した企業には見えません。設定は不要です。
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 20, textAlign: "center" }}>
            あとから <a href="/profile/edit" style={{ color: "var(--royal)", textDecoration: "underline" }}>プロフィール設定</a> でいつでも変更できます
          </div>

          {/* ボタン */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                width: "100%", padding: "13px", fontSize: 14, fontWeight: 700,
                border: "none", borderRadius: 10, cursor: saving || saved ? "default" : "pointer",
                background: saved
                  ? "var(--success)"
                  : saving
                  ? "var(--ink-mute)"
                  : "linear-gradient(135deg, var(--royal), #3B5FD9)",
                color: "#fff", fontFamily: "inherit", transition: "background 0.2s",
              }}
            >
              {saved ? "✓ 保存しました" : saving ? "保存中…" : "この設定で保存"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                width: "100%", padding: "10px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--line)", borderRadius: 10, cursor: "pointer",
                background: "#fff", color: "var(--ink-soft)", fontFamily: "inherit",
              }}
            >
              あとで決める
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
