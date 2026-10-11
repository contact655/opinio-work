import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { mutateOne } from "@/lib/supabase/mutate";
import { sendEmail } from "@/lib/notify/email";
import { listingRequestAdminTemplate } from "@/lib/notify/templates";
import { checkPublishable } from "@/lib/companies/publishable";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { greetingName } from "@/lib/constants/personName";

export const dynamic = "force-dynamic";

/*
 * ═══ 企業からの掲載依頼（POST /api/biz/company/listing-request）═══════════
 *
 * `/biz/company` の「設定」タブにある **「掲載を依頼する」** の送り先。
 *
 * ── なぜ作ったか（2026-09-29 / 柴さんの指示）─────────────────────────────
 * それまでは `/business/contact`（公開のフォーム）へのリンクだけで、
 * **ログイン済みの担当者に会社名・氏名・メールを打ち直させていた。**
 * しかもあのフォームは**メール1本で DB に残らない**ので、運営が見落とすと追えず、
 * 企業側も「依頼したかどうか」が画面から分からなかった。
 *
 * ── ⚠️★記録が正で、メールは best-effort ──────────────────────────────────
 * 正は **`ow_companies.listing_requested_at`**。`/admin` の要対応タスクと
 * `/admin/companies` に出るので、**メールが落ちても運営は気づける。**
 * だから `sendEmail`（失敗しても 200 を返す）でよい。
 * ⚠️★**`/business/contact` と同じ扱いにしないこと。** あちらは保存先がメールしか
 *    無いので `sendEmailStrict` で 502 を返している。**逆にしない。**
 * ⚠️ ただし**失敗は必ずログに出す**（握り潰さない）。
 *
 * ── ⚠️★掲載そのものは切り替えない ───────────────────────────────────────
 * 企業側の掲載スイッチは 2026-09-18 に撤去されている（柴さんの指示）。
 * このルートが触るのは **`listing_requested_at` の1列だけ**で、
 * `is_published` / `listing_status` / `is_approved` には**一切触れない。**
 * ⚠️★**ここで掲載を立てる形に変えないこと。** 掲載の管理は運営が行う
 *    （`/admin/companies` の `updateIsPublished` / `updateListingStatus`）。
 *
 * ── ★必要な項目が欠けていたら依頼を止める（2026-10-12 に変更 / 柴さんの指示）────
 * 企業名・業種・事業領域・従業員数・本社所在地（`companyRequirements.ts`）。**下書きの値で**判定する
 * （掲載前の企業は自分で下書きを反映できず、運営が掲載にする操作の中でまとめて反映されるため）。
 * ⚠️ それまでは「事業領域は企業側に入力欄が無く直せない」ので止めていなかった。
 *    2026-09-29 に `/biz/company` に入力欄ができたので、もう行き止まりにならない。
 * ⚠️ 掲載利用規約の同意も止める（画面では、初めて押したときの確認画面で同意を取る）。
 *
 * ⚠️ 書き込みは **admin クライアント**。`listing_requested_at` は
 *    `authenticated` に UPDATE を配っていない（migration `20260929010000`）。
 *    「その企業の有効な管理者か」はこのルートが `requireAdmin` で確かめる。
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function POST() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  const { companyId, owUserId } = ctx;

  try { requireAdmin(ctx.allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  const admin = createAdminClient();

  /* ⚠️ `error` を捨てない。捨てると「掲載中かどうか」が undefined に化け、
        掲載中の企業からの依頼を通してしまう。 */
  const { data: company, error: companyErr } = await admin
    .from("ow_companies")
    .select("id, name, is_published, listing_status, listing_requested_at")
    .eq("id", companyId)
    .maybeSingle();

  if (companyErr) {
    console.error("[listing-request] 企業の取得に失敗:", companyErr.message);
    return NextResponse.json({ error: "企業情報を確認できませんでした。時間をおいて再度お試しください。" }, { status: 500 });
  }
  if (!company) return NextResponse.json({ error: "企業が見つかりませんでした。" }, { status: 404 });

  /* ⚠️ 掲載中なら依頼する意味が無い。**2軸とも見る**（片方だけだと
        「ページは見えるが一覧に出ない」状態を掲載中と誤判定する）。 */
  if (company.is_published === true && company.listing_status === "listed") {
    return NextResponse.json({ error: "すでに掲載中です。" }, { status: 400 });
  }

  /* ⚠️★二重送信をここで止める。運営が対応して NULL に戻すまで受け付けない。
        押した本人に「いつ依頼したか」を返して、画面に出せるようにする。 */
  if (company.listing_requested_at) {
    return NextResponse.json(
      { error: "すでに掲載依頼を受け付けています。", requestedAt: company.listing_requested_at },
      { status: 409 },
    );
  }

  /* 掲載規約の同意（画面では確認画面で取ってから送る） */
  if (!(await hasAgreedTerms(user.id, "listing"))) {
    return NextResponse.json(
      { error: "TERMS_REQUIRED", message: "先に掲載利用規約へ同意してください。" },
      { status: 400 },
    );
  }

  /* ★必要な項目（下書きの値で判定）。⚠️ 条件はここに書かない（companyRequirements.ts） */
  const gate = await checkPublishable(companyId, { kind: "admin" }, { useDraft: true, forListing: true });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "REQUIREMENTS_MISSING", message: `入力が足りない項目があります。${gate.missing.join(" ")}`, missing: gate.missing },
      { status: 400 },
    );
  }

  const requestedAt = new Date().toISOString();

  /* ⚠️ `mutateOne`。0行更新を成功として扱わない（CLAUDE.md） */
  const res = await mutateOne(
    admin.from("ow_companies").update({ listing_requested_at: requestedAt }).eq("id", companyId),
    "掲載依頼の記録",
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  /* ── ここから先は best-effort。失敗しても記録は残っているので 200 を返す ── */

  /* 押した人。⚠️ 名前が無い人がいるので `greetingName` を通して null を許す */
  const { data: requester, error: requesterErr } = await admin
    .from("ow_users")
    .select("name, email")
    .eq("id", owUserId)
    .maybeSingle();
  if (requesterErr) console.error("[listing-request] 依頼者の取得に失敗:", requesterErr.message);

  /* ⚠️ 必要な項目は上で止めているので、ここで足りないものは無い（メールの欄は空で送る） */
  const blockers: string[] = [];

  try {
    await sendEmail(listingRequestAdminTemplate({
      companyId,
      companyName: (company.name as string) ?? "（社名不明）",
      requesterName: greetingName(requester?.name as string | null | undefined),
      requesterEmail: (requester?.email as string | null) ?? null,
      requestedAt,
      blockers,
    }));
  } catch (e) {
    /* ⚠️ 握り潰さない。記録は残っているので依頼自体は成立している */
    console.error("[listing-request] 運営への通知に失敗:", e);
  }

  return NextResponse.json({ ok: true, requestedAt });
}
