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

  /* ── 3. 新規作成 ────────────────────────────────────────────────
     ⚠️★**`rawEmail.split("@")[0]` を戻さないこと**（2026-09-14 に削除）。
        `ow_users.name` は `/people`・企業ページ・`/u/[id]`・フィードにそのまま出るので、
        メールのローカル部を入れると**本人が入力していない個人情報を公開する**ことになる。
        ⚠️ `/people` は `ow_users` 起点で、**職歴が無い人も出る**。
     ⚠️ ここに落ちるのは `user_metadata` に名前が無い経路だけ
        （マジックリンク・招待など）。パスワード登録は入力欄が `required`、
        Google は `full_name` が入るので、通常はここまで来ない。
     ⚠️ 「ユーザー」は**プレースホルダと読める値**。オンボーディング1画面目（必須）で
        姓名を聞き、`name` はそこで上書きされる。 */
  const displayName = (name?.trim() || "ユーザー").slice(0, 100);

  /* ⚠️★**`visibility` を書かないこと（2026-09-16 に `"public"` を削除）。**
        列の既定値（`ow_users.visibility DEFAULT 'login_only'`）に任せる。

     ── なぜ「定数を作って書く」のではなく「書かない」のか ──────────────────
     もう一方の作成経路が**そうしているから**。`ow_users` の行は通常
     **DB トリガー `on_auth_user_created` → `handle_new_ow_user()`** が作っており、
     あれは `auth_id / email / name / created_at / updated_at` しか書かない。
     同関数のコメントにも `scout_enabled` について
     「**ここに true を書くと既定値との二重管理になり、片方だけ変えたときにずれる**」とある。
     ここで定数を持つと、**DB の DEFAULT と定数の2箇所**になって同じ形になる。

     ── 何が起きていたか（2026-09-16 実測）──────────────────────────────────
     この行は `"public"`（＝ 氏名・所属・職歴が**未ログインと検索エンジンに見える**）を
     書いていた。設定画面（`lib/constants/profileVisibility.ts`）は `login_only` を
     既定として説明しており、**食い違っていた。**
     ⚠️ 実害は出ていない。`visibility = 'public'` の行は**全ユーザーで0件**
        （トリガーが先に行を作るので、この INSERT にほぼ到達しないため。到達条件は下記）。
        **トリガーを消した日に静かに発火する形だった。**

     ── この INSERT に到達する条件 ────────────────────────────────────────
     トリガーは **AFTER INSERT ON auth.users**（ROW）で、`ON CONFLICT (email) DO NOTHING`。
     したがってここまで来るのは「**auth_id でも email でも既存行が見つからない**」とき、
     具体的には
       ・トリガーが無かった時期に作られた auth ユーザーが、いま初めて認証した
       ・auth 側のメールアドレスが作成後に変わった（トリガーは旧アドレスで作っている）
       ・`ow_users` の行だけ消えている
     のいずれか。**通常のサインアップでは来ない。** */
  const { data: created, error: insertError } = await admin
    .from("ow_users")
    .insert({
      auth_id: authId,
      email: rawEmail.toLowerCase(),
      name: displayName,
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
