import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ScoutList, type ScoutRow } from "./ScoutList";
import { isScoutSendingEnabled } from "@/lib/business/scoutGate";
import { isScoutEmailUndelivered } from "@/lib/constants/scoutEmail";

export const dynamic = "force-dynamic";
/* ★名前はサイドバーの「スカウト履歴」に揃えた（2026-09-21。それまで「スカウト管理」） */
export const metadata = { title: { absolute: "スカウト履歴 | OPINIO Business" } };

/* ★絞り込みのタブ（2026-09-21）。それまでは丸いタブの見た目の div で、押せなかった。
      URL（?status=）で切り替え、サーバーで絞る。⚠️ 知らない値は「すべて」に落とす */
const FILTER_TABS = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "返答待ち" },
  { key: "interested", label: "興味あり" },
  { key: "declined", label: "辞退" },
] as const;
type FilterKey = (typeof FILTER_TABS)[number]["key"];
function matchesFilter(status: string, f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "pending") return status === "sent" || status === "read";
  return status === f;
}

export default async function BizScoutsPage({
  searchParams,
}: { searchParams?: { status?: string } }) {
  const filter: FilterKey = (FILTER_TABS.some((t) => t.key === searchParams?.status)
    ? searchParams?.status
    : "all") as FilterKey;
  /* ★スカウト送信が止まっているかを見る（2026-09-01）。
        ⚠️ `/biz/candidates` と `POST /api/biz/scouts` と**同じ判定**にすること。
           片方だけ変えると「押せるのに 503」か「押せないのに送れる」になる。
        ⚠️ ここでは env だけを見る。人材紹介の同意（`placementAgreed`）は
           **送信の可否**の条件で、この画面が言いたい「機能自体がまだ開いていない」
           とは別の話。混ぜると「同意すれば送れる」と読めてしまう。 */
  const scoutSendingEnabled = isScoutSendingEnabled();
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();

  const { data: scouts, error: scoutsErr } = await admin
    .from("ow_scouts")
    .select("id, status, sent_at, replied_at, conversation_id, message, candidate_id, email_status, ow_jobs(id, title)")
    .eq("company_id", ctx.tenantId)
    .order("sent_at", { ascending: false });

  /* ★読み込みの失敗を「0件」「まだ使えません」に化けさせない（2026-09-22） */
  if (scoutsErr) console.error("[biz/scouts] ow_scouts:", scoutsErr.message);

  // Resolve candidate ow_users info via auth_id
  /* ⚠️ `ow_scouts.candidate_id` は auth 空間（auth.users.id）。ow_users へは auth_id で引く */
  const authIds = Array.from(new Set((scouts ?? []).map((s: any) => s.candidate_id).filter(Boolean)));
  const { data: users, error: usersErr } = authIds.length > 0
    ? await admin.from("ow_users").select("id, auth_id, name, avatar_color, is_test").in("auth_id", authIds)
    : { data: [], error: null };
  if (usersErr) console.error("[biz/scouts] ow_users:", usersErr.message);

  const userMap = new Map((users ?? []).map((u: any) => [u.auth_id, u]));
  /* ★検証用アカウント宛てのスカウトは一覧から外す（2026-09-22）。それまでは名前だけ引かずに
        「候補者」「?」の行として残っていた。
     ⚠️ 引けない人（退会など）は外さない。「表示できない候補者」として残す（送った事実は消さない） */
  const testAuthIds = new Set((users ?? []).filter((u: any) => u.is_test === true).map((u: any) => u.auth_id));

  const rows: ScoutRow[] = (scouts ?? []).filter((s: any) => !testAuthIds.has(s.candidate_id)).map((s: any) => ({
    id: s.id as string,
    status: s.status as string,
    sentAt: s.sent_at as string,
    repliedAt: s.replied_at as string | null,
    conversationId: s.conversation_id as string | null,
    message: s.message as string,
    jobTitle: (s.ow_jobs as any)?.title as string | null,
    jobId: (s.ow_jobs as any)?.id as string | null,
    candidate: (userMap.get(s.candidate_id) ?? null) as { id: string; name: string; avatar_color: string | null } | null,
    /* ★通知メールが届かなかったか（2026-09-10）。
       ⚠️★**`skipped` を含めないこと。** あれは「本人がメール通知を切っている」という
          **本人の設定**で、企業に知らせるものではない（出すと、本人が企業に開示していない
          設定が企業側に伝わる）。しかもアプリ内通知は届いているので未達ですらない。
       ⚠️ 判定は `isScoutEmailUndelivered()` の1本。ここで値を並べ直さないこと。 */
    emailUndelivered: isScoutEmailUndelivered(s.email_status as string | null),
  }));

  /* ★「返信率」は 2026-09-21 に外した。「興味あり」だけを返信と数えていて（辞退も返信なのに）、
        名前と式が合っていなかった。件数はタブに出ている */
  const countOf = (f: FilterKey) => rows.filter((r) => matchesFilter(r.status, f)).length;
  const visibleRows = rows.filter((r) => matchesFilter(r.status, filter));

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <div style={{ maxWidth: 860 }}>
        {/* 見出し（2026-09-21） */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>スカウト履歴</h1>
          {/* ★送信が有効なときだけ出す（2026-09-21）。止めている間は行き先の候補者検索も
                 閉じており（有料プラン）、押すと行き止まりだった。0件の案内と同じ扱い */}
          {scoutSendingEnabled && (
            <Link href="/biz/candidates" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              候補者を探す
            </Link>
          )}
        </div>

        {rows.length > 0 && (
          <div role="tablist" aria-label="スカウトの絞り込み" style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
            {FILTER_TABS.map((t) => {
              const active = filter === t.key;
              return (
                <Link key={t.key} role="tab" aria-selected={active} data-state={active ? "active" : "inactive"}
                  href={t.key === "all" ? "/biz/scouts" : `/biz/scouts?status=${t.key}`} scroll={false}
                  style={{ padding: "9px 14px", marginBottom: -1, borderBottom: `2px solid ${active ? "var(--royal)" : "transparent"}`, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "var(--royal)" : "var(--ink-mute)", textDecoration: "none" }}>
                  {t.label} {countOf(t.key)}
                </Link>
              );
            })}
          </div>
        )}

        {/* Table */}
        {scoutsErr ? (
          <p role="alert" style={{ fontSize: 14, lineHeight: 1.9, color: "var(--error-ink)" }}>
            スカウトの読み込みに失敗しました。<strong>「0件」という意味ではありません。</strong>時間をおいて再読み込みしてください。
          </p>
        ) : rows.length === 0 ? (
          <div style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
            padding: "48px 32px", textAlign: "center",
          }}>
            {/* ★★「起こせなかった0」を「まだ起きていない0」として見せない（2026-09-01）。
                   ⚠️ 直す前は、送信が止まっている状態でも常に
                      「まだスカウトを送信していません」＋「候補者を探す →」と出していた。
                      **送れるのに送っていない、と読める。** さらにその CTA の行き先
                      （`/biz/candidates`）は有料プランで閉じており、
                      押すと「有料プランの機能です」に着く**行き止まり**だった。
                   ⚠️ CLAUDE.md「0件を読むときは、起きなかった0か起こせなかった0かを分ける」。
                      画面に出す0も同じ。**区別が付く文言にする。** */}
            {scoutSendingEnabled ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  まだスカウトを送信していません
                </p>
                <Link href="/biz/candidates" style={{
                  display: "inline-block", marginTop: 12,
                  background: "var(--royal)", color: "#fff",
                  padding: "10px 24px", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>
                  候補者を探す →
                </Link>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                  スカウトはまだご利用いただけません
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8, margin: 0 }}>
                  現在は登録者を増やしている段階のため、スカウトの送信を止めています。<br />
                  送れるようになりましたら、こちらからご案内します。
                </p>
                {/* ⚠️ CTA は出さない。行き先（候補者検索）も閉じているので、
                       押させると必ず行き止まりになる。 */}
              </>
            )}
          </div>
        ) : (
          <ScoutList rows={visibleRows} />
        )}
      </div>
    </BusinessLayout>
  );
}
