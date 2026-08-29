import { createAdminClient } from "@/lib/supabase/admin";
import { CandidatesClient } from "./CandidatesClient";

async function getUsers(query?: string) {
  const admin = createAdminClient();

  let q = admin
    .from("ow_users")
    // ⚠️ can_talk_to_candidates は選ばない（2026-08-05 に一覧から外した。カラムは残存）
    .select("id, auth_id, name, email, is_mentor, location, birth_date, visibility, created_at")
    .order("created_at", { ascending: false });

  if (query) {
    const safeQuery = query.replace(/[(),"\\]/g, "");
    if (safeQuery) {
      q = q.or(`name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,location.ilike.%${safeQuery}%`);
    }
  }

  const [{ data: users }, authResult, { data: bizAdmins }] = await Promise.all([
    q.limit(500),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("ow_company_admins").select("user_id").eq("is_active", true),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authUsers = (authResult as any).data?.users ?? [];
  const authMap = new Map<string, string | null>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authUsers.map((u: any) => [u.id as string, (u.last_sign_in_at ?? null) as string | null])
  );
  const bizUserIds = new Set((bizAdmins ?? []).map((a) => a.user_id).filter(Boolean));

  return (users ?? []).map((u) => ({
    ...u,
    lastLogin: u.auth_id ? (authMap.get(u.auth_id) ?? null) : null,
    isBizAdmin: bizUserIds.has(u.id),
  }));
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const users = await getUsers(searchParams.q);
  const mentorCount = users.filter((u) => u.is_mentor).length;
  const bizAdminCount = users.filter((u) => u.isBizAdmin).length;
  const neverLoggedInCount = users.filter((u) => !u.lastLogin).length;

  return (
    <div style={{ padding: 32 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            ユーザー管理
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
            <strong style={{ color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {users.length}
            </strong>{" "}名
          </span>
          {mentorCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              うちメンター{" "}
              <strong style={{ color: "#7C3AED", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                {mentorCount}
              </strong>{" "}名
            </span>
          )}
          {bizAdminCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              うちBIZ担当者{" "}
              <strong style={{ color: "#001233", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                {bizAdminCount}
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

      {/* ── Search ── */}
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

      {/* ── Table (Client Component with bulk ops) ── */}
      <CandidatesClient users={users} />
    </div>
  );
}
