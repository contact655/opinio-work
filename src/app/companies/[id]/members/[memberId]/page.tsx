import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────

type MemberHonestQA = {
  id: string;
  question: string;
  answer: string;
  display_order: number;
};

type WorkHistory = {
  id: string;
  company_id: string;
  company?: { name: string; logo_url?: string } | null;
  role: string;
  department?: string;
  joined_year: number;
  left_year?: number;
  description?: string;
  reason_join?: string;
  good_points?: string;
  hard_points?: string;
  is_public: boolean;
};

type Education = {
  id: string;
  school_name: string;
  faculty?: string;
  department?: string;
  enrollment_year?: number;
  graduation_year?: number;
};

type MemberProfile = {
  id: string;
  user_id?: string | null;
  company_id: string;
  company?: { name: string; logo_url?: string } | null;
  name: string;
  role: string;
  background?: string;
  photo_url?: string;
  tagline?: string;
  age_range?: string;
  location?: string;
  hometown?: string;
  is_current: boolean;
  skill_tags: string[];
  hobby_tags: string[];
  hobby_description?: string;
  header_color: string;
  honest_qa: MemberHonestQA[];
  work_histories: WorkHistory[];
  educations: Education[];
};

// ─── Constants ─────────────────────────────────────

const HONEST_QUESTIONS = [
  "なぜこの会社に入ったの？",
  "転職して後悔したことは？",
  "この会社、正直どう？",
];

// ─── Data Fetching ─────────────────────────────────

async function getMemberProfile(
  memberId: string,
  companyId: string
): Promise<{ member: MemberProfile; isOwner: boolean } | null> {
  const supabase = createClient();
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cmMember } = await supabase
    .from("ow_company_members")
    .select("*")
    .eq("id", memberId)
    .single();

  const { data: whMember } = await supabase
    .from("work_histories")
    .select("*")
    .eq("id", memberId)
    .eq("is_public", true)
    .single();

  if (!cmMember && !whMember) return null;

  let honestQa: MemberHonestQA[] = [];
  if (cmMember) {
    const { data: qaData } = await supabase
      .from("ow_member_honest_qa")
      .select("*")
      .eq("member_id", memberId)
      .order("display_order", { ascending: true });
    honestQa = (qaData as MemberHonestQA[]) || [];
  }

  const { data: company } = await supabase
    .from("ow_companies")
    .select("name, logo_url, user_id")
    .eq("id", companyId)
    .single();

  // user_idがnullの場合、ow_profilesからnameで検索してuser_idを推定
  async function resolveUserId(
    memberUserId: string | null | undefined,
    memberName: string
  ): Promise<string | null> {
    if (memberUserId) return memberUserId;
    // ow_profilesからname一致でuser_idを取得
    const { data: profileMatch } = await adminClient
      .from("ow_profiles")
      .select("user_id")
      .eq("name", memberName)
      .limit(1)
      .single();
    if (profileMatch?.user_id) {
      console.log("[member-profile] resolved user_id from ow_profiles:", profileMatch.user_id, "for name:", memberName);
      return profileMatch.user_id;
    }
    return null;
  }

  // cmMember or whMember の user_id を解決
  const rawUserId = cmMember?.user_id || whMember?.user_id;
  const memberName = cmMember?.name || "";
  const resolvedUserId = await resolveUserId(rawUserId, memberName);

  console.log("[member-profile] auth user id:", user?.id);
  console.log("[member-profile] raw member user_id:", rawUserId);
  console.log("[member-profile] resolvedUserId:", resolvedUserId);
  console.log("[member-profile] company.user_id:", company?.user_id);

  // resolvedUserIdを使ってwork_histories・学歴を取得
  let workHistories: WorkHistory[] = [];
  if (resolvedUserId) {
    const { data: whData } = await adminClient
      .from("work_histories")
      .select("*, company:ow_companies(name, logo_url)")
      .eq("user_id", resolvedUserId)
      .eq("is_public", true)
      .order("joined_year", { ascending: false });
    workHistories = (whData as WorkHistory[]) || [];
  }

  // 学歴取得
  let educations: Education[] = [];
  if (resolvedUserId) {
    const { data: eduData } = await adminClient
      .from("candidate_educations")
      .select("*")
      .eq("user_id", resolvedUserId)
      .order("graduation_year", { ascending: false });
    educations = (eduData as Education[]) || [];
  }

  function checkIsOwner(memberUserId: string | null | undefined): boolean {
    if (!user) return false;
    if (memberUserId && user.id === memberUserId) return true;
    if (company?.user_id && user.id === company.user_id) return true;
    return false;
  }

  if (cmMember) {
    const isOwner = checkIsOwner(resolvedUserId);
    console.log("[member-profile] isOwner:", isOwner);
    return {
      member: {
        id: cmMember.id,
        user_id: cmMember.user_id,
        company_id: companyId,
        company: company
          ? { name: company.name, logo_url: company.logo_url }
          : null,
        name: cmMember.name || "メンバー",
        role: cmMember.role || "",
        background: cmMember.background,
        photo_url: cmMember.photo_url,
        tagline: cmMember.tagline,
        age_range: cmMember.age_range,
        location: cmMember.location,
        hometown: cmMember.hometown,
        is_current: cmMember.is_current ?? true,
        skill_tags: cmMember.skill_tags || [],
        hobby_tags: cmMember.hobby_tags || [],
        hobby_description: cmMember.hobby_description,
        header_color: cmMember.header_color || "#1D9E75",
        honest_qa: honestQa,
        work_histories: workHistories,
        educations,
      },
      isOwner,
    };
  }

  if (whMember) {
    const { data: profile } = await adminClient
      .from("ow_profiles")
      .select("name, bio")
      .eq("user_id", whMember.user_id)
      .single();

    if (!profile?.name) return null;

    const isOwner = checkIsOwner(whMember.user_id);
    return {
      member: {
        id: whMember.id,
        user_id: whMember.user_id,
        company_id: companyId,
        company: company
          ? { name: company.name, logo_url: company.logo_url }
          : null,
        name: profile.name,
        role: whMember.role || "",
        background: profile.bio || undefined,
        tagline: undefined,
        age_range: undefined,
        location: undefined,
        hometown: undefined,
        is_current: whMember.status === "current",
        skill_tags: [],
        hobby_tags: [],
        hobby_description: undefined,
        header_color: "#1D9E75",
        honest_qa: [],
        work_histories:
          workHistories.length > 0
            ? workHistories
            : [
                {
                  id: whMember.id,
                  company_id: companyId,
                  company: company
                    ? { name: company.name, logo_url: company.logo_url }
                    : null,
                  role: whMember.role || "",
                  department: whMember.department,
                  joined_year: whMember.joined_year,
                  left_year: whMember.left_year,
                  description: whMember.description,
                  reason_join: whMember.reason_join,
                  good_points: whMember.good_points,
                  hard_points: whMember.hard_points,
                  is_public: true,
                },
              ],
        educations,
      },
      isOwner,
    };
  }

  return null;
}

// ─── Sub-components ────────────────────────────────

function ProfileSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 3,
            height: 14,
            background: "#1D9E75",
            borderRadius: 999,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 999,
              background: "#FAEEDA",
              color: "#854F0B",
              border: "1px solid #FAC775",
              fontWeight: 500,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function MetaRow({
  icon,
  text,
  muted = false,
  showLink = false,
}: {
  icon: string;
  text: string;
  muted?: boolean;
  showLink?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          background: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "#6b7280",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 14,
          color: muted ? "#6b7280" : "#4b5563",
          flex: 1,
        }}
      >
        {text}
      </span>
      {muted && showLink && (
        <Link
          href="/mypage/profile"
          style={{
            fontSize: 14,
            color: "#1D9E75",
            textDecoration: "underline",
            flexShrink: 0,
          }}
        >
          追加 →
        </Link>
      )}
    </div>
  );
}

function EmptyState({
  text,
  buttonText,
  href,
  showButton = true,
}: {
  text: string;
  buttonText?: string;
  href?: string;
  showButton?: boolean;
}) {
  return (
    <div
      style={{
        border: "1.5px dashed #d1d5db",
        borderRadius: 8,
        padding: "16px 12px",
        textAlign: "center",
        background: "#f9fafb",
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: "#4b5563",
          margin: showButton && buttonText ? "0 0 10px 0" : "0",
        }}
      >
        {text}
      </p>
      {showButton && buttonText && href && (
        <Link
          href={href}
          style={{
            fontSize: 14,
            color: "#1D9E75",
            textDecoration: "underline",
          }}
        >
          {buttonText}
        </Link>
      )}
    </div>
  );
}

// ─── Page Component ────────────────────────────────

export default async function MemberDetailPage({
  params,
}: {
  params: { id: string; memberId: string };
}) {
  const result = await getMemberProfile(params.memberId, params.id);
  if (!result) notFound();

  const { member, isOwner } = result;
  const companyName = member.company?.name || "企業";
  const hasTagline = !!(member.tagline || member.background);
  const hasSkills = member.skill_tags.length > 0;
  const hasHobby = member.hobby_tags.length > 0 || !!member.hobby_description;
  const hasEducations = member.educations.length > 0;

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f9fafb" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          {/* パンくず */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            <Link
              href="/companies"
              style={{ color: "#1a6fd4", textDecoration: "none" }}
            >
              企業一覧
            </Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            <Link
              href={`/companies/${params.id}`}
              style={{ color: "#1a6fd4", textDecoration: "none" }}
            >
              {companyName}
            </Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            <span style={{ color: "#6b7280" }}>{member.name}</span>
          </nav>

          {/* ═══ ヘッダーカード（全幅） ═══ */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #f3f4f6",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div style={{ height: 80, background: member.header_color }} />
            <div style={{ padding: "0 24px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  marginTop: -32,
                  marginBottom: 12,
                }}
              >
                {member.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photo_url}
                    alt={member.name}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      border: "3px solid #fff",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      border: "3px solid #fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 500,
                      color: "#fff",
                      background: member.header_color,
                    }}
                  >
                    {member.name[0]}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontWeight: 500,
                    ...(member.is_current
                      ? {
                          background: "#E1F5EE",
                          color: "#0F6E56",
                          border: "1px solid #9FE1CB",
                        }
                      : {
                          background: "#f3f4f6",
                          color: "#6b7280",
                          border: "1px solid #d1d5db",
                        }),
                  }}
                >
                  {member.is_current ? "現役" : "OB/OG"}
                </span>
              </div>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  color: "#111827",
                  margin: "0 0 4px 0",
                }}
              >
                {member.name}
              </h1>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                {companyName} · {member.role}
                {member.age_range && ` · ${member.age_range}`}
                {member.location && ` · ${member.location}`}
              </p>
            </div>
          </div>

          {/* ═══ 2カラムレイアウト ═══ */}
          <div
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            style={{ gap: 12, alignItems: "start" }}
          >
            {/* ── 左カラム（メイン） ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* どんな人？（常に表示） */}
              <ProfileSection title="どんな人？">
                {hasTagline ? (
                  <div
                    style={{
                      background: "#f9fafb",
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 14,
                        color: "#1f2937",
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      {member.tagline ?? member.background}
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    text="まだ登録されていません"
                    buttonText="プロフィールを編集する →"
                    href="/mypage/profile"
                    showButton={isOwner}
                  />
                )}
              </ProfileSection>

              {/* 本音Q&A（常に表示・3問すべて） */}
              <ProfileSection title="本音Q&A" badge="Opinio独自">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {HONEST_QUESTIONS.map((q, i) => {
                    const qa = member.honest_qa.find(
                      (item) => item.display_order === i
                    );
                    if (qa) {
                      return (
                        <div
                          key={i}
                          style={{
                            background: "#f9fafb",
                            borderRadius: 8,
                            padding: 16,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#1D9E75",
                              margin: "0 0 6px 0",
                            }}
                          >
                            {q}
                          </p>
                          <p
                            style={{
                              fontSize: 14,
                              color: "#1f2937",
                              lineHeight: 1.7,
                              margin: 0,
                            }}
                          >
                            {qa.answer}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        style={{
                          border: "1.5px dashed #d1d5db",
                          borderRadius: 8,
                          padding: 16,
                          textAlign: "center",
                          background: "#f9fafb",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 14,
                            color: "#4b5563",
                            margin: isOwner ? "0 0 10px 0" : "0",
                          }}
                        >
                          「{q}」への回答がまだありません
                        </p>
                        {isOwner && (
                          <Link
                            href="/mypage/profile"
                            style={{
                              fontSize: 14,
                              color: "#1D9E75",
                              textDecoration: "underline",
                            }}
                          >
                            回答する →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ProfileSection>

              {/* 職歴 */}
              {member.work_histories.length > 0 && (
                <ProfileSection title="職歴">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                    }}
                  >
                    {member.work_histories.map((wh, i) => (
                      <div key={wh.id}>
                        {i > 0 && (
                          <hr
                            style={{
                              border: "none",
                              borderTop: "1px solid #f3f4f6",
                              marginBottom: 20,
                            }}
                          />
                        )}
                        <div style={{ display: "flex", gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: "#E1F5EE",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#0F6E56",
                              flexShrink: 0,
                            }}
                          >
                            {wh.company?.name?.[0] ?? companyName[0] ?? "?"}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#111827",
                                margin: "0 0 2px 0",
                              }}
                            >
                              {wh.role}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                color: "#6b7280",
                                margin: "0 0 2px 0",
                              }}
                            >
                              {wh.company?.name ?? companyName}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                color: "#4b5563",
                                margin: "0 0 12px 0",
                              }}
                            >
                              {wh.joined_year}年〜
                              {wh.left_year ? `${wh.left_year}年` : "現在"}
                              （
                              {(wh.left_year ?? new Date().getFullYear()) -
                                wh.joined_year}
                              年）
                            </p>

                            {/* 入社理由 */}
                            <div
                              style={{
                                background: "#E6F1FB",
                                borderRadius: 8,
                                padding: 12,
                                marginBottom: 8,
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "#185FA5",
                                  margin: "0 0 4px 0",
                                }}
                              >
                                入社理由
                              </p>
                              {wh.reason_join ? (
                                <p
                                  style={{
                                    fontSize: 14,
                                    color: "#0C447C",
                                    lineHeight: 1.7,
                                    margin: 0,
                                  }}
                                >
                                  {wh.reason_join}
                                </p>
                              ) : isOwner ? (
                                <Link
                                  href="/mypage/profile"
                                  style={{
                                    fontSize: 14,
                                    color: "#1D9E75",
                                    textDecoration: "underline",
                                  }}
                                >
                                  入社理由を追加する →
                                </Link>
                              ) : (
                                <p
                                  style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    margin: 0,
                                  }}
                                >
                                  未入力
                                </p>
                              )}
                            </div>

                            {/* 仕事内容 */}
                            <div
                              style={{
                                background: "#f9fafb",
                                borderRadius: 8,
                                padding: 12,
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: wh.description ? "#6b7280" : "#9ca3af",
                                  margin: "0 0 4px 0",
                                }}
                              >
                                仕事内容
                              </p>
                              {wh.description ? (
                                <p
                                  style={{
                                    fontSize: 14,
                                    color: "#4b5563",
                                    lineHeight: 1.7,
                                    margin: 0,
                                  }}
                                >
                                  {wh.description}
                                </p>
                              ) : isOwner ? (
                                <Link
                                  href="/mypage/profile"
                                  style={{
                                    fontSize: 14,
                                    color: "#1D9E75",
                                    textDecoration: "underline",
                                  }}
                                >
                                  仕事内容を追加する →
                                </Link>
                              ) : (
                                <p
                                  style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    margin: 0,
                                  }}
                                >
                                  未入力
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ProfileSection>
              )}
            </div>

            {/* ── 右カラム（サイド） ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 基本情報 */}
              <ProfileSection title="基本情報">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <MetaRow
                    icon="歳"
                    text={member.age_range || "未登録"}
                    muted={!member.age_range}
                    showLink={isOwner}
                  />
                  <MetaRow
                    icon="地"
                    text={member.location || "未登録"}
                    muted={!member.location}
                    showLink={isOwner}
                  />
                  <MetaRow
                    icon="出"
                    text={
                      member.hometown ? `${member.hometown}出身` : "未登録"
                    }
                    muted={!member.hometown}
                    showLink={isOwner}
                  />
                </div>
              </ProfileSection>

              {/* 学歴 */}
              <ProfileSection title="学歴">
                {hasEducations ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {member.educations.map((edu) => (
                      <div key={edu.id}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#111827",
                            margin: "0 0 2px 0",
                          }}
                        >
                          {edu.school_name}
                        </p>
                        {(edu.faculty || edu.department) && (
                          <p
                            style={{
                              fontSize: 13,
                              color: "#6b7280",
                              margin: "0 0 2px 0",
                            }}
                          >
                            {[edu.faculty, edu.department]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        )}
                        {(edu.enrollment_year || edu.graduation_year) && (
                          <p
                            style={{
                              fontSize: 12,
                              color: "#9ca3af",
                              margin: 0,
                            }}
                          >
                            {edu.enrollment_year
                              ? `${edu.enrollment_year}年`
                              : ""}
                            {edu.enrollment_year && edu.graduation_year
                              ? " 〜 "
                              : ""}
                            {edu.graduation_year
                              ? `${edu.graduation_year}年`
                              : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    text="まだ登録されていません"
                    buttonText="学歴を追加する →"
                    href="/mypage/profile"
                    showButton={isOwner}
                  />
                )}
              </ProfileSection>

              {/* スキル */}
              <ProfileSection title="スキル">
                {hasSkills ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {member.skill_tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#f9fafb",
                          color: "#4b5563",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    text="まだ登録されていません"
                    buttonText="スキルを追加する →"
                    href="/mypage/profile"
                    showButton={isOwner}
                  />
                )}
              </ProfileSection>

              {/* 趣味・人柄 */}
              <ProfileSection title="趣味・人柄">
                {hasHobby ? (
                  <>
                    {member.hobby_tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginBottom: member.hobby_description ? 10 : 0,
                        }}
                      >
                        {member.hobby_tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: "#f9fafb",
                              color: "#4b5563",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {member.hobby_description && (
                      <p
                        style={{
                          fontSize: 14,
                          color: "#374151",
                          lineHeight: 1.7,
                          margin: 0,
                        }}
                      >
                        {member.hobby_description}
                      </p>
                    )}
                  </>
                ) : (
                  <EmptyState
                    text="まだ登録されていません"
                    buttonText="追加する →"
                    href="/mypage/profile"
                    showButton={isOwner}
                  />
                )}
              </ProfileSection>
            </div>
          </div>

          {/* ═══ 戻るリンク ═══ */}
          <div style={{ marginTop: 16 }}>
            <Link
              href={`/companies/${params.id}`}
              style={{
                fontSize: 14,
                color: "#6b7280",
                textDecoration: "none",
              }}
            >
              ← {companyName}に戻る
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
