import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA, memberState } from "@/lib/constants/companyMembers";
import { RequestsClient, type AmbassadorRequest } from "./RequestsClient";

/* ⚠️ 運営が押した結果をすぐ反映する。キャッシュに載せない。 */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "自己申告で掲載中の人 | OPINIO 運営" } };

/**
 * 本人が自分で「話を聞かれてもよい」をONにして**掲載されている人**を全社横断で一覧する。
 *
 * ★2026-08-24 に**中身を入れ替えた**。それまでは「承認待ちの申請」の一覧だったが、
 *   同日に会社の事前承認を廃止したので、その状態には**もう到達しない**。
 *   ⚠️ 条件を戻すと、この画面は**永久に「申請はありません」と表示し続ける**。
 *      0件が「無い」ではなく「起こせない」になる（CLAUDE.md「0件を読むときは〜」）。
 *
 * ── なぜ運営に要るか ────────────────────────────────────────────────────────
 * 事前の承認が無くなったので、**なりすましは後から見つけて外すしかない**。
 * **掲載中79社のうち77社は通知の宛先が0件**（2026-08-23 実測）＝企業側に気づく人がいない。
 * この一覧が、運営が気づくための唯一の場所になる。
 *
 * ⚠️ 企業ごとの画面ではなく**横断1枚**にしてある。件数が少なく、
 *    企業を1社ずつ開く形だと「どこに出たか」が分からない。
 *
 * ⚠️ 判定は `memberState()` を使う。ここで状態を定義し直さない。
 * ⚠️ `/admin` は `createAdminClient` で読む（CLAUDE.md）。
 *    ブラウザ側クライアントだと RLS で黙って0行になる。
 */
async function getRequests(): Promise<AmbassadorRequest[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_company_members")
    .select("id, company_id, user_id, display_consent, is_public, created_via, approved_at, consent_at, created_at, ow_users!user_id(name), ow_companies!company_id(name, brand_name)")
    /* 本人発だけが対象。企業が招待した行（`created_via` が null / 'invite'）は
       企業が相手を知っているので、なりすましの監視対象ではない。 */
    .eq("created_via", MEMBER_CREATED_VIA.SELF)
    /* ★掲載されているものだけ。⚠️ 本人がOFFにした行（`paused`）は出さない
          ——外に出ていないので運営が見る理由が無い。 */
    .eq("is_public", true)
    .order("consent_at", { ascending: false, nullsFirst: false });

  /* ⚠️ 握り潰さない。空になると「誰も自己申告していない」と誤って表示され、
        なりすましを見落とす。 */
  if (error) {
    console.error("[admin/ambassador-requests] fetch:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    id: string; company_id: string; user_id: string;
    display_consent: boolean; is_public: boolean; created_via: string | null;
    approved_at: string | null; consent_at: string | null; created_at: string;
    ow_users: { name: string | null } | null;
    ow_companies: { name: string | null; brand_name: string | null } | null;
  }[];

  /* ⚠️ 念のため `memberState()` でも絞る。上の where と二重だが、
        状態の定義が1箇所であることを保つため（where だけにすると判定が2つになる）。 */
  const pending = rows.filter((r) => memberState(r) === "listed");
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
        自己申告で掲載中の人
      </h1>
      {/* ⚠️★ここの文言を「申請」「承認」に戻さないこと（2026-08-24）。
             会社の事前承認は廃止した。**この一覧に出ている人は既に掲載されている。**
             承認を促す文面にすると、運営が押すべき操作が無いのに待つことになる。 */}
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        本人が「話を聞かれてもよい」をONにして、その企業のページに掲載されている人です。
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#92400e", lineHeight: 1.7, fontWeight: 600 }}>
        在籍は本人の申告で、OPINIO は在籍確認を行っていません。
        なりすましや誤りに気づいたら、ここから掲載を取り消してください。
        企業側に担当者がいる場合は、企業の「チーム管理」からも非掲載にできます。
      </p>
      <RequestsClient requests={requests} />
    </div>
  );
}
