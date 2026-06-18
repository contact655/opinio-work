import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { TrendingUp, CheckCircle, Clock } from "lucide-react";

async function getCareerUsers() {
  const supabase = createAdminClient();

  // ow_experiences を持つユーザーを取得（experience count付き）
  const { data: users } = await supabase
    .from("ow_users")
    .select(`
      id, name, email, created_at,
      ow_experiences(id, role_title, company_text, is_current, salary_man),
      ow_career_profiles(id, headline, is_published, updated_at)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  return users ?? [];
}

export default async function AdminCareerPage() {
  const users = await getCareerUsers();

  const withExp = users.filter((u: any) => u.ow_experiences?.length > 0);
  const published = withExp.filter((u: any) => u.ow_career_profiles?.[0]?.is_published);
  const hasSalary = withExp.filter((u: any) =>
    u.ow_experiences?.some((e: any) => e.salary_man != null)
  );

  return (
    <div style={{ padding: 32 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <TrendingUp size={22} color="var(--royal)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            キャリア軌跡管理
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            background: "var(--error)", color: "#fff",
            padding: "2px 7px", borderRadius: 4,
          }}>ADMIN</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
          ユーザーの職歴に年収・公開設定を入力し、キャリア軌跡として公開します
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {[
          { label: "職歴あり", value: withExp.length, color: "var(--royal)" },
          { label: "年収入力済み", value: hasSalary.length, color: "var(--success)" },
          { label: "公開中", value: published.length, color: "#7C3AED" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
            padding: "14px 20px", minWidth: 120,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "Inter" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── User Table ── */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--line-soft)", borderBottom: "1px solid var(--line)" }}>
              {["ユーザー", "職歴ステップ数", "年収入力", "キャリアプロフィール", "公開状態", ""].map((h) => (
                <th key={h} style={{
                  padding: "10px 16px", textAlign: "left",
                  fontSize: 11, fontWeight: 700, color: "var(--ink-soft)",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withExp.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--ink-mute)", fontSize: 14 }}>
                  職歴データを持つユーザーがいません
                </td>
              </tr>
            )}
            {withExp.map((user: any) => {
              const exps = user.ow_experiences ?? [];
              const profile = user.ow_career_profiles?.[0];
              const salaryCount = exps.filter((e: any) => e.salary_man != null).length;
              const isPublished = profile?.is_published === true;

              return (
                <tr key={user.id} style={{
                  borderBottom: "1px solid var(--line-soft)",
                  transition: "background 0.1s",
                }}>
                  {/* ユーザー */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>
                        {user.name?.[0] ?? "?"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                          {user.name ?? "名前未設定"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* 職歴ステップ数 */}
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontFamily: "Inter", fontWeight: 700, fontSize: 15, color: "var(--royal)",
                    }}>
                      {exps.length}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-soft)", fontFamily: "inherit" }}>
                        ステップ
                      </span>
                    </span>
                  </td>

                  {/* 年収入力 */}
                  <td style={{ padding: "12px 16px" }}>
                    {salaryCount > 0 ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 12, fontWeight: 600, color: "var(--success)",
                        background: "var(--success-soft)", padding: "3px 8px", borderRadius: 100,
                      }}>
                        <CheckCircle size={11} />
                        {salaryCount}/{exps.length}件
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>未入力</span>
                    )}
                  </td>

                  {/* キャリアプロフィール */}
                  <td style={{ padding: "12px 16px" }}>
                    {profile ? (
                      <div style={{ fontSize: 13, color: "var(--ink)" }}>
                        {profile.headline ?? <span style={{ color: "var(--ink-mute)" }}>見出し未設定</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>未作成</span>
                    )}
                  </td>

                  {/* 公開状態 */}
                  <td style={{ padding: "12px 16px" }}>
                    {isPublished ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 12, fontWeight: 600, color: "#7C3AED",
                        background: "#F3E8FF", padding: "3px 8px", borderRadius: 100,
                      }}>
                        <CheckCircle size={11} />
                        公開中
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 12, color: "var(--ink-mute)",
                        background: "var(--line-soft)", padding: "3px 8px", borderRadius: 100,
                      }}>
                        <Clock size={11} />
                        {profile ? "非公開" : "未作成"}
                      </span>
                    )}
                  </td>

                  {/* 編集ボタン */}
                  <td style={{ padding: "12px 16px" }}>
                    <Link
                      href={`/admin/career/${user.id}`}
                      style={{
                        display: "inline-block", padding: "6px 14px", borderRadius: 6,
                        background: "var(--royal)", color: "#fff",
                        fontSize: 12, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      編集 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 職歴なしユーザーの案内 */}
      {users.length - withExp.length > 0 && (
        <p style={{ marginTop: 16, fontSize: 12, color: "var(--ink-mute)" }}>
          ※ 職歴データなしのユーザー {users.length - withExp.length}名 は非表示
        </p>
      )}
    </div>
  );
}
