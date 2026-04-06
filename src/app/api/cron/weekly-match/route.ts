import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Cron認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 全登録ユーザーを取得
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers();

    // アクティブな求人を取得（マッチ用）
    const { data: activeJobs } = await supabase
      .from("ow_jobs")
      .select(
        "id, title, job_category, salary_min, salary_max, work_style, location, company_id, ow_companies(name, url, brand_color)"
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!activeJobs || activeJobs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: "no active jobs" });
    }

    let sent = 0;
    for (const user of users ?? []) {
      if (!user.email) continue;

      // ユーザーごとのマッチスコアを取得
      const { data: matchScores } = await supabase
        .from("ow_match_scores")
        .select("company_id, overall_score, match_reasons")
        .eq("user_id", user.id)
        .order("overall_score", { ascending: false })
        .limit(3);

      // マッチスコアがある場合はそれに基づく求人、なければ最新求人を使う
      let topJobs: any[] = [];
      if (matchScores && matchScores.length > 0) {
        const companyIds = matchScores.map((m) => m.company_id);
        const matchedJobs = activeJobs.filter((j: any) =>
          companyIds.includes(j.company_id)
        );
        topJobs = matchedJobs.slice(0, 3).map((j: any) => {
          const score = matchScores.find((m) => m.company_id === j.company_id);
          return {
            ...j,
            matchScore: score?.overall_score ?? 80,
            matchReason: score?.match_reasons?.[0] ?? getDefaultReason(j),
          };
        });
      }

      // マッチ求人が足りない場合は最新求人で補完
      if (topJobs.length < 3) {
        const existingIds = new Set(topJobs.map((j) => j.id));
        const fill = activeJobs
          .filter((j: any) => !existingIds.has(j.id))
          .slice(0, 3 - topJobs.length)
          .map((j: any) => ({
            ...j,
            matchScore: 75,
            matchReason: getDefaultReason(j),
          }));
        topJobs = [...topJobs, ...fill];
      }

      if (topJobs.length === 0) continue;

      // メール送信（Resend未導入の場合はログのみ）
      console.log(
        `[weekly-match] Would send email to ${user.email} with ${topJobs.length} jobs`
      );

      // TODO: Resend導入後にメール送信を有効化
      // メールテンプレートは generateWeeklyEmail(topJobs) で生成可能
      const _html = generateWeeklyEmail(topJobs);
      void _html; // Resend導入後に使用

      sent++;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error: any) {
    console.error("[weekly-match] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getDefaultReason(job: any): string {
  const category = job.job_category ?? "";
  if (category.includes("営業"))
    return "SaaS営業の経験が活かせるポジションです";
  if (category.includes("カスタマーサクセス"))
    return "CS経験とSaaSプロダクト理解がマッチしています";
  if (category.includes("マーケ"))
    return "BtoBマーケの経験が直結するポジションです";
  return "あなたのスキルセットにマッチする求人です";
}

// Resend導入後に使用するメールテンプレート
function generateWeeklyEmail(topJobs: any[]): string {
  const jobsHtml = topJobs
    .map((j) => {
      const company = j.ow_companies;
      const salary =
        j.salary_min && j.salary_max
          ? `${j.salary_min}〜${j.salary_max}万円`
          : "応相談";
      return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">${company?.name ?? ""}</div>
            <div style="font-size:16px;font-weight:600;color:#111">${j.title}</div>
          </div>
          <div style="background:#E1F5EE;color:#0F6E56;font-weight:600;padding:4px 10px;border-radius:999px;font-size:14px">
            ${j.matchScore}%
          </div>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px">
          ${salary} &middot; ${j.work_style ?? ""} &middot; ${j.location ?? ""}
        </div>
        <div style="font-size:12px;color:#085041;background:#E1F5EE;border-radius:8px;padding:8px 10px;margin-bottom:12px">
          <strong>マッチ理由：</strong>${j.matchReason}
        </div>
        <a href="https://opinio-work-kappa.vercel.app/jobs/${j.id}"
           style="display:inline-block;background:#1D9E75;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;text-decoration:none;font-weight:500">
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
        <span style="font-size:18px;font-weight:600">opinio<span style="color:#1D9E75">.work</span></span>
      </div>
      <h1 style="font-size:20px;font-weight:600;margin-bottom:4px">今週のあなたへのおすすめ求人</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">
        プロフィールに基づいて、マッチ度の高い求人を${topJobs.length}件ピックアップしました。
      </p>
      ${jobsHtml}
      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:20px">
        <a href="https://opinio-work-kappa.vercel.app/jobs"
           style="display:inline-block;border:1px solid #1D9E75;color:#1D9E75;padding:10px 20px;border-radius:8px;font-size:14px;text-decoration:none">
          すべての求人を見る
        </a>
      </div>
      <p style="font-size:11px;color:#9ca3af;margin-top:20px">
        opinio.work &middot; Truth to Careers<br>
        配信停止は<a href="https://opinio-work-kappa.vercel.app/dashboard" style="color:#9ca3af">こちら</a>
      </p>
    </body>
    </html>
  `;
}
