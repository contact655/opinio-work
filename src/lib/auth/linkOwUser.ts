import { createAdminClient } from "@/lib/supabase/admin";

/**
 * auth.users のユーザーに対応する ow_users 行を解決する。
 * 運営が先に作成した行（auth_id IS NULL）がある場合は、所有証明があるときに限り引き継ぐ。
 *
 * ⚠️ emailVerified の意味に注意
 *   「ow_users.email と auth のメールアドレスが一致する」だけでは所有証明にならない。
 *   このプロジェクトは Supabase 側のメール確認が長らく無効で、email_confirmed_at は
 *   サインアップと同時に立つため所有証明として使えない（2026-08-03 実測: email プロバイダ
 *   46名中44名が作成から3秒以内に confirmed）。
 *
 *   そのため emailVerified に true を渡してよいのは
 *   「そのアドレス宛に送ったリンクをクリックした」か「OAuth プロバイダが検証済み」の
 *   経路だけ、すなわち /auth/callback に有効な code を持って到達した場合に限る。
 *   パスワードログイン/登録は callback を通らないため false を渡すこと。
 */

type OwUserRow = { id: string; name: string | null; email: string | null };

export type OwUserResolution =
  /** 既に auth_id で紐付いていた */
  | { status: "existing"; owUser: OwUserRow }
  /** 運営が作った行に auth_id を補完した */
  | { status: "linked"; owUser: OwUserRow }
  /** 新規に行を作成した */
  | { status: "created"; owUser: OwUserRow }
  /** 未紐付けの行はあるが所有証明が無いので触れなかった */
  | { status: "needs_verification" }
  /** 想定外の失敗。呼び出し側でログを出すこと */
  | { status: "error"; message: string };

const SELECT_COLS = "id, name, email";

export async function resolveOrLinkOwUser(params: {
  authId: string;
  email: string | null | undefined;
  /** 新規作成時の表示名。auth の user_metadata などから渡す */
  name?: string | null;
  /** true にしてよいのはメールアドレスの所有が証明された経路だけ（上のコメント参照） */
  emailVerified: boolean;
}): Promise<OwUserResolution> {
  const { authId, name, emailVerified } = params;
  const admin = createAdminClient();

  // ── 1. auth_id で既に紐付いている行 ──────────────────────────────
  const { data: byAuthId, error: byAuthIdError } = await admin
    .from("ow_users")
    .select(SELECT_COLS)
    .eq("auth_id", authId)
    .maybeSingle();

  if (byAuthIdError) {
    return { status: "error", message: `lookup by auth_id failed: ${byAuthIdError.message}` };
  }
  if (byAuthId) return { status: "existing", owUser: byAuthId as OwUserRow };

  const rawEmail = params.email?.trim() ?? "";
  if (!rawEmail) {
    return { status: "error", message: "auth user has no email; cannot resolve ow_users row" };
  }

  // GoTrue は email を小文字で保存するが、運営が手で入れた行は大文字混じりの可能性がある。
  // ILIKE は `_` がワイルドカードとして効き別アドレスに一致しうるため使わず、
  // 正規化した値と生の値の2通りを完全一致で試す。
  const candidates = Array.from(new Set([rawEmail.toLowerCase(), rawEmail]));

  // ── 2. 未紐付けの行を引き継ぐ（所有証明があるときだけ） ──────────
  if (emailVerified) {
    for (const candidate of candidates) {
      // auth_id IS NULL を UPDATE の条件に含めることで、
      // 同時実行で他方が先に取った場合は0行になり、上書きが起きない。
      const { data: linked, error: linkError } = await admin
        .from("ow_users")
        .update({
          auth_id: authId,
          auth_linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("email", candidate)
        .is("auth_id", null)
        // システムユーザー（フィード自動投稿の所有者）とテストデータは引き継がせない。
        // 特に is_system の行を奪われると、自動生成された投稿の所有者になれてしまう。
        .eq("is_system", false)
        .eq("is_test", false)
        .select(SELECT_COLS)
        .maybeSingle();

      if (linkError) {
        return { status: "error", message: `link by email failed: ${linkError.message}` };
      }
      if (linked) return { status: "linked", owUser: linked as OwUserRow };
    }
  }

  // ── 3. 新規作成 ────────────────────────────────────────────────
  const displayName =
    (name?.trim() || rawEmail.split("@")[0] || "ユーザー").slice(0, 100);

  const { data: created, error: insertError } = await admin
    .from("ow_users")
    .insert({
      auth_id: authId,
      email: rawEmail.toLowerCase(),
      name: displayName,
      visibility: "public",
    })
    .select(SELECT_COLS)
    .maybeSingle();

  if (created) return { status: "created", owUser: created as OwUserRow };

  // 23505 = unique_violation。ここに来るのは「未紐付けの行が email を占有しているが
  // 所有証明が無いので手を出せなかった」ケース。握り潰さず呼び出し側に返す。
  if (insertError?.code === "23505") {
    return { status: "needs_verification" };
  }

  return {
    status: "error",
    message: `insert failed: ${insertError?.message ?? "unknown error"}`,
  };
}
