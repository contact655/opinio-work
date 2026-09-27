export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MypageLayout from "../_components/MypageLayout";
import { ScoutsClient, type ScoutItem } from "./ScoutsClient";
import { isScoutSendingEnabled } from "@/lib/business/scoutGate";

export const metadata: Metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
          `template: "%s | OPINIO"`（app/layout.tsx）が後ろに足すので、
          素の `title` に書くと **「… | OPINIO | OPINIO」** になる。実測で3ページ該当した。 */
  title: { absolute: "届いたスカウト | OPINIO" },
  robots: { index: false, follow: false },
};

/**
 * 届いたスカウトの一覧。
 *
 * ⚠️ `ow_scouts.candidate_id` は **auth 空間**（auth.users.id）。
 *    `ow_users.id` で引くと0件になる（CLAUDE.md「user_id は2つの空間がある」）。
 *
 * ⚠️ 絞り込みは `candidate_id = 自分` の1本だけが根拠。
 *    admin クライアントで RLS をバイパスしているので、この条件を外すと
 *    他人宛のスカウトを配ることになる。
 */
export default async function ScoutsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/scouts");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_scouts")
    .select(
      /* ⚠️★可視性の列を**必ず取る**（2026-09-27）。落とすと `undefined` になり、
            下の `alive` が静かに「生きている」側へ倒れる
            （CLAUDE.md「『本人が保存したもの』の一覧は id で素引きするので可視性が抜ける」）。 */
      "id, message, status, sent_at, replied_at, conversation_id, " +
        "ow_companies!company_id(id, name, slug, logo_letter, logo_gradient, logo_url, is_published, is_test), " +
        "ow_jobs!job_id(id, title, status, is_test)",
    )
    .eq("candidate_id", user.id) // ⚠️ auth 空間
    .order("sent_at", { ascending: false });

  if (error) console.error("[mypage/scouts]", error.message);

  type Row = {
    id: string;
    message: string | null;
    status: string | null;
    sent_at: string | null;
    replied_at: string | null;
    conversation_id: string | null;
    ow_companies:
      | CompanyRow[]
      | CompanyRow
      | null;
    ow_jobs: JobRow[] | JobRow | null;
  };
  type CompanyRow = {
    id: string; name: string; slug: string | null;
    logo_letter: string | null; logo_gradient: string | null; logo_url: string | null;
    is_published: boolean | null; is_test: boolean | null;
  };
  type JobRow = { id: string; title: string; status: string | null; is_test: boolean | null };

  // PostgREST の埋め込みは 1:1 でも配列で返ることがある
  const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  const scouts: ScoutItem[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const c = one(r.ow_companies);
    const j = one(r.ow_jobs);
    return {
      id: r.id,
      message: r.message ?? "",
      status: r.status === "interested" || r.status === "declined" ? r.status : "sent",
      sentAt: r.sent_at,
      conversationId: r.conversation_id,
      company: c
        ? {
            id: c.id,
            name: c.name,
            slug: c.slug,
            logoLetter: c.logo_letter,
            logoGradient: c.logo_gradient,
            logoUrl: c.logo_url,
            /* ★「いま開けるか」。⚠️★**行は落とさない。リンクにしないだけ。**
                  受け取った事実は本人の履歴で、相手が下ろしても消える理由が無い。
               ⚠️ 企業は `is_published`（404 ゲート）で見る。`listing_status` では落とさない。 */
            alive: c.is_published === true && c.is_test !== true,
          }
        : null,
      /* ⚠️ 求人の表示条件は `status='published'` かつ `is_test=false` の2つだけ
            （`ow_jobs` に `is_published` 列は無い）。 */
      job: j ? { id: j.id, title: j.title, alive: j.status === "published" && j.is_test !== true } : null,
    };
  });

  const unanswered = scouts.filter((s) => s.status === "sent").length;

  return (
    <MypageLayout
      activeKey="scouts"
      scoutsBadge={unanswered}
    >
      {/* ⚠️ 判定は `POST /api/biz/scouts` と `/biz/candidates` と**同じ env**にする。
             片方だけ変えると「届かないのに理由が違う」案内になる。
          ⚠️ ここでは env だけを見る。本人の受け取り設定（`scout_enabled`）は
             **別の話**なので混ぜない（混ぜると「設定すれば届く」と読める）。 */}
      <ScoutsClient scouts={scouts} sendingEnabled={isScoutSendingEnabled()} />
    </MypageLayout>
  );
}
