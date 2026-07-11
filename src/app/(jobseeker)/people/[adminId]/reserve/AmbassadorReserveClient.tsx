"use client";

import { useState } from "react";
import Link from "next/link";

const DAY_OPTIONS = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"];
const TIME_OPTIONS = ["朝（9〜11時）", "昼（11〜13時）", "午後（13〜17時）", "夕方（17〜19時）", "夜（19〜21時）"];

type Props = {
  adminId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  companyName: string;
  talkThemes: string[];
};

export function AmbassadorReserveClient({ adminId, name, initial, gradient, avatarUrl, roleTitle, companyName, talkThemes }: Props) {
  const [themes, setThemes] = useState<string[]>([]);
  const [situation, setSituation] = useState("");
  const [questions, setQuestions] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  function toggleSet<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (themes.length === 0) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/ambassador-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, themes, situation, questions, contactEmail, preferredDays, preferredTimes }),
      });
      if (res.status === 401) {
        window.location.href = `/auth?next=/people/${adminId}/reserve`;
        return;
      }
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ヘッダーバナー */}
      <div style={{ background: "linear-gradient(155deg, #001233 0%, #002366 60%, #1a3569 100%)", padding: "48px 24px 40px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link href="/people" style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
            ← 先輩一覧に戻る
          </Link>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.3)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", border: "3px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
                {initial}
              </div>
            )}
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "0 0 4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>話を聞きたい先輩</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 4px", fontFamily: "'Noto Serif JP', serif" }}>{name}</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                {companyName}{roleTitle ? ` · ${roleTitle}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        {status === "done" ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 32px", textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
              リクエストを送りました！
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 28 }}>
              編集部で確認後、<strong>2〜3営業日以内</strong>に<br />
              ご登録のメールアドレスへご連絡します。
            </p>
            <Link href="/people" style={{ display: "inline-block", padding: "12px 32px", background: "var(--royal)", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              先輩一覧に戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "32px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* 相談テーマ */}
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  相談したいテーマ <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 12px" }}>1つ以上選んでください</p>
                {talkThemes.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {talkThemes.map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => setThemes(toggleSet(themes, t))}
                        style={{
                          padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
                          border: themes.includes(t) ? "2px solid var(--royal)" : "2px solid var(--line)",
                          background: themes.includes(t) ? "var(--royal-50)" : "#fff",
                          color: themes.includes(t) ? "var(--royal)" : "var(--ink-soft)",
                          transition: "all 0.15s",
                        }}
                      >{t}</button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["転職・キャリアの相談", "職場環境・文化について", "仕事内容・やりがい", "選考・面接対策", "給与・待遇について"].map((t) => (
                      <button
                        key={t} type="button"
                        onClick={() => setThemes(toggleSet(themes, t))}
                        style={{
                          padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
                          border: themes.includes(t) ? "2px solid var(--royal)" : "2px solid var(--line)",
                          background: themes.includes(t) ? "var(--royal-50)" : "#fff",
                          color: themes.includes(t) ? "var(--royal)" : "var(--ink-soft)",
                          transition: "all 0.15s",
                        }}
                      >{t}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 現在の状況 */}
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  現在の状況
                </label>
                <textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  rows={3}
                  placeholder={`例：現在は事業会社でマーケティングを担当しています。SaaS企業への転職を検討していますが、実際の業務内容や文化が気になっています。`}
                  style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
                />
              </div>

              {/* 聞きたいこと */}
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  具体的に聞きたいこと
                </label>
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  rows={3}
                  placeholder="例：入社前後でのギャップ、チームの雰囲気、どんな人が活躍しているか など"
                  style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
                />
              </div>

              {/* 希望日程 */}
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                  都合のよい曜日（任意）
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DAY_OPTIONS.map((d) => (
                    <button key={d} type="button"
                      onClick={() => setPreferredDays(toggleSet(preferredDays, d))}
                      style={{
                        padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: preferredDays.includes(d) ? "2px solid var(--royal)" : "1.5px solid var(--line)",
                        background: preferredDays.includes(d) ? "var(--royal-50)" : "#fff",
                        color: preferredDays.includes(d) ? "var(--royal)" : "var(--ink-soft)",
                      }}
                    >{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                  都合のよい時間帯（任意）
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TIME_OPTIONS.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setPreferredTimes(toggleSet(preferredTimes, t))}
                      style={{
                        padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: preferredTimes.includes(t) ? "2px solid var(--royal)" : "1.5px solid var(--line)",
                        background: preferredTimes.includes(t) ? "var(--royal-50)" : "#fff",
                        color: preferredTimes.includes(t) ? "var(--royal)" : "var(--ink-soft)",
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* 連絡先メール */}
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  連絡先メールアドレス <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <input
                  type="email" required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", boxSizing: "border-box" }}
                />
              </div>

              {status === "error" && (
                <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>
                  送信に失敗しました。時間をおいて再度お試しいただくか、contact@opinio.co.jp までご連絡ください。
                </p>
              )}

              <div>
                <button
                  type="submit"
                  disabled={status === "sending" || themes.length === 0}
                  style={{
                    width: "100%", padding: "14px 20px",
                    background: themes.length === 0 ? "var(--line)" : "linear-gradient(135deg, #F59E0B, #F97316)",
                    color: themes.length === 0 ? "var(--ink-mute)" : "#fff",
                    border: "none", borderRadius: 10,
                    fontSize: 15, fontWeight: 800, cursor: themes.length === 0 ? "default" : "pointer",
                    transition: "opacity 0.15s",
                  }}
                >
                  {status === "sending" ? "送信中..." : "相談リクエストを送る →"}
                </button>
                <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", marginTop: 10, lineHeight: 1.7 }}>
                  完全無料・OPINIO編集部が確認してからご連絡します<br />
                  送信することで<Link href="/privacy" style={{ color: "var(--royal)" }}>プライバシーポリシー</Link>に同意したものとみなします。
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
