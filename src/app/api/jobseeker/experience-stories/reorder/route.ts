import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/jobseeker/experience-stories/reorder
//
// DnD ドロップ後のストーリー並べ替えを一括更新するエンドポイント。
// 単件 PUT を複数回呼ぶより効率的(リクエスト1本で完結)。
// セクションをまたぐ移動では section_id + sort_order を同時更新する必要があるため、
// orderedIds のみでなく items: [{id, sort_order, section_id}] 形式を採用。
//
// RLS: 既存の ow_experience_stories UPDATE ポリシー(migration 094 で強化済み)が適用。
//   USING: experience_id が自分の所有か
//   WITH CHECK: experience_id + section_id の所有者チェック(section_id 改ざん防止)
// → 追加 Migration 不要

type ReorderItem = {
  id: string;
  sort_order: number;
  section_id: string | null;
};

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

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "items は非空の配列が必要です。" },
      { status: 400 }
    );
  }

  // バリデーション: 各 item が {id: string, sort_order: integer, section_id: string|null} の形を持つか
  const validated: ReorderItem[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      return NextResponse.json({ error: "INVALID_ITEM", message: "各 item はオブジェクトである必要があります。" }, { status: 400 });
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== "string") {
      return NextResponse.json({ error: "INVALID_ITEM", message: "各 item.id は string が必要です。" }, { status: 400 });
    }
    if (typeof obj.sort_order !== "number" || !Number.isInteger(obj.sort_order)) {
      return NextResponse.json({ error: "INVALID_ITEM", message: "各 item.sort_order は整数が必要です。" }, { status: 400 });
    }
    // section_id: null か string のみ許容
    if (obj.section_id !== null && typeof obj.section_id !== "string") {
      return NextResponse.json({ error: "INVALID_ITEM", message: "各 item.section_id は string または null が必要です。" }, { status: 400 });
    }
    validated.push({
      id: obj.id,
      sort_order: obj.sort_order,
      section_id: obj.section_id === null ? null : (obj.section_id as string),
    });
  }

  // 各 item を並列更新
  // RLS の USING + WITH CHECK が DB レベルで ownership を保証するため、
  // アプリ層での所有者確認は不要(レコードが存在しない or 権限外なら UPDATE 件数ゼロで返る)
  const updates = validated.map(({ id, sort_order, section_id }) =>
    supabase
      .from("ow_experience_stories")
      .update({ sort_order, section_id })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(
      "[PATCH /api/jobseeker/experience-stories/reorder]",
      failed[0].error?.message
    );
    return NextResponse.json(
      { error: `${failed.length} 件の更新に失敗しました` },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
