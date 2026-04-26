"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const JOB_TYPES = [
  "営業",
  "CS",
  "マーケ",
  "エンジニア",
  "PdM",
  "事業開発",
  "その他",
];

const CONCERN_TAGS = [
  "年収交渉",
  "転職タイミング",
  "キャリアチェンジ",
  "外資転職",
  "スタートアップ",
  "働き方",
];

const COMPANY_TYPES = [
  "日系大手",
  "外資系",
  "SaaS",
  "SIer",
  "人材",
  "コンサル",
  "スタートアップ",
  "その他",
];

function PillButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 20px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: selected ? 600 : 500,
        background: selected ? "#0f172a" : "#fff",
        color: selected ? "#fff" : "#374151",
        border: selected ? "1.5px solid #0f172a" : "1.5px solid #d1d5db",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [jobType, setJobType] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [companyType, setCompanyType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

  // Load existing profile data
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/signup");
        return;
      }
      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("job_type, consultation_tags, current_company_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) {
        if (profile.job_type) setJobType(profile.job_type);
        if (profile.consultation_tags) setTags(profile.consultation_tags);
        if (profile.current_company_type) setCompanyType(profile.current_company_type);
      }
      setInitialLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const canProceed = () => {
    if (step === 1) return !!jobType;
    if (step === 2) return tags.length > 0;
    if (step === 3) return !!companyType;
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/signup");
        return;
      }

      // Check existing profile
      const { data: existing } = await supabase
        .from("ow_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileData = {
        job_type: jobType,
        consultation_tags: tags,
        current_company_type: companyType,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: updateErr } = await supabase
          .from("ow_profiles")
          .update(profileData)
          .eq("user_id", user.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from("ow_profiles")
          .insert({ ...profileData, user_id: user.id });
        if (insertErr) throw insertErr;
      }

      // Redirect with success indicator
      router.push("/career-consultation?matched=1");
    } catch (e: any) {
      setError(e.message || "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  if (initialLoading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen bg-white flex items-center justify-center">
          <div style={{ color: "#9ca3af", fontSize: 14 }}>読み込み中...</div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {step}/3
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                あと{3 - step + 1}問
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "#e5e7eb",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(step / 3) * 100}%`,
                  background: "#059669",
                  borderRadius: 999,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Step 1: Job Type */}
          {step === 1 && (
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                今の職種を教えてください
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  marginBottom: 28,
                }}
              >
                あなたに合ったメンターを見つけるために使います
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {JOB_TYPES.map((jt) => (
                  <PillButton
                    key={jt}
                    label={jt}
                    selected={jobType === jt}
                    onClick={() => setJobType(jt)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Concerns */}
          {step === 2 && (
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                転職で一番気になっていることは？
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  marginBottom: 28,
                }}
              >
                複数選択OK（最大3つ）
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {CONCERN_TAGS.map((tag) => (
                  <PillButton
                    key={tag}
                    label={tag}
                    selected={tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
              </div>
              {tags.length > 0 && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#059669",
                    marginTop: 12,
                  }}
                >
                  {tags.length}つ選択中
                </p>
              )}
            </div>
          )}

          {/* Step 3: Company Type */}
          {step === 3 && (
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                今の会社の種類は？
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#6b7280",
                  marginBottom: 28,
                }}
              >
                近いものを選んでください
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {COMPANY_TYPES.map((ct) => (
                  <PillButton
                    key={ct}
                    label={ct}
                    selected={companyType === ct}
                    onClick={() => setCompanyType(ct)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              style={{
                fontSize: 13,
                color: "#dc2626",
                marginTop: 16,
              }}
            >
              {error}
            </p>
          )}

          {/* Navigation buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 40,
            }}
          >
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#374151",
                  border: "1.5px solid #d1d5db",
                  cursor: "pointer",
                }}
              >
                戻る
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || loading}
              style={{
                flex: 1,
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                background: canProceed() ? "#059669" : "#d1d5db",
                color: canProceed() ? "#fff" : "#9ca3af",
                border: "none",
                cursor: canProceed() ? "pointer" : "default",
                transition: "background 0.15s",
              }}
            >
              {loading
                ? "保存中..."
                : step === 3
                ? "メンターを見つける"
                : "次へ"}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
