import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getBizNavBadges } from "@/lib/business/navBadges";

/* ⚠️★外さないこと。Next 14 は GET のルートハンドラを**既定でキャッシュする**
      （CLAUDE.md「Next 14 は GET のルートハンドラを既定でキャッシュする」）。
      外すと未読の数が固定され、読んでも減らない。 */
export const dynamic = "force-dynamic";

/**
 * ★`/biz` サイドバーの未読バッジ（2026-09-21）。
 * `BusinessLayout` がページを移るたびに叩く。数え方は `lib/business/navBadges.ts`。
 *
 * ⚠️ 企業に紐付いていない・未ログインは 401。バッジを出さないだけで、画面は壊さない。
 */
export async function GET() {
  /* ⚠️ `getTenantContext` は複数社で Cookie が無いと redirect を投げる。
        API では握って 401 にする（ページの遷移はページ側に任せる）。 */
  const ctx = await getTenantContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const badges = await getBizNavBadges({ owUserId: ctx.currentOwnId, companyId: ctx.tenantId });
  return NextResponse.json(badges, { headers: { "Cache-Control": "no-store" } });
}
