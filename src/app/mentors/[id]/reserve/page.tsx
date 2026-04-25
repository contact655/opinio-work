"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MOCK_MENTORS } from "../../mockMentorData";
import { MOCK_PROFILE } from "../../../profile/edit/mockProfileData";

// ─── Icons ────────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ─── Success Modal ─────────────────────────────────────────────────────────────

function SuccessModal({ mentorName, onClose }: { mentorName: string; onClose: () => void }) {
  const steps = [
    { label: "申請完了", note: "今ここ" },
    { label: "編集部が内容を確認", note: "〜2営業日" },
    { label: "メンターが承認", note: "〜5営業日" },
    { label: "日程調整（メール）", note: "メールで届きます" },
    { label: "30分の対話", note: "オンライン" },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "44px 40px",
        maxWidth: 500, width: "100%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
      }}>
        <div style={{ color: "var(--success)", marginBottom: 16 }}>
          <CheckCircleIcon />
        </div>
        <div style={{
          fontFamily: '"Noto Serif JP", serif', fontSize: 21, fontWeight: 600,
          color: "var(--ink)", marginBottom: 10, lineHeight: 1.5,
        }}>
          申込を受け付けました
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 24 }}>
          <strong style={{ color: "var(--ink)" }}>{mentorName}さん</strong> への相談申請が完了しました。<br />
          編集部が内容を確認後、メンターへ転送します。<br />
          マイページで申込状況を確認できます。
        </p>

        {/* 5-step flow */}
        <div style={{
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left",
        }}>
          {steps.map(({ label, note }, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "7px 0",
              borderBottom: i < steps.length - 1 ? "1px dashed var(--line)" : "none",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "var(--royal)" : "var(--line)",
                color: i === 0 ? "#fff" : "var(--ink-mute)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontFamily: "Inter, sans-serif", fontWeight: 700,
              }}>
                {i === 0 ? <CheckIcon /> : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 12, fontWeight: i === 0 ? 700 : 600,
                  color: i === 0 ? "var(--royal)" : "var(--ink)",
                }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 8 }}>{note}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/mypage" style={{
            flex: 1, padding: "12px 0", background: "var(--royal)", color: "#fff",
            borderRadius: 10, fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none",
          }}>
            マイページで確認 →
          </Link>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 0", background: "var(--bg-tint)", color: "var(--ink-soft)",
            border: "1px solid var(--line)", borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MentorReservePage() {
  const params = useParams();
  const mentorId = params.id as string;
  const mentor = MOCK_MENTORS.find((m) => m.id === mentorId);

  // Form state
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [situation, setSituation] = useState("");
  const [questions, setQuestions] = useState("");
  const [background, setBackground] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [email] = useState(MOCK_PROFILE.email);
  const [tool, setTool] = useState("どちらでも構わない");
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!mentor) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        メンターが見つかりませんでした
      </div>
    );
  }

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) { next.delete(theme); } else { next.add(theme); }
      return next;
    });
    setErrors((prev) => ({ ...prev, themes: "" }));
  }

  function toggleDay(day: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) { next.delete(day); } else { next.add(day); }
      return next;
    });
  }

  function toggleTime(time: string) {
    setSelectedTimes((prev) => {
      const next = new Set(prev);
      if (next.has(time)) { next.delete(time); } else { next.add(time); }
      return next;
    });
  }

  const canSubmit = selectedThemes.size > 0 && situation.trim() && questions.trim() && email.trim();

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (selectedThemes.size === 0) e.themes = "相談テーマを1つ以上選択してください";
    if (!situation.trim()) e.situation = "現在の状況を入力してください";
    if (!questions.trim()) e.questions = "聞きたいことを入力してください";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // TODO: POST to /api/mentor-reservations when Supabase connected
    setShowModal(true);
  }

  const days = ["月", "火", "水", "木", "金", "土", "日"];
  const times = [
    { key: "morning", label: "MORNING", value: "朝 9-12時" },
    { key: "lunch", label: "LUNCH", value: "昼 12-14時" },
    { key: "afternoon", label: "AFTERNOON", value: "午後 14-18時" },
    { key: "evening", label: "EVENING", value: "夕方 18-20時" },
    { key: "night", label: "NIGHT", value: "夜 20-22時" },
    { key: "late", label: "LATE", value: "深夜 22時以降" },
  ];

  const flowSteps = [
    "申請\n（あなた）",
    "編集部が\n内容を確認",
    "メンター\n承認",
    "日程調整\n（メール）",
    "対話\n（30分）",
  ];

  return (
    <>
      {showModal && (
        <SuccessModal mentorName={mentor.name} onClose={() => setShowModal(false)} />
      )}

      {/* Breadcrumb */}
      <nav style={{
        background: "var(--bg-tint)", padding: "13px 48px",
        borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-mute)",
      }}>
        <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/mentors" style={{ color: "var(--ink-mute)" }}>先輩に相談</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/mentors" style={{ color: "var(--ink-mute)" }}>{mentor.name}さん</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--ink-soft)" }}>相談を予約する</span>
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Page head */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 11, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", padding: "4px 10px",
            borderRadius: 4, letterSpacing: "0.15em", marginBottom: 14,
          }}>
            TALK WITH MENTOR
          </span>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
            fontSize: 30, color: "var(--ink)", lineHeight: 1.5,
            letterSpacing: "0.02em", marginBottom: 10,
          }}>
            {mentor.name}さんに、<br />相談を予約する。
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9 }}>
            30分の対話を予約します。このフォームの内容は<strong>Opinio編集部がまず確認</strong>し、マッチング精度を見てメンターに共有します。<br />
            質の高い対話を保つため、相談内容を事前に丁寧にご記入ください。
          </p>
        </div>

        {/* Mentor card */}
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          display: "grid", gridTemplateColumns: "56px 1fr auto",
          gap: 18, alignItems: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", position: "relative",
            background: mentor.gradient, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 600, fontSize: 22,
            boxShadow: "0 0 0 2.5px var(--royal), 0 0 0 4px #fff",
          }}>
            {mentor.initial}
            <div style={{
              position: "absolute", bottom: -2, right: -2,
              width: 20, height: 20, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--royal), var(--accent))",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff",
            }}>
              <StarIcon />
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.15em", marginBottom: 4,
            }}>
              MENTOR
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
              {mentor.name}さん
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              {mentor.current_company} · {mentor.current_role}
            </div>
          </div>
          <Link href="/mentors" style={{
            color: "var(--royal)", fontSize: 12, fontWeight: 600,
            textDecoration: "none", whiteSpace: "nowrap",
          }}>
            別のメンターを選ぶ →
          </Link>
        </div>

        {/* Flow steps */}
        <div style={{
          background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
          border: "1px solid var(--royal-100)", borderRadius: 14,
          padding: "20px 24px", marginBottom: 40,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: "var(--royal)",
            marginBottom: 4, display: "flex", alignItems: "center", gap: 8,
          }}>
            <ClockIcon />
            予約の流れ
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 14 }}>
            Opinioの相談は、メンターの質を守るため <strong>編集部がまず確認</strong> するプロセスを挟んでいます。<br />
            予約成立まで通常 <strong>2〜5営業日</strong> かかります。
          </p>
          {/* Horizontal steps */}
          <div style={{ display: "flex", gap: 0 }}>
            {flowSteps.map((step, i) => (
              <div key={i} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", textAlign: "center", position: "relative",
              }}>
                {i < flowSteps.length - 1 && (
                  <div style={{
                    position: "absolute", top: 14,
                    left: "calc(50% + 14px)", right: "calc(-50% + 14px)",
                    height: 2, background: "var(--royal-100)", zIndex: 0,
                  }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", zIndex: 1,
                  background: i === 0 ? "var(--royal)" : "#fff",
                  border: i === 0 ? "2px solid var(--royal)" : "2px solid var(--royal-100)",
                  color: i === 0 ? "#fff" : "var(--royal)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
                  marginBottom: 6,
                }}>
                  {i + 1}
                </div>
                <div style={{
                  fontSize: 10, color: "var(--ink-soft)", fontWeight: 600,
                  lineHeight: 1.4, padding: "0 4px", whiteSpace: "pre-line",
                }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STEP 01: Theme selection */}
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "28px 32px", marginBottom: 20,
        }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", padding: "3px 8px",
            borderRadius: 4, letterSpacing: "0.1em", marginBottom: 10,
          }}>
            STEP 01
          </span>
          <h2 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 600,
            color: "var(--ink)", marginBottom: 6,
          }}>
            相談したいテーマを選ぶ
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 20 }}>
            {mentor.name}さんが対応可能なテーマから、あなたが相談したいものを選んでください（複数選択可）。<br />
            マッチングの精度を上げるため、最低1つは選択してください。
          </p>

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              相談テーマ<span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mentor.themes.map((theme) => {
                const active = selectedThemes.has(theme);
                return (
                  <button
                    key={theme}
                    onClick={() => toggleTheme(theme)}
                    style={{
                      padding: "8px 14px", borderRadius: 100,
                      border: active ? "1.5px solid var(--royal)" : "1.5px solid var(--line)",
                      background: active ? "var(--royal)" : "#fff",
                      color: active ? "#fff" : "var(--ink-soft)",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      transition: "all 0.15s",
                    }}
                  >
                    {active && <span style={{ fontSize: 10 }}>✓</span>}
                    {theme}
                  </button>
                );
              })}
            </div>
            {errors.themes && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--error, #DC2626)" }}>{errors.themes}</div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
              ※ メンターごとに提示されるテーマが変わります。ここは{mentor.name}さんの相談可能テーマです。
            </div>
          </div>
        </section>

        {/* STEP 02: Content */}
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "28px 32px", marginBottom: 20,
        }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", padding: "3px 8px",
            borderRadius: 4, letterSpacing: "0.1em", marginBottom: 10,
          }}>
            STEP 02
          </span>
          <h2 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 600,
            color: "var(--ink)", marginBottom: 6,
          }}>
            相談内容の詳細を記入する
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 24 }}>
            30分を有意義に使うため、事前に「現状」「聞きたいこと」を整理してご記入ください。<br />
            ここに書いた内容は、編集部とメンターに共有されます。
          </p>

          {/* Situation */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              いまの状況
              <span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
            </label>
            <textarea
              value={situation}
              onChange={(e) => { setSituation(e.target.value); setErrors((p) => ({ ...p, situation: "" })); }}
              rows={4}
              placeholder="例：現在、SaaS系スタートアップでPdMを2年経験しています。来年度からマネジメントも担うことになり、CPOを目指すべきかを悩んでいます。"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, resize: "vertical",
                border: errors.situation ? "1.5px solid var(--error, #DC2626)" : "1.5px solid var(--line)",
                fontSize: 13, color: "var(--ink)", fontFamily: "inherit", lineHeight: 1.7,
                outline: "none", background: "#fff",
              }}
            />
            {errors.situation && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--error, #DC2626)" }}>{errors.situation}</div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
              現在のお立場・職種・経験年数・抱えている課題などを具体的に。
            </div>
          </div>

          {/* Questions */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              聞きたいこと
              <span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
            </label>
            <textarea
              value={questions}
              onChange={(e) => { setQuestions(e.target.value); setErrors((p) => ({ ...p, questions: "" })); }}
              rows={5}
              placeholder={"例：\n1. PdMからマネージャーへの役割シフトで、最初に気をつけたことは何か\n2. CPOを目指すとしたら、今のうちに身につけておくべきスキルは"}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, resize: "vertical",
                border: errors.questions ? "1.5px solid var(--error, #DC2626)" : "1.5px solid var(--line)",
                fontSize: 13, color: "var(--ink)", fontFamily: "inherit", lineHeight: 1.7,
                outline: "none", background: "#fff",
              }}
            />
            {errors.questions && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--error, #DC2626)" }}>{errors.questions}</div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
              質問を箇条書きで整理すると、対話がスムーズに進みます。
            </div>
          </div>

          {/* Background (optional) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              相談の背景・伝えておきたいこと
              <span style={{ color: "var(--ink-mute)", marginLeft: 4, fontSize: 11 }}>任意</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={3}
              placeholder={`例：${mentor.name}さんの記事を読んで、お話を聞きたいと思いました。`}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, resize: "vertical",
                border: "1.5px solid var(--line)",
                fontSize: 13, color: "var(--ink)", fontFamily: "inherit", lineHeight: 1.7,
                outline: "none", background: "#fff",
              }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
              きっかけ・背景・期待していることなど、自由にお書きください。
            </div>
          </div>
        </section>

        {/* STEP 03: Schedule preference */}
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "28px 32px", marginBottom: 20,
        }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", padding: "3px 8px",
            borderRadius: 4, letterSpacing: "0.1em", marginBottom: 10,
          }}>
            STEP 03
          </span>
          <h2 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 600,
            color: "var(--ink)", marginBottom: 6,
          }}>
            希望する曜日・時間帯
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 24 }}>
            メンター承認後、実際の日程はメールでのやり取りで調整します。<br />
            あなたが一般的に都合の良い曜日・時間帯を選んでおいてください（複数選択可）。
          </p>

          {/* Day grid */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              希望曜日<span style={{ color: "var(--ink-mute)", marginLeft: 4, fontSize: 11 }}>任意</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {days.map((day) => {
                const active = selectedDays.has(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: "10px 4px", borderRadius: 10, textAlign: "center",
                      border: active ? "1.5px solid var(--royal)" : "1.5px solid var(--line)",
                      background: active ? "var(--royal-50)" : "#fff",
                      color: active ? "var(--royal)" : "var(--ink-soft)",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              希望時間帯<span style={{ color: "var(--ink-mute)", marginLeft: 4, fontSize: 11 }}>任意</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {times.map(({ key, label, value }) => {
                const active = selectedTimes.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTime(key)}
                    style={{
                      padding: "12px 10px", borderRadius: 10, textAlign: "center",
                      border: active ? "1.5px solid var(--royal)" : "1.5px solid var(--line)",
                      background: active ? "var(--royal-50)" : "#fff",
                      color: active ? "var(--royal)" : "var(--ink-soft)",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      fontSize: 9, fontFamily: "Inter, sans-serif", fontWeight: 700,
                      letterSpacing: "0.08em", color: active ? "var(--royal)" : "var(--ink-mute)",
                      marginBottom: 2,
                    }}>
                      {label}
                    </div>
                    {value}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
              メンターと調整する際の目安です。実際の日程は個別にやり取りします。
            </div>
          </div>
        </section>

        {/* STEP 04: Contact */}
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "28px 32px", marginBottom: 20,
        }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", padding: "3px 8px",
            borderRadius: 4, letterSpacing: "0.1em", marginBottom: 10,
          }}>
            STEP 04
          </span>
          <h2 style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 600,
            color: "var(--ink)", marginBottom: 6,
          }}>
            連絡先の確認
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 24 }}>
            日程調整や事前情報の共有に使用します。登録時のメールアドレスが初期値で入っています。
          </p>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              メールアドレス<span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
            </label>
            <input
              type="email"
              value={email}
              readOnly
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                fontFamily: "inherit", background: "var(--bg-tint)", outline: "none",
              }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
              変更したい場合は、プロフィール設定からメールアドレスを更新してください。
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              Zoom / Google Meet の希望
              <span style={{ color: "var(--ink-mute)", marginLeft: 4, fontSize: 11 }}>任意</span>
            </label>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                fontFamily: "inherit", background: "#fff", outline: "none", cursor: "pointer",
              }}
            >
              <option>どちらでも構わない</option>
              <option>Zoom</option>
              <option>Google Meet</option>
              <option>その他</option>
            </select>
          </div>
        </section>

        {/* Notice */}
        <div style={{
          background: "var(--warm-soft)", border: "1px solid #FDE68A",
          borderRadius: 12, padding: "18px 22px", marginBottom: 20,
        }}>
          <div style={{
            fontWeight: 700, fontSize: 13, color: "#B45309",
            marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertIcon />
            申し込み前にご確認ください
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              "編集部による精査で、マッチングが不適切と判断された場合、お繋ぎできないことがあります。",
              "メンターのご事情により、承認されない場合があります。その際は別のメンターをご紹介します。",
              "申請から対話実施まで通常2〜5営業日かかります。",
              "予約成立後のキャンセルは、対話48時間前までにご連絡ください。",
              "対話内容は編集部とも共有し、Opinioのサービス改善に匿名で活用させていただく場合があります。",
            ].map((item, i) => (
              <li key={i} style={{
                fontSize: 12, color: "#78350F", lineHeight: 1.8,
                paddingLeft: 14, position: "relative", marginBottom: 2,
              }}>
                <span style={{ position: "absolute", left: 2, fontWeight: 700 }}>·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Submit block — royal gradient (対比: casual-meeting は warm orange) */}
        <div style={{
          background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
          color: "#fff", borderRadius: 14, padding: "28px 32px",
          textAlign: "center", marginTop: 32,
        }}>
          {/* Free badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", background: "var(--success-soft)",
            color: "var(--success)", borderRadius: 100,
            fontSize: 12, fontWeight: 700, marginBottom: 12,
          }}>
            <CheckIcon />
            MVP期間中は無料でご利用いただけます
          </div>

          <div style={{
            fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 500,
            marginBottom: 8, lineHeight: 1.6,
          }}>
            あなたのキャリアの話、<br />
            {mentor.name}さんと一緒に整理してみませんか？
          </div>
          <p style={{
            fontSize: 12, opacity: 0.9, lineHeight: 1.8, marginBottom: 20,
            maxWidth: 500, marginLeft: "auto", marginRight: "auto",
          }}>
            このフォームを送信すると、Opinio編集部が内容を確認し、適切と判断した場合にメンターへ転送します。<br />
            編集部からの連絡は通常2営業日以内にお送りします。
          </p>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "14px 32px",
              background: canSubmit ? "#fff" : "rgba(255,255,255,0.45)",
              color: canSubmit ? "var(--royal)" : "rgba(0,35,102,0.4)",
              border: "none", borderRadius: 10,
              fontFamily: "inherit", fontSize: 15, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "transform 0.2s",
            }}
          >
            <SendIcon />
            予約をリクエストする
          </button>
          <div style={{ fontSize: 10, opacity: 0.8, marginTop: 14, lineHeight: 1.7 }}>
            送信することで、利用規約およびプライバシーポリシーに同意したものとみなされます。<br />
            料金体系は将来変更される可能性があります。
          </div>
        </div>
      </main>

      <style>{`
        textarea:focus, input:focus, select:focus {
          border-color: var(--royal) !important;
          box-shadow: 0 0 0 3px rgba(0,35,102,0.08);
        }
      `}</style>
    </>
  );
}
