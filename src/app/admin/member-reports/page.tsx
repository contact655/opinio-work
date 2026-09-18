import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberReportReasonLabel } from "@/lib/constants/memberReports";
import { ReportsClient, type MemberReportRow } from "./ReportsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "在籍していない人の報告 | OPINIO 運営" },
};

/**
 * 企業からの「この人は在籍していない」報告の一覧（2026-09-18 / B7）。
 *
 * ⚠️★**企業は自分で外せない。** 外すのはこの画面だけ
 *    （`ow_company_hidden_experiences` は運営専用）。
 * ⚠️ 未対応を上に、古い順で並べる。**「放置されている報告」が上に来る形**にする
 *    （`/admin/ambassador-requests` の未確認と同じ考え方）。
 * ⚠️★`is_test` を隠さない。ラベルを付けて**区別だけ示す**
 *    （運営向けの一覧なので `/admin/ambassador-requests` と同じ方針。
 *     `/admin/companies` の「要対応」が `is_test` を除くのとは目的が違う）。
 */
export default async function MemberReportsPage() {
  const admin = createAdminClient();

  /* ⚠️ 複合の埋め込みにしない。`ow_experiences` → `ow_users` / `ow_roles` は
        B6 で埋め込みが曖昧になる形を踏んでいるので、素直に2段で引く。 */
  const { data: reports, error } = await admin
    .from("ow_company_member_reports")
    .select("id, company_id, experience_id, reason, note, reported_at, resolved_at, ow_companies(name, slug, is_test)")
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("reported_at", { ascending: true });

  /* ⚠️★握り潰さない。0件と「取得に失敗した」を画面で区別する
        （`/admin/companies` の「判定に失敗しました」と同じ形）。 */
  if (error) console.error("[admin/member-reports]", error.message);

  const experienceIds = Array.from(new Set((reports ?? []).map((r) => r.experience_id as string)));

  const expMap = new Map<string, { userId: string; roleTitle: string | null; isCurrent: boolean; startedAt: string; endedAt: string | null }>();
  const userMap = new Map<string, { name: string | null; isTest: boolean }>();
  const hiddenIds = new Set<string>();

  if (experienceIds.length > 0) {
    const [expRes, hiddenRes] = await Promise.all([
      admin
        .from("ow_experiences")
        .select("id, user_id, role_title, is_current, started_at, ended_at")
        .in("id", experienceIds),
      admin
        .from("ow_company_hidden_experiences")
        .select("experience_id")
        .in("experience_id", experienceIds),
    ]);
    if (expRes.error) console.error("[admin/member-reports] experiences:", expRes.error.message);
    if (hiddenRes.error) console.error("[admin/member-reports] hidden:", hiddenRes.error.message);

    for (const e of (expRes.data ?? [])) {
      expMap.set(e.id as string, {
        userId: e.user_id as string,
        roleTitle: (e.role_title as string | null) ?? null,
        isCurrent: e.is_current as boolean,
        startedAt: e.started_at as string,
        endedAt: (e.ended_at as string | null) ?? null,
      });
    }
    for (const h of (hiddenRes.data ?? [])) hiddenIds.add(h.experience_id as string);

    /* ⚠️ `[...map.values()]` はこの tsconfig の target では `--downlevelIteration` が要る。
          設定は触らない（`talkable.ts` にも同じ注記がある）。`Array.from` で受ける。 */
    const userIds = Array.from(new Set(Array.from(expMap.values(), (e) => e.userId)));
    if (userIds.length > 0) {
      const { data: users, error: userErr } = await admin
        .from("ow_users")
        .select("id, name, is_test")
        .in("id", userIds);
      if (userErr) console.error("[admin/member-reports] users:", userErr.message);
      for (const u of (users ?? [])) {
        userMap.set(u.id as string, { name: (u.name as string | null) ?? null, isTest: u.is_test === true });
      }
    }
  }

  const rows: MemberReportRow[] = (reports ?? []).map((r) => {
    const exp = expMap.get(r.experience_id as string);
    const user = exp ? userMap.get(exp.userId) : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const co = (r as any).ow_companies as { name: string | null; slug: string | null; is_test: boolean | null } | null;
    return {
      id: r.id as string,
      companyId: r.company_id as string,
      companyName: co?.name ?? null,
      companySlug: co?.slug ?? null,
      companyIsTest: co?.is_test === true,
      experienceId: r.experience_id as string,
      /* ⚠️ 経歴が消えている場合（本人が削除）は null のまま出す。
            「不明」等で埋めない —— 運営には「対象がもう無い」ことが分かる必要がある。 */
      userId: exp?.userId ?? null,
      userName: user?.name ?? null,
      userIsTest: user?.isTest === true,
      roleTitle: exp?.roleTitle ?? null,
      isCurrent: exp?.isCurrent ?? null,
      startedAt: exp?.startedAt ?? null,
      endedAt: exp?.endedAt ?? null,
      reasonLabel: memberReportReasonLabel(r.reason as string),
      note: (r.note as string | null) ?? null,
      reportedAt: r.reported_at as string,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      hidden: hiddenIds.has(r.experience_id as string),
    };
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 12, color: "var(--ink-mute)", textDecoration: "none" }}>← 運営ダッシュボード</Link>
        <h1 style={{ margin: "8px 0 6px", fontSize: 20, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
          在籍していない人の報告
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          企業が「この人は自社に在籍していない」と報告したものです。
          <strong style={{ color: "var(--ink)" }}>企業側からは外せません。</strong>
          確認のうえ、必要なら企業ページから外してください。本人のプロフィールは変わりません。
        </p>
      </div>

      {error ? (
        <div role="alert" style={{
          padding: "14px 16px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
          fontSize: 13, color: "#B91C1C", lineHeight: 1.7,
        }}>
          報告の取得に失敗しました（<strong>0件という意味ではありません</strong>）。時間をおいて開き直してください。
        </div>
      ) : (
        <ReportsClient rows={rows} />
      )}
    </div>
  );
}
