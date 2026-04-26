"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";

const JOB_TYPES = ["営業", "カスタマーサクセス", "マーケ", "PdM", "エンジニア", "事業開発"];
const LOCATIONS = ["東京", "大阪", "名古屋", "福岡", "リモート可"];
const WORK_STYLES = ["フルリモート", "ハイブリッド", "オフィス出社"];

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState(600);
  const [workStyle, setWorkStyle] = useState("");

  const toggleItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("ow_user_profiles").upsert({
      user_id: user.id,
      preferred_job_types: jobTypes,
      preferred_locations: locations,
      salary_min: salaryMin,
      work_style: workStyle,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    router.push("/jobs");
  };

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f8f6" }}>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {/* ステップインジケーター */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 32,
            }}
          >
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background: s <= step ? "#2d7a4f" : "#e8e4dc",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                希望職種を選んでください
              </h2>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
                複数選択できます
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {JOB_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setJobTypes(toggleItem(jobTypes, type))}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 99,
                      border: "1.5px solid",
                      borderColor: jobTypes.includes(type) ? "#2d7a4f" : "#e0e0e0",
                      background: jobTypes.includes(type) ? "#f0faf4" : "#fff",
                      color: jobTypes.includes(type) ? "#2d7a4f" : "#555",
                      fontSize: 14,
                      cursor: "pointer",
                      fontWeight: jobTypes.includes(type) ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={jobTypes.length === 0}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#1a1a1a",
                  color: "#fff",
                  borderRadius: 12,
                  border: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: jobTypes.length > 0 ? "pointer" : "not-allowed",
                  opacity: jobTypes.length > 0 ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
              >
                次へ →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                希望勤務地を選んでください
              </h2>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
                複数選択できます
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocations(toggleItem(locations, loc))}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 99,
                      border: "1.5px solid",
                      borderColor: locations.includes(loc) ? "#2d7a4f" : "#e0e0e0",
                      background: locations.includes(loc) ? "#f0faf4" : "#fff",
                      color: locations.includes(loc) ? "#2d7a4f" : "#555",
                      fontSize: 14,
                      cursor: "pointer",
                      fontWeight: locations.includes(loc) ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                  希望年収：{salaryMin}万円〜
                </p>
                <input
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#2d7a4f" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#aaa",
                    marginTop: 4,
                  }}
                >
                  <span>300万</span>
                  <span>2,000万</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "transparent",
                    color: "#555",
                    borderRadius: 12,
                    border: "1.5px solid #e0e0e0",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  ← 戻る
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={locations.length === 0}
                  style={{
                    flex: 2,
                    padding: "14px",
                    background: "#1a1a1a",
                    color: "#fff",
                    borderRadius: 12,
                    border: "none",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: locations.length > 0 ? "pointer" : "not-allowed",
                    opacity: locations.length > 0 ? 1 : 0.4,
                    transition: "opacity 0.15s",
                  }}
                >
                  次へ →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                希望の働き方を選んでください
              </h2>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
                1つ選んでください
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {WORK_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => setWorkStyle(style)}
                    style={{
                      padding: "14px 18px",
                      borderRadius: 12,
                      border: "1.5px solid",
                      borderColor: workStyle === style ? "#2d7a4f" : "#e0e0e0",
                      background: workStyle === style ? "#f0faf4" : "#fff",
                      color: workStyle === style ? "#2d7a4f" : "#555",
                      fontSize: 14,
                      cursor: "pointer",
                      textAlign: "left" as const,
                      fontWeight: workStyle === style ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "transparent",
                    color: "#555",
                    borderRadius: 12,
                    border: "1.5px solid #e0e0e0",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  ← 戻る
                </button>
                <button
                  onClick={handleSave}
                  disabled={!workStyle || saving}
                  style={{
                    flex: 2,
                    padding: "14px",
                    background: "#1a1a1a",
                    color: "#fff",
                    borderRadius: 12,
                    border: "none",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: workStyle ? "pointer" : "not-allowed",
                    opacity: workStyle ? 1 : 0.4,
                    transition: "opacity 0.15s",
                  }}
                >
                  {saving ? "保存中..." : "求人を見る →"}
                </button>
              </div>
              <button
                onClick={() => router.push("/jobs")}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "10px",
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: "#aaa",
                  cursor: "pointer",
                }}
              >
                スキップして求人を見る
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
