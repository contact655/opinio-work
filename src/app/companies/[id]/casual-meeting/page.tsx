"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MOCK_COMPANIES } from "../../mockCompanies";
import { getJobById } from "../../../jobs/mockJobData";
import { MOCK_PROFILE } from "../../../profile/edit/mockProfileData";

// ─── Icons ────────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const BriefcaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const BanIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);

// ─── 在籍企業チェック ─────────────────────────────────────────────────────────

function checkIsCurrentEmployer(companyId: string): boolean {
  const company = MOCK_COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;

  return MOCK_PROFILE.experiences
    .filter((e) => e.isCurrent)
    .some((e) => {
      // master type: companyId が一致
      if (e.companyType === "master" && e.companyId === companyId) return true;
      // custom/anon type: 表示名で照合
      const name = e.displayCompanyName ?? "";
      return name.includes(company.name) || company.name.includes(name);
    });
}

// ─── Success Modal ─────────────────────────────────────────────────────────────

function SuccessModal({ companyName, onClose }: { companyName: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "48px 40px",
        maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
      }}>
        <div style={{ color: "var(--success)", marginBottom: 20 }}>
          <CheckCircleIcon />
        </div>
        <div style={{
          fontFamily: '"Noto Serif JP", serif', fontSize: 22, fontWeight: 600,
          color: "var(--ink)", marginBottom: 10, lineHeight: 1.5,
        }}>
          申込を受け付けました
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
          <strong style={{ color: "var(--ink)" }}>{companyName}</strong> の採用担当に申込内容が届きました。<br />
          通常 <strong>3営業日以内</strong> に企業から連絡が来ます。<br />
          マイページから申込状況をいつでも確認できます。
        </p>

        {/* Steps */}
        <div style={{
          background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 12,
          padding: "16px 20px", marginBottom: 28, textAlign: "left",
        }}>
          {[
            { step: "1", label: "企業が申込内容を確認", note: "〜3営業日" },
            { step: "2", label: "企業から日程調整の連絡", note: "メールで届きます" },
            { step: "3", label: "オンラインで30分お話し", note: "カジュアルな対話" },
          ].map(({ step, label, note }) => (
            <div key={step} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "8px 0", borderBottom: step !== "3" ? "1px dashed var(--line)" : "none",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: "var(--royal)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: 700,
              }}>
                {step}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{note}</div>
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
            border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Blocked State ─────────────────────────────────────────────────────────────

function CurrentEmployerBlock({ companyName, companyId }: { companyName: string; companyId: string }) {
  return (
    <div style={{
      background: "#fff", border: "1.5px solid var(--error-soft, #FEE2E2)",
      borderRadius: 16, padding: "40px 32px", textAlign: "center",
      marginTop: 32,
    }}>
      <div style={{ color: "var(--error, #DC2626)", marginBottom: 16 }}>
        <BanIcon />
      </div>
      <div style={{
        fontFamily: '"Noto Serif JP", serif', fontSize: 20, fontWeight: 600,
        color: "var(--ink)", marginBottom: 10,
      }}>
        現在ご在籍中の企業です
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28, maxWidth: 420, margin: "0 auto 28px" }}>
        <strong style={{ color: "var(--ink)" }}>{companyName}</strong> は、あなたの現在の在籍企業として登録されています。<br />
        在籍中の企業へのカジュアル面談申込はできません。<br />
        プロフィールの職歴情報が誤っている場合は、編集してください。
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Link href={`/companies/${companyId}`} style={{
          padding: "11px 24px", background: "var(--bg-tint)", color: "var(--ink-soft)",
          border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, fontWeight: 600,
          textDecoration: "none",
        }}>
          ← 企業ページへ戻る
        </Link>
        <Link href="/profile/edit" style={{
          padding: "11px 24px", background: "var(--royal)", color: "#fff",
          borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
        }}>
          職歴を編集する
        </Link>
      </div>
    </div>
  );
}

// ─── Main form (reads search params) ─────────────────────────────────────────

function CasualMeetingForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const jobIdParam = searchParams.get("job_id");

  const company = MOCK_COMPANIES.find((c) => c.id === companyId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const job = jobIdParam ? getJobById(jobIdParam) : null;
  const isCurrentEmployer = checkIsCurrentEmployer(companyId);

  // Form state
  const [shareProfile, setShareProfile] = useState(true);
  const [intent, setIntent] = useState<string | null>(null);
  const [motivation, setMotivation] = useState("");
  const [questions, setQuestions] = useState("");
  const [email] = useState(MOCK_PROFILE.email);
  const [meetingFormat, setMeetingFormat] = useState("どちらでも構わない");
  const [linkedJobId, setLinkedJobId] = useState<string | null>(jobIdParam);
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!company) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-mute)" }}>
        企業が見つかりませんでした
      </div>
    );
  }

  const linkedJob = linkedJobId ? getJobById(linkedJobId) : null;
  const canSubmit = intent !== null && motivation.trim() && questions.trim() && email.trim();

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!intent) e.intent = "転職意向を選択してください";
    if (!motivation.trim()) e.motivation = "興味を持ったきっかけを入力してください";
    if (!questions.trim()) e.questions = "聞きたいことを入力してください";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // TODO: POST to /api/casual-meetings when Supabase connected
    setShowModal(true);
  }

  const currentExps = MOCK_PROFILE.experiences.filter((e) => e.isCurrent);
  const pastExps = MOCK_PROFILE.experiences.filter((e) => !e.isCurrent);

  const intents = [
    { id: "exploring", label: "情報収集中", desc: "まだ転職を決めておらず、情報を集めている段階" },
    { id: "open", label: "良い機会があれば検討", desc: "積極的ではないが、良い出会いがあれば前向きに" },
    { id: "6months", label: "半年以内に転職したい", desc: "具体的にこれから転職活動を始める予定" },
    { id: "3months", label: "3ヶ月以内に転職したい", desc: "選考を並行して進めている段階" },
  ];

  return (
    <>
      {showModal && (
        <SuccessModal companyName={company.name} onClose={() => setShowModal(false)} />
      )}

      {/* Breadcrumb */}
      <nav style={{
        background: "var(--bg-tint)", padding: "13px 48px",
        borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-mute)",
      }}>
        <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>求人を探す</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href={`/companies/${company.id}`} style={{ color: "var(--ink-mute)" }}>{company.name}</Link>
        {linkedJob && (
          <>
            <span style={{ margin: "0 6px" }}>/</span>
            <Link href={`/jobs/${linkedJob.id}`} style={{ color: "var(--ink-mute)" }}>{linkedJob.role}</Link>
          </>
        )}
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--ink-soft)" }}>カジュアル面談を申し込む</span>
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Page head */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            display: "inline-block", fontFamily: "Inter, sans-serif",
            fontSize: 11, fontWeight: 700, color: "#B45309",
            background: "var(--warm-soft)", padding: "4px 10px",
            borderRadius: 4, letterSpacing: "0.15em", marginBottom: 14,
          }}>
            CASUAL MEETING
          </span>
          <h1 style={{
            fontFamily: '"Noto Serif JP", serif', fontWeight: 500,
            fontSize: 28, color: "var(--ink)", lineHeight: 1.5,
            letterSpacing: "0.02em", marginBottom: 10,
          }}>
            {company.name}に、<br />カジュアル面談を申し込む。
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9 }}>
            まずは気軽に、企業の方とオンラインで30分お話ししませんか？<br />
            選考前の段階でも OK。興味を持った理由、聞いてみたいこと、現在のキャリアなど、<strong>ざっくばらんに対話する場</strong>です。
          </p>
        </div>

        {/* 在籍企業制約 */}
        {isCurrentEmployer ? (
          <CurrentEmployerBlock companyName={company.name} companyId={company.id} />
        ) : (
          <>
            {/* Target card */}
            <div style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "22px 24px", marginBottom: 24,
            }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                color: "var(--ink-mute)", letterSpacing: "0.15em", marginBottom: 14,
              }}>
                あなたの申し込みは、以下の企業に直接届きます
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 16, alignItems: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: company.gradient, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22,
                  boxShadow: "0 4px 12px rgba(0,35,102,0.2)",
                }}>
                  {company.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
                    {company.name}
                  </div>
                  <div style={{
                    fontFamily: '"Noto Serif JP", serif',
                    fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
                  }}>
                    {company.tagline}
                  </div>
                </div>
                <Link href={`/companies/${company.id}`} style={{
                  color: "var(--royal)", fontSize: 12, fontWeight: 600, textDecoration: "none",
                  whiteSpace: "nowrap",
                }}>
                  企業ページへ →
                </Link>
              </div>

              {linkedJob && (
                <div style={{
                  marginTop: 18, paddingTop: 18, borderTop: "1px dashed var(--line)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: "var(--royal-50)", color: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BriefcaseIcon />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 2 }}>
                      興味を持った求人
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                      {linkedJob.role}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
                    color: "var(--royal)", whiteSpace: "nowrap",
                  }}>
                    ¥{linkedJob.salary_min}–{linkedJob.salary_max}万
                  </div>
                  <button onClick={() => setLinkedJobId(null)} style={{
                    fontSize: 11, color: "var(--ink-mute)", background: "none",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    padding: "4px 8px",
                  }}>
                    × 紐づけを外す
                  </button>
                </div>
              )}
            </div>

            {/* Flow box */}
            <div style={{
              background: "linear-gradient(135deg, var(--warm-soft) 0%, #fff 100%)",
              border: "1px solid #FDE68A", borderRadius: 14,
              padding: "20px 24px", marginBottom: 40,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: "#B45309",
                marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
              }}>
                <ClockIcon />
                企業からの返答の目安
              </div>
              <p style={{ fontSize: 12, color: "#78350F", lineHeight: 1.8 }}>
                このフォームの内容は <strong>直接企業の採用担当に届きます</strong>。<br />
                通常 <strong>3営業日以内</strong> に企業側から連絡が来ます。日程・形式（Zoom / Google Meet）を調整して、30分お話しします。
              </p>
            </div>

            {/* Section 1: Profile sharing */}
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "28px 32px", marginBottom: 20,
            }}>
              <h2 style={{
                fontFamily: '"Noto Serif JP", serif', fontSize: 17, fontWeight: 600,
                color: "var(--ink)", marginBottom: 6,
              }}>
                Opinioプロフィールを企業に共有
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 20 }}>
                あなたのプロフィール情報が企業側に共有されます。企業側が事前にあなたのキャリアを確認できるため、<strong>面談当日の対話がスムーズ</strong>になります。
              </p>

              {/* Profile preview */}
              <div style={{
                background: "var(--bg-tint)", border: "1px solid var(--line)",
                borderRadius: 12, padding: "18px 20px", marginBottom: 14,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 14, marginBottom: 14,
                  paddingBottom: 14, borderBottom: "1px dashed var(--line)",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: MOCK_PROFILE.avatarColor, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 600, fontSize: 18,
                  }}>
                    {MOCK_PROFILE.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                      {MOCK_PROFILE.name}さん · {MOCK_PROFILE.ageRange}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                      {currentExps[0]?.displayCompanyName} · {currentExps[0]?.roleTitle}
                    </div>
                  </div>
                  <Link href="/profile/edit" target="_blank" style={{
                    marginLeft: "auto", padding: "6px 12px",
                    background: "#fff", border: "1px solid var(--line)", borderRadius: 6,
                    fontSize: 11, color: "var(--ink)", textDecoration: "none", whiteSpace: "nowrap",
                  }}>
                    プロフィールを確認
                  </Link>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { label: "現職", value: `${currentExps[0]?.displayCompanyName} · ${currentExps[0]?.roleTitle}（${currentExps[0]?.startedAt?.replace("-", ".")}〜）` },
                    ...pastExps.slice(0, 2).map((e, i) => ({
                      label: i === 0 ? "前職" : "その前",
                      value: `${e.displayCompanyName} · ${e.roleTitle}（${e.startedAt?.replace("-", ".")}〜${e.endedAt?.replace("-", ".")}）`,
                    })),
                    { label: "所在地", value: MOCK_PROFILE.location },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      display: "grid", gridTemplateColumns: "56px 1fr", gap: 8, padding: "5px 0",
                    }}>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, paddingTop: 1 }}>{label}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <label style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "14px 16px",
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                borderRadius: 10, cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={shareProfile}
                  onChange={(e) => setShareProfile(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--royal)", flexShrink: 0, marginTop: 1 }}
                />
                <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.7 }}>
                  <strong>Opinioプロフィールを企業に共有する</strong>（推奨）<br />
                  チェックを外すと、プロフィールは共有されず、下記の入力内容のみが企業に届きます。
                </div>
              </label>
            </section>

            {/* Section 2: Intent */}
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "28px 32px", marginBottom: 20,
            }}>
              <h2 style={{
                fontFamily: '"Noto Serif JP", serif', fontSize: 17, fontWeight: 600,
                color: "var(--ink)", marginBottom: 6,
              }}>
                いまの転職意向
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 20 }}>
                あなたの現在の状況を教えてください。企業側がどのような話をすべきかの参考になります。<br />
                ※ カジュアル面談は選考ではないので、どの状態でも問題ありません。
              </p>

              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 10, display: "block" }}>
                  いまの状況<span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {intents.map(({ id, label, desc }) => {
                    const active = intent === id;
                    return (
                      <div
                        key={id}
                        onClick={() => { setIntent(id); setErrors(prev => ({ ...prev, intent: "" })); }}
                        style={{
                          padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                          border: active ? "1.5px solid var(--royal)" : "1.5px solid var(--line)",
                          background: active ? "var(--royal-50)" : "#fff",
                          display: "flex", gap: 12, alignItems: "flex-start",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                          border: active ? "4.5px solid var(--royal)" : "2px solid var(--line)",
                          background: "#fff",
                        }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>{desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.intent && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--error, #DC2626)" }}>{errors.intent}</div>
                )}
              </div>
            </section>

            {/* Section 3: Motivation + Questions */}
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "28px 32px", marginBottom: 20,
            }}>
              <h2 style={{
                fontFamily: '"Noto Serif JP", serif', fontSize: 17, fontWeight: 600,
                color: "var(--ink)", marginBottom: 6,
              }}>
                興味を持ったきっかけ・聞きたいこと
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 24 }}>
                企業に興味を持った理由や、面談で聞きたいことを自由に書いてください。<br />
                堅苦しい文章でなくてOK。カジュアルな会話の種になればOKです。
              </p>

              {/* Motivation */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  興味を持ったきっかけ
                  <span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => { setMotivation(e.target.value); setErrors(prev => ({ ...prev, motivation: "" })); }}
                  rows={4}
                  placeholder="例：Opinioに掲載されている記事を読んで、職域を超える文化に興味を持ちました。"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10, resize: "vertical",
                    border: errors.motivation ? "1.5px solid var(--error, #DC2626)" : "1.5px solid var(--line)",
                    fontSize: 13, color: "var(--ink)", fontFamily: "inherit", lineHeight: 1.7,
                    outline: "none", background: "#fff",
                  }}
                />
                {errors.motivation && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--error, #DC2626)" }}>{errors.motivation}</div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-mute)" }}>
                  記事を読んだ・知人から聞いた・サービスを使ったことがある、など自由に。
                </div>
              </div>

              {/* Questions */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  面談で聞いてみたいこと
                  <span style={{ color: "var(--error, #DC2626)", marginLeft: 4, fontSize: 11 }}>必須</span>
                </label>
                <textarea
                  value={questions}
                  onChange={(e) => { setQuestions(e.target.value); setErrors(prev => ({ ...prev, questions: "" })); }}
                  rows={5}
                  placeholder={"例：\n- 会社の雰囲気や働き方のリアルを知りたい\n- このポジションで活躍している方の特徴\n- 今後の事業展開について"}
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
                  複数書いてOK。箇条書きだと面談当日スムーズです。
                </div>
              </div>
            </section>

            {/* Section 4: Contact */}
            <section style={{
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 14, padding: "28px 32px", marginBottom: 20,
            }}>
              <h2 style={{
                fontFamily: '"Noto Serif JP", serif', fontSize: 17, fontWeight: 600,
                color: "var(--ink)", marginBottom: 6,
              }}>
                連絡先
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 24 }}>
                日程調整や事前資料の送付に使用します。登録時のメールアドレスが初期値で入っています。
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
                  企業からの連絡先として使われます。
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
                  希望する面談形式
                  <span style={{ color: "var(--ink-mute)", marginLeft: 4, fontSize: 11 }}>任意</span>
                </label>
                <select
                  value={meetingFormat}
                  onChange={(e) => setMeetingFormat(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 10,
                    border: "1.5px solid var(--line)", fontSize: 13, color: "var(--ink)",
                    fontFamily: "inherit", background: "#fff", outline: "none", cursor: "pointer",
                  }}
                >
                  <option>どちらでも構わない</option>
                  <option>Zoom</option>
                  <option>Google Meet</option>
                  <option>対面（企業オフィス）</option>
                  <option>対面（カフェ等）</option>
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
                  <>このフォームは <strong>企業の採用担当に直接届きます</strong>（Opinioは介在しません）。</>,
                  <>カジュアル面談は <strong>選考ではありません</strong>。結果通知や合否はなく、相互理解のための対話です。</>,
                  <>通常 <strong>3営業日以内</strong> に企業から連絡が来ますが、遅れる場合もあります。</>,
                  <>企業側の判断で、面談を見送る場合もあります。</>,
                  <>面談後、Opinioから感想アンケートをお送りする場合があります（任意回答）。</>,
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

            {/* Submit block */}
            <div style={{
              background: "linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)",
              color: "#fff", borderRadius: 14, padding: "28px 32px",
              textAlign: "center", marginTop: 32,
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", background: "rgba(255,255,255,0.2)",
                color: "#fff", borderRadius: 100, fontSize: 12, fontWeight: 700,
                marginBottom: 10, border: "1px solid rgba(255,255,255,0.3)",
              }}>
                <ClockIcon />
                3営業日以内に企業から連絡が来ます
              </div>
              <div style={{
                fontFamily: '"Noto Serif JP", serif', fontSize: 18, fontWeight: 500,
                marginBottom: 8, lineHeight: 1.6,
              }}>
                まずは、気軽に話してみましょう。<br />
                転職を決めていなくても、大丈夫です。
              </div>
              <p style={{
                fontSize: 12, opacity: 0.9, lineHeight: 1.8, marginBottom: 20,
                maxWidth: 480, marginLeft: "auto", marginRight: "auto",
              }}>
                このフォームを送信すると、{company.name}の採用担当にあなたの申し込み内容が届きます。<br />
                企業から日程調整のメールが届いたら、対話の日時を決めていきます。
              </p>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: "14px 32px",
                  background: canSubmit ? "#fff" : "rgba(255,255,255,0.5)",
                  color: canSubmit ? "#C2410C" : "rgba(194,65,12,0.5)",
                  border: "none", borderRadius: 10,
                  fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  transition: "transform 0.2s",
                }}
              >
                <SendIcon />
                カジュアル面談を申し込む
              </button>
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 14, lineHeight: 1.7 }}>
                送信することで、利用規約およびプライバシーポリシーに同意したものとみなされます。<br />
                あなたの情報は、{company.name}にのみ共有されます。
              </div>
            </div>
          </>
        )}
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

// ─── Page (Suspense wrapper required for useSearchParams) ─────────────────────

export default function CasualMeetingPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--ink-mute)" }}>
        読み込み中...
      </div>
    }>
      <CasualMeetingForm />
    </Suspense>
  );
}
