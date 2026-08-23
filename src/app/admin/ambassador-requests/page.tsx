import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA, memberState } from "@/lib/constants/companyMembers";
import { RequestsClient, type AmbassadorRequest } from "./RequestsClient";

/* ⚠️ 運営が押した結果をすぐ反映する。キャッシュに載せない。 */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "面談対応者の申請 | OPINIO 運営" } };

/**
 * 本人からの「話を聞かれてもよい」申請を**全社横断**で一覧する（2026-08-23）。
 *
 * ── なぜ運営に要るか ────────────────────────────────────────────────────────
 * **掲載中79社のうち77社は通知の宛先が0件**（実測）で、企業側に承認できる人がいない。
 * `/biz/members` の第3区分だけでは、その77社の申請は誰にも見られず宙吊りになる。
 *
 * ⚠️ 企業ごとの画面ではなく**横断1枚**にしてある。申請は企業をまたいで少数しか
 *    起きないので、企業を1社ずつ開く形だと「どこに来たか」が分からない。
 *
 * ⚠️ 判定は `memberState()` を使う。ここで状態を定義し直さない。
 * ⚠️ `/admin` は `createAdminClient` で読む（CLAUDE.md）。
 *    ブラウザ側クライアントだと RLS で黙って0行になる。
 */
async function getRequests(): Promise<AmbassadorRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_company_members")
    .select("id, company_id, user_id, display_consent, is_public, created_via, consent_at, created_at, ow_users!user_id(name), ow_companies!company_id(name, brand_name)")
    /* 本人発だけが対象。企業が招待した行（`created_via` が null / 'invite'）は
       `/biz/members` の担当で、運営が代理で承認する対象ではない。 */
    .eq("created_via", MEMBER_CREATED_VIA.SELF)
    .eq("is_public", false)
    .order("consent_at", { ascending: true, nullsFirst: false });

  /* ⚠️ 握り潰さない。空になると「申請が無い」と誤って表示され、
        宙吊りの申請を運営が見落とす。 */
  if (error) {
    console.error("[admin/ambassador-requests] fetch:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    id: string; company_id: string; user_id: string;
    display_consent: boolean; is_public: boolean; created_via: string | null;
    consent_at: string | null; created_at: string;
    ow_users: { name: string | null } | null;
    ow_companies: { name: string | null; brand_name: string | null } | null;
  }[];

  /* ⚠️ 念のため `memberState()` でも絞る。上の where と二重だが、
        状態の定義が1箇所であることを保つため（where だけにすると判定が2つになる）。 */
  const pending = rows.filter((r) => memberState(r) === "pending_company");
  if (pending.length === 0) return [];

  /* 企業ごとの通知宛先数。0 なら企業側に承認できる人がいない＝運営が判断する対象。
     ⚠️ N+1 にしないよう1回で引く。 */
  const companyIds = Array.from(new Set(pending.map((r) => r.company_id)));
  const { data: admins, error: adminErr } = await admin
    .from("ow_company_admins")
    .select("company_id, ow_users!user_id(email)")
    .in("company_id", companyIds)
    .eq("permission", "admin")
    .eq("is_active", true);
  if (adminErr) console.error("[admin/ambassador-requests] recipients:", adminErr.message);

  const recipientCount = new Map<string, number>();
  for (const a of (admins ?? []) as unknown as { company_id: string; ow_users: { email: string | null } | null }[]) {
    const email = a.ow_users?.email;
    if (!email) continue;
    recipientCount.set(a.company_id, (recipientCount.get(a.company_id) ?? 0) + 1);
  }

  return pending.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: r.ow_companies?.brand_name ?? r.ow_companies?.name ?? "—",
    userId: r.user_id,
    userName: r.ow_users?.name ?? "—",
    appliedAt: r.consent_at ?? r.created_at,
    companyRecipients: recipientCount.get(r.company_id) ?? 0,
  }));
}

export default async function AmbassadorRequestsPage() {
  const requests = await getRequests();

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
        面談対応者の申請
      </h1>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        在籍していると申告している方から届いた「話を聞かれてもよい」の申請です。
        承認すると、その企業のページに掲載されます。
      </p>
      {/* ⚠️ 在籍は自己申告。承認＝在籍の確認なので、押す前に実態を確かめる必要がある。 */}
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#92400e", lineHeight: 1.7, fontWeight: 600 }}>
        在籍は本人の自己申告です。承認する前に実態を確認してください。
        企業側に担当者がいる場合は、企業の「チーム管理」からも承認できます。
      </p>
      <RequestsClient requests={requests} />
    </div>
  );
}
