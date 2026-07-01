import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return null;

  return { supabase, companyId: ctx.companyId };
}

// ─── GET /api/biz/pipeline/stages ─────────────────────────────────────────────

export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, companyId } = ctx;

  const { data, error } = await supabase
    .from("ow_pipeline_stages")
    .select("id, company_id, name, color, order_index, is_hired, is_rejected, created_at, updated_at")
    .eq("company_id", companyId)
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ stages: data });
}

// ─── POST /api/biz/pipeline/stages ────────────────────────────────────────────

export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, companyId } = ctx;

  let body: { name: string; color: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || !body.color) {
    return NextResponse.json({ error: "name and color are required" }, { status: 400 });
  }
  if (body.name.length > 50) {
    return NextResponse.json({ error: "ステージ名は50文字以内で入力してください" }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    return NextResponse.json({ error: "color must be a valid hex color (e.g. #3B5FD9)" }, { status: 400 });
  }

  // Get current max order_index
  const { data: existing } = await supabase
    .from("ow_pipeline_stages")
    .select("order_index")
    .eq("company_id", companyId)
    .order("order_index", { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order_index ?? -1;

  const { data, error } = await supabase
    .from("ow_pipeline_stages")
    .insert({
      company_id: companyId,
      name: body.name,
      color: body.color,
      order_index: maxOrder + 1,
      is_hired: false,
      is_rejected: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ stage: data }, { status: 201 });
}

// ─── PUT /api/biz/pipeline/stages ─────────────────────────────────────────────

export async function PUT(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, companyId } = ctx;

  let body: { id: string; name?: string; color?: string; order_index?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (body.name !== undefined && body.name.length > 50) {
    return NextResponse.json({ error: "ステージ名は50文字以内で入力してください" }, { status: 400 });
  }
  if (body.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    return NextResponse.json({ error: "color must be a valid hex color (e.g. #3B5FD9)" }, { status: 400 });
  }
  if (body.order_index !== undefined) {
    const n = Number(body.order_index);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      return NextResponse.json({ error: "Invalid order_index" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.order_index !== undefined) updates.order_index = Number(body.order_index);

  const { data, error } = await supabase
    .from("ow_pipeline_stages")
    .update(updates)
    .eq("id", body.id)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ stage: data });
}

// ─── DELETE /api/biz/pipeline/stages ──────────────────────────────────────────

export async function DELETE(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, companyId } = ctx;

  let body: { id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Check stage exists and belongs to this company
  const { data: stage } = await supabase
    .from("ow_pipeline_stages")
    .select("id, is_hired, is_rejected")
    .eq("id", body.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  if (stage.is_hired || stage.is_rejected) {
    return NextResponse.json(
      { error: "採用・不採用ステージは削除できません" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("ow_pipeline_stages")
    .delete()
    .eq("id", body.id)
    .eq("company_id", companyId);

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
