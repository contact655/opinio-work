import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/recommendations — 推薦文を送信
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { target_user_id, recommender_name, recommender_title, recommender_company, relationship, content } = body;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof target_user_id !== "string" || !UUID_RE.test(target_user_id)) {
    return NextResponse.json({ error: "Invalid target_user_id" }, { status: 400 });
  }

  if (!target_user_id || !recommender_name || !content) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length < 10 || content.length > 1000) {
    return NextResponse.json({ error: "推薦文は10〜1000文字で入力してください" }, { status: 400 });
  }
  if (typeof recommender_name === "string" && recommender_name.length > 100) {
    return NextResponse.json({ error: "お名前は100文字以内で入力してください" }, { status: 400 });
  }
  if (typeof recommender_title === "string" && recommender_title.length > 100) {
    return NextResponse.json({ error: "肩書きは100文字以内で入力してください" }, { status: 400 });
  }
  if (typeof recommender_company === "string" && recommender_company.length > 100) {
    return NextResponse.json({ error: "会社名は100文字以内で入力してください" }, { status: 400 });
  }
  if (typeof relationship === "string" && relationship.length > 200) {
    return NextResponse.json({ error: "関係性は200文字以内で入力してください" }, { status: 400 });
  }

  // 自分自身への推薦はNG
  const { data: owViewer } = await supabase
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owViewer) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  if (owViewer.id === target_user_id) {
    return NextResponse.json({ error: "自分自身には推薦文を書けません" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ow_user_recommendations")
    .insert({
      target_user_id,
      recommender_user_id: owViewer.id,
      recommender_name,
      recommender_title: recommender_title || null,
      recommender_company: recommender_company || null,
      relationship: relationship || null,
      content,
    })
    .select("id")
    .single();

  if (error) {
    console.error("recommendation insert error:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
