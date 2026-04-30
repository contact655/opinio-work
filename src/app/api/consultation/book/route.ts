import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mentorId, message, preferredDate } = await req.json();

    if (!mentorId) {
      return NextResponse.json({ error: "mentorId is required" }, { status: 400 });
    }

    // メンター情報を取得
    const { data: mentor, error: mentorError } = await supabase
      .from("ow_mentors")
      .select("id, name, email")
      .eq("id", mentorId)
      .single();

    if (mentorError || !mentor) {
      console.error("[consultation/book] mentor not found:", mentorError?.message);
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }

    // ユーザープロフィールを取得
    const { data: userProfile } = await supabase
      .from("ow_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const userName = userProfile?.display_name || user.email?.split("@")[0] || "ユーザー";
    const userEmail = user.email || "";

    // consultationsテーブルに保存
    const { error: insertError } = await supabase.from("consultations").insert({
      mentor_id: mentorId,
      user_id: user.id,
      message: message || "",
      preferred_date: preferredDate || "",
      status: "pending",
    });

    if (insertError) {
      console.error("[consultation/book] insert error:", insertError.message);
      // テーブルが存在しない場合でもメール送信は続行
    }

    // Resendでメール送信
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[consultation/book] RESEND_API_KEY not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_fromEmail || "onboarding@resend.dev";
    const adminEmail = process.env.adminEmail || "hshiba@opinio.co.jp";

    // ① メンター（＝admin）へ通知メール
    const mentorEmail = mentor.email || adminEmail;
    await resend.emails.send({
      from: `opinio.jp <${fromEmail}>`,
      to: mentorEmail,
      subject: `【相談予約】${userName}さんから相談リクエストが届きました`,
      html: `
        <h2>${mentor.name} さん</h2>
        <p>${userName}さんから相談リクエストが届きました。</p>
        <hr/>
        <p><strong>希望日程：</strong>${preferredDate || "未指定"}</p>
        <p><strong>メッセージ：</strong></p>
        <p>${message || "（メッセージなし）"}</p>
        <hr/>
        <p>メッセージページからやり取りを開始してください。</p>
        <a href="https://opinio.jp/mypage">メッセージを確認する →</a>
        <br/><br/>
        <p style="color:#999;font-size:12px;">opinio.jp — Truth to Careers</p>
      `,
    });

    // ② ユーザーへ確認メール
    if (userEmail) {
      await resend.emails.send({
        from: `opinio.jp <${fromEmail}>`,
        to: userEmail,
        subject: `【予約完了】${mentor.name}さんへの相談リクエストを送りました`,
        html: `
          <h2>${userName}さん、相談リクエストを送りました。</h2>
          <p>${mentor.name}さんからメッセージが届いたらお知らせします。</p>
          <p>しばらくお待ちください。</p>
          <hr/>
          <a href="https://opinio.jp/mypage">メッセージを確認する →</a>
          <br/><br/>
          <p style="color:#999;font-size:12px;">opinio.jp — Truth to Careers</p>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[consultation/book] Error:", msg);
    return NextResponse.json(
      { error: "Failed to process consultation booking" },
      { status: 500 }
    );
  }
}
