// Supabase Edge Function: notify followers when a new job is published.
// Deploy with: supabase functions deploy notify-followers
// Invoke via DB trigger or from app after job publish.
//
// Expected body: { job_id: string, company_id: string }

// @ts-ignore Deno std imports resolved at deploy time
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore Supabase JS client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface NotifyPayload {
  job_id: string;
  company_id: string;
}

const SITE_URL = Deno.env.get("SITE_URL") || "https://opinio.work";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Opinio <notify@opinio.work>";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send");
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
    });
    return r.ok;
  } catch (e) {
    console.error("resend error", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }
  if (!payload.job_id || !payload.company_id) {
    return new Response(JSON.stringify({ error: "job_id and company_id required" }), { status: 400 });
  }

  // Fetch job + company
  const { data: job } = await supabase
    .from("ow_jobs")
    .select("id, title, salary_min, salary_max, location, ow_companies(name)")
    .eq("id", payload.job_id)
    .maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: "job not found" }), { status: 404 });

  // Fetch followers
  const { data: follows } = await supabase
    .from("ow_company_follows")
    .select("user_id")
    .eq("company_id", payload.company_id);
  const followerIds = (follows || []).map((f: any) => f.user_id);
  if (followerIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "no followers" }));
  }

  // Fetch emails from auth users (admin)
  const { data: users } = await (supabase as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
  const allUsers = (users?.users || []) as Array<{ id: string; email: string | null }>;
  const targetEmails = allUsers
    .filter((u) => followerIds.includes(u.id) && !!u.email)
    .map((u) => u.email as string);

  const companyName = (job.ow_companies as any)?.name || "フォロー中の企業";
  const subject = `【Opinio】${companyName}から新しい求人が公開されました`;
  const salary = job.salary_min && job.salary_max
    ? `${job.salary_min}万円〜${job.salary_max}万円`
    : job.salary_min ? `${job.salary_min}万円〜` : job.salary_max ? `〜${job.salary_max}万円` : "応相談";

  const body = `
${companyName}から、以下の求人が新しく公開されました。

━━━━━━━━━━━━━━━━━━━━
ポジション: ${job.title}
年収: ${salary}
勤務地: ${job.location || "—"}
━━━━━━━━━━━━━━━━━━━━

▶ 求人詳細を見る
${SITE_URL}/jobs/${job.id}

▶ この会社の通知を停止する
${SITE_URL}/settings/follows
`.trim();

  let sent = 0;
  for (const email of targetEmails) {
    const ok = await sendEmail(email, subject, body);
    if (ok) sent++;
  }

  return new Response(JSON.stringify({ sent, total: targetEmails.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
