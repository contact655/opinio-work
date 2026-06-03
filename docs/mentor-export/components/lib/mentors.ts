// src/lib/mentors.ts
// メンター関連のデータ取得ヘルパー
//
// getMentors / getMentorById は @/lib/supabase/queries に存在。
// ここでは悩みカテゴリ別のメンター取得・カテゴリマスタ取得を担当する。

import { createClient } from "@/lib/supabase/server";
import { getMentors, type MentorData } from "@/lib/supabase/queries";

// ─── 型定義 ────────────────────────────────────────────────────────────────────

export type ConsultationCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type CategoryWithMentors = ConsultationCategory & {
  mentors: MentorData[];
};

// ─── fetchCategoriesWithMentors ───────────────────────────────────────────────

/**
 * アクティブな悩みカテゴリをメンター一覧付きで取得する。
 *
 * - ow_consultation_categories（マスタ）を sort_order 昇順で取得
 * - ow_mentor_categories（多対多）でメンターと紐付け
 * - MentorData は getMentors()（ow_mentors テーブル）から取得し、user_id で照合
 * - mentor が 0 名のカテゴリも返す（呼び出し側で非表示を判断）
 */
export async function fetchCategoriesWithMentors(): Promise<CategoryWithMentors[]> {
  const supabase = createClient();

  // カテゴリ一覧
  const { data: categories, error: catError } = await supabase
    .from("ow_consultation_categories")
    .select("id, slug, name, description, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (catError || !categories?.length) return [];

  // メンターが 0 名なら紐付け不要
  const allMentors = await getMentors();
  if (allMentors.length === 0) {
    return categories.map((c) => ({ ...c, mentors: [] }));
  }

  // user_id → MentorData の Map（ow_mentor_categories との照合に使う）
  const mentorByUserId = new Map<string, MentorData>();
  for (const m of allMentors) {
    if (m.user_id) mentorByUserId.set(m.user_id, m);
  }

  // カテゴリ別メンター紐付け一覧を取得
  const { data: links } = await supabase
    .from("ow_mentor_categories")
    .select("mentor_user_id, category_id");

  if (!links?.length) {
    return categories.map((c) => ({ ...c, mentors: [] }));
  }

  // category_id → mentor_user_id[] の Map
  const catToUserIds = new Map<string, string[]>();
  for (const link of links) {
    if (!catToUserIds.has(link.category_id)) catToUserIds.set(link.category_id, []);
    catToUserIds.get(link.category_id)!.push(link.mentor_user_id);
  }

  return categories.map((c) => {
    const userIds = catToUserIds.get(c.id) ?? [];
    const mentors = userIds
      .map((uid) => mentorByUserId.get(uid))
      .filter((m): m is MentorData => !!m);
    return { ...c, mentors };
  });
}
