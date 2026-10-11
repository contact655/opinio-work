import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 通知先の1人ぶん。⚠️ 出どころは `ow_company_admins`（その会社の有効な担当者）＋ `ow_users`。
 * ⚠️ `department` / `role_title` は `ow_company_admins` の列。**`ow_users` の職歴ではない。**
 */
export type NotificationTeamMember = {
  name: string;
  email: string;
  department: string | null;
  roleTitle: string | null;
  /** `permission === "admin"`。⚠️ 未設定のときのフォールバック先はこの人たちだけ（recipients.ts の②） */
  isAdminPermission: boolean;
};

/**
 * ★通知先の候補と、いま保存されている通知先（2026-10-12 に /biz/company から「メンバーと権限」へ移した）。
 * ⚠️ `error` を捨てない。捨てると「担当者が1人もいない」に見えて、自由入力だけの画面になる。
 * ⚠️ `is_test` では絞らない（その会社の担当者として実在し、実際に受け取れるため）。
 */
export async function fetchNotificationSettings(companyId: string): Promise<{
  members: NotificationTeamMember[];
  emails: string[];
}> {
  const admin = createAdminClient();
  const [adminsRes, coRes] = await Promise.all([
    admin
      .from("ow_company_admins")
      .select("user_id, department, role_title, permission")
      .eq("company_id", companyId)
      .eq("is_active", true)
      /* 招待中の行（user_id NULL）を数えない */
      .not("user_id", "is", null),
    admin.from("ow_companies").select("notification_emails").eq("id", companyId).maybeSingle(),
  ]);
  if (adminsRes.error) console.error("[notificationTeam] 担当者の取得に失敗:", adminsRes.error.message);
  if (coRes.error) console.error("[notificationTeam] 通知先の取得に失敗:", coRes.error.message);

  const rows = (adminsRes.data ?? []) as { user_id: string | null; department: string | null; role_title: string | null; permission: string | null }[];
  const ids = rows.map((r) => r.user_id).filter((v): v is string => Boolean(v));
  /* ⚠️ `.in()` に空配列を渡すと全件返る */
  const usersRes = ids.length > 0
    ? await admin.from("ow_users").select("id, name, email").in("id", ids)
    : { data: [], error: null };
  if (usersRes.error) console.error("[notificationTeam] 氏名・メールの取得に失敗:", usersRes.error.message);
  const userMap = new Map(((usersRes.data ?? []) as { id: string; name: string | null; email: string | null }[]).map((u) => [u.id, u]));

  const members = rows
    .map((r): NotificationTeamMember | null => {
      const u = r.user_id ? userMap.get(r.user_id) : undefined;
      if (!u?.email) return null;   // 通知先として選べないものを出さない
      return {
        name: (u.name ?? "").trim() || u.email,
        email: u.email,
        department: r.department,
        roleTitle: r.role_title,
        isAdminPermission: r.permission === "admin",
      };
    })
    .filter((m): m is NotificationTeamMember => m !== null)
    /* 管理者を上に。⚠️ 並びを固定しないと表示順が揺れる */
    .sort((a, b) => (Number(b.isAdminPermission) - Number(a.isAdminPermission)) || a.name.localeCompare(b.name, "ja"));

  const raw = coRes.data?.notification_emails;
  return { members, emails: Array.isArray(raw) ? (raw as string[]) : [] };
}
