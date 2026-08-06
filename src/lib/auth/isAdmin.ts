import { createClient } from "@/lib/supabase/server";

/**
 * 現在ログイン中のユーザーが管理者かどうかを判定する。
 *
 * 判定ロジック (段階7-F 判断点 #1):
 *   既存 admin 画面と同じ auth_is_admin() RPC を使用する。
 *   RPC は ow_user_roles テーブルで role='admin' を持つユーザーを管理者と判定。
 *
 *   補助的フォールバック: ADMIN_EMAILS 環境変数が設定されている場合、
 *   RPC の結果に加えてメールアドレス照合でも管理者判定できる。
 *   これにより DB への role 登録なしでの即時利用が可能(開発・緊急時)。
 *
 * - 未ログイン → false
 * - RPC falsy + ADMIN_EMAILS 未設定 → false
 *
 * 用途:
 *   /admin/layout.tsx の認可ガード、および Phase 3/4 の API Route での
 *   管理者専用操作の認可チェックに使用する。
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // ── プライマリ: auth_is_admin() RPC（既存 admin 画面と同じ判定）──
  const { data: rpcResult } = await supabase.rpc("auth_is_admin");
  if (rpcResult) return true;

  // ── フォールバック: ADMIN_EMAILS 環境変数（開発・緊急時用）──
  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];
  if (adminEmails.length === 0) return false;

  /* ⚠️ ow_users.email ではなく auth セッションの email を使う。
        2026-08-06 に authenticated から ow_users.email の SELECT 権限を剥がしたため。
        どちらもログイン本人のアドレスで、auth 側が正（ow_users.email はそこからの写し）。 */
  const email = user.email;
  if (!email) return false;

  return adminEmails.includes(email);
}
