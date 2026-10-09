import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_JOB_MATCH } from "@/lib/jobs/publicJobs";
import { decideView, isBotUserAgent, type ViewerInfo } from "@/lib/views/decide";
import { SEEN_COOKIE, jstToday, pageKey, parseSeen, secondsUntilJstMidnight, serializeSeen } from "@/lib/views/seenCookie";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★企業ページ・求人詳細の閲覧を1件数える（2026-10-09 / 段階D）。
 *
 * 呼ぶのはページ側の `ViewBeacon`（クライアント）だけ。ページは ISR なので、
 * 描画の時点では数えられない（サーバーで閲覧者を読むと動的になる）。
 *
 * ⚠️★**閲覧者の ID は保存しない。** 書くのは `ow_page_view_daily` の
 *    「日付 × ページ」の件数だけ（increment_page_view）。
 * ⚠️★**判定は `lib/views/decide.ts` の1か所。** ここは材料を集めるだけ。
 * ⚠️★**開発環境では書かない**（dev も本番 DB に繋がっているため）。判定結果だけ返す。
 *    書きたいときだけ `VIEW_RECORD_IN_DEV=true`。`next start` は本番扱いで書く。
 * ⚠️ 応答は常に 200。数えなかった理由（自分が運営か等）は呼んだ本人にしか返らない。
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const type = body?.type === "company" || body?.type === "job" ? (body.type as "company" | "job") : null;
  const id = typeof body?.id === "string" && UUID.test(body.id) ? (body.id as string) : null;
  if (!type || !id) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const isBot = isBotUserAgent(req.headers.get("user-agent"));
  const today = jstToday();
  const key = pageKey(type, id);
  const seen = parseSeen(req.cookies.get(SEEN_COOKIE)?.value, today.compact);

  const admin = createAdminClient();

  // 対象が公開されているか（＝その企業の id を引く）
  let companyId: string | null = null;
  if (type === "company") {
    const { data, error } = await admin.from("ow_companies").select("id, is_published, is_test").eq("id", id).maybeSingle();
    if (error) console.error("[api/views] company:", error.message);
    if (data && data.is_published === true && data.is_test !== true) companyId = data.id as string;
  } else {
    const { data, error } = await admin.from("ow_jobs").select("id, company_id").eq("id", id).match(PUBLIC_JOB_MATCH).maybeSingle();
    if (error) console.error("[api/views] job:", error.message);
    if (data?.company_id) companyId = data.company_id as string;
  }

  // 閲覧者
  let viewer: ViewerInfo = { loggedIn: false };
  if (!isBot && companyId) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me, error: meErr } = await admin
        .from("ow_users").select("id, is_test, is_system").eq("auth_id", user.id).maybeSingle();
      if (meErr) console.error("[api/views] ow_users:", meErr.message);
      const { data: isAdmin } = await supabase.rpc("auth_is_admin");
      let isCompanyStaff = false;
      if (me?.id) {
        const { data: staff, error: stErr } = await admin
          .from("ow_company_admins").select("id").eq("user_id", me.id).eq("company_id", companyId).eq("is_active", true).limit(1);
        if (stErr) console.error("[api/views] company_admins:", stErr.message);
        isCompanyStaff = (staff ?? []).length > 0;
      }
      viewer = {
        loggedIn: true,
        /* ⚠️ 自分の行が引けないときは数えない側に倒す（誰か分からない人の閲覧を足さない） */
        isTest: me ? me.is_test === true : true,
        isSystem: me?.is_system === true,
        isAdmin: isAdmin === true,
        isCompanyStaff,
      };
    }
  }

  const decision = decideView({ isBot, targetPublic: companyId !== null, seenToday: seen.includes(key), viewer });

  const writes = process.env.NODE_ENV === "production" || process.env.VIEW_RECORD_IN_DEV === "true";
  let recorded = false;
  if (decision.count && writes && companyId) {
    const { error } = await admin.rpc("increment_page_view", {
      p_view_date: today.iso, p_page_type: type, p_target_id: id, p_company_id: companyId,
    });
    if (error) console.error("[api/views] increment:", error.message);
    else recorded = true;
  }

  const res = NextResponse.json(
    writes ? { counted: recorded } : { counted: decision.count, reason: decision.count ? null : decision.reason, devNoWrite: true },
  );
  /* ⚠️ 数えたときだけ印を付ける（除かれた閲覧で印を進めない）。
        dev は書かないが、印の動きを確かめられるよう判定どおりに付ける。 */
  if (decision.count && (recorded || !writes)) {
    res.cookies.set(SEEN_COOKIE, serializeSeen(today.compact, [...seen, key]), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: secondsUntilJstMidnight(),
    });
  }
  return res;
}
