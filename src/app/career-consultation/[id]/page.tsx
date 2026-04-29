import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getMentorAvatarProps } from "@/lib/utils/mentorAvatar";

export const dynamic = "force-dynamic";

type CareerItem = {
  year: string;
  company: string;
  role: string;
  duration: string;
};

type ConsultationCase = {
  category: string;
  situation: string;
  comment: string;
};

const COVER_COLORS: Record<string, string> = {
  柴: "#0f172a",
  田中: "#0070d2",
  佐藤: "#ff7a59",
  鈴木: "#2d1b4e",
  伊藤: "#1a1a2e",
  中村: "#003366",
  小林: "#007aff",
  加藤: "#0070d2",
  渡辺: "#ff7a59",
};

function getCoverColor(name: string): string {
  for (const key of Object.keys(COVER_COLORS)) {
    if (name.startsWith(key)) return COVER_COLORS[key];
  }
  return "#1a2e44";
}

export default async function MentorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: mentor } = await supabase
    .from("ow_mentors")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!mentor) notFound();

  const coverColor = getCoverColor(mentor.name);

  const allTags = [...(mentor.roles || []), ...(mentor.worries || [])];
  const careerHistory: CareerItem[] = mentor.career_history || [];
  const cases: ConsultationCase[] = mentor.consultation_cases || [];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f9fafb" }}>
        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2" style={{ fontSize: 13, color: "#9ca3af" }}>
            <Link href="/career-consultation" style={{ color: "#9ca3af", textDecoration: "none" }}>
              メンター一覧
            </Link>
            <span>›</span>
            <span style={{ color: "#6b7280" }}>{mentor.name}</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-3 gap-6">
            {/* LEFT: Main content */}
            <div className="col-span-2 flex flex-col gap-5">
              {/* Header card */}
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f3f4f6",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: coverColor,
                    padding: "28px 24px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  {(() => {
                    const ap = getMentorAvatarProps(mentor.name, mentor.avatar_url);
                    if (ap.type === "image") return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ap.src} alt={mentor.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    );
                    return (
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: ap.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 500, color: ap.textColor, flexShrink: 0 }}>
                        {ap.char}
                      </div>
                    );
                  })()}
                  <div>
                    <h1 className="text-2xl font-medium text-white" style={{ margin: 0 }}>
                      {mentor.name}
                    </h1>
                    {(mentor.current_company || mentor.current_role) && (
                      <div className="text-sm text-white/80 mt-1">
                        {[mentor.current_company, mentor.current_role].filter(Boolean).join(" / ")}
                      </div>
                    )}
                    {mentor.previous_career && mentor.current_career && (
                      <div className="text-sm text-white/70 mt-0.5">
                        元{mentor.previous_career} → 現{mentor.current_career}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: "16px 24px 20px" }}>
                  {allTags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {allTags.map((tag: string) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#f0fdf4",
                            color: "#15803d",
                            fontWeight: 500,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              {mentor.bio && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f3f4f6",
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
                    自己紹介
                  </h2>
                  <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.8 }}>
                    {mentor.bio}
                  </p>
                </div>
              )}

              {/* Career timeline */}
              {careerHistory.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f3f4f6",
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
                    キャリア
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {careerHistory.map((item: CareerItem, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#22c55e",
                              marginTop: 6,
                              flexShrink: 0,
                            }}
                          />
                          {i < careerHistory.length - 1 && (
                            <div
                              style={{
                                width: 1,
                                flexGrow: 1,
                                background: "#e5e7eb",
                                marginTop: 4,
                                minHeight: 24,
                              }}
                            />
                          )}
                        </div>
                        <div style={{ paddingBottom: 16 }}>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>
                            {item.year} · {item.duration}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            {item.company}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                            {item.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consultation cases */}
              {cases.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f3f4f6",
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 16 }}>
                    実際の相談事例
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {cases.map((c: ConsultationCase, i: number) => (
                      <div
                        key={i}
                        style={{
                          border: "1px solid #f3f4f6",
                          borderRadius: 12,
                          padding: 16,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "#f0fdf4",
                            color: "#15803d",
                          }}
                        >
                          {c.category}
                        </span>
                        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 10, marginBottom: 12, lineHeight: 1.7 }}>
                          {c.situation}
                        </p>
                        <div
                          style={{
                            background: "#f0fdf4",
                            borderRadius: 8,
                            padding: 12,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
                            メンターのコメント
                          </div>
                          <p style={{ fontSize: 12, color: "#166534", lineHeight: 1.7, margin: 0 }}>
                            {c.comment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Concerns list (if no cases) */}
              {cases.length === 0 && mentor.concerns && mentor.concerns.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f3f4f6",
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
                    こんな悩みに答えられます
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {mentor.concerns.map((c: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#374151" }}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* キャリア経歴（テキスト） */}
              {mentor.career_history_text && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6">
                  <h2 className="text-base font-medium text-gray-900 mb-4">キャリア経歴</h2>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {mentor.career_history_text}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div className="flex flex-col gap-4">
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f3f4f6",
                  borderRadius: 16,
                  padding: 20,
                  position: "sticky",
                  top: 88,
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
                    {mentor.name}さんに相談する
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    完全無料・30分・オンライン
                  </div>
                </div>

                <Link
                  href={`/consultation-request?mentor_id=${mentor.id}&mentor_name=${encodeURIComponent(mentor.name)}`}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "#111827",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "12px 0",
                    borderRadius: 10,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  相談を申し込む
                </Link>

                <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
                  営業は一切なし。転職するかどうか<br />決まっていなくてもOKです。
                </div>

                {((mentor.total_sessions || mentor.total_consultations || 0) > 0 || (mentor.success_count || 0) > 0) && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
                    {(mentor.total_sessions || mentor.total_consultations || 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                        <span>相談実績</span>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {mentor.total_sessions || mentor.total_consultations || 0}回
                        </span>
                      </div>
                    )}
                    {(mentor.success_count || 0) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                        <span>転職成功</span>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {mentor.success_count}名
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Link
                href="/career-consultation"
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "#9ca3af",
                  textDecoration: "none",
                }}
              >
                ← メンター一覧に戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
