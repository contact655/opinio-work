import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/jobseeker/experience-story-sections/reorder
//
// DnD ドロップ後のセクション並べ替えを一括更新するエンドポイント。
// セクション並べ替えは sort_order のみ変わる(section_id など他フィールド変更なし)ため、
// orderedIds 配列を受け取りインデックスを sort_order として使用するシンプル形式を採用。
// (employee-categories/route.ts の PUT と同じパターン)
//
// RLS: 既存の ow_story_sections UPDATE ポリシー(migration 094 実装済み)が適用。
//   USING + WITH CHECK で experience_id 所有者チェック済み。
// → 追加 Migration 不要

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderedIds = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "orderedIds は非空の文字列配列が必要です。" },
      { status: 400 }
    );
  }
  if (!orderedIds.every((id) => typeof id === "string")) {
    return NextResponse.json(
      { error: "INVALID_FIELD", message: "orderedIds の各要素は string である必要があります。" },
      { status: 400 }
    );
  }

  // index を sort_order として使用(0-based)
  // RLS の USING + WITH CHECK が DB レベルで ownership を保証
  const updates = (orderedIds as string[]).map((id, index) =>
    supabase
      .from("ow_story_sections")
      .update({ sort_order: index + 1 })  // 1-based に揃える(既存 MAX+1 の起点と一致)
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(
      "[PATCH /api/jobseeker/experience-story-sections/reorder]",
      failed[0].error?.message
    );
    return NextResponse.json(
      { error: `${failed.length} 件の更新に失敗しました` },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
