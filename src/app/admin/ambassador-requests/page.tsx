import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSelfListed } from "@/lib/companyMembers/selfListed";
import { RequestsClient, type AmbassadorRequest } from "./RequestsClient";

/* ⚠️ 運営が押した結果をすぐ反映する。キャッシュに載せない。 */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "面談対応者（自己申告） | OPINIO 運営" } };

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

  /* ⚠️★条件は `lib/companyMembers/selfListed.ts` に集約している。**ここに書き直さないこと。**
        ダッシュボードの「未確認 N名」と同じ関数を通さないと、数字と中身が食い違う。
        （とくに「その企業に在籍中の経歴があるか」の突き合わせを落としやすい） */
  const listed = await fetchSelfListed();
  if (listed.length === 0) return [];

  /* 表示に要るものだけ、まとめて引く。⚠️ N+1 にしない */
  const userIds = Array.from(new Set(listed.map((r) => r.user_id)));
  const companyIds = Array.from(new Set(listed.map((r) => r.company_id)));

  const [{ data: users, error: uErr }, { data: companies, error: cErr }, { data: admins, error: adminErr }] =
    await Promise.all([
      admin.from("ow_users").select("id, name").in("id", userIds),
      admin.from("ow_companies").select("id, name, brand_name").in("id", companyIds),
      /* 企業ごとの通知宛先数。0 なら企業側に気づける人がいない＝運営が見るしかない対象。 */
      admin
        .from("ow_company_admins")
        .select("company_id, ow_users!user_id(email)")
        .in("company_id", companyIds)
        .eq("permission", "admin")
        .eq("is_active", true),
    ]);
  /* ⚠️ 握り潰さない。名前が引けないだけで一覧が空になると、監視対象を見落とす */
  if (uErr) console.error("[admin/ambassador-requests] ow_users:", uErr.message);
  if (cErr) console.error("[admin/ambassador-requests] ow_companies:", cErr.message);
  if (adminErr) console.error("[admin/ambassador-requests] recipients:", adminErr.message);

  const userName = new Map((users ?? []).map((u) => [(u as { id: string }).id, (u as { name: string | null }).name]));
  const companyName = new Map(
    (companies ?? []).map((c) => {
      const r = c as { id: string; name: string | null; brand_name: string | null };
      return [r.id, r.brand_name ?? r.name ?? "—"];
    }),
  );
  const recipientCount = new Map<string, number>();
  for (const a of (admins ?? []) as unknown as { company_id: string; ow_users: { email: string | null } | null }[]) {
    if (!a.ow_users?.email) continue;
    recipientCount.set(a.company_id, (recipientCount.get(a.company_id) ?? 0) + 1);
  }

  return listed.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: companyName.get(r.company_id) ?? "—",
    userId: r.user_id,
    userName: userName.get(r.user_id) ?? "—",
    appliedAt: r.consent_at ?? r.created_at,
    companyRecipients: recipientCount.get(r.company_id) ?? 0,
    reviewedAt: r.ops_reviewed_at,
  }));
}

export default async function AmbassadorRequestsPage() {
  const requests = await getRequests();

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
        面談対応者（自己申告）
      </h1>
      {/* ⚠️★ここの文言を「申請」「承認」に戻さないこと（2026-08-24）。
             会社の事前承認は廃止した。**この一覧に出ている人は既に掲載されている。**
             承認を促す文面にすると、運営が押すべき操作が無いのに待つことになる。 */}
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        本人が「話を聞かれてもよい」をONにして、<strong style={{ color: "var(--ink)" }}>その企業のページに出ている人</strong>です。
        （企業の掲載・求人の掲載とは別物）<strong style={{ color: "var(--ink)" }}>未確認が上に並びます。</strong>
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#92400e", lineHeight: 1.7, fontWeight: 600 }}>
        在籍は本人の申告で、OPINIO は在籍確認を行っていません。
        なりすましや誤りに気づいたら、ここから<strong style={{ color: "#7c2d12" }}>企業ページから外して</strong>ください。
        企業側に担当者がいる場合は、企業の「チーム管理」からも外せます。
      </p>
      <RequestsClient requests={requests} />
    </div>
  );
}
