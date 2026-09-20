import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseSavedFilters,
  isEmptyFilters,
  MAX_SAVED_SEARCHES,
  MAX_SAVED_SEARCH_NAME,
  type SavedSearch,
} from "@/lib/business/savedSearch";

/**
 * 候補者検索の「保存した条件」。
 *
 * ⚠️★**行の持ち主は `ow_users.id`（`ctx.currentOwnId`）。** `auth.uid()` ではない。
 * ⚠️★**企業は `ctx.tenantId` から取る。** リクエストの値を信じない
 *    （信じると、所属していない会社の条件を読み書きできる）。
 * ⚠️ 読み書きは admin クライアント。表は `authenticated` に SELECT しか配っておらず、
 *    書き込みはこの経路だけを通る（migration の冒頭に理由）。
 *
 * ⚠️★**プランのゲートを掛けてある。** 候補者検索そのものが有料機能なので、
 *    その条件を保存する口だけ無料で開いていると辻褄が合わない。
 *    判定は `canUse(..., "candidateSearch")` の1本。ここに条件を書き写さない。
 */
export const dynamic = "force-dynamic";

/** 企業の担当者であることと、候補者検索を使えることを確かめる */
async function requireCandidateSearch() {
  const ctx = await getTenantContext();
  if (!ctx) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  if (!canUse(ctx.planType, "candidateSearch")) {
    return { error: NextResponse.json({ error: "候補者検索は有料プランの機能です" }, { status: 403 }) } as const;
  }
  return { ctx } as const;
}

export async function GET() {
  const g = await requireCandidateSearch();
  if (g.error) return g.error;
  const { ctx } = g;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_saved_candidate_searches")
    .select("id, name, filters, updated_at")
    .eq("owner_user_id", ctx.currentOwnId)
    .eq("company_id", ctx.tenantId)
    .order("updated_at", { ascending: false });

  /* ⚠️ error を握り潰さない。`?? []` で受けると権限エラーが「0件」に化ける（CLAUDE.md）。 */
  if (error) {
    console.error("[GET /api/biz/saved-searches]", error.message);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }

  const searches: SavedSearch[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    filters: parseSavedFilters(r.filters),
    updatedAt: r.updated_at as string,
  }));
  return NextResponse.json({ searches });
}

/**
 * 保存する。
 *
 * ⚠️★**同じ名前で保存したら上書き**（UNIQUE `(company_id, owner_user_id, name)`）。
 *    別の行を作ると、同じ名前が並んでどちらが新しいか分からなくなる。
 */
export async function POST(req: NextRequest) {
  const g = await requireCandidateSearch();
  if (g.error) return g.error;
  const { ctx } = g;

  const body = (await req.json().catch(() => null)) as { name?: unknown; filters?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  if (name.length > MAX_SAVED_SEARCH_NAME) {
    return NextResponse.json({ error: `名前は${MAX_SAVED_SEARCH_NAME}文字以内にしてください` }, { status: 400 });
  }

  /* ⚠️ 知らないキーはここで落ちる（`parseSavedFilters`）。
        画面から送られたものをそのまま DB に入れない。 */
  const filters = parseSavedFilters(body?.filters);
  if (isEmptyFilters(filters)) {
    return NextResponse.json({ error: "絞り込んでから保存してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  /* ★上限は行を数えて確かめる。⚠️ DB に CHECK は無い（件数の制約は行をまたぐため）。
        ⚠️ 既存の名前への上書きは増えないので、**新規のときだけ**数える。 */
  const { data: existing, error: cntErr } = await admin
    .from("ow_saved_candidate_searches")
    .select("id, name")
    .eq("owner_user_id", ctx.currentOwnId)
    .eq("company_id", ctx.tenantId);
  if (cntErr) {
    console.error("[POST /api/biz/saved-searches] count:", cntErr.message);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  const isOverwrite = (existing ?? []).some((r) => r.name === name);
  if (!isOverwrite && (existing ?? []).length >= MAX_SAVED_SEARCHES) {
    return NextResponse.json(
      { error: `保存できるのは${MAX_SAVED_SEARCHES}件までです。使わないものを削除してください` },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("ow_saved_candidate_searches")
    .upsert(
      {
        owner_user_id: ctx.currentOwnId,
        company_id: ctx.tenantId,
        name,
        filters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,owner_user_id,name" },
    )
    .select("id, name, filters, updated_at")
    .single();

  if (error || !data) {
    console.error("[POST /api/biz/saved-searches]", error?.message);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }

  const saved: SavedSearch = {
    id: data.id as string,
    name: data.name as string,
    filters: parseSavedFilters(data.filters),
    updatedAt: data.updated_at as string,
  };
  return NextResponse.json({ saved, overwritten: isOverwrite });
}
