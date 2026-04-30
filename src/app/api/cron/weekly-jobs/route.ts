import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://opinio-work-kappa.vercel.app";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(request: Request) {
  // Cron認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { success: false, error: "Supabase env vars not configured" },
      { status: 503 }
    );
  }
  const supabase = createClient(url, key);

  try {
    // 過去7日以内に追加された求人を取得
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentJobs } = await supabase
      .from("ow_jobs")
      .select(
        "id, title, job_category, salary_min, salary_max, work_style, location, ow_companies(name, url)"
      )
      .eq("status", "active")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    if (!recentJobs || recentJobs.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        reason: "no new jobs in last 7 days",
      });
    }

    // メール通知を許可しているユーザーを取得
    // notify_email が true または null（デフォルト許可）のユーザー
    const { data: profiles } = await supabase
      .from("ow_profiles")
      .select("user_id, name")
      .or("notify_email.eq.true,notify_email.is.null");

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        reason: "no eligible users",
      });
    }

    // ユーザーのメールアドレスを取得
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers();

    const userEmailMap = new Map<string, string>();
    for (const u of users ?? []) {
      if (u.email) userEmailMap.set(u.id, u.email);
    }

    // 送信対象を構築
    const topJobs = recentJobs.slice(0, 3);
    const totalCount = recentJobs.length;
    const html = generateWeeklyJobsEmail(topJobs, totalCount);

    let sent = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      const email = userEmailMap.get(profile.user_id);
      if (!email) continue;

      try {
        await getResend().emails.send({
          from: "opinio.jp <noreply@opinio.jp>",
          to: email,
          subject: `【opinio.jp】今週の新着求人 ${totalCount}件をお届けします`,
          html,
        });
        sent++;
      } catch (err: any) {
        errors.push(`${email}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      totalJobs: totalCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[weekly-jobs] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function formatSalary(min: number | null, max: number | null): string {
  if (min && max) return `${min}〜${max}万円`;
  if (min) return `${min}万円〜`;
  if (max) return `〜${max}万円`;
  return "応相談";
}

function generateWeeklyJobsEmail(jobs: any[], totalCount: number): string {
  const jobCards = jobs
    .map((j) => {
      const company = j.ow_companies;
      const salary = formatSalary(j.salary_min, j.salary_max);
      const meta = [j.job_category, salary, j.location]
        .filter(Boolean)
        .join(" &middot; ");

      return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:12px;background:#fff">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${company?.name ?? "企業名"}</div>
        <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">${j.title}</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:12px">${meta}</div>
        <a href="${BASE_URL}/jobs/${j.id}"
           style="display:inline-block;background:#1D9E75;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;text-decoration:none;font-weight:500">
          詳細を見る →
        </a>
      </div>`;
    })
    .join("");

  const moreLink =
    totalCount > 3
      ? `<div style="text-align:center;margin-top:8px;margin-bottom:16px">
           <a href="${BASE_URL}/jobs?sort=newest"
              style="display:inline-block;border:1px solid #1D9E75;color:#1D9E75;padding:10px 24px;border-radius:8px;font-size:14px;text-decoration:none;font-weight:500">
             他 ${totalCount - 3}件の新着を見る →
           </a>
         </div>`
      : "";

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;background:#f9fafb">
      <div style="margin-bottom:24px">
        <span style="font-size:20px;font-weight:700;color:#0f172a">opinio</span><span style="font-size:20px;font-weight:700;color:#1D9E75">.work</span>
      </div>

      <h1 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:4px">
        今週の新着求人 ${totalCount}件
      </h1>
      <p style="font-size:14px;color:#6b7280;margin-bottom:24px">
        この1週間で追加された求人をお届けします。
      </p>

      ${jobCards}
      ${moreLink}

      <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:24px">
        <p style="font-size:11px;color:#9ca3af;line-height:1.6">
          opinio.jp &middot; Truth to Careers<br>
          配信停止は<a href="${BASE_URL}/dashboard" style="color:#9ca3af">マイページ</a>から設定できます
        </p>
      </div>
    </body>
    </html>
  `;
}
