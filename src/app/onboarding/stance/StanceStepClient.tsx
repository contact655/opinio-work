"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StanceQuestion } from "@/components/onboarding/StanceQuestion";

/**
 * 「転職について」を1問だけ聞く画面（2026-08-27 / フェーズ3）。
 *
 * ⚠️★**問い・説明・選択肢はここに書かない。** 実体は
 *    [components/onboarding/StanceQuestion](src/components/onboarding/StanceQuestion.tsx)。
 *    **登録の途中（`/onboarding` の2／3）と同じ部品**を使っている。
 *    ⚠️★**「入口が2つあるのは重複だ」と読まないこと。** なぜ2つ要るかは
 *       あの部品の冒頭に書いてある。**実装は1つ、入口が2つ。**
 *
 * ⚠️★**スキップを置かない。** 未設定を無くすための画面なので、
 *    「あとで」を作った瞬間に存在意義が消える。
 *
 * ⚠️ 保存は `PUT /api/jobseeker/career-preferences`。**新しいルートを作らない。**
 *    同じ列を書く経路が2つになる（CLAUDE.md ルール⑧）。
 *    このルートは `career_stance` が変わったときだけ `stance_updated_at` も打つ。
 */
export default function StanceStepClient({ next }: { next: string }) {
  const router = useRouter();
  const [stance, setStance] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!stance || saving) return;
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/jobseeker/career-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ career_stance: stance }),
        });
        if (!res.ok) {
          /* ⚠️ API はキー名入りの文言を返す。丸めない */
          const json = await res.json().catch(() => null);
          throw new Error((json && typeof json.error === "string" && json.error) || "");
        }
        /* ⚠️ `replace` にする。戻るボタンでこの画面に戻れると、
              答えたのにまた聞かれたように見える（サーバー側は `next` へ送り返す）。 */
        router.replace(next);
      } catch (e) {
        setError(
          e instanceof Error && e.message
            ? `保存できませんでした（${e.message}）`
            : "保存できませんでした。もう一度お試しください。",
        );
        setSaving(false);
      }
    })();
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg-tint)",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--royal)" }}>
            OPINIO
          </span>
        </div>

        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 20, padding: "32px 28px", boxShadow: "var(--shadow-md)",
        }}>
          <StanceQuestion value={stance} onChange={setStance} headingTag="h1" disabled={saving} />

          {error && (
            <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 600, color: "var(--error)" }}>{error}</p>
          )}

          {/* ⚠️ 選ぶまで押せない。**既定値で先へ進めない**ことが、この画面の要件そのもの。 */}
          <button
            type="button"
            disabled={!stance || saving}
            onClick={submit}
            style={{
              width: "100%", height: 48, marginTop: 20, borderRadius: 12,
              border: "none", fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              background: stance ? "var(--royal)" : "var(--line)",
              color: stance ? "#fff" : "var(--ink-mute)",
              cursor: !stance || saving ? "default" : "pointer",
            }}
          >
            {saving ? "保存中…" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
