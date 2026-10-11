import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import BizProposalsClient, { type BizProposalView } from "./BizProposalsClient";
import {
  listCompanyProposals, companyProposalStats, startOfMonthJstIso,
} from "@/lib/evidence/companyProposals";
import { getEvidenceMaterials } from "@/lib/evidence/materials";
import { calcTotalExperience } from "@/lib/profile/tenure";

export const dynamic = "force-dynamic";

/* ★タブの題（2026-09-21）。サイドバーの「提案」と同じ名前にする */
export const metadata = {
  title: { absolute: "OPINIOからの紹介 | OPINIO Business" },
};

/**
 * 企業の「提案」（2026-10-11 に「求職者が先に答える」形へ作り替えた）。
 *
 * ★★ここに出るのは、OPINIO が貴社をご紹介し、**求職者が「話を聞いてみたい」と答えた方だけ。**
 *    未回答・見送り・30日経過の方は、名前も件数の内訳も出さない。
 *    ⚠️★提案を読むのは `lib/evidence/companyProposals.ts` だけ。このファイルで `ow_proposals` を引かないこと
 *       （`node scripts/check-proposal-reads.mjs` が見張っている）。
 * ★「今月の提案」は人数だけ。1日1回の集計（今日の0時より前）にしてある（`companyProposalStats`）。
 *
 * ⚠️ いま見せてはいけない方（hidden）は行ごと出さない・数えない（`companyTabOf`）。会話ができた方は会話があるので出す。
 * ⚠️ 年齢・年代は出さない（`/biz` に年齢を渡さないという既存方針）。
 * ⚠️★これはスカウトではない。送れる数の枠（毎月10通）も使わない。
 */
export default async function BizProposalsPage() {
  const ctx = await getTenantContext();
  /* ⚠️ 他の /biz と同じ形にする。`null` を返すと**真っ白な画面**になる */
  if (!ctx) return <BizNoTenantPage />;

  /* ⚠️ 企業側の設定（すぐにメッセージ／確認してから）は 2026-10-11 に廃止した。読まない */
  const [rows, stats, materials] = await Promise.all([
    listCompanyProposals(ctx.tenantId),
    companyProposalStats(ctx.tenantId, startOfMonthJstIso()),
    getEvidenceMaterials(ctx.tenantId),
  ]);

  /* ★プロフィールの要約を引く。⚠️ 見せられない方（hidden）は `listCompanyProposals` が行ごと落としている */
  const db = createAdminClient();
  const nameIds = Array.from(new Set((rows ?? []).map((r) => r.candidateUserId)));
  const [{ data: userRows, error: userErr }, { data: expRows, error: expErr }] = nameIds.length > 0
    ? await Promise.all([
        db.from("ow_users").select("id, name, headline, location").in("id", nameIds),
        /* ⚠️ 職歴を「非表示」にした行は使わない（企業ページの在籍者と同じ扱い） */
        db.from("ow_experiences").select("user_id, started_at, role_category_id, visibility_company").in("user_id", nameIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (userErr) console.error("[biz/proposals] ow_users:", userErr.message);
  if (expErr) console.error("[biz/proposals] ow_experiences:", expErr.message);
  const exps = (expRows ?? []).filter((e) => e.visibility_company !== "hidden");
  const roleIds = Array.from(new Set(exps.map((e) => e.role_category_id as string | null).filter(Boolean) as string[]));
  const { data: roleRows, error: roleErr } = roleIds.length > 0
    ? await db.from("ow_roles").select("id, name").in("id", roleIds)
    : { data: [], error: null };
  if (roleErr) console.error("[biz/proposals] ow_roles:", roleErr.message);
  const roleName = new Map((roleRows ?? []).map((r) => [r.id as string, r.name as string]));
  const expByUser = new Map<string, { started_at: string; role: string | null }[]>();
  for (const e of exps) {
    const list = expByUser.get(e.user_id as string) ?? [];
    list.push({ started_at: e.started_at as string, role: e.role_category_id ? roleName.get(e.role_category_id as string) ?? null : null });
    expByUser.set(e.user_id as string, list);
  }
  /** 職種の変遷（古い順・続けて同じ職種はまとめる・直近3つまで）。⚠️ 取れなければ null（推測で埋めない） */
  const roleTrail = (userId: string): string | null => {
    const list = [...(expByUser.get(userId) ?? [])].sort((a, b) => a.started_at.localeCompare(b.started_at));
    const names: string[] = [];
    for (const x of list) if (x.role && names[names.length - 1] !== x.role) names.push(x.role);
    return names.length ? names.slice(-3).join(" → ") : null;
  };
  const candidates = new Map<string, NonNullable<BizProposalView["candidate"]>>(
    (userRows ?? []).map((u) => {
      const months = expErr ? null : calcTotalExperience((expByUser.get(u.id as string) ?? []).map((x) => x.started_at))?.months ?? null;
      const loc = ((u.location as string | null) ?? "").trim();
      return [u.id as string, {
        id: u.id as string,
        name: ((u.name as string | null) ?? "").trim() || "名前未設定",
        headline: ((u.headline as string | null) ?? "").trim() || null,
        tenureYears: months == null ? null : Math.floor(months / 12),
        roleTrail: roleTrail(u.id as string),
        /* ⚠️ 「非公開」と選んだ人は出さない */
        prefecture: loc && loc !== "非公開" ? loc : null,
      }];
    }),
  );

  const proposals: BizProposalView[] = (rows ?? []).map((r) => ({
    id: r.id,
    tab: r.tab,
    phase: r.phase,
    candidate: candidates.get(r.candidateUserId) ?? null,
    evidence: r.evidence as BizProposalView["evidence"],
    counter: r.counter as BizProposalView["counter"],
    note: r.note,
    jobTitle: r.jobTitle,
    raisedAt: r.raisedAt,
    /* ⚠️ 会話のリンクは会話ができた段だけ */
    conversationId: r.phase === "introduced" ? r.conversationId : null,
  }));

  /* ⚠️★`BusinessLayout` で包む。包まないとナビが出ず、開いた人が戻れない */
  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <BizProposalsClient
        proposals={proposals}
        loadFailed={rows === null}
        materials={materials}
        stats={stats}
      />
    </BusinessLayout>
  );
}
