import { createAdminClient } from "@/lib/supabase/admin";
import { greetingName } from "@/lib/constants/personName";
import { ScoutAccessClient, type ScoutCompanyRow, type ScoutRequestRow } from "./ScoutAccessClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト機能の許可 | OPINIO Admin" } };

/*
 * ★スカウト機能（候補者を探す・候補者にメッセージを送る）の企業ごとの許可（2026-10-28 / 柴さんの判断）。
 *   ・企業からの依頼を許可する／見送る
 *   ・依頼が無くても、担当者がいる企業に直接付与する
 *   ・使える企業から取り消す
 * ⚠️ 状態の正は ow_company_scout_access / ow_scout_access_requests（運営専用）。書き込みは lib/business/scoutAccess.ts。
 * ⚠️ 直接付与の候補は「有効な担当者がいる企業」だけ（担当者が居ない企業に付けても使う人がいない。/admin/plans と同じ絞り）。
 */
export default async function AdminScoutAccessPage() {
  const db = createAdminClient();
  const [{ data: access, error: aErr }, { data: open, error: rErr }, { data: adminRows, error: adErr }] = await Promise.all([
    db.from("ow_company_scout_access").select("company_id, status, source, granted_at, revoked_at, revoke_reason"),
    db.from("ow_scout_access_requests").select("id, company_id, requested_by, message, created_at").is("resolved_at", null).order("created_at"),
    db.from("ow_company_admins").select("company_id").eq("is_active", true).not("user_id", "is", null),
  ]);
  const loadError = aErr ?? rErr ?? adErr;
  if (loadError) console.error("[admin/scout-access]", loadError.message);

  const ids = Array.from(new Set([
    ...(access ?? []).map((r) => r.company_id as string),
    ...(open ?? []).map((r) => r.company_id as string),
    ...(adminRows ?? []).map((r) => r.company_id as string),
  ]));
  const userIds = Array.from(new Set((open ?? []).map((r) => r.requested_by as string | null).filter((x): x is string => !!x)));
  const [{ data: cos, error: cErr }, { data: users, error: uErr }] = await Promise.all([
    db.from("ow_companies").select("id, name, is_test, suspended_at").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("ow_users").select("id, name, email").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  if (cErr || uErr) console.error("[admin/scout-access]", cErr?.message ?? uErr?.message);
  const coBy = new Map((cos ?? []).map((c) => [c.id as string, c]));
  const userBy = new Map((users ?? []).map((u) => [u.id as string, u]));
  const accessBy = new Map((access ?? []).map((a) => [a.company_id as string, a]));
  const withAdmin = new Set((adminRows ?? []).map((r) => r.company_id as string));

  const requests: ScoutRequestRow[] = (open ?? []).map((r) => {
    const co = coBy.get(r.company_id as string);
    const u = r.requested_by ? userBy.get(r.requested_by as string) : null;
    return {
      companyId: r.company_id as string,
      companyName: (co?.name as string | null) ?? "（不明）",
      isTest: co?.is_test === true,
      suspended: co?.suspended_at != null,
      requesterName: greetingName((u?.name as string | null | undefined) ?? null),
      requesterEmail: (u?.email as string | null) ?? null,
      message: (r.message as string | null) ?? null,
      createdAt: r.created_at as string,
    };
  });
  const openIds = new Set(requests.map((r) => r.companyId));
  const companies: ScoutCompanyRow[] = ids
    .filter((id) => !openIds.has(id))
    .map((id) => {
      const co = coBy.get(id);
      const a = accessBy.get(id);
      return {
        companyId: id,
        companyName: (co?.name as string | null) ?? "（不明）",
        isTest: co?.is_test === true,
        suspended: co?.suspended_at != null,
        hasAdmin: withAdmin.has(id),
        status: a?.status === "granted" ? "granted" as const : a?.status === "revoked" ? "revoked" as const : "none" as const,
        at: (a?.status === "granted" ? a.granted_at : a?.revoked_at) as string | null ?? null,
        revokeReason: (a?.revoke_reason as string | null) ?? null,
      };
    })
    /* 直接付与の候補は担当者がいる企業だけ。使える・取り消した企業は担当者がいなくても出す */
    .filter((c) => c.status !== "none" || c.hasAdmin)
    .sort((x, y) => x.companyName.localeCompare(y.companyName, "ja"));

  return <ScoutAccessClient requests={requests} companies={companies} loadFailed={Boolean(loadError)} />;
}
