"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAREER_STANCES } from "@/lib/constants/careerPreferences";

/**
 * 「転職について」を1問だけ聞く画面（2026-08-27 / フェーズ3）。
 *
 * ⚠️★**スキップを置かない。** 未設定を無くすための画面なので、
 *    「あとで」を作った瞬間に存在意義が消える。
 *
 * ⚠️ **選ぶ前に「何が決まるのか」を書く。** この答えでスカウトが届くかどうかが変わる。
 *    書かずに選ばせると、企業に開示される設定を本人が知らないまま決めることになる。
 *
 * ⚠️ 「スカウト」という語を本文に出さない（`/mypage` の意思表示カードと同じ方針）。
 *    送る側の意図は受け手には判断できないので、軸を**「相手が誰か」**にしている。
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            転職について、いまの気持ちに近いものは？
          </h1>
          {/* ⚠️ 何が決まるのかを**選ぶ前に**書く。消さないこと。 */}
          <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
            この答えで、<strong style={{ color: "var(--ink)" }}>企業の採用担当から声をかけられるかどうか</strong>が決まります。
            あとから何度でも変えられます。
            <br />
            いま在籍している会社と、職歴に書いた会社からは、答えにかかわらず届きません。
          </p>

          <div role="radiogroup" aria-label="転職について" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CAREER_STANCES.map((o) => {
              const on = stance === o.value;
              return (
                <label
                  key={o.value}
                  className="tap-min-h"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    padding: "12px 14px", borderRadius: 12,
                    border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`,
                    background: on ? "var(--royal-50)" : "#fff",
                  }}
                >
                  <input
                    type="radio"
                    name="career-stance"
                    value={o.value}
                    checked={on}
                    onChange={() => setStance(o.value)}
                  />
                  <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: "var(--ink)" }}>
                    {o.label}
                  </span>
                </label>
              );
            })}
          </div>

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
