import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

// POST /api/biz/pipeline/candidates
// Body: { external_name, external_email?, source, agent_company?, job_id, pipeline_stage_id, memo? }
export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  let body: {
    external_name: string;
    external_email?: string;
    source: string;
    agent_company?: string;
    agency_id?: string;
    job_id: string;
    pipeline_stage_id: string;
    memo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.external_name) {
    return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
  }
  if (body.external_name.length > 100) {
    return NextResponse.json({ error: "氏名は100字以内で入力してください" }, { status: 400 });
  }
  if (body.external_email && body.external_email.length > 200) {
    return NextResponse.json({ error: "メールアドレスが長すぎます" }, { status: 400 });
  }
  if (!body.source) {
    return NextResponse.json({ error: "応募経路は必須です" }, { status: 400 });
  }
  if (body.source.length > 100) {
    return NextResponse.json({ error: "応募経路は100字以内で入力してください" }, { status: 400 });
  }
  if (body.agent_company && body.agent_company.length > 100) {
    return NextResponse.json({ error: "エージェント会社名は100字以内で入力してください" }, { status: 400 });
  }
  if (body.memo && body.memo.length > 1000) {
    return NextResponse.json({ error: "メモは1000字以内で入力してください" }, { status: 400 });
  }
  if (!body.job_id) {
    return NextResponse.json({ error: "対象求人は必須です" }, { status: 400 });
  }
  if (!body.pipeline_stage_id) {
    return NextResponse.json({ error: "選考ステージは必須です" }, { status: 400 });
  }

  // Verify job belongs to this company
  const { data: job } = await supabase
    .from("ow_jobs")
    .select("id, company_id")
    .eq("id", body.job_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }

  // Verify stage belongs to this company
  const { data: stage } = await supabase
    .from("ow_pipeline_stages")
    .select("id, company_id")
    .eq("id", body.pipeline_stage_id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!stage) {
    return NextResponse.json({ error: "ステージが見つかりません" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ow_job_applications")
    .insert({
      job_id: body.job_id,
      user_id: null,
      external_name: body.external_name,
      external_email: body.external_email || null,
      source: body.source,
      agent_company: body.agent_company || null,
      agency_id: body.agency_id || null,
      pipeline_stage_id: body.pipeline_stage_id,
      memo: body.memo || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ application: data }, { status: 201 });
}
