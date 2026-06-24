"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SKILL_SUGGESTIONS = [
  "Salesforce", "HubSpot", "Marketo", "Tableau", "Looker",
  "Python", "SQL", "TypeScript", "JavaScript", "React", "Node.js",
  "AWS", "GCP", "Azure",
  "エンタープライズ営業", "インサイドセールス", "フィールドセールス",
  "カスタマーサクセス", "マーケティング", "データ分析",
  "プロダクトマネジメント", "プロジェクト管理", "コンサルティング",
  "採用/HR", "コーチング", "ビジネス開発",
];

type Props = {
  initialName: string;
  initialAboutMe: string;
  initialSkills: string[];
};

export default function ProfileStartClient({ initialName, initialAboutMe, initialSkills }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [aboutMe, setAboutMe] = useState(initialAboutMe);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [customSkill, setCustomSkill] = useState("");
  const [error, setError] = useState<string | null>(null);

  const MAX_SKILLS = 3;

  function toggleSkill(label: string) {
    setSkills((prev) => {
      if (prev.includes(label)) return prev.filter((s) => s !== label);
      if (prev.length >= MAX_SKILLS) return prev;
      return [...prev, label];
    });
  }

  function addCustomSkill() {
    const trimmed = customSkill.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    if (skills.length >= MAX_SKILLS) return;
    setSkills((prev) => [...prev, trimmed]);
    setCustomSkill("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("名前を入力してください。"); return; }
    if (!aboutMe.trim()) { setError("自己紹介を入力してください。"); return; }
    if (skills.length === 0) { setError("スキルを1つ以上選んでください。"); return; }

    startTransition(async () => {
      try {
        // 1. プロフィール基本情報 + profile_setup_at を保存
        const profileRes = await fetch("/api/jobseeker/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            about_me: aboutMe.trim(),
            profile_setup_at: new Date().toISOString(),
          }),
        });
        if (!profileRes.ok) throw new Error("プロフィールの保存に失敗しました。");

        // 2. スキルタグを順番に登録（既存タグはスキップ）
        for (const label of skills) {
          await fetch("/api/jobseeker/skill-tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, category: null }),
          }).catch(() => {}); // 重複エラーは無視
        }

        router.push("/mypage?setup=done");
      } catch (err) {
        setError((err as Error).message ?? "エラーが発生しました。");
      }
    });
  }

  const remainingSkills = MAX_SKILLS - skills.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ヘッダーバー */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--line)",
        padding: "14px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-noto-serif)", fontWeight: 800, fontSize: 18, color: "var(--royal)" }}>
            OPINIO
          </span>
        </Link>
        <Link href="/profile/edit" style={{
          fontSize: 12, color: "var(--ink-mute)", textDecoration: "none",
        }}>
          詳しく編集する →
        </Link>
      </div>

      {/* メインフォーム */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ページタイトル */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "var(--royal-50)", color: "var(--royal)",
            fontSize: 11, fontWeight: 700, padding: "4px 12px",
            borderRadius: 100, letterSpacing: "0.06em", marginBottom: 12,
          }}>
            3つの入力だけ
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 800,
            color: "var(--ink)", margin: 0, lineHeight: 1.4,
          }}>
            プロフィールを公開しましょう
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.7 }}>
            名前・自己紹介・スキルの3つを入力するだけで<br />
            企業やメンターに見つけてもらえる状態になります。
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── 名前 ── */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", border: "1px solid var(--line)" }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 700,
              color: "var(--royal)", marginBottom: 8, letterSpacing: "0.04em",
            }}>
              名前 <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：柴 久人"
              maxLength={50}
              style={{
                width: "100%", padding: "12px 14px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontSize: 15, color: "var(--ink)", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* ── 自己紹介 ── */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", border: "1px solid var(--line)" }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 700,
              color: "var(--royal)", marginBottom: 6, letterSpacing: "0.04em",
            }}>
              自己紹介 <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>
            </label>
            <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 0, marginBottom: 10 }}>
              キャリアや強み、今関心のあることを簡単に書いてください。
            </p>
            <textarea
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              placeholder="例：リクルートで営業を4年経験した後、Salesforceのカスタマーサクセスに転職。SaaS企業での組織づくりや顧客成功に関心があります。"
              rows={4}
              maxLength={200}
              style={{
                width: "100%", padding: "12px 14px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontSize: 14, color: "var(--ink)", outline: "none",
                resize: "vertical", boxSizing: "border-box", lineHeight: 1.7,
              }}
            />
            <div style={{ textAlign: "right", fontSize: 11, color: aboutMe.length > 180 ? "var(--warm)" : "var(--ink-mute)", marginTop: 4 }}>
              {aboutMe.length}/200字
            </div>
          </div>

          {/* ── スキルタグ（最大3つ） ── */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", border: "1px solid var(--line)" }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 700,
              color: "var(--royal)", marginBottom: 6, letterSpacing: "0.04em",
            }}>
              スキル・専門領域 <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>
            </label>
            <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 0, marginBottom: 14 }}>
              最大3つ選択。あとで変更できます。
            </p>

            {/* 選択済みスキル */}
            {skills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {skills.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => toggleSkill(s)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 10px 5px 12px", borderRadius: 100,
                      background: "var(--royal)", color: "#fff",
                      fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                    }}
                  >
                    {s}
                    <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {/* サジェストチップ */}
            {remainingSkills > 0 && (
              <>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 8 }}>
                  あと{remainingSkills}つ選べます：
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).map((s) => (
                    <button
                      key={s} type="button"
                      onClick={() => toggleSkill(s)}
                      style={{
                        padding: "5px 12px", borderRadius: 100,
                        background: "var(--royal-50)", color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* カスタム入力 */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                    placeholder="上にない場合は入力..."
                    maxLength={30}
                    style={{
                      flex: 1, padding: "9px 12px",
                      border: "1.5px solid var(--line)", borderRadius: 8,
                      fontSize: 13, outline: "none",
                    }}
                  />
                  <button
                    type="button" onClick={addCustomSkill}
                    disabled={!customSkill.trim()}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      background: customSkill.trim() ? "var(--royal-50)" : "var(--line-soft)",
                      color: customSkill.trim() ? "var(--royal)" : "var(--ink-mute)",
                      border: "1px solid var(--royal-100)",
                      fontSize: 12, fontWeight: 700, cursor: customSkill.trim() ? "pointer" : "default",
                    }}
                  >
                    追加
                  </button>
                </div>
              </>
            )}
          </div>

          {/* エラー */}
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 10,
              background: "var(--error-soft)", color: "var(--error)",
              fontSize: 13, fontWeight: 600, border: "1px solid #FECACA",
            }}>
              {error}
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: "100%",
              padding: "16px 24px",
              background: isPending
                ? "var(--ink-mute)"
                : "linear-gradient(135deg, var(--royal) 0%, #1a3a8f 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              cursor: isPending ? "default" : "pointer",
              boxShadow: isPending ? "none" : "0 4px 20px rgba(0,35,102,0.3)",
              transition: "all 0.15s",
              letterSpacing: "0.02em",
            }}
          >
            {isPending ? "保存中..." : "プロフィールを公開する →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", margin: 0 }}>
            あとで詳しく編集できます。まずはこの3つだけで大丈夫です。
          </p>
        </form>
      </div>
    </div>
  );
}
