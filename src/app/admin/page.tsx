import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paging";
import { loadRealFunnel, ACTIVE_WINDOW_DAYS } from "@/lib/admin/realFunnel";
import { loadWaitingCompanies } from "@/lib/admin/waitingCompanies";
import { findTestLeftovers, countTestLeftovers } from "@/lib/admin/testLeftovers";
import { TestLeftoversCard } from "@/components/admin/TestLeftoversCard";
import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
/* ⚠️★件数も一覧も同じ関数を通す。条件を書き分けると
      「1件と出ているのに開くと空」が起きる（`fetchSelfListed` と同じ理由）。 */
import { fetchOpenJoinRequests } from "@/lib/business/joinRequests";
import Link from "next/link";

async function getStats() {
  /* ⚠️★セッションクライアント（`createClient`）はこのページから外した（2026-08-29）。
        **運営も `authenticated` ロールで来るので RLS が効き、数え上げが静かに減る。**
        `/admin` の読みは `createAdminClient` に統一する（CLAUDE.md）。
     ⚠️ 認証・権限の判定は `layout.tsx` が済ませている。ここで取り直さない。 */
  const admin = createAdminClient();

  const [
    users, testUsers, activeCompanies, activeJobs, totalApplications,
    pendingJobs, pendingMeetings, bizAdmins,
  ] = await Promise.all([
    /* ⚠️★ここは `supabase`（運営本人のセッション）で数えていた（〜2026-08-29）。
          **運営も `authenticated` ロールで来るので RLS が効く。**
          実測（2026-08-29 / 運営セッション vs service_role）:
            ow_jobs 全件          **7 / 20**  ← 13件見えていない（他社の下書き）
            ow_company_admins     **6 / 13**  ← 7件見えていない
          CLAUDE.md 2026-08-11 の「`/admin/jobs` が20件中7件しか出なかった」と同じ形で、
          **数え上げ側が取り残されていた。**
       ⚠️★とくに「求人審査待ち」「面談申込待ち」は**運営を呼び出すためのアラート**。
          他社の行が RLS で落ちると、**審査すべきものがあるのに 0 件と出て誰も気づけない。**
          いま 0/0 なのは、たまたま該当が0件だから。**運が良いだけ。**
       ⚠️ したがって `/admin` の数え上げは必ず `admin`（service_role）で行う。 */
    /* ⚠️ `is_system` を除く。運営セッションでは RLS が落としていたので**除外が既定だった**。
          `admin` にすると数えてしまい、表示が 38 → 39 に増える（システムユーザーは
          フィード投稿の主体で、登録ユーザーではない）。
       ⚠️ `is_test` は**あえて除いていない**。運営画面はテストデータも見える方が正しい
          （CLAUDE.md「完全に隠さないこと」）。⚠️ ただし実測では 38人中 32人が is_test で、
          **実ユーザーは6人**。この数字を対外的な指標に使わないこと。 */
    admin.from("ow_users").select("id", { count: "exact", head: true }).eq("is_system", false),
    /* ★検証用アカウントの数も取る（2026-09-01）。
          ⚠️ 上のコメントは「実ユーザーは6人。この数字を対外的な指標に使わないこと」と
             **コード側では知っていた**が、**画面には一切出ていなかった。**
             ダッシュボードを見た人には「登録ユーザー 38 / オンボーディング完了率 79%」
             としか見えず、**84% が検証用アカウントであることを知る手段が無かった。**
          ⚠️ 隠すのではなく**内訳を出す**（2026-10-16 に撤去した `/admin/ambassador-requests` が
             `is_test` を隠さず「検証用アカウント」とラベルを付けていたのと同じ方針）
             （CLAUDE.md「完全に隠さないこと」）。 */
    admin.from("ow_users").select("id", { count: "exact", head: true })
      .eq("is_system", false).eq("is_test", true),
    admin.from("ow_companies").select("id", { count: "exact", head: true }).eq("is_published", true),
    admin.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("ow_job_applications").select("id", { count: "exact", head: true }),
    admin.from("ow_jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    admin.from("ow_casual_meetings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // BIZ担当者数。
    // ⚠️ 2026-08-05 から、保留中の招待（user_id が null）はここに数えられない。
    //    招待の作成時に is_active を立てるのをやめ、承諾時に立てるようにしたため。
    //    「招待した人数」ではなく「実際に使える担当者の数」を出したいので、これが正。
    /* ⚠️★ただし 2026-08-05 より前の招待は is_active=true で作られており、1行残っていた。
          `user_id` の NULL も明示的に除く（2026-10-08） */
    admin.from("ow_company_admins").select("id", { count: "exact", head: true }).eq("is_active", true).not("user_id", "is", null),
    /* ⚠️ 「面談対応者（自己申告）の未確認」は 2026-10-16 に撤去した（面談OKの撤去） */
    /* ⚠️ 旧ファネルの3本（オンボーディング完了・希望職種・応募の行数）は 2026-10-17 に外した。
          ファネルは lib/admin/realFunnel.ts が実ユーザーだけ・人数で数える */
  ]);

  // 未ログインBIZ担当者数を算出（auth.admin → ow_users.auth_id でジョイン）
  let neverLoggedInBizCount = 0;
  try {
    const [{ data: adminRows }, { data: owUsers }, authResult] = await Promise.all([
      admin.from("ow_company_admins").select("user_id").eq("is_active", true).not("user_id", "is", null),
      /* ★1,000 行ずつ最後まで（2026-10-19。超えると「未ログインの担当者」の数が黙って少なく出た） */
      fetchAllRows((from, to) => admin.from("ow_users").select("id, auth_id").order("id").range(from, to), "admin ow_users"),
      (async () => {
        // Paginate through all auth users to avoid the 1000-user hard cap
        const allUsers: { id: string; last_sign_in_at?: string | null }[] = [];
        let page = 1;
        while (true) {
          const { data } = await admin.auth.admin.listUsers({ perPage: 1000, page });
          const batch = (data as { users?: { id: string; last_sign_in_at?: string | null }[] } | null)?.users ?? [];
          allUsers.push(...batch);
          if (batch.length < 1000) break;
          page++;
        }
        return { data: { users: allUsers } };
      })(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authUsers = (authResult as any).data?.users ?? [];
    const neverLoggedInAuthIds = new Set<string>(
      authUsers.filter((u: any) => !u.last_sign_in_at).map((u: any) => u.id as string)
    );
    const owUserMap = new Map<string, string | null>((owUsers ?? []).map((u) => [u.id, u.auth_id]));
    const bizUserIds = Array.from(new Set((adminRows ?? []).map((r: any) => r.user_id as string)));
    for (const owUserId of bizUserIds) {
      const authId = owUserMap.get(owUserId);
      if (authId && neverLoggedInAuthIds.has(authId)) neverLoggedInBizCount++;
    }
  } catch {
    // best-effort
  }

  // Recent users
  /* ⚠️ email は authenticated から SELECT 権限を剥がしたので admin で引く（2026-08-06） */
  const { data: recentUsers } = await admin
    .from("ow_users")
    .select("id, name, email, location, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  /* Recent companies
     ⚠️ ここも `admin` で引く（2026-08-29）。企業は運営セッションでも全件見えていたが
        （実測 89/89）、**RLS を締めた日に静かに減る**。`/admin` の読みは admin に揃える。
     ⚠️ `error` を捨てない。捨てると RLS も 400 も「0件」に化け、
        「最近の企業」が空になっただけに見える。 */
  const { data: recentCompanies, error: recentCompaniesErr } = await admin
    .from("ow_companies")
    .select("id, name, industry, is_published, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (recentCompaniesErr) console.error("[admin] ow_companies(recent):", recentCompaniesErr.message);

  /* ★企業への参加依頼（2026-09-04）。
     ⚠️ 失敗を 0 に倒さない。**「0件」と「取得できなかった」を区別して出す。**
        ここを 0 にすると、要対応が消えて誰も見に行かなくなる。 */
  const joinRequests = await fetchOpenJoinRequests(admin);
  const joinRequestsOldestDays = joinRequests && joinRequests.length > 0
    /* ⚠️ 起点は一覧の「◯日前」と同じ `sentAt`。別の起点にすると数字が食い違う */
    ? Math.max(...joinRequests.map((r) => Math.floor((Date.now() - Date.parse(r.sentAt)) / 86_400_000)))
    : null;

  /* ⚠️ 「メールが届かなかったスカウト」は 2026-10-08 にスカウトごと廃止した（提案に一本化）。 */

  /* ★企業からの「在籍していない人」報告（2026-09-18 / B7）。**0件が正常な状態。**
     ⚠️ 未対応（`resolved_at is null`）だけを数える。
     ⚠️ 失敗を 0 に倒さない。取得できなかったときは要対応に1件として出す
        （参加依頼と同じ理由。0 にすると壊れているのに要対応が消える）。 */
  const memberReports = await admin
    .from("ow_company_member_reports")
    .select("id, reported_at", { count: "exact" })
    .is("resolved_at", null)
    .order("reported_at", { ascending: true })
    .limit(1);
  if (memberReports.error) {
    console.error("[admin] 在籍報告の取得に失敗:", memberReports.error.message);
  }
  /* ⚠️ 最も古い未対応の経過日数。0件なら null（0 ではない）。
        件数だけだと「放置されている」ことが読み取れない（面談対応者の未確認と同じ形）。 */
  const memberReportsOldestDays = memberReports.data?.[0]?.reported_at
    ? Math.floor((Date.now() - Date.parse(memberReports.data[0].reported_at as string)) / 86_400_000)
    : null;

  /* ★企業からの掲載依頼（2026-09-29）。**0件が正常な状態。**
     企業が `/biz/company` の「掲載を依頼する」を押すと `listing_requested_at` が入り、
     運営が掲載にすると（`updateListingStatus('listed')`）**同じ UPDATE で消える。**
     掲載しないと決めたときは `/admin/companies` の「対応済みにする」。
     ⚠️ 失敗を 0 に倒さない。取得できなかったときは要対応に1件として出す
        （参加依頼・在籍報告と同じ理由。0 にすると壊れているのに要対応が消える）。
     ⚠️ 検証用（`is_test`）を外さない。押せるのは実在の担当者だけなので積み上がらないし、
        外すと検証で押したものが**どこにも出ず消せなくなる。** */
  const listingRequests = await admin
    .from("ow_companies")
    .select("id, listing_requested_at", { count: "exact" })
    .not("listing_requested_at", "is", null)
    .order("listing_requested_at", { ascending: true })
    .limit(1);
  if (listingRequests.error) {
    console.error("[admin] 掲載依頼の取得に失敗:", listingRequests.error.message);
  }
  /* ⚠️ 最も古い依頼の経過日数。0件なら null（0 ではない）。
        件数だけだと「放置されている」ことが読み取れない（在籍報告と同じ形）。 */
  const listingRequestsOldestDays = listingRequests.data?.[0]?.listing_requested_at
    ? Math.floor((Date.now() - Date.parse(listingRequests.data[0].listing_requested_at as string)) / 86_400_000)
    : null;

  /* ★会話を作るはずなのに作られていない提案（2026-09-21・2026-10-11 に条件を変更）。**0件が正常な状態。**
     `introduceProposal()` は best-effort なので、会話の作成に失敗するとここに残る。
     ⚠️★**両側とも答え終わっているので、もう誰も押さない。** 運営が
        `/admin/proposals` の「再試行」を押さないと**永久に救われない。**
     ⚠️ 述語は `proposalShouldConnect()`（proposalResponses.ts）と同じ:
        求職者が「話を聞いてみたい」かつ 以前に企業が見送ったものでない（2026-10-11 に企業側の設定をなくした）。
     ⚠️ 失敗を 0 に倒さない（参加依頼・在籍報告と同じ理由）。 */
  const stuckIntros = await admin
    .from("ow_proposals")
    .select("id", { count: "exact", head: true })
    .eq("candidate_response", "interested")
    .or("company_response.is.null,company_response.eq.want_to_meet")
    .is("introduced_at", null);
  if (stuckIntros.error) {
    console.error("[admin] 未紹介の提案の取得に失敗:", stuckIntros.error.message);
  }

  /* ★検証用アカウントの取り残しを数える（2026-09-28）。判定は1箇所。 */
  const testLeftovers = await findTestLeftovers(admin);

  return {
    stuckIntrosCount: stuckIntros.error ? 0 : (stuckIntros.count ?? 0),
    stuckIntrosFailed: Boolean(stuckIntros.error),
    memberReportsCount: memberReports.error ? 0 : (memberReports.count ?? 0),
    memberReportsFailed: Boolean(memberReports.error),
    memberReportsOldestDays,
    listingRequestsCount: listingRequests.error ? 0 : (listingRequests.count ?? 0),
    listingRequestsFailed: Boolean(listingRequests.error),
    listingRequestsOldestDays,
    joinRequestsCount: joinRequests?.length ?? 0,
    joinRequestsFailed: joinRequests === null,
    joinRequestsOldestDays,
    usersCount: users.count ?? 0,
    testUsersCount: testUsers.count ?? 0,
    activeCompaniesCount: activeCompanies.count ?? 0,
    activeJobsCount: activeJobs.count ?? 0,
    totalApplicationsCount: totalApplications.count ?? 0,
    /* ★検証用アカウントの取り残し（2026-09-28）。0件が正常。
          ⚠️★条件は `lib/admin/testLeftovers.ts` の1箇所。ここに書き写さない
             （日次 cron が同じ関数を呼ぶ。割れると画面とメールが食い違う）。 */
    testLeftovers,
    pendingJobsCount: pendingJobs.count ?? 0,
    pendingMeetingsCount: pendingMeetings.count ?? 0,


    bizAdminsCount: bizAdmins.count ?? 0,
    neverLoggedInBizCount,
    recentUsers: recentUsers ?? [],
    recentCompanies: recentCompanies ?? [],
  };
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, #7C3AED, #C4B5FD)",
  "linear-gradient(135deg, var(--success), #34D399)",
  "linear-gradient(135deg, #F59E0B, #FCD34D)",
  "linear-gradient(135deg, #DC2626, #FCA5A5)",
];

export default async function AdminDashboard() {
  /* ★★運営権限をページ本体でも確かめる（2026-09-18）。**消さないこと。**
        レイアウトのガードだけでは、ページが実行されて props が RSC フライトデータ
        として HTML に載り、権限の無い人に読まれる。理由と実測値は
        `lib/auth/adminPageGuard.ts` に書いてある。
     ⚠️ DB を引く前に返すこと。 */
  if (!(await viewerIsAdmin())) return null; // 画面はレイアウトの「権限がありません」が出す


  const [stats, realFunnel, waiting] = await Promise.all([getStats(), loadRealFunnel(), loadWaitingCompanies()]);
  /* ★担当者のいない企業で、実在の利用者が待っている（2026-10-17）。検証用だけが待つ企業は要対応に数えない
        （一覧には出る）。失敗は1件として数える（0に倒すと壊れているのに消える） */
  const waitingReal = waiting === null ? null : waiting.filter((w) => !w.testOnly);
  /* ⚠️ 口コミ承認待ちは 2026-08-07 に外した。参照していた ow_company_reviews が
        このプロジェクトに存在せず、常に0件を足していただけだったため。 */
  const totalPending = stats.pendingJobsCount + stats.pendingMeetingsCount
    + (stats.neverLoggedInBizCount > 0 ? 1 : 0)
    /* ⚠️ 取得に失敗したときは 1件として数える（下のカードが「失敗」を出すため）。
          0 にすると、壊れているのに要対応が消える。 */
    + (stats.joinRequestsFailed ? 1 : stats.joinRequestsCount)
    /* ⚠️ 0件が正常。取得に失敗したときは 1件（`countTestLeftovers` がそう返す） */
    + countTestLeftovers(stats.testLeftovers)
    /* ★在籍していない人の報告（2026-09-18）。0件が正常。失敗は1件として数える */
    + (stats.memberReportsFailed ? 1 : stats.memberReportsCount)
    /* ★未紹介の提案（2026-09-21）。0件が正常。失敗は1件として数える */
    + (stats.stuckIntrosFailed ? 1 : stats.stuckIntrosCount)
    /* ★企業からの掲載依頼（2026-09-29）。0件が正常。失敗は1件として数える */
    + (stats.listingRequestsFailed ? 1 : stats.listingRequestsCount)
    + (waitingReal === null ? 1 : waitingReal.length);

  const kpis = [
    {
      label: "登録ユーザー数",
      sublabel: "Job Seekers",
      value: stats.usersCount,
      /* ⚠️★実測（2026-09-01）: 38人中 **32人が検証用**。実ユーザーは6人。
            内訳を出さないと、この画面の数字とファネルの%が**何を測っているのか
            読み取れない。** 隠すのではなく**内訳で示す**。 */
      /* ★実ユーザーの数は下のファネルと同じ数え方（lib/admin/realFunnel.ts。本人が登録した人だけ）にした（2026-10-17）。
            それまでは「全体 − 検証用」で、運営が履歴書から作った（本人未登録の）人も入り、ファネルと1人ずれていた */
      note: stats.testUsersCount > 0
        ? `うち検証用 ${stats.testUsersCount} ／ 実ユーザー ${realFunnel ? realFunnel.registered : "—"}`
        : null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      iconBg: "#EFF3FC",
      iconColor: "var(--royal)",
      accentBar: "var(--royal)",
      href: "/admin/candidates",
    },
    {
      label: "BIZ担当者数",
      sublabel: "Biz Accounts",
      note: null,
      value: stats.bizAdminsCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <polyline points="16 11 18 13 22 9"/>
        </svg>
      ),
      iconBg: "#F3E8FF",
      iconColor: "#7C3AED",
      accentBar: "#7C3AED",
      href: "/admin/biz-accounts",
    },
    {
      /* ⚠️★ラベルを「ページが見える企業数」にした（2026-09-09）。
            数えているのは `is_published = true` で、**一覧に出ている数ではない。**
            実測（2026-09-09）: ページが見える 90 ／ そのうち一覧に出る 83
            （差の7は「一覧に出さない企業6 ＋ 検証用2」。重複あり）。
            「公開中」だと `/companies` の「83社」と食い違って読めるので、
            **何を数えているかを言葉に出す。**
         ⚠️ 数え方は変えていない。変えると `/admin/companies` の「すべて 103」とも
            別の定義が増える。**言葉のほうを実態に合わせた。** */
      label: "ページが見える企業数",
      sublabel: "Active Companies",
      note: "一覧に出るかは別（企業審査の「一覧掲載」）",
      value: stats.activeCompaniesCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
      iconBg: "#ECFDF5",
      iconColor: "var(--success)",
      accentBar: "var(--success)",
      href: "/admin/companies",
    },
    {
      label: "公開中の求人数",
      sublabel: "Active Jobs",
      note: null,
      value: stats.activeJobsCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
        </svg>
      ),
      iconBg: "#FEF3C7",
      iconColor: "var(--warm-ink)",
      accentBar: "#F59E0B",
      href: "/admin/jobs",
    },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        .admin-kpi-card:hover { box-shadow: 0 6px 20px rgba(15,23,42,0.08); transform: translateY(-2px); border-color: #DCE5F7 !important; }
        .admin-quick-link:hover { background: #F8FAFC !important; border-color: #E2E8F0 !important; }
      `}</style>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "var(--font-inter), var(--font-noto)",
              fontSize: 9, fontWeight: 800,
              letterSpacing: "0.18em", textTransform: "uppercase",
              background: "#DC2626", color: "#fff",
              padding: "3px 8px", borderRadius: 4,
            }}>ADMIN</span>
            <h1 style={{
              fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
              fontSize: 22, fontWeight: 600, color: "#0F172A",
              margin: 0,
            }}>ダッシュボード</h1>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
            OPINIO 管理画面 — {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>

        {/* Pending tasks badge */}
        {totalPending > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#FEF3C7", border: "1px solid #FCD34D",
            borderRadius: 10, padding: "10px 16px",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--warm-strong)",
              boxShadow: "0 0 0 3px rgba(245,158,11,0.25)",
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--warm-ink)" }}>
              要対応タスク {totalPending}件
            </span>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12, marginBottom: 24,
      }}>
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} style={{ textDecoration: "none", display: "block" }}>
            <div className="admin-kpi-card" style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 14,
              padding: "20px 22px 16px",
              transition: "all 0.18s ease",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
            }}>
              {/* Top accent bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 3, background: kpi.accentBar, borderRadius: "14px 14px 0 0",
              }} />

              {/* Icon + value */}
              <div style={{
                display: "flex", alignItems: "flex-start",
                justifyContent: "space-between", marginBottom: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: kpi.iconBg, color: kpi.iconColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {kpi.icon}
                </div>
                <div style={{
                  fontFamily: "var(--font-inter), var(--font-noto)",
                  fontSize: 34, fontWeight: 800, color: "#0F172A",
                  lineHeight: 1, letterSpacing: "-0.02em",
                }}>
                  {kpi.value}
                </div>
              </div>

              {/* Label */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>
                {kpi.label}
              </div>
              {/* ★内訳（2026-09-01）。⚠️ 数字だけだと**何を数えたか**が読めない。 */}
              {kpi.note && (
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2 }}>
                  {kpi.note}
                </div>
              )}
              <div style={{
                fontFamily: "var(--font-inter), var(--font-noto)",
                fontSize: 9, fontWeight: 700,
                color: "#94A3B8", letterSpacing: "0.14em", textTransform: "uppercase",
                borderTop: "1px solid #F1F5F9", paddingTop: 8, marginTop: 8,
              }}>
                {kpi.sublabel} →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── ★実ユーザーのファネル（2026-10-17 / 柴さんの指示）──────────────────────────
             それまでのファネルは検証用アカウントを母数に含み、注記で断っていた。
             「応募・面談実績あり」も応募の**行数**で、人数ではなかった。
             ⚠️ 数え方は lib/admin/realFunnel.ts の1か所。ここに条件を書かない。
             ⚠️ 取得に失敗したら「取得できませんでした」。0人と出さない。 */}
      {(() => {
        const f = realFunnel;
        if (!f) {
          return (
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px 22px", marginBottom: 16, fontSize: 13, color: "var(--error-ink)" }}>
              実ユーザーのファネルを取得できませんでした（0人という意味ではありません）。
            </div>
          );
        }
        const total = f.registered;
        const steps = [
          { label: "登録", count: f.registered, note: "本人が登録した人" },
          { label: "オンボーディング完了", count: f.onboarded, note: null },
          { label: "職歴あり", count: f.withCareer, note: null },
          { label: "入社後レビューに回答", count: f.reviewed, note: "「この会社について」" },
          { label: `直近${ACTIVE_WINDOW_DAYS}日に利用`, count: f.activeLast7d, note: f.lastActiveAt ? `最終 ${new Date(f.lastActiveAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}` : "記録なし" },
        ];
        return (
          <div data-state="real-funnel" style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>実ユーザーのファネル</div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                検証用・システムを除く ／ 応募・面談をした人 <strong style={{ color: "var(--ink)" }}>{f.appliedOrMet}人</strong>
                {" "}／ ユーザーどうしの最初のメッセージ <strong data-state="real-funnel-dm" style={{ color: "var(--ink)" }}>{f.dmRequests}件</strong>（返信あり {f.dmReplied}件）
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              {steps.map((step, i) => {
                const pct = total > 0 ? Math.round((step.count / total) * 100) : 0;
                const prev = i > 0 ? steps[i - 1].count : null;
                const stepPct = prev && prev > 0 ? Math.round((step.count / prev) * 100) : null;
                return (
                  <div key={step.label} style={{ background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 10, padding: "12px 14px", minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 26, fontWeight: 800, color: "var(--royal)", lineHeight: 1 }}>
                      {step.count}<span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginLeft: 4 }}>人</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginTop: 6 }}>{step.label}</div>
                    <div style={{ height: 4, background: "#E2E8F0", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--royal)", borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4, fontFamily: "var(--font-inter), var(--font-noto)" }}>
                      登録の {pct}%{stepPct !== null ? ` ／ 前の段の ${stepPct}%` : ""}
                    </div>
                    {step.note && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{step.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Tasks + Quick Actions ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Pending Tasks */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>
            <h2 style={{
              fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              要対応タスク
            </h2>
            {totalPending > 0 && (
              <span style={{
                background: "#FEF3C7", color: "var(--warm-ink)",
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 100,
              }}>
                {totalPending}件
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.pendingJobsCount > 0 && (
              <Link href="/admin/jobs" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  transition: "background 0.15s",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "var(--warm-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>求人の再開依頼</p>
                    <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>{stats.pendingJobsCount}件（運営が停止した求人を、企業が直して再開を依頼しています）</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {stats.pendingMeetingsCount > 0 && (
              <Link href="/admin/candidates" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#EFF3FC", border: "1px solid #DCE5F7",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#DCE5F7", color: "var(--royal)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", margin: 0, marginBottom: 2 }}>カジュアル面談 申込待ち</p>
                    <p style={{ fontSize: 11, color: "#3B5FD9", margin: 0 }}>{stats.pendingMeetingsCount}件</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {/* ★担当者のいない企業で待っている人（2026-10-17）。数え方は lib/admin/waitingCompanies.ts */}
            {(waitingReal === null || waitingReal.length > 0) && (
              <Link href="/admin/waiting-companies" style={{ textDecoration: "none" }}>
                <div data-state="todo-waiting-companies" style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A", cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "var(--warm-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" /><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>
                      {waitingReal === null ? "担当者のいない企業で待っている人 取得に失敗" : `担当者のいない企業で待っている人 ${waitingReal.length}社`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>
                      {waitingReal === null ? "0社という意味ではありません。開いて確認してください" : "応募・面談の申込・興味あり。企業に担当者の登録を案内してください"}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            {/* ★企業への参加依頼（2026-09-04）。
                   ⚠️ 掲載中79社のうち依頼メールが届くのは2社だけ（2026-09-04 実測）。
                      残り77社では企業側に受け取れる人がいないので、
                      **ここに出ないと依頼はどこにも着かない。** */}
            {(stats.joinRequestsCount > 0 || stats.joinRequestsFailed) && (
              <Link href="/admin/company-join-requests" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  transition: "background 0.15s", cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "var(--warm-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>
                      {stats.joinRequestsFailed
                        ? "企業への参加依頼 取得に失敗"
                        : `企業への参加依頼 ${stats.joinRequestsCount}件`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>
                      {stats.joinRequestsFailed ? (
                        /* ⚠️ 「0件」と読ませない */
                        <>0件という意味ではありません。開いて確認してください</>
                      ) : (
                        <>
                          {stats.joinRequestsOldestDays !== null && stats.joinRequestsOldestDays >= 1 && (
                            <>最も古いもので {stats.joinRequestsOldestDays} 日前 ・ </>
                          )}
                          {/* ⚠️ ここで「誰にも届いていません」と断定しない。届く企業もある
                                 （宛先の有無は**依頼ごとに違う**ので一覧で出す）。 */}
                          承認すると、その企業の管理画面をその人に渡します
                        </>
                      )}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )}

            <TestLeftoversCard leftovers={stats.testLeftovers} />

            {/* ★★双方合意なのに紹介できていない提案（2026-09-21）。
                   ⚠️ 両側とも答え終わっているので、運営が押さないと永久に残る。
                   ⚠️ 取得に失敗したときも出す（0件に化けさせない）。 */}
            {(stats.stuckIntrosCount > 0 || stats.stuckIntrosFailed) && (
              <Link href="/admin/proposals" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  transition: "background 0.15s", cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "var(--warm-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>
                      {stats.stuckIntrosFailed
                        ? "未紹介の提案の取得に失敗しました（0件という意味ではありません）"
                        : `会話が作られていない提案 ${stats.stuckIntrosCount}件`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>
                      {stats.stuckIntrosFailed
                        ? "取得に失敗しています"
                        : "本人は「話を聞いてみたい」と答え済みです。運営が再試行しないと動きません"}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* ★企業からの掲載依頼（2026-09-29）。
                   ⚠️ 取得に失敗したときも出す（0件に化けさせない）。 */}
            {(stats.listingRequestsCount > 0 || stats.listingRequestsFailed) && (
              <Link href="/admin/companies" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "var(--success-soft)", border: "1px solid #A7F3D0",
                  transition: "background 0.15s", cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#D1FAE5", color: "var(--success-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--success-ink)", margin: 0, marginBottom: 2 }}>
                      {stats.listingRequestsFailed
                        ? "掲載依頼の取得に失敗しました（0件という意味ではありません）"
                        : `企業からの掲載依頼 ${stats.listingRequestsCount}社`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--success-ink)", margin: 0 }}>
                      {stats.listingRequestsFailed
                        ? "取得に失敗しています"
                        : <>掲載トグルを入れると印は自動で消えます{stats.listingRequestsOldestDays !== null ? ` ・ 最も古い依頼から ${stats.listingRequestsOldestDays}日` : ""}</>}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* ★企業からの「在籍していない人」報告（2026-09-18 / B7）。
                   ⚠️ 取得に失敗したときも出す（0件に化けさせない）。 */}
            {(stats.memberReportsCount > 0 || stats.memberReportsFailed) && (
              <Link href="/admin/member-reports" style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  background: "#FFFBEB", border: "1px solid #FDE68A",
                  transition: "background 0.15s", cursor: "pointer",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#FEF3C7", color: "var(--warm-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>
                      {stats.memberReportsFailed
                        ? "在籍報告の取得に失敗しました（0件という意味ではありません）"
                        : `在籍していない人の報告 ${stats.memberReportsCount}件`}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>
                      {stats.memberReportsFailed
                        ? "取得に失敗しています"
                        : <>企業からの報告です ・ 外すかどうかは運営が判断します{stats.memberReportsOldestDays !== null ? ` ・ 最も古い報告から ${stats.memberReportsOldestDays}日` : ""}</>}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {totalPending === 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "16px 14px", borderRadius: 10,
                background: "#ECFDF5", border: "1px solid #A7F3D0",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
                </svg>
                <p style={{ fontSize: 13, color: "#065F46", fontWeight: 600, margin: 0 }}>
                  対応が必要なタスクはありません
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B5FD9" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            クイックアクション
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/admin/invite" style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10,
                background: "#EFF3FC", border: "1px solid #DCE5F7",
                cursor: "pointer", transition: "background 0.15s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--royal)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", margin: 0, marginBottom: 2 }}>ユーザーを招待する</p>
                  <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>求職者・企業担当者をメール招待</p>
                </div>
              </div>
            </Link>

            {[
              { href: "/admin/companies", label: "企業を管理する", desc: "掲載企業の承認・編集", icon: "🏢" },
              { href: "/admin/jobs", label: "求人を審査する", desc: "掲載求人のレビューと承認", icon: "📋" },
              { href: "/admin/candidates", label: "候補者を確認する", desc: "登録ユーザーの一覧", icon: "👤" },
            ].map(({ href, label, desc, icon }) => (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div className="admin-quick-link" style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px solid #F1F5F9",
                  cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0, marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>


      {/* ── Recent Users ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16,
      }}>
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>最近の登録ユーザー</h2>
            <Link href="/admin/candidates" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              すべて見る →
            </Link>
          </div>

          {stats.recentUsers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.recentUsers.map((u: any, i: number) => (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  background: "#F8FAFC",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#fff",
                    flexShrink: 0,
                  }}>
                    {u.name?.[0] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.name || "未入力"}
                      </p>
                    </div>
                    <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.email ? u.email.replace(/[^@]*/, "***") : "—"}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, color: "#94A3B8", flexShrink: 0,
                    fontFamily: "var(--font-inter), var(--font-noto)",
                  }}>
                    {new Date(u.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
              ユーザーはまだいません
            </p>
          )}
        </div>

        {/* Stats summary */}
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "20px 22px",
        }}>
          <h2 style={{
            fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0,
            marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
          }}>プラットフォーム概況</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                label: "登録ユーザー（求職者）",
                value: stats.usersCount,
                color: "var(--royal)",
                bar: stats.usersCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "BIZ担当者",
                value: stats.bizAdminsCount,
                color: "#7C3AED",
                bar: stats.bizAdminsCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                /* ⚠️ 上の KPI カードと**同じ言葉にする**（2026-09-09）。
                      同じ値（`activeCompaniesCount` = `is_published`）を
                      1画面で「ページが見える企業数」と「公開中の企業」の2つの語で
                      出していた。数えているのは一覧掲載の数ではない。 */
                label: "ページが見える企業",
                value: stats.activeCompaniesCount,
                color: "var(--success-ink)",
                bar: stats.activeCompaniesCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "公開中の求人",
                value: stats.activeJobsCount,
                color: "var(--warm-ink)",
                bar: stats.activeJobsCount,
                max: Math.max(stats.usersCount, 1),
              },
              {
                label: "累計応募数",
                value: stats.totalApplicationsCount,
                color: "#DC2626",
                bar: stats.totalApplicationsCount,
                max: Math.max(stats.usersCount, 1),
                // 数字だけ出して一覧に飛べない状態だったので導線を足した（2026-08-05）
                href: "/admin/applications",
              },
            ].map(({ label, value, color, bar, max, href }: { label: string; value: number; color: string; bar: number; max: number; href?: string }) => (
              <div key={label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  {href ? (
                    <Link href={href} style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                      {label} →
                    </Link>
                  ) : (
                    <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</span>
                  )}
                  <span style={{
                    fontFamily: "var(--font-inter), var(--font-noto)",
                    fontSize: 14, fontWeight: 700, color,
                  }}>{value}</span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: "#F1F5F9", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (bar / max) * 100)}%`,
                    background: color,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                    minWidth: value > 0 ? 8 : 0,
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, paddingTop: 14, borderTop: "1px solid #F1F5F9",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              BIZ担当者（未ログイン）:{" "}
              <strong style={{ color: stats.neverLoggedInBizCount > 0 ? "var(--warm-ink)" : "var(--success-ink)" }}>
                {stats.neverLoggedInBizCount}名
              </strong>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              審査待ち求人: <strong style={{ color: stats.pendingJobsCount > 0 ? "var(--warm-ink)" : "var(--success-ink)" }}>
                {stats.pendingJobsCount}件
              </strong>
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
              面談申込待ち: <strong style={{ color: stats.pendingMeetingsCount > 0 ? "var(--royal)" : "var(--success-ink)" }}>
                {stats.pendingMeetingsCount}件
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent Companies Table ── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0",
        borderRadius: 14, padding: "20px 22px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #F1F5F9",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", margin: 0 }}>企業一覧</h2>
          <Link href="/admin/companies" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            すべて見る →
          </Link>
        </div>

        {stats.recentCompanies.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["企業名", "業界", "ステータス", "登録日"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "6px 10px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    borderBottom: "1px solid #F1F5F9",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.recentCompanies.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  <td style={{ padding: "10px 10px", fontWeight: 600, color: "#0F172A" }}>
                    <Link href={`/admin/companies/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 10px", color: "#475569" }}>{c.industry || "—"}</td>
                  <td style={{ padding: "10px 10px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                      background: c.is_published ? "#ECFDF5" : "#F8FAFC",
                      color: c.is_published ? "var(--success-ink)" : "#94A3B8",
                      border: `1px solid ${c.is_published ? "#A7F3D0" : "#E2E8F0"}`,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: c.is_published ? "var(--success)" : "#94A3B8",
                      }} />
                      {c.is_published ? "公開中" : "非公開"}
                    </span>
                  </td>
                  <td style={{
                    padding: "10px 10px", color: "#94A3B8",
                    fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12,
                  }}>
                    {new Date(c.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
            企業はまだ登録されていません
          </p>
        )}
      </div>
    </div>
  );
}
