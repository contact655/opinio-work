import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canSendScout, SCOUT_PLAN_BLOCKED_MESSAGE } from "@/lib/business/scoutGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasResendKey, sendEmailStrict } from "@/lib/notify/email";
import { scoutTemplate } from "@/lib/notify/templates";
import {
  isScoutEmailUndelivered,
  type ScoutEmailStatus,
} from "@/lib/constants/scoutEmail";

export const dynamic = "force-dynamic";

// GET: list scouts sent by this company
export async function GET(_req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: scouts, error } = await admin
    .from("ow_scouts")
    .select("id, status, sent_at, replied_at, conversation_id, message, candidate_id, ow_jobs(id, title)")
    .eq("company_id", ctx.tenantId)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[GET /api/biz/scouts]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  if (!scouts?.length) return NextResponse.json({ scouts: [] });

  // Resolve candidate ow_users info via auth_id
  const authIds = Array.from(new Set(scouts.map((s) => s.candidate_id).filter(Boolean)));
  const { data: users } = await admin
    .from("ow_users")
    .select("id, auth_id, name, avatar_color")
    .in("auth_id", authIds)
    .eq("is_test", false);

  const userMap = new Map((users ?? []).map((u) => [u.auth_id, u]));
  const result = scouts.map((s) => ({
    ...s,
    candidate: userMap.get(s.candidate_id) ?? null,
  }));

  return NextResponse.json({ scouts: result });
}

// POST: send a scout to a candidate
export async function POST(req: NextRequest) {
  /* ⚠️ **スカウト送信はまだ止めてある。** 再開は SCOUT_SENDING_ENABLED=true を
        環境変数に入れるだけ。

     ── 止めた理由は解消済み（2026-08-10）──────────────────────────────
     2026-08-09 に止めたのは「送れるが受け取る手段が1つも無い」ためだった。
     受信側を作ったので、その理由は無くなっている。

       求職者側の閲覧UI … `/mypage/scouts`
       アプリ内通知     … `ow_notifications` の type='scout'（下で INSERT）
       メール通知       … `sendScoutEmail`（配信停止を尊重する）
       返答             … 既存の `/api/jobseeker/scouts/[id]/reply`

     ── それでもまだ開けていない理由 ───────────────────────────────────
     ⚠️★**利用規約 第8条の改定（効力発生日 2026-09-27）より前に開けないこと。**
        現行の第1項は「初期設定において**受け取る**」と書いており、製品の挙動
        （**答えるまで届かない**）と逆。フラグを開けると、規約より先に
        新しい挙動が動き出す。改定の周知は 2026-08-28 開始（第24条2項の30日前）。
        → 手順は docs/todo.md「2026-09-27 にやること」。

     ⚠️★**「転職について」に答えていない人には送れない**（2026-08-27 / フェーズ3）。
        `can_send_scout` が `career_stance` を見る（**未設定は false 扱い**）。
        止めるのは `no_contact`（今はいない）と未設定の2つだけ。
        ⚠️ DB 関数の付け替えは **2026-08-28 に適用済み**
           （`20260828010000_scout_gate_career_stance.sql`）。それまでは
           アプリ側だけが移行しており、2層が AND で重なって
           **候補者一覧が実ユーザー0人**になっていた。
        ⚠️ 実測（2026-08-28 / 適用後）: 企業に見える実ユーザーは **0人 → 2人**。
           どちらも本人が `active`（積極的に検討中）を選んだ人。
        ⚠️ 未設定を無くす導線（オンボーディングの必須設問・ログイン時の1問）が
           効き始めるまで、母集合は小さいままになる。開ける前に件数を数えること。

     ⚠️ フラグを立てると `/biz/candidates` のボタンも同時に開く。片方だけ変えない。 */
  if (process.env.SCOUT_SENDING_ENABLED !== "true") {
    return NextResponse.json(
      { error: "スカウト機能は現在準備中です。受信側の画面を用意してから再開します。" },
      { status: 503 }
    );
  }

  /* ★★メールの送信設定が入っていないまま本番でフラグが開く事故を、ここで止める（2026-09-10）。
     ⚠️★**起動時に落とさない。** メールと無関係なページまで巻き込んで本番が丸ごと止まる。
        **送る前に、この操作だけを断る。**
     ⚠️★`RESEND_API_KEY` が無いと `sendEmail` は mock で**正常終了**する。
        送ってから気づくのではなく、**送る前に止める**のが違い。
     ⚠️ dev では止めない（`mocked` として記録され、それが正しい状態）。
     ⚠️ 認証より前に見る。上の 503 と同じで、企業ごとの話ではなく設定の話。 */
  if (process.env.NODE_ENV === "production" && !hasResendKey()) {
    console.error("[POST /api/biz/scouts] RESEND_API_KEY が無い。送信を断った");
    return NextResponse.json(
      { error: "メール送信の設定が未完了のため、スカウトを送信できません。" },
      { status: 503 }
    );
  }

  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /* ⚠️ **スカウトはプランで判定しない**（2026-08-23）。
        送信は上の `SCOUT_SENDING_ENABLED` だけで止めている。
        有料プランの機能表にも載せていない（売れないものを書かない）。
        再開してプランに含めるなら、`lib/constants/plans.ts` の
        `PLAN_FEATURES` に `scoutSend` を戻したうえでここにも判定を足すこと。 */

  /* ⚠️★**人材紹介利用規約の同意ゲートは外した**（2026-09-05）。**戻さないこと。**

        スカウトは**掲載側（月額プラン）の機能**で、OPINIO は職安法4条6項の
        募集情報等提供に該当するサービス（掲載利用規約 第6条1項）。
        あっせんを行わないので、成功報酬の規約に同意させる理由が無い。

        ⚠️ 外す前は `hasAgreedTerms(user, "placement")` を要求していた。
           人材紹介利用規約 第8条は「理論年収 × 15%（最低50万円）」を定めており、
           **月額プランの機能を使うために成功報酬の規約へ同意させる**形になっていた。
           `SCOUT_SENDING_ENABLED` が未設定で眠っていたため実害は0件だったが、
           **スカウトを開けた日に全社が踏む**状態だった。

        ⚠️ 会社（株式会社Opinio）は人材紹介事業も行っているが、**OPINIO という
           プロダクトはその対象外**。切り分けは掲載利用規約 第6条2項・3項が持つ。
           ここに紹介側の判定を混ぜないこと。 */

  if (!ctx.isPublished) {
    return NextResponse.json(
      { error: "運営審査が完了するまでスカウトを送信できません" },
      { status: 403 }
    );
  }

  /* ★★プランのゲート（2026-09-10 に追加）。
     ⚠️★**これが無いあいだ、`free` の企業から送信が通っていた。**
        ゲートは `/biz/candidates:78` の画面にしか無く、`candidate_id` を知っていれば
        画面を通らずに送れた（dev で実証: 送信元プラン `free` で 200）。
     ⚠️★**判定は `canSendScout()` の1本。** ここに `canUse(...)` を直接書かないこと。
        画面（`/biz/candidates`）も同じ関数を呼ぶ。経路ごとに条件を書き写すと必ずずれる
        （2026-08-25 の掲載規約ゲートと同じ形。**3度目**）。
     ⚠️ 上の `SCOUT_SENDING_ENABLED`（503）とは**別の軸**。
        あちらは機能ごと止めているか、こちらはその企業に開いているか。**両方が要る。** */
  if (!canSendScout(ctx.planType)) {
    return NextResponse.json(
      { error: SCOUT_PLAN_BLOCKED_MESSAGE },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { candidate_id, message, job_id } = body as {
    candidate_id?: string;
    message?: string;
    job_id?: string | null;
  };

  if (!candidate_id || typeof candidate_id !== "string") {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  // candidate_id は ow_users.id。ow_scouts は auth.users.id を参照する場合もあるため
  // ow_users.auth_id を取得して candidate を特定
  const { data: candidateUser } = await admin
    .from("ow_users")
    .select("id, auth_id")
    .eq("id", candidate_id)
    .maybeSingle();

  if (!candidateUser) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  // ow_scouts INSERT — trigger が自動でバリデーション + 枠消費
  /* ⚠️ 挿入した行の id が要るので `.select("id").single()` を付ける。
        ⚠️ 列を絞ること。引数なしの `.select()` は全列を返し、
           返却列にも SELECT 権限が要るため権限剥奪列があると 403 になる
           （CLAUDE.md「列単位 GRANT を剥がすときのチェックリスト」）。 */
  const { data: inserted, error } = await admin
    .from("ow_scouts")
    .insert({
      company_id: ctx.tenantId,
      candidate_id: candidateUser.auth_id ?? candidate_id,
      job_id: job_id ?? null,
      message: message.trim(),
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // トリガーからのエラーコードで判定
    const code = (error as any).code as string ?? "";
    const msg = (error as any).message as string ?? "";
    if (code === "P0001" || msg.includes("P0001") || msg.includes("スカウトを送信できません")) {
      return NextResponse.json({ error_code: "P0001", error: "この候補者にはスカウトを送信できません" }, { status: 422 });
    }
    if (code === "P0002" || msg.includes("P0002") || msg.includes("送信枠")) {
      return NextResponse.json({ error_code: "P0002", error: "今月のスカウト送信枠を使い切りました。追加をご希望の場合はお問い合わせください" }, { status: 422 });
    }
    console.error("[POST /api/biz/scouts]", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  /* 受信者に届いたことを知らせる。**これが無いと送っても気づかれない。**
     ⚠️ `recipient_user_id` は **ow_users 空間**。`ow_scouts.candidate_id` は
        auth 空間なので、そちらを渡さないこと（CLAUDE.md「user_id は2つの空間がある」）。
        ここでは API が受け取った `candidate_id`（= ow_users.id）をそのまま使う。
     ⚠️ 通知の失敗でスカウト送信自体を失敗させない（best-effort）。
        ただし握りつぶさずログは必ず出す。届かなかったことに気づけなくなるため。 */
  let emailStatus: ScoutEmailStatus = "pending";

  if (inserted?.id) {
    const { error: notifErr } = await admin.from("ow_notifications").insert({
      recipient_user_id: candidate_id,
      actor_company_id: ctx.tenantId,
      type: "scout",
      scout_id: inserted.id,
    });
    if (notifErr) {
      console.error("[POST /api/biz/scouts] 通知の作成に失敗（スカウトは送信済み）", notifErr.message);
    }

    /* メールでも知らせる。⚠️ アプリ内通知だけだと、来訪しない限り気づけない。
       ⚠️ 配信停止（`email_scout_enabled`）を必ず見る。**ここを外さないこと。**
          止められないメールを送ると、週次メールを止めた理由②に逆戻りする。
       ⚠️ `ow_profiles.user_id` は auth 空間なので `candidateUser.auth_id` で引く。 */
    emailStatus = await sendScoutEmail(admin, {
      scoutId: inserted.id,
      candidateAuthId: candidateUser.auth_id,
      candidateOwUserId: candidate_id,
      companyName: ctx.tenantName,
    });
  }

  /* ⚠️★**メールが落ちても 500 を返さない。** スカウトの行は既に入っていて、
     アプリ内通知も届いているので、**送信自体は成功している**（2026-09-10 の判断）。
     500 にすると企業は再送を試み、候補者に二重に届く。
     扱いは「送信の失敗」ではなく「**通知手段のひとつが欠けた**」。
     ⚠️ `skipped` は本人がメール通知を切っているだけなので `emailDelivered` は true 側に置く
        ——企業に「届かなかった」と伝えるものではない（本人の設定を企業に渡さない）。 */
  return NextResponse.json({
    ok: true,
    emailDelivered: !isScoutEmailUndelivered(emailStatus),
  });
}

/**
 * スカウトが届いたことをメールで知らせ、**結果を `ow_scouts` に記録する**。
 *
 * ⚠️ **配信停止の判定をこの関数の中に置いてある。** 呼び出し側で判定すると、
 *    経路が増えたときに片方だけ忘れる（週次メール2本で実際に起きた）。
 *
 * ── ★なぜ記録するようになったか（2026-09-10）─────────────────────────────
 * それまで `notify()` を呼ぶだけで、**送れたかどうかがどこにも残っていなかった。**
 * `notify()` が例外を飲み、`sendEmail()` は Resend の error を console に出すだけ、
 * さらにこの関数の catch が受ける——**3重に握り潰していた。**
 * 企業には常に `{ok:true}` が返るので、**届いていなくても「送信しました」と出る。**
 * 本番で `RESEND_API_KEY` が外れていれば mock で正常終了し、誰も気づけない。
 *
 * ⚠️★**`notify()` / `sendEmail()` に戻さないこと。** どちらも成否を返さない。
 *    ここは `sendEmailStrict()` を使う。
 *
 * ⚠️ 記録は best-effort（記録に失敗してもスカウト送信は成功扱い）。ただしログは必ず出す。
 */
async function sendScoutEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  args: {
    scoutId: string;
    candidateAuthId: string | null;
    candidateOwUserId: string;
    companyName: string;
  },
): Promise<ScoutEmailStatus> {
  /** 結果を1箇所で書く。⚠️ 分岐ごとに update を書き写さないこと（必ずどれかを書き忘れる）。 */
  const record = async (
    status: ScoutEmailStatus,
    extra?: { error?: string; providerId?: string },
  ): Promise<ScoutEmailStatus> => {
    const { error } = await admin
      .from("ow_scouts")
      .update({
        email_status: status,
        email_sent_at: status === "sent" ? new Date().toISOString() : null,
        email_error: extra?.error ?? null,
        email_provider_id: extra?.providerId ?? null,
      })
      .eq("id", args.scoutId);
    if (error) {
      console.error("[POST /api/biz/scouts] 送信結果の記録に失敗", error.message);
    }
    return status;
  };

  try {
    /* ⚠️ 宛先が無い経路は `skipped` ではなく `failed`。**本人の設定ではない**ので、
       運営の「要対応」に出て直せるほうがよい（スカウトを受け取れる人に
       メールアドレスが無いのはデータ側の問題）。 */
    if (!args.candidateAuthId) {
      return await record("failed", { error: "candidate に auth_id が無い" });
    }

    // ⚠️ ow_profiles.user_id は auth 空間
    const { data: prof } = await admin
      .from("ow_profiles")
      .select("email_scout_enabled")
      .eq("user_id", args.candidateAuthId)
      .maybeSingle();

    /* ⚠️ 明示的に true のときだけ送る（読めなかったときに送る向きにしない）。
       ⚠️★これは**本人の設定**なので `skipped`＝正常。**企業には知らせない。** */
    if (prof?.email_scout_enabled !== true) return await record("skipped");

    const { data: owUser } = await admin
      .from("ow_users")
      .select("email, name")
      .eq("id", args.candidateOwUserId)
      .maybeSingle();
    if (!owUser?.email) {
      return await record("failed", { error: "ow_users.email が空" });
    }

    /* ⚠️★**本文は `templates.ts` の `scoutTemplate()` に置いてある。ここに書き戻さないこと。**
       2026-09-10 まで HTML をこのファイルに直書きしており、共通レイアウト（`htmlWrap`）を
       通っていなかった——**利用者に届くメールでスカウトだけがロゴも共通フッターも無い**別物だった。 */
    const result = await sendEmailStrict(scoutTemplate({
      to: owUser.email,
      userName: owUser.name ?? null,
      companyName: args.companyName,
    }));

    if (!result.ok) return await record("failed", { error: result.error });

    /* ⚠️★`mocked` は **RESEND_API_KEY が無い**という意味で、**送っていない。**
       本番でこれが出たら設定事故なので、`sent` と一緒にしないこと。 */
    if (result.mocked) return await record("mocked");

    return await record("sent", { providerId: result.providerId });
  } catch (err) {
    console.error("[POST /api/biz/scouts] スカウトメールの送信に失敗（スカウトは送信済み）", err);
    return await record("failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
