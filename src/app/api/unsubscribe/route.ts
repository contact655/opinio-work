import { NextRequest, NextResponse } from "next/server";
import { applyUnsubscribe, verifyUnsubscribeToken } from "@/lib/notify/unsubscribe";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/unsubscribe?t=<トークン> — メールのお知らせを止める（ログイン不要。2026-10-20）
 *
 * 呼ばれ方は2つ:
 *   ① /unsubscribe のページの「止める」ボタン（form の POST）→ 303 でページに戻す（done=1）
 *   ② メールソフトの「配信停止」（RFC 8058。本文 `List-Unsubscribe=One-Click`）→ 200 を返すだけ
 * ⚠️★GET は受けない。メールの安全確認ツールがリンクを開いただけで止まらないようにするため。
 * ⚠️ 判定と書き込みは lib/notify/unsubscribe.ts の1か所。
 */
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 30, windowSec: 3600, prefix: "unsubscribe" });
  if (!allowed) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  const t = req.nextUrl.searchParams.get("t");
  const v = verifyUnsubscribeToken(t);
  const form = await req.formData().catch(() => null);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";

  if (!v) {
    if (oneClick) return new NextResponse("invalid", { status: 400 });
    return NextResponse.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(t ?? "")}`, req.url), 303);
  }
  const ok = await applyUnsubscribe(v.authUserId, v.setting);
  if (oneClick) return new NextResponse(ok ? "ok" : "error", { status: ok ? 200 : 500 });
  const url = new URL("/unsubscribe", req.url);
  url.searchParams.set("t", t as string);
  url.searchParams.set(ok ? "done" : "error", "1");
  return NextResponse.redirect(url, 303);
}
