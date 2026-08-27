import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { addUserRole } from "@/lib/roles";
import { notify } from "@/lib/notify/email";
import { resolveOrLinkOwUser } from "@/lib/auth/linkOwUser";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * メールリンク / OAuth で認証が成立した直後の共通後処理。
 *
 * ⚠️ `/auth/callback`（OAuth の code 交換）と `/auth/confirm`（メールの token_hash 検証）の
 *    両方から呼ぶ。**片方にコピーしないこと。** 2つに割れると、ow_users の引き継ぎや
 *    onboarding 判定がどちらか一方だけ直る形の不具合が生まれる。
 */

/**
 * ow_users 行を解決する。
 *
 * ⚠️ 呼んでよいのは「メールアドレスの所有が証明された経路」だけ。
 *    有効な code / token_hash を持ってこのサーバーに到達できるのは、
 *    そのアドレス宛に送られたリンクを開いた人か、OAuth で検証を終えた人に限られる。
 *    パスワードログイン・登録はここを通らない（linkOwUser.ts の冒頭コメント参照）。
 *
 * @returns isNewUser — ow_users 行を新規作成した場合のみ true。
 *          運営が用意した行の引き継ぎ（linked）は「新規ユーザー」ではない。
 */
export async function resolveOwUserForVerifiedEmail(
  session: Session,
  logPrefix: string
): Promise<{ isNewUser: boolean }> {
  const resolution = await resolveOrLinkOwUser({
    authId: session.user.id,
    email: session.user.email,
    name:
      session.user.user_metadata?.name ||
      session.user.user_metadata?.full_name ||
      null,
    emailVerified: true,
  });

  if (resolution.status === "error") {
    // 握り潰さない。ここで失敗すると「認証は通っているのに ow_users 行が無い」
    // ユーザーが生まれ、以降の画面が静かに壊れる。
    console.error(`${logPrefix} resolveOrLinkOwUser failed:`, resolution.message);
  } else if (resolution.status === "needs_verification") {
    // ここは emailVerified: true で呼んでいるので、未紐付け行なら引き継げているはず。
    // それでも email 衝突するのは「その email の行が既に別の auth_id に紐付いている」場合。
    console.error(
      `${logPrefix} email already belongs to a different linked ow_users row:`,
      session.user.email
    );
  } else if (resolution.status === "linked") {
    console.info(
      `${logPrefix} linked pre-created ow_users row:`,
      resolution.owUser.id,
      session.user.email
    );
  }

  return { isNewUser: resolution.status === "created" };
}

/**
 * 求職者側の着地先を決める。role 登録・ウェルカムメールもここで行う。
 *
 * @returns origin を含む絶対URL
 */
export async function jobseekerDestination(params: {
  supabase: SupabaseClient<Database>;
  session: Session;
  origin: string;
  next: string;
  isNewUser: boolean;
  logPrefix: string;
}): Promise<string> {
  const { supabase, session, origin, next, isNewUser, logPrefix } = params;

  // role='candidate' を best-effort で登録（重複は無視）。
  // 失敗しても認証は続行するが、無言では落とさずログに残す。
  await addUserRole(supabase, "candidate").catch((e: unknown) => {
    console.error(`${logPrefix} addUserRole failed:`, e);
  });

  const { data: profile, error: profileError } = await supabase
    .from("ow_profiles")
    /* ⚠️ `career_stance` も**同じ1回で**取る（2026-08-27 / フェーズ3）。
          別のクエリを足すと、認証の直列段に往復が1つ増える。 */
    .select("onboarding_completed, career_stance")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (profileError) {
    console.error(`${logPrefix} ow_profiles lookup failed:`, profileError.message);
  }

  const needsOnboarding = !profile?.onboarding_completed;

  /* ── ウェルカムメール（best-effort）────────────────────────────────────
     ★**判断は `isNewUser` ではなく `ow_users.welcome_sent_at`。**

     ⚠️ 2026-08-20 まで `isNewUser`（＝`resolveOrLinkOwUser` が `'created'` を返したか）で
        判断していたが、**一度も送られていなかった。**
        登録した瞬間にトリガー `on_auth_user_created` が `ow_users` を **auth_id 付きで**
        作るため、`/auth/confirm` の時点では必ず `'existing'` になる。
        つまり `'created'` は事実上発生しない。

     ⚠️ **「行があるか」を冪等キーにしない。** 行はトリガーが先に作る。
        **「送ったか」**を持つ列で判断する。

     ── 二重送信と送り逃しの両方を防ぐ ──────────────────────────────────
     ① `welcome_sent_at IS NULL` の行だけを **UPDATE で先に確保**する
        （同時に2本走っても、行を取れるのは片方だけ）
     ② 送信に失敗したら **NULL に戻す**（次の認証で再挑戦できる）
     ⚠️ 「送ってから記録」にしない。同時実行で二重に送る。
     ⚠️ 「記録して終わり」にもしない。失敗したら永久に送られなくなる。

     ⚠️ `createAdminClient` を使う。`welcome_sent_at` は列単位 GRANT の対象外
        （anon / authenticated からは読めない）なので、利用者のセッションでは触れない。 */
  if (session.user.email) {
    const admin = createAdminClient();
    const { data: claimed, error: claimError } = await admin
      .from("ow_users")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("auth_id", session.user.id)
      .is("welcome_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error(`${logPrefix} welcome claim failed:`, claimError.message);
    } else if (claimed) {
      const userName: string =
        session.user.user_metadata?.name
        ?? session.user.user_metadata?.full_name
        ?? session.user.email.split("@")[0]
        ?? "さん";
      await notify({
        to: session.user.email,
        subject: "【OPINIO】ようこそ！OPINIO へ登録完了しました",
        html: buildWelcomeHtml(userName),
      }).catch(async (e: unknown) => {
        console.error(`${logPrefix} welcome email failed:`, e);
        /* 送れなかったので確保を解除する。次の認証で再挑戦する。 */
        await admin
          .from("ow_users")
          .update({ welcome_sent_at: null })
          .eq("id", claimed.id)
          .then(({ error }) => {
            if (error) console.error(`${logPrefix} welcome claim rollback failed:`, error.message);
          });
      });
    }
  }

  if (needsOnboarding) {
    return `${origin}/onboarding?next=${encodeURIComponent(next)}`;
  }

  /* ★「転職について」に答えていない人は、ログインのたびに1問だけ聞く（2026-08-27 / フェーズ3）。
     ⚠️ スカウトの送信可否がこの値になったので、**未設定のままだと誰からも届かない。**
        既定値を付けて埋めるのではなく、本人に選んでもらう。
     ⚠️ `profileError` のときは飛ばさない（`profile` が null になり
        `needsOnboarding` 側で既に `/onboarding` へ行く）。
     ⚠️ **同じ判定が `OnboardingGuard` にもある。** あちらは遷移のたびに効く。
        片方だけ条件を変えないこと。 */
  if (!profile?.career_stance) {
    return `${origin}/onboarding/stance?next=${encodeURIComponent(next)}`;
  }

  /* 新規ユーザーはウェルカムバナー付きで着地させる。
     行き先の指定が無い（既定の /companies）ときだけ。指定があればそちらを優先する。

     ⚠️ **`isNewUser` は実質いつも false**（上のウェルカムメールのコメント参照）。
        トリガーが先に `ow_users` を作るので `'created'` にならない。
        したがって**この分岐にはまず入らない**。
        さらに、その手前の `needsOnboarding` で新規は `/onboarding` へ行くため、
        「新規なのにオンボーディング済み」という到達しにくい組み合わせが前提になっている。
        バナーを本当に出したいなら、ウェルカムメールと同じく**別の印**で判断すること。 */
  if (isNewUser && next === "/companies") {
    return `${origin}/mypage?welcome=1`;
  }

  return `${origin}${next}`;
}

// ── Welcome email HTML ────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildWelcomeHtml(name: string): string {
  const btn = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">IT/SaaS業界のキャリアインフラ</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">
            <h2 style="margin:0 0 8px;font-size:20px;color:#002366">ようこそ、OPINIO へ！</h2>
            <p style="margin:0 0 20px;color:#475569">${esc(name)} さん、登録ありがとうございます。</p>

            <p style="margin:0 0 16px;color:#0f172a;font-weight:600">OPINIO でできること：</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              ${[
                ["🏢", "IT/SaaS 企業の情報閲覧・カジュアル面談申込"],
                ["💼", "IT/SaaS 業界の求人に直接応募"],
                ["🌟", "先輩メンターに30分の無料キャリア相談"],
              ].map(([icon, text]) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">
                  <span style="margin-right:10px">${icon}</span>${text}
                </td>
              </tr>`).join("")}
            </table>

            <p style="margin:0 0 24px">
              <a href="https://opinio.jp/mypage?welcome=1" style="${btn}">プロフィールを設定する →</a>
            </p>

            <div style="background:#eff3fc;border-radius:8px;padding:14px 18px;border-left:3px solid #002366">
              <p style="margin:0;font-size:12px;color:#334155;line-height:1.7">
                💡 プロフィールを充実させると、企業の採用担当者にあなたの経験が伝わりやすくなります。
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
              このメールは <a href="https://opinio.jp" style="color:#3B5FD9">opinio.jp</a> から自動送信されています。<br>
              心当たりのない場合は、このメールを無視してください。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
