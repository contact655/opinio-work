import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { getWeeklyRecipients, unsubscribeUrl } from "@/lib/notify/weeklyRecipients";
import { timingSafeEqual } from "crypto";
import { fmtMan } from "@/lib/utils/salary";
import { getJobs } from "@/lib/supabase/queries";
import { computeRecommendations, type RecommendedJob } from "@/lib/matching/scoreJob";
import { getDesiredRolesFor } from "@/lib/profile/desiredRoles";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.co.jp";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

/*
  ⚠️⚠️ 週次メールはまだ止めてある。**このガードを外す前に下を読むこと。**

  ── 止めた3つの理由は解消済み（2026-08-10）────────────────────────────

  ① マッチ度「75%」に根拠が無い → ✅ 解消
     ow_match_scores（0件・書き込む主体が存在しない）を読むのをやめ、
     希望条件と lib/matching/scoreJob.ts でその場で算出する形にした。
     ⚠️ **希望条件が1つも無い人には送らない。** 以前はそこを 75% で埋めていた。
     ⚠️ **マッチ度の数字は出さない**（Hisato 思想⑦）。理由を文で出す。

  ② 配信停止が機能していない → ✅ 解消
     ow_profiles.email_weekly_enabled を作り、getWeeklyRecipients が見る。
     設定 UI は /profile/edit?tab=account（localStorage をやめた）。

  ③ 宛先に is_test と実在しないアドレスが混ざる → ✅ 解消
     getWeeklyRecipients に集約。2026-08-10 実測で 39件 → 3名。

  ── 再開に必要なこと（両方やらないと動かない。**片方だけ戻さないこと**）──
    1. Vercel の環境変数に WEEKLY_EMAIL_ENABLED=true を入れる
    2. vercel.json の crons に "/api/cron/weekly-match" を戻す

  ⚠️ 送るかどうかは製品判断として残してある。技術的な障害は無い。
*/
function isDisabled(): boolean {
  return process.env.WEEKLY_EMAIL_ENABLED !== "true";
}

export async function GET(request: Request) {
  // ⚠️ 認証より前に置く。認証が通っても送信経路に入らないための保険
  if (isDisabled()) {
    return NextResponse.json({
      success: true,
      sent: 0,
      reason: "disabled: weekly-match は停止中。①②③は解消済みで、再開は WEEKLY_EMAIL_ENABLED=true と vercel.json の crons の両方",
    });
  }

  // Fail fast if CRON_SECRET is not configured
  if (!process.env.CRON_SECRET) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  // Cron認証
  const authHeader = request.headers.get("authorization");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  const actual = Buffer.from(authHeader ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ success: false, error: "Supabase env vars not configured" }, { status: 503 });
  }
  const supabase = createClient(url, key);

  try {
    /* 求人は一覧と同じ `getJobs()` から取る。
       ⚠️ 独自に ow_jobs を select しないこと。`roleIds`（祖先まで展開済み）が
          付かず、職種マッチが常に外れる。 */
    const [{ jobs, companies }, { recipients, excluded }] = await Promise.all([
      getJobs(),
      getWeeklyRecipients(supabase),
    ]);

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: "no published jobs" });
    }

    console.log(
      `[weekly-match] 宛先 ${recipients.length}名 / 除外: 配信停止 ${excluded.optedOut} / ` +
      `ow_users なし ${excluded.noOwUser} / test・system ${excluded.testOrSystem} / メールなし ${excluded.noEmail}`
    );

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: "no eligible users", excluded });
    }

    const phaseMap = new Map(
      companies.filter((c) => c.phase).map((c) => [c.id, c.phase as string])
    );
    const companyById = new Map(companies.map((c) => [c.id, c]));

    const authIds = recipients.map((r) => r.authId);

    /* 希望条件をまとめて引く。⚠️ `ow_profiles.user_id` は auth 空間。 */
    const [desiredMap, { data: prefRows }] = await Promise.all([
      getDesiredRolesFor(authIds),
      supabase
        .from("ow_profiles")
        .select("user_id, desired_work_styles, desired_salary_min, desired_salary_max, desired_phase")
        .in("user_id", authIds),
    ]);
    const prefByUser = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prefRows ?? []) as any[]).map((r) => [r.user_id as string, r])
    );

    let sent = 0;
    const errors: string[] = [];
    // ⚠️ 送らなかった理由を数える。黙ってスキップすると「0通」の意味が分からない
    const skipped = { noPreference: 0, noMatch: 0 };

    for (const r of recipients) {
      const desired = desiredMap.get(r.authId);
      const pref = prefByUser.get(r.authId);

      const scoringProfile = {
        // ⚠️ 突き合わせは展開後（祖先込み）、表示は展開前の名前。/jobs と同じ
        desired_role_ids: desired?.expandedIds ?? null,
        desired_role_names: desired?.names ?? null,
        desired_work_styles: (pref?.desired_work_styles as string[] | null) ?? null,
        desired_salary_min: pref?.desired_salary_min ? Number(pref.desired_salary_min) : null,
        desired_salary_max: pref?.desired_salary_max ? Number(pref.desired_salary_max) : null,
        desired_phase: (pref?.desired_phase as string[] | null) ?? null,
      };

      /* ⚠️ **希望条件が1つも無い人には送らない。**
            以前はここで matchScore: 75 を作って「あなたへのおすすめ」として
            送っていた。根拠が無いなら、埋めずに送らないのが正しい
            （CLAUDE.md「値が無いことを、ある値に置き換えない」）。 */
      const hasPreference =
        (scoringProfile.desired_role_ids?.length ?? 0) > 0 ||
        (scoringProfile.desired_work_styles?.length ?? 0) > 0 ||
        (scoringProfile.desired_phase?.length ?? 0) > 0 ||
        scoringProfile.desired_salary_min != null ||
        scoringProfile.desired_salary_max != null;

      if (!hasPreference) {
        skipped.noPreference++;
        continue;
      }

      /* ⚠️ computeRecommendations はしきい値未満と「理由が作れないもの」を
            自分で落とす。0件なら送るものが無いということ。 */
      const recs = computeRecommendations(jobs, phaseMap, scoringProfile);
      if (recs.length === 0) {
        skipped.noMatch++;
        continue;
      }

      try {
        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "contact@opinio.co.jp",
          to: r.email,
          subject: "【OPINIO】希望条件に合う求人が届いています",
          html: generateWeeklyEmail(recs.slice(0, 3), companyById),
        });
        sent++;
      } catch (err: any) {
        console.error(`[weekly-match] Failed to send email:`, err.message);
        errors.push("send_failed");
      }
    }

    console.log(
      `[weekly-match] 送信 ${sent}通 / 送らなかった: 希望条件なし ${skipped.noPreference} / ` +
      `該当求人なし ${skipped.noMatch}`
    );

    return NextResponse.json({
      success: true,
      sent,
      total: recipients.length,
      errors: errors.length > 0 ? errors.length : undefined,
      excluded,
      skipped,
    });
  } catch (error: unknown) {
    console.error("[weekly-match] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * ⚠️ **マッチ度の数字（%）は出さない。**
 *    以前は全員・全求人に固定の 75% を出していた。根拠のある数字を作れたとしても、
 *    「マッチ度%・星評価を出さない。求職者が自分で判断する」がこのプロダクトの方針
 *    （CLAUDE.md「Hisato 思想」⑦）。代わりに**なぜ選ばれたか**を文で出す。
 *
 * ⚠️ 理由文は `computeRecommendations` が実際の希望条件から作ったもの。
 *    ここで補完しないこと。補完した瞬間に、また嘘に戻る。
 */
function generateWeeklyEmail(
  recs: RecommendedJob[],
  companyById: Map<string, { id: string; name: string }>
): string {
  const jobsHtml = recs
    .map(({ job, reasonText }) => {
      const company = companyById.get(job.company_id);
      const salary =
        job.salary_min && job.salary_max
          ? `${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円`
          : "応相談";
      return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="margin-bottom:8px">
          <div style="font-size:12px;color:#6b7280;margin-bottom:2px">${escapeHtml(company?.name ?? "")}</div>
          <div style="font-size:16px;font-weight:600;color:#111">${escapeHtml(job.role ?? "")}</div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px">
          ${escapeHtml(salary)} &middot; ${escapeHtml(job.work_style ?? "")} &middot; ${escapeHtml(job.location ?? "")}
        </div>
        <div style="font-size:12px;color:#085041;background:#E1F5EE;border-radius:8px;padding:8px 10px;margin-bottom:12px">
          <strong>選んだ理由：</strong>${escapeHtml(reasonText)}
        </div>
        <a href="${BASE_URL}/jobs/${job.id}"
           style="display:inline-block;background:#059669;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;text-decoration:none">
          詳細を見る →
        </a>
      </div>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
      <div style="margin-bottom:24px">
        <span style="font-size:18px;font-weight:600;color:#002366">OPINIO</span>
        <span style="font-size:11px;color:#6b7280;margin-left:8px">IT/SaaS業界のキャリアインフラ</span>
      </div>
      <h1 style="font-size:20px;font-weight:600;margin-bottom:4px">希望条件に合う求人が届いています</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">
        あなたが登録した希望条件に合う求人を${recs.length}件お送りします。
        条件は<a href="${BASE_URL}/mypage?tab=wishes" style="color:#059669">プロフィール編集</a>からいつでも変更できます。
      </p>
      ${jobsHtml}
      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:20px">
        <a href="${BASE_URL}/jobs"
           style="display:inline-block;border:1px solid #059669;color:#059669;padding:10px 20px;border-radius:8px;font-size:14px;text-decoration:none">
          すべての求人を見る
        </a>
      </div>
      <p style="font-size:11px;color:#94a3b8;margin-top:20px">
        OPINIO &middot; IT/SaaS業界のキャリアインフラ<br>
        配信停止は<a href="${unsubscribeUrl(BASE_URL)}" style="color:#94a3b8">プロフィール編集</a>から設定できます
      </p>
    </body>
    </html>
  `;
}
