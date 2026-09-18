import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeesClient } from "./EmployeesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "社員管理 | OPINIO Business" },
};

/* ⚠️★**`BizTeamMember` と「管理アカウント」タブは 2026-09-18 に削除した。**
      同じ人たちは「チーム管理」（**`/biz/members`**）で追加・削除でき、この画面で
      **見るだけの一覧が二重にあった**。代わりに、経歴を登録している管理者には
      現役社員カードに「管理者」バッジを出す（下の `isAdmin`）。
   ⚠️ `ow_company_admins` の取得自体は残す。バッジの判定に要る。
   ⚠️★**経歴を持たない管理者は、この画面に出なくなった。** それは意図どおり
      ——ここは「企業ページに出る人」の一覧で、管理権限の一覧ではない。
      権限の確認は `/biz/members`（サイドバーの「チーム管理」）で行う。
      ⚠️ **`/biz/team` というパスは存在しない。** 書くときは実在を確かめること。 */

export type BizEmployee = {
  experienceId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  isMentor: boolean;
  /** ★職種マスタ（`ow_roles`）の名前。**これが主。** */
  roleName: string | null;
  /** 本人が入れた社内での呼び方（自由入力）。★マスタ名の下に小さく併記する */
  roleTitle: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  /** この企業の有効な管理者（`ow_company_admins`）でもあるか */
  isAdmin: boolean;
  /** この企業で面談OK（`ow_company_members` が掲載中）か */
  isTalkable: boolean;
};

export default async function EmployeesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const admin = createAdminClient();

  /*
    公開を選んだ経歴だけを取得する。

    ⚠️ **`visibility_company` を必ず見ること。** 2026-08-13 まで条件が無く、
       `createAdminClient`（RLS バイパス）で全件引いていたため、
       オンボーディングで「会社名は伏せる」を選んだ人が
       **その勤務先の採用担当者には実名で見えていた**。

       伏せた人が気にしているのは「社名が出ること」ではなく
       **「転職を考えていると今の会社に知られること」**なので、
       ここに出るのはチェックボックスの文面から誰も予想できない。
       CLAUDE.md「ユーザーの非表示希望と企業側の掲載要望が衝突したら
       必ずユーザー側を優先する」（2026-08-02 確立）に従う。

    ⚠️ 企業側が失うものは無い。`masked` / `hidden` の人は公開側にも出ていないので、
       社員管理画面（＝公開時の見え方を調整する画面）で企業がすることが元から無い。

    ⚠️ **企業が自分で隠した行（`ow_company_hidden_experiences`）はここで除外しない。**
       あれは企業が解除できる必要がある。除外の主体が違うので混同しないこと。

    ⚠️ NULL も除外される（`.eq` は NULL に一致しない）。これは意図どおり。
       値が無いものを「公開してよい」とみなさない。

    ⚠️★★**職種マスタの埋め込みは `ow_roles!role_category_id` と FK を名指しすること**
       （2026-09-18）。素の `ow_roles ( name )` は
       **「Could not embed because more than one relationship was found」で失敗する。**
       `ow_experiences` → `ow_roles` の FK は1本しかないが、PostgREST は
       **`ow_experience_roles`（多対多の中間表）経由の関係も候補に数える**ため。
       ⚠️ 失敗すると `data` が undefined になり、`rows ?? []` で受けているここでは
       **社員一覧が丸ごと0件になる**（画面はエラーを出さない）。実装中に実際に踏んだ。
  */
  const { data: rows, error: rowsError } = await admin
    .from("ow_experiences")
    .select(`
      id,
      user_id,
      role_title,
      role_category_id,
      started_at,
      ended_at,
      is_current,
      ow_users (
        id,
        name,
        avatar_url,
        is_mentor,
        is_test
      ),
      ow_roles!role_category_id (
        name
      )
    `)
    .eq("company_id", ctx.tenantId)
    .eq("visibility_company", "real")
    .order("started_at", { ascending: false });

  // 握り潰さない。0件が「誰もいない」なのか「取得に失敗した」なのか区別できなくなる。
  if (rowsError) {
    console.error("[biz/employees] experiences fetch failed:", rowsError.message);
  }

  // 非表示 experience_id 一覧
  const { data: hiddenRows } = await admin
    .from("ow_company_hidden_experiences")
    .select("experience_id")
    .eq("company_id", ctx.tenantId);
  const hiddenIds = new Set((hiddenRows ?? []).map((r: any) => r.experience_id as string));

  /* ★検証用アカウント（`is_test`）を除外する（2026-08-31）。
        ⚠️ **企業の管理画面に検証用アカウントが「現役社員」として出ていた。**
           実測（2026-08-31 / 本番）: セールスフォース・ジャパンは
           `visibility_company = 'real'` の経歴9件のうち**4件が検証用**で、
           そのうち**3名が現役社員**として並んでいた（実在するのは1名だけ）。
        ⚠️ **求職者側（`/companies/[id]`）は元から除外している**（`queries.ts`）。
           企業側だけが除外していなかったので、**企業が見る自社の社員一覧と、
           訪問者が見る社員一覧が食い違っていた。** 揃えるのが目的。
        ⚠️ 運営が検証用を見たいときは `/admin` 側で見る。**ここは企業の画面。**
           `/admin/ambassador-requests` が `is_test` を「ラベルを付けて出す」のは
           **運営向けの一覧だから**で、方針が違う（CLAUDE.md に明記されている）。 */
  /* この企業の有効な管理者。**バッジの判定にしか使わない**（一覧は `/biz/members`）。
     ⚠️ `is_test` を除外しない。検証用アカウントでも実際に管理者として動くので、
        バッジの事実としては正しい（そもそも経歴側で `is_test` を落としているので、
        この画面に出るのは実アカウントだけ）。 */
  const { data: adminRows, error: adminErr } = await admin
    .from("ow_company_admins")
    .select("user_id")
    .eq("company_id", ctx.tenantId)
    .eq("is_active", true);
  if (adminErr) console.error("[biz/employees] admins fetch failed:", adminErr.message);
  const adminUserIds = new Set((adminRows ?? []).map((r: any) => r.user_id as string));

  /* ★面談OK（`ow_company_members` が掲載中）。
     ⚠️★**条件は `display_consent && is_public` の両方。** 片方だけだと
        「本人が同意していないのに掲載中」「本人はONだが企業が非掲載」を
        取り違える（状態は5つある。`lib/constants/companyMembers.ts` の `memberState`）。
     ⚠️★**現役（`is_current`）にだけ出す**（下のカード側で判定）。
        `lib/companyMembers/talkable.ts` の②と同じ ——行は退職しても残るので、
        これが無いと**辞めた人が「面談OK」のまま**出る。
     ⚠️ 企業の受付状態（`accepting_casual_meetings`）は**見ない**。
        人が出るかは本人の同意で決まり、申込導線が出るかは企業の受付で決まる。 */
  /* ★報告の状態（2026-09-18 / B7 → C-9 で結果まで持つようにした）。
     ⚠️ **1つの経歴に複数行ありうる**（却下されたあとの再報告は新しい行になる。
        一意なのは「未対応の行」だけ ——`uq_company_member_reports_open`）。
        だから**未対応の集合**と**直近の対応済み**を分けて持つ。
     ⚠️ 順に並べて最後を採る。`.limit(1)` を経歴ごとに投げない（N+1 になる）。 */
  const { data: reportRows, error: reportErr } = await admin
    .from("ow_company_member_reports")
    .select("experience_id, resolved_at, resolution, resolution_note")
    .eq("company_id", ctx.tenantId)
    .order("reported_at", { ascending: true });
  if (reportErr) console.error("[biz/employees] reports fetch failed:", reportErr.message);

  const reportedExperienceIds: string[] = [];
  const latestResolved = new Map<string, { resolution: string; note: string | null }>();
  for (const r of (reportRows ?? []) as any[]) {
    const expId = r.experience_id as string;
    if (r.resolved_at === null) {
      reportedExperienceIds.push(expId);
    } else if (typeof r.resolution === "string") {
      /* 後から来た行で上書きする（`reported_at` 昇順なので最後が直近） */
      latestResolved.set(expId, { resolution: r.resolution, note: (r.resolution_note as string | null) ?? null });
    }
  }
  /* ★却下の経歴だけを企業に伝える（2026-09-18 / C-9）。
     ⚠️ `hidden` の行は下の `hiddenExperienceIds` が担当するので、ここでは出さない
        （運営が外した → 戻した場合は、どちらにも入らず通常表示に戻る＝再報告できる）。 */
  const rejectedExperiences = Array.from(latestResolved.entries())
    .filter(([, v]) => v.resolution === "rejected")
    .map(([experienceId, v]) => ({ experienceId, note: v.note }));

  const { data: memberRows, error: memberErr } = await admin
    .from("ow_company_members")
    .select("user_id, display_consent, is_public")
    .eq("company_id", ctx.tenantId)
    .eq("display_consent", true)
    .eq("is_public", true);
  if (memberErr) console.error("[biz/employees] members fetch failed:", memberErr.message);
  const talkableUserIds = new Set((memberRows ?? []).map((r: any) => r.user_id as string));

  const employees: BizEmployee[] = (rows ?? []).flatMap((row: any) => {
    const user = row.ow_users;
    if (!user) return [];
    if (user.is_test === true) return [];
    const userId = user.id as string;
    const isCurrent = row.is_current as boolean;
    return [{
      experienceId: row.id as string,
      userId,
      name: user.name as string | null,
      avatarUrl: user.avatar_url as string | null,
      isMentor: user.is_mentor === true,
      /* ⚠️ 埋め込みは `role_category_id` が NULL の行では null になる（左結合）。
            `?? ""` に倒さない ——「未設定」と「取得漏れ」が区別できなくなる。 */
      roleName: (row.ow_roles?.name as string | null) ?? null,
      roleTitle: row.role_title as string | null,
      startedAt: row.started_at as string,
      endedAt: row.ended_at as string | null,
      isCurrent,
      isAdmin: adminUserIds.has(userId),
      /* ★退職者には出さない（上の注記の②）。 */
      isTalkable: isCurrent && talkableUserIds.has(userId),
    }];
  });

  /* ★非表示にした人も、それぞれのタブの中に出す（2026-09-18）。
     ⚠️★**「非表示中」タブを消したので、除外したままだと解除する手段が無くなる。**
        `ow_company_hidden_experiences` は本番0行なので今日は誰も該当しないが、
        1行でも入った瞬間に「画面から消えて戻せない」形になる。
     ⚠️ 企業ページ（公開面）から外れていること自体は変わらない。
        カード側で「非表示中」と示し、「表示に戻す」を出す。 */
  const current = employees.filter((e) => e.isCurrent);
  const alumni = employees.filter((e) => !e.isCurrent);
  const hiddenExperienceIds = Array.from(hiddenIds);

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <EmployeesClient
        current={current}
        alumni={alumni}
        hiddenExperienceIds={hiddenExperienceIds}
        reportedExperienceIds={reportedExperienceIds}
        rejectedExperiences={rejectedExperiences}
        companyName={ctx.tenantName ?? ""}
      />
    </BusinessLayout>
  );
}
