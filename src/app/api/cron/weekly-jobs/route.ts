import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.co.jp";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(request: Request) {
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
    return NextResponse.json(
      { success: false, error: "Supabase env vars not configured" },
      { status: 503 }
    );
  }
  const supabase = createClient(url, key);

  try {
    // 期限切れ求人を expired に遷移（DRY RUN: 件数をログするのみ、実際の UPDATE はコメントアウト）
    const { data: expiredCandidates } = await supabase
      .from("ow_jobs")
      .select("id, title")
      .eq("status", "published")
      .lt("expires_at", new Date().toISOString());
    console.log(
      `[weekly-jobs] expired candidates (DRY RUN): ${expiredCandidates?.length ?? 0} jobs`,
      expiredCandidates?.map((j) => j.id) ?? []
    );
    // TODO: DRY RUN 確認後に以下のコメントを外す（1週間様子を見てから）
    // if (expiredCandidates && expiredCandidates.length > 0) {
    //   const ids = expiredCandidates.map((j) => j.id);
    //   await supabase.from("ow_jobs").update({ status: "expired" }).in("id", ids);
    //   console.log(`[weekly-jobs] expired ${ids.length} jobs`);
    // }

    // 過去7日以内に追加された求人を取得
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentJobs } = await supabase
      .from("ow_jobs")
      .select(
        "id, title, job_category, salary_min, salary_max, work_style, location, ow_companies(name, url)"
      )
      .eq("status", "published")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    if (!recentJobs || recentJobs.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        reason: "no new jobs in last 7 days",
      });
    }

    // メール通知を許可しているユーザーを取得（全ユーザーデフォルト許可）
    const { data: profiles } = await supabase
      .from("ow_profiles")
      .select("user_id, name");

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
    } = await supabase.auth.admin.listUsers({ perPage: 1000 });

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
          from: process.env.RESEND_FROM_EMAIL ?? "contact@opinio.co.jp",
          to: email,
          subject: `今週の注目求人・企業${totalCount}選 — OPINIO`,
          html,
        });
        sent++;
      } catch (err: any) {
        console.error("[weekly-jobs] send error:", err.message);
        errors.push("send_failed");
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      totalJobs: totalCount,
      errors: errors.length > 0 ? errors.length : undefined,
    });
  } catch (error: unknown) {
    console.error("[weekly-jobs] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatSalary(min: number | null, max: number | null): string {
  const fmt = (v: number) => v.toLocaleString("ja-JP");
  if (min && max) return `${fmt(min)}〜${fmt(max)}万円`;
  if (min) return `${fmt(min)}万円〜`;
  if (max) return `〜${fmt(max)}万円`;
  return "応相談";
}

function generateWeeklyJobsEmail(jobs: any[], totalCount: number): string {
  const jobCards = jobs
    .map((j) => {
      const company = j.ow_companies;
      const salary = formatSalary(j.salary_min, j.salary_max);
      const meta = [j.job_category, salary, j.location]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" &middot; ");

      return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:12px;background:#fff;position:relative">
        <div style="display:inline-block;background:#002366;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;margin-bottom:8px;letter-spacing:0.05em">
          &#x1F4BC; 新着
        </div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${escapeHtml(company?.name ?? "企業名")}</div>
        <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:8px">${escapeHtml(j.title ?? "")}</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:12px">${meta}</div>
        <a href="${BASE_URL}/jobs/${j.id}"
           style="display:inline-block;background:#059669;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;text-decoration:none;font-weight:500">
          詳細を見る →
        </a>
      </div>`;
    })
    .join("");

  const moreLink =
    totalCount > 3
      ? `<div style="text-align:center;margin-top:8px;margin-bottom:16px">
           <a href="${BASE_URL}/jobs?sort=newest"
              style="display:inline-block;border:1px solid #059669;color:#059669;padding:10px 24px;border-radius:8px;font-size:14px;text-decoration:none;font-weight:500">
             他 ${totalCount - 3}件の新着を見る →
           </a>
         </div>`
      : "";

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;background:#f9fafb">
      <div style="margin-bottom:24px">
        <span style="font-size:20px;font-weight:700;color:#002366">OPINIO</span>
        <span style="font-size:11px;color:#6b7280;margin-left:8px">IT/SaaS業界のキャリアインフラ</span>
      </div>

      <!-- 今週の注目バナー -->
      <div style="background:#002366;border-radius:12px;padding:20px 24px;margin-bottom:24px;color:#fff">
        <div style="font-size:11px;letter-spacing:0.1em;opacity:0.7;margin-bottom:6px;text-transform:uppercase">Weekly Picks</div>
        <div style="font-size:20px;font-weight:700;line-height:1.3">
          今週の注目求人 ${totalCount}選
        </div>
        <div style="font-size:13px;opacity:0.8;margin-top:6px">
          IT/SaaS業界の最新キャリアチャンスをお届けします
        </div>
      </div>

      ${jobCards}
      ${moreLink}

      <!-- メンター相談CTA -->
      <div style="background:#fff8f0;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin-top:24px;text-align:center">
        <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:6px">
          &#x1F4AC; 企業の在籍者にDMで直接相談
        </div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:14px">
          気になる企業のプロフィールページから、在籍ユーザーにDMを送れます
        </div>
        <a href="${BASE_URL}/companies"
           style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;padding:10px 28px;border-radius:8px;font-size:14px;text-decoration:none;font-weight:700;box-shadow:0 2px 8px rgba(245,158,11,0.3)">
          企業一覧を見る →
        </a>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:24px">
        <p style="font-size:12px;color:#6b7280;margin-bottom:4px">
          OPINIOは IT/SaaS業界専門のキャリアプラットフォームです
        </p>
        <p style="font-size:11px;color:#94a3b8;line-height:1.6">
          OPINIO &middot; IT/SaaS業界のキャリアインフラ<br>
          配信停止は<a href="${BASE_URL}/mypage" style="color:#94a3b8">マイページ</a>から設定できます
        </p>
      </div>
    </body>
    </html>
  `;
}
