import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { AmbassadorToggle } from "./AmbassadorToggle";

export const dynamic = "force-dynamic";

const ENGAGEMENT_CONFIG = {
  none:       { label: "未認証",         bg: "#F1F5F9", color: "#6b7280",           border: "#E2E8F0" },
  verified:   { label: "ドメイン認証済", bg: "#EFF3FC", color: "var(--royal)",       border: "#DCE5F7" },
  contracted: { label: "契約済み",       bg: "#ECFDF5", color: "var(--success)",     border: "#A7F3D0" },
} as const;

type EngagementKey = keyof typeof ENGAGEMENT_CONFIG;

function getAvatarGradient(str: string): string {
  const gradients = [
    "linear-gradient(135deg, var(--royal), #3B5FD9)",
    "linear-gradient(135deg, #7C3AED, #A855F7)",
    "linear-gradient(135deg, var(--success), #10B981)",
    "linear-gradient(135deg, #F59E0B, #FBBF24)",
    "linear-gradient(135deg, #DC2626, #F87171)",
    "linear-gradient(135deg, #0EA5E9, #38BDF8)",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
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

type BizAccount = {
  id: string;
  companyId: string;
  companyName: string;
  companyEngagement: EngagementKey;
  companyPublished: boolean;
  userId: string | null;
  userName: string;
  userEmail: string;
  userAvatarColor: string | null;
  permission: "admin" | "member";
  roleTitle: string | null;
  department: string | null;
  isActive: boolean;
  isAmbassador: boolean;
  createdAt: string;
  lastLogin: string | null;
  neverLoggedIn: boolean;
};

async function getBizAccounts(): Promise<BizAccount[]> {
  const admin = createAdminClient();

  const [{ data: adminRows }, { data: users }, { data: companies }, authResult] =
    await Promise.all([
      admin
        .from("ow_company_admins")
        .select("id, company_id, user_id, permission, department, role_title, is_active, is_ambassador, created_at")
        .order("created_at", { ascending: false }),
      admin.from("ow_users").select("id, auth_id, name, email, avatar_color"),
      admin.from("ow_companies").select("id, name, engagement_status, is_published"),
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allUsers: any[] = [];
        let page = 1;
        while (true) {
          const { data } = await admin.auth.admin.listUsers({ perPage: 1000, page });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const batch = (data as any)?.users ?? [];
          allUsers.push(...batch);
          if (batch.length < 1000) break;
          page++;
        }
        return { data: { users: allUsers } };
      })(),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap = new Map<string, any>((users ?? []).map((u) => [u.id, u]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyMap = new Map<string, any>((companies ?? []).map((c) => [c.id, c]));
  // auth_id → last_sign_in_at
  const authMap = new Map<string, string | null>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((authResult as any).data?.users ?? []).map((u: any) => [u.id as string, (u.last_sign_in_at ?? null) as string | null])
  );

  return (adminRows ?? []).map((row) => {
    const user = userMap.get(row.user_id ?? "");
    const company = companyMap.get(row.company_id ?? "");
    const lastLogin = user?.auth_id ? (authMap.get(user.auth_id) ?? null) : null;
    const eng = (company?.engagement_status ?? "none") as string;
    return {
      id: row.id,
      companyId: row.company_id as string,
      companyName: company?.name ?? "—",
      companyEngagement: (eng in ENGAGEMENT_CONFIG ? eng : "none") as EngagementKey,
      companyPublished: company?.is_published ?? false,
      userId: row.user_id as string | null,
      userName: user?.name ?? "未設定",
      userEmail: user?.email ?? "—",
      userAvatarColor: user?.avatar_color ?? null,
      permission: (row.permission ?? "member") as "admin" | "member",
      roleTitle: row.role_title as string | null,
      department: row.department as string | null,
      isActive: row.is_active as boolean,
      isAmbassador: (row.is_ambassador as boolean) ?? false,
      createdAt: row.created_at as string,
      lastLogin,
      neverLoggedIn: !lastLogin,
    };
  });
}

export default async function AdminBizAccountsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const accounts = await getBizAccounts();
  const filter = searchParams.filter ?? "all";

  const totalCount = accounts.length;
  const activeCount = accounts.filter((a) => a.isActive).length;
  const loggedInCount = accounts.filter((a) => a.isActive && !a.neverLoggedIn).length;
  const neverLoggedInCount = accounts.filter((a) => a.isActive && a.neverLoggedIn).length;
  const inactiveCount = accounts.filter((a) => !a.isActive).length;

  const filtered = accounts.filter((a) => {
    if (filter === "never_login") return a.isActive && a.neverLoggedIn;
    if (filter === "inactive") return !a.isActive;
    return true;
  });

  const TABS = [
    { key: "all",          label: `すべて (${totalCount})` },
    { key: "never_login",  label: `未ログイン (${neverLoggedInCount})` },
    { key: "inactive",     label: `非アクティブ (${inactiveCount})` },
  ];

  const SUMMARY_CARDS = [
    { label: "全担当者",      value: totalCount,        color: "var(--royal)",   bg: "#EFF3FC" },
    { label: "アクティブ",    value: activeCount,        color: "var(--success)", bg: "#ECFDF5" },
    { label: "ログイン済み",  value: loggedInCount,      color: "#7C3AED",        bg: "#F3E8FF" },
    {
      label: "未ログイン",
      value: neverLoggedInCount,
      color: neverLoggedInCount > 0 ? "#B45309" : "var(--success)",
      bg:    neverLoggedInCount > 0 ? "#FEF3C7" : "#ECFDF5",
    },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            background: "#DC2626", color: "#fff", padding: "3px 8px", borderRadius: 4,
          }}>ADMIN</span>
          <h1 style={{
            fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
            fontSize: 22, fontWeight: 600, color: "#0F172A", margin: 0,
          }}>BIZ 担当者管理</h1>
        </div>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 28px" }}>
          企業アカウントに紐付いているすべての採用担当者・管理者を一覧表示します。招待後に未ログインの担当者も確認できます。
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {SUMMARY_CARDS.map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
            padding: "20px 22px", position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: color, borderRadius: "14px 14px 0 0",
            }} />
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 34, fontWeight: 800,
              color, lineHeight: 1, marginBottom: 6,
            }}>
              {value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{label}</div>
            <div style={{
              height: 4, background: bg, borderRadius: 2, marginTop: 10,
            }} />
          </div>
        ))}
      </div>

      {/* ── Filter Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/biz-accounts?filter=${key}`}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              textDecoration: "none",
              background: filter === key ? "var(--royal)" : "#fff",
              color: filter === key ? "#fff" : "#475569",
              border: `1.5px solid ${filter === key ? "var(--royal)" : "#E2E8F0"}`,
            }}
          >
            {label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <Link
          href="/admin/invite"
          style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            textDecoration: "none",
            background: "var(--royal)", color: "#fff",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          担当者を招待
        </Link>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
            <p style={{ fontSize: 14, margin: 0 }}>該当する担当者が見つかりません</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {/* ⚠️ 列を足し引きしたら td 側も合わせること。2026-08-04 に talk_themes 列の
                    td を消したときヘッダーだけ残り、8列 vs 7列でずれていた。 */}
                {["担当者", "所属企業", "権限", "部署", "役職", "最終ログイン", "招待日", "状態", "話せる人"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 16px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((acc) => {
                const engConf = ENGAGEMENT_CONFIG[acc.companyEngagement];
                return (
                  <tr key={acc.id} style={{ borderBottom: "1px solid #F8FAFC" }}>

                    {/* 担当者 */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: acc.userAvatarColor || getAvatarGradient(acc.userId ?? acc.id),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700, color: "#fff",
                        }}>
                          {acc.userName?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>
                            {acc.userName}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8" }}>{acc.userEmail}</div>
                        </div>
                      </div>
                    </td>

                    {/* 所属企業 */}
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/admin/companies/${acc.companyId}`} style={{
                        fontWeight: 600, color: "var(--royal)", textDecoration: "none",
                        display: "block", marginBottom: 5,
                      }}>
                        {acc.companyName}
                      </Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                          background: engConf.bg, color: engConf.color, border: `1px solid ${engConf.border}`,
                        }}>
                          {engConf.label}
                        </span>
                        {acc.companyPublished && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                            background: "#ECFDF5", color: "var(--success)", border: "1px solid #A7F3D0",
                          }}>
                            公開中
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 権限（アプリ内の権限であって職位ではない） */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                        background: acc.permission === "admin" ? "#EFF3FC" : "#F1F5F9",
                        color: acc.permission === "admin" ? "var(--royal)" : "#475569",
                        border: `1px solid ${acc.permission === "admin" ? "#DCE5F7" : "#E2E8F0"}`,
                      }}>
                        {acc.permission === "admin" ? "管理者" : "メンバー"}
                      </span>
                    </td>

                    {/*
                      部署 / 役職 — ow_company_admins.department / role_title。
                      ⚠️ 2つの列の使い分けが定義されていない。2026-08-05 時点で
                         10行中2行しか埋まっておらず、その2行は department にも
                         role_title にも同じ値（「代表取締役」「人事部」）が入っている。
                         データは直していない。埋める運用を始める前に、
                         「部署＝所属組織 / 役職＝肩書き」のような定義を決めること。
                      ⚠️ 空欄には何も出さない（「—」を並べると埋まっているように見えるため）。
                    */}
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--ink-soft)" }}>
                      {acc.department}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--ink-soft)" }}>
                      {acc.roleTitle}
                    </td>

                    {/* 最終ログイン */}
                    <td style={{ padding: "12px 16px" }}>
                      {acc.neverLoggedIn ? (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100,
                          background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A",
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: "#F59E0B",
                            boxShadow: "0 0 0 2px rgba(245,158,11,0.3)",
                          }} />
                          未ログイン
                        </span>
                      ) : (
                        <span style={{
                          fontFamily: "Inter, sans-serif", fontSize: 12, color: "#475569",
                        }}>
                          {formatRelative(acc.lastLogin)}
                        </span>
                      )}
                    </td>

                    {/* 招待日 */}
                    <td style={{
                      padding: "12px 16px", color: "#94A3B8",
                      fontFamily: "Inter, sans-serif", fontSize: 12,
                    }}>
                      {formatDate(acc.createdAt)}
                    </td>

                    {/* 状態 */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                        background: acc.isActive ? "#ECFDF5" : "#F1F5F9",
                        color: acc.isActive ? "var(--success)" : "#94A3B8",
                        border: `1px solid ${acc.isActive ? "#A7F3D0" : "#E2E8F0"}`,
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: acc.isActive ? "var(--success)" : "#94A3B8",
                        }} />
                        {acc.isActive ? "アクティブ" : "非アクティブ"}
                      </span>
                    </td>

                    {/* 話せる人 ambassador トグル */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AmbassadorToggle adminId={acc.id} isAmbassador={acc.isAmbassador} />
                        {acc.isAmbassador && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: "var(--royal)",
                            background: "var(--royal-50)", padding: "2px 8px",
                            borderRadius: 100, border: "1px solid var(--royal-100)",
                          }}>
                            公開中
                          </span>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {neverLoggedInCount > 0 && (
        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 10,
          background: "#FFFBEB", border: "1px solid #FDE68A",
          display: "flex", alignItems: "center", gap: 10, fontSize: 13,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ color: "#92400E", fontWeight: 500 }}>
            <strong>{neverLoggedInCount}名</strong>の担当者が招待後にまだログインしていません。
            必要に応じて再招待を検討してください。
          </span>
        </div>
      )}
    </div>
  );
}
