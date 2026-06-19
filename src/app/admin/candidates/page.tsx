import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAge } from "@/lib/age";
import { CanCasualMeetingToggle } from "./CanCasualMeetingToggle";

function getAvatarGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, var(--royal), #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, var(--success), #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #DC2626, #F87171)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    "linear-gradient(135deg, #D97706, #F59E0B)",
    "linear-gradient(135deg, #7C3AED, var(--royal))",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}

async function getUsers(query?: string) {
  const admin = createAdminClient();

  // ow_users の一覧取得
  let q = admin
    .from("ow_users")
    .select("id, auth_id, name, email, is_mentor, can_casual_meeting, location, birth_date, visibility, created_at")
    .order("created_at", { ascending: false });

  if (query) {
    q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%,location.ilike.%${query}%`);
  }

  const [{ data: users }, authResult] = await Promise.all([
    q.limit(100),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authUsers = (authResult as any).data?.users ?? [];
  const authMap = new Map<string, string | null>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authUsers.map((u: any) => [u.id as string, (u.last_sign_in_at ?? null) as string | null])
  );

  return (users ?? []).map((u) => ({
    ...u,
    lastLogin: u.auth_id ? (authMap.get(u.auth_id) ?? null) : null,
  }));
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const users = await getUsers(searchParams.q);
  const mentorCount = users.filter((u) => u.is_mentor).length;
  const neverLoggedInCount = users.filter((u) => !u.lastLogin).length;

  return (
    <div style={{ padding: 32 }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            求職者管理
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
            background: "var(--error)", color: "#fff",
            padding: "2px 7px", borderRadius: 4,
          }}>
            ADMIN
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            登録ユーザー{" "}
            <strong style={{ color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>
              {users.length}
            </strong>{" "}名
          </span>
          {mentorCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              うちメンター{" "}
              <strong style={{ color: "#7C3AED", fontFamily: "Inter, sans-serif" }}>
                {mentorCount}
              </strong>{" "}名
            </span>
          )}
          {neverLoggedInCount > 0 && (
            <span style={{
              fontSize: 12, padding: "3px 10px", borderRadius: 100,
              background: "#FEF3C7", color: "#B45309",
              border: "1px solid #FDE68A", fontWeight: 600,
            }}>
              未ログイン {neverLoggedInCount}名
            </span>
          )}
          {searchParams.q && (
            <span style={{
              fontSize: 12, padding: "2px 10px", borderRadius: 100,
              background: "var(--royal-50)", color: "var(--royal)",
              fontWeight: 600,
            }}>
              「{searchParams.q}」の検索結果
            </span>
          )}
        </div>
      </div>

      {/* ── Search ────────────────────────────────────────────────── */}
      <form action="/admin/candidates" method="GET" style={{ marginBottom: 24 }}>
        <div style={{ position: "relative", maxWidth: 440 }}>
          <svg
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-mute)" strokeWidth="2.5" strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q}
            placeholder="名前・メール・所在地で検索..."
            aria-label="候補者を検索"
            style={{
              width: "100%", padding: "9px 16px 9px 36px",
              border: "1.5px solid var(--line)", borderRadius: 8,
              fontSize: 13, color: "var(--ink)", background: "#fff",
              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
        </div>
      </form>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid var(--line)", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
              {["名前", "メール", "居住地", "年代", "公開設定", "面談可", "メンター", "最終ログイン", "登録日"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: "left", padding: "10px 14px",
                    fontSize: 11, color: "var(--ink-mute)", fontWeight: 700,
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}
                >
                  <div style={{ marginBottom: 8, fontSize: 28 }}>👤</div>
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                  className="admin-row"
                >
                  {/* 名前 */}
                  <td style={{ padding: "11px 14px" }}>
                    <a
                      href={`/u/${u.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        textDecoration: "none", color: "inherit",
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: getAvatarGradient(u.id || u.name || ""),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#fff",
                        letterSpacing: "0.02em",
                      }}>
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--royal)" }}>
                        {u.name || "未入力"}
                      </span>
                    </a>
                  </td>
                  {/* メール */}
                  <td style={{ padding: "11px 14px", color: "var(--ink-soft)", fontSize: 12 }}>
                    {u.email}
                  </td>
                  {/* 居住地 */}
                  <td style={{ padding: "11px 14px", color: "var(--ink-soft)" }}>
                    {u.location || <span style={{ color: "var(--ink-mute)" }}>—</span>}
                  </td>
                  {/* 年代 */}
                  <td style={{ padding: "11px 14px", color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                    {u.birth_date
                      ? `${getUserAge(u.birth_date)}歳`
                      : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                  </td>
                  {/* 公開設定 */}
                  <td style={{ padding: "11px 14px" }}>
                    {u.visibility === "public" ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: "var(--success-soft)", color: "var(--success)",
                        border: "1px solid #A7F3D0",
                      }}>公開</span>
                    ) : u.visibility === "login_only" ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: "var(--royal-50)", color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                      }}>ログイン限定</span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: "var(--line-soft)", color: "var(--ink-mute)",
                        border: "1px solid var(--line)",
                      }}>非公開</span>
                    )}
                  </td>
                  {/* 面談可 */}
                  <td style={{ padding: "11px 14px" }}>
                    <CanCasualMeetingToggle
                      userId={u.id}
                      initialValue={!!u.can_casual_meeting}
                    />
                  </td>
                  {/* メンター */}
                  <td style={{ padding: "11px 14px" }}>
                    {u.is_mentor ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 100,
                        background: "var(--purple-soft)", color: "var(--purple)",
                        border: "1px solid #DDD6FE",
                      }}>メンター</span>
                    ) : (
                      <span style={{ color: "var(--ink-mute)", fontSize: 13 }}>—</span>
                    )}
                  </td>
                  {/* 最終ログイン */}
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    {u.lastLogin ? (
                      <span style={{
                        fontSize: 12, color: "var(--ink-soft)",
                        fontFamily: "Inter, sans-serif",
                      }}>
                        {formatRelative(u.lastLogin)}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                        background: "#FEF3C7", color: "#B45309",
                      }}>未ログイン</span>
                    )}
                  </td>
                  {/* 登録日 */}
                  <td style={{ padding: "11px 14px", color: "var(--ink-mute)", fontSize: 11, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                    {new Date(u.created_at).toLocaleDateString("ja-JP")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-row:hover { background: var(--bg-tint); }
        .admin-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
