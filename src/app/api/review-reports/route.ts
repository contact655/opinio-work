import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { review_id, reason, detail, contact_email } = body;

  if (!review_id || !reason) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ow_review_reports").insert({
    review_id,
    reason,
    detail: detail || null,
    contact_email: contact_email || null,
  });

  if (error) {
    console.error("review-reports insert error:", error);
    return NextResponse.json({ error: "通報の送信に失敗しました" }, { status: 500 });
  }

  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@opinio.co.jp",
        to: "contact@opinio.co.jp",
        subject: `[OPINIO] 口コミ通報: ${reason}`,
        text: [
          "口コミ通報が届きました。",
          "",
          `通報理由: ${reason}`,
          `詳細: ${detail ?? "なし"}`,
          `連絡先: ${contact_email ?? "なし"}`,
          `口コミID: ${review_id}`,
          "",
          `管理画面: ${process.env.SITE_URL ?? ""}/admin/reviews`,
        ].join("\n"),
      });
    }
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
