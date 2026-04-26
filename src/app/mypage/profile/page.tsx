"use client";

import { useState, useEffect, useCallback, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// ─── Types ─────────────────────────────────────────

type HonestQA = {
  id?: string;
  member_id?: string;
  question: string;
  answer: string;
  display_order: number;
};

type WorkHistoryEdit = {
  id: string;
  company_name: string;
  role: string;
  joined_year: number;
  left_year?: number;
  reason_join: string;
  description: string;
};

// ─── Constants ─────────────────────────────────────

const HONEST_QUESTIONS = [
  "なぜこの会社に入ったの？",
  "転職して後悔したことは？",
  "この会社、正直どう？",
];

const AGE_OPTIONS = [
  "",
  "20代前半",
  "20代後半",
  "30代前半",
  "30代後半",
  "40代以上",
];

// ─── Section Card ─────────────────────────────────

function SectionCard({
  title,
  children,
  onSave,
  saving,
  saved,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            width: 3,
            height: 14,
            background: "#1D9E75",
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
          {title}
        </span>
      </div>
      {children}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        {saved && (
          <span style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>
            保存しました
          </span>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "8px 24px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            background: saving ? "#9ca3af" : "#1D9E75",
            color: "#fff",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}

// ─── Tag Input ────────────────────────────────────

function TagInput({
  tags,
  setTags,
  max,
  placeholder,
}: {
  tags: string[];
  setTags: (t: string[]) => void;
  max: number;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed) || tags.length >= max) return;
    setTags([...tags, trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: tags.length > 0 ? 12 : 0,
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#E1F5EE",
              color: "#065F46",
              border: "1px solid #9FE1CB",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => setTags(tags.filter((t) => t !== tag))}
              style={{
                background: "none",
                border: "none",
                color: "#065F46",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              x
            </button>
          </span>
        ))}
      </div>
      {tags.length < max && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={30}
            style={{
              flex: 1,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 12,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={addTag}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              cursor: "pointer",
            }}
          >
            追加
          </button>
        </div>
      )}
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
        {tags.length}/{max} 個
      </p>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
          プロフィール完成度
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1D9E75" }}>
          {percent}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "#e5e7eb",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: "linear-gradient(90deg, #1D9E75, #34D399)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Input styles ─────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  marginBottom: 6,
};

// ─── Main Page Component ──────────────────────────

export default function MyProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [, setCompanyId] = useState<string | null>(null);

  // Form states
  const [tagline, setTagline] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [locationVal, setLocationVal] = useState("");
  const [hometown, setHometown] = useState("");
  const [honestQa, setHonestQa] = useState<HonestQA[]>(
    HONEST_QUESTIONS.map((q, i) => ({
      question: q,
      answer: "",
      display_order: i,
    }))
  );
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [hobbyTags, setHobbyTags] = useState<string[]>([]);
  const [hobbyDescription, setHobbyDescription] = useState("");
  const [workHistories, setWorkHistories] = useState<WorkHistoryEdit[]>([]);

  // Show saved indicator
  const showSaved = useCallback((section: string) => {
    setSavedSections((prev) => ({ ...prev, [section]: true }));
    setTimeout(() => {
      setSavedSections((prev) => ({ ...prev, [section]: false }));
    }, 3000);
  }, []);

  // ── Load data ──
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUserId(user.id);

      // ow_company_members からメンバー情報を取得（user_idで検索）
      let member: any = null;
      const { data: cmData } = await supabase
        .from("ow_company_members")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cmData) {
        member = cmData;
      } else {
        // user_idがセットされていない場合、ow_profilesのnameで検索
        const { data: profile } = await supabase
          .from("ow_profiles")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.name) {
          const { data: cmByName } = await supabase
            .from("ow_company_members")
            .select("*")
            .eq("name", profile.name)
            .limit(1)
            .maybeSingle();

          if (cmByName) {
            member = cmByName;
            // user_idをセットしておく（次回から直接取得できるように）
            await supabase
              .from("ow_company_members")
              .update({ user_id: user.id })
              .eq("id", cmByName.id);
          }
        }
      }

      if (member) {
        setMemberId(member.id);
        setCompanyId(member.company_id);
        setTagline(member.tagline || "");
        setAgeRange(member.age_range || "");
        setLocationVal(member.location || "");
        setHometown(member.hometown || "");
        setSkillTags(member.skill_tags || []);
        setHobbyTags(member.hobby_tags || []);
        setHobbyDescription(member.hobby_description || "");

        // 本音Q&A取得
        const { data: qaData } = await supabase
          .from("ow_member_honest_qa")
          .select("*")
          .eq("member_id", member.id)
          .order("display_order", { ascending: true });

        if (qaData && qaData.length > 0) {
          setHonestQa(
            HONEST_QUESTIONS.map((q, i) => {
              const existing = qaData.find(
                (qa: any) => qa.display_order === i
              );
              return existing
                ? {
                    id: existing.id,
                    member_id: member.id,
                    question: q,
                    answer: existing.answer,
                    display_order: i,
                  }
                : { question: q, answer: "", display_order: i };
            })
          );
        }
      }

      // work_histories取得
      const { data: whData } = await supabase
        .from("work_histories")
        .select(
          "id, role, joined_year, left_year, reason_join, description, company:ow_companies(name)"
        )
        .eq("user_id", user.id)
        .eq("is_public", true)
        .order("joined_year", { ascending: false });

      if (whData) {
        setWorkHistories(
          whData.map((wh: any) => ({
            id: wh.id,
            company_name: wh.company?.name || "不明",
            role: wh.role || "",
            joined_year: wh.joined_year,
            left_year: wh.left_year,
            reason_join: wh.reason_join || "",
            description: wh.description || "",
          }))
        );
      }

      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress calculation ──
  const calcProgress = () => {
    let filled = 0;
    const total = 8;
    if (tagline) filled++;
    if (ageRange) filled++;
    if (locationVal || hometown) filled++;
    if (honestQa.some((q) => q.answer)) filled++;
    if (skillTags.length > 0) filled++;
    if (hobbyTags.length > 0 || hobbyDescription) filled++;
    if (workHistories.some((wh) => wh.reason_join)) filled++;
    if (workHistories.some((wh) => wh.description)) filled++;
    return Math.round((filled / total) * 100);
  };

  // ── Save handlers ──

  const saveTagline = async () => {
    if (!userId) return;
    setSaving("tagline");
    setError(null);
    const { error: err } = await supabase
      .from("ow_company_members")
      .update({ tagline })
      .eq("user_id", userId);
    setSaving(null);
    if (!err) showSaved("tagline");
    else setError("保存に失敗しました");
  };

  const saveBasicInfo = async () => {
    if (!userId) return;
    setSaving("basic");
    setError(null);
    const { error: err } = await supabase
      .from("ow_company_members")
      .update({
        age_range: ageRange || null,
        location: locationVal || null,
        hometown: hometown || null,
      })
      .eq("user_id", userId);
    setSaving(null);
    if (!err) showSaved("basic");
    else setError("保存に失敗しました");
  };

  const saveHonestQa = async () => {
    if (!memberId) return;
    setSaving("qa");
    setError(null);
    let hasError = false;

    for (const qa of honestQa) {
      if (!qa.answer.trim()) continue;
      const { error: err } = await supabase
        .from("ow_member_honest_qa")
        .upsert(
          {
            member_id: memberId,
            question: qa.question,
            answer: qa.answer,
            display_order: qa.display_order,
          },
          { onConflict: "member_id,display_order" }
        );
      if (err) hasError = true;
    }

    setSaving(null);
    if (!hasError) showSaved("qa");
    else setError("一部の保存に失敗しました");
  };

  const saveSkillTags = async () => {
    if (!userId) return;
    setSaving("skills");
    setError(null);
    const { error: err } = await supabase
      .from("ow_company_members")
      .update({ skill_tags: skillTags })
      .eq("user_id", userId);
    setSaving(null);
    if (!err) showSaved("skills");
    else setError("保存に失敗しました");
  };

  const saveHobby = async () => {
    if (!userId) return;
    setSaving("hobby");
    setError(null);
    const { error: err } = await supabase
      .from("ow_company_members")
      .update({
        hobby_tags: hobbyTags,
        hobby_description: hobbyDescription || null,
      })
      .eq("user_id", userId);
    setSaving(null);
    if (!err) showSaved("hobby");
    else setError("保存に失敗しました");
  };

  const saveWorkHistory = async (wh: WorkHistoryEdit) => {
    const key = `wh-${wh.id}`;
    setSaving(key);
    setError(null);
    const { error: err } = await supabase
      .from("work_histories")
      .update({
        reason_join: wh.reason_join || null,
        description: wh.description || null,
      })
      .eq("id", wh.id);
    setSaving(null);
    if (!err) showSaved(key);
    else setError("保存に失敗しました");
  };

  // ── Render: Loading ──

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen" style={{ background: "#f9fafb" }}>
          <div
            style={{
              maxWidth: 640,
              margin: "0 auto",
              padding: "60px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 14 }}>読み込み中...</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Render: No member ──

  if (!memberId) {
    return (
      <>
        <Header />
        <main className="pt-16 min-h-screen" style={{ background: "#f9fafb" }}>
          <div
            style={{
              maxWidth: 640,
              margin: "0 auto",
              padding: "60px 16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #f3f4f6",
                borderRadius: 12,
                padding: 40,
              }}
            >
              <p style={{ fontSize: 16, color: "#374151", marginBottom: 8 }}>
                メンバー情報が見つかりません
              </p>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
                企業メンバーとして登録された後にプロフィールを編集できます。
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  padding: "8px 24px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#1D9E75",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ダッシュボードに戻る
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Render: Main ──

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f9fafb" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
                margin: "0 0 4px 0",
              }}
            >
              プロフィール編集
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              入力した内容はメンバープロフィールページに表示されます
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 12,
                fontSize: 14,
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}

          {/* Progress */}
          <ProgressBar percent={calcProgress()} />

          {/* Sections */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 16,
            }}
          >
            {/* ① どんな人？ */}
            <SectionCard
              title="どんな人？"
              onSave={saveTagline}
              saving={saving === "tagline"}
              saved={!!savedSections["tagline"]}
            >
              <textarea
                value={tagline}
                onChange={(e) => setTagline(e.target.value.slice(0, 100))}
                placeholder="例：SIerから外資SaaSへ。技術がわかる営業として活動中です。"
                rows={3}
                style={textareaStyle}
              />
              <p
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                {tagline.length}/100
              </p>
            </SectionCard>

            {/* ② 基本情報 */}
            <SectionCard
              title="基本情報"
              onSave={saveBasicInfo}
              saving={saving === "basic"}
              saved={!!savedSections["basic"]}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>年代</label>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    style={{ ...inputStyle, background: "#fff" }}
                  >
                    {AGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt || "選択してください"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>居住地</label>
                  <input
                    type="text"
                    value={locationVal}
                    onChange={(e) => setLocationVal(e.target.value)}
                    placeholder="例：東京都渋谷区"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>出身地</label>
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    placeholder="例：大阪府"
                    style={inputStyle}
                  />
                </div>
              </div>
            </SectionCard>

            {/* ③ 本音Q&A */}
            <SectionCard
              title="本音Q&A"
              onSave={saveHonestQa}
              saving={saving === "qa"}
              saved={!!savedSections["qa"]}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {honestQa.map((qa, i) => (
                  <div key={i}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#1D9E75",
                        marginBottom: 8,
                      }}
                    >
                      Q{i + 1}. {qa.question}
                    </p>
                    <textarea
                      value={qa.answer}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 200);
                        setHonestQa((prev) =>
                          prev.map((q, idx) =>
                            idx === i ? { ...q, answer: val } : q
                          )
                        );
                      }}
                      placeholder="回答を入力してください..."
                      rows={3}
                      style={textareaStyle}
                    />
                    <p
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        marginTop: 4,
                        textAlign: "right",
                      }}
                    >
                      {qa.answer.length}/200
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ④ スキルタグ */}
            <SectionCard
              title="スキル"
              onSave={saveSkillTags}
              saving={saving === "skills"}
              saved={!!savedSections["skills"]}
            >
              <TagInput
                tags={skillTags}
                setTags={setSkillTags}
                max={10}
                placeholder="例：法人営業、SaaS、マネジメント"
              />
            </SectionCard>

            {/* ⑤ 趣味・人柄 */}
            <SectionCard
              title="趣味・人柄"
              onSave={saveHobby}
              saving={saving === "hobby"}
              saved={!!savedSections["hobby"]}
            >
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>
                  趣味タグ
                </label>
                <TagInput
                  tags={hobbyTags}
                  setTags={setHobbyTags}
                  max={8}
                  placeholder="例：キャンプ、読書、ランニング"
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>
                  自由記述
                </label>
                <textarea
                  value={hobbyDescription}
                  onChange={(e) =>
                    setHobbyDescription(e.target.value.slice(0, 200))
                  }
                  placeholder="趣味や人柄について自由に書いてください"
                  rows={3}
                  style={textareaStyle}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {hobbyDescription.length}/200
                </p>
              </div>
            </SectionCard>

            {/* ⑥ 職歴の入社理由・仕事内容 */}
            {workHistories.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f3f4f6",
                  borderRadius: 12,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      width: 3,
                      height: 14,
                      background: "#1D9E75",
                      borderRadius: 999,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}
                  >
                    職歴の入社理由・仕事内容
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                  }}
                >
                  {workHistories.map((wh, idx) => {
                    const key = `wh-${wh.id}`;
                    return (
                      <div
                        key={wh.id}
                        style={{
                          borderTop:
                            idx > 0 ? "1px solid #f3f4f6" : "none",
                          paddingTop: idx > 0 ? 24 : 0,
                        }}
                      >
                        {/* Company header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: "#E1F5EE",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#065F46",
                              flexShrink: 0,
                            }}
                          >
                            {wh.company_name[0]}
                          </div>
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#111827",
                                margin: 0,
                              }}
                            >
                              {wh.company_name}
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                margin: 0,
                              }}
                            >
                              {wh.role} / {wh.joined_year}年〜
                              {wh.left_year ? `${wh.left_year}年` : "現在"}
                            </p>
                          </div>
                        </div>

                        {/* Fields */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                color: "#185FA5",
                              }}
                            >
                              入社理由
                            </label>
                            <textarea
                              value={wh.reason_join}
                              onChange={(e) => {
                                const val = e.target.value.slice(0, 200);
                                setWorkHistories((prev) =>
                                  prev.map((w) =>
                                    w.id === wh.id
                                      ? { ...w, reason_join: val }
                                      : w
                                  )
                                );
                              }}
                              placeholder="なぜこの会社に入ろうと思ったのか"
                              rows={3}
                              style={textareaStyle}
                            />
                            <p
                              style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 4,
                                textAlign: "right",
                              }}
                            >
                              {wh.reason_join.length}/200
                            </p>
                          </div>
                          <div>
                            <label style={labelStyle}>仕事内容</label>
                            <textarea
                              value={wh.description}
                              onChange={(e) => {
                                const val = e.target.value.slice(0, 200);
                                setWorkHistories((prev) =>
                                  prev.map((w) =>
                                    w.id === wh.id
                                      ? { ...w, description: val }
                                      : w
                                  )
                                );
                              }}
                              placeholder="どんな仕事をしているか / していたか"
                              rows={3}
                              style={textareaStyle}
                            />
                            <p
                              style={{
                                fontSize: 12,
                                color: "#9ca3af",
                                marginTop: 4,
                                textAlign: "right",
                              }}
                            >
                              {wh.description.length}/200
                            </p>
                          </div>
                        </div>

                        {/* Save button */}
                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 12,
                          }}
                        >
                          {savedSections[key] && (
                            <span
                              style={{
                                fontSize: 13,
                                color: "#059669",
                                fontWeight: 500,
                              }}
                            >
                              保存しました
                            </span>
                          )}
                          <button
                            onClick={() => saveWorkHistory(wh)}
                            disabled={saving === key}
                            style={{
                              padding: "8px 24px",
                              borderRadius: 8,
                              fontSize: 14,
                              fontWeight: 600,
                              background:
                                saving === key ? "#9ca3af" : "#1D9E75",
                              color: "#fff",
                              border: "none",
                              cursor:
                                saving === key
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {saving === key ? "保存中..." : "保存する"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Back link */}
            <div
              style={{
                textAlign: "center",
                paddingTop: 8,
                paddingBottom: 20,
              }}
            >
              <button
                onClick={() => router.back()}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 14,
                  color: "#6b7280",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                &larr; 戻る
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
