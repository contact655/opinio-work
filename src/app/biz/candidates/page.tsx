import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcTotalExperience } from "@/lib/profile/tenure";
import CandidatesClient from "./CandidatesClient";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS, MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { getDesiredRolesFor } from "@/lib/profile/desiredRoles";
import { resolveTopRole } from "@/lib/roles/jobRoles";
/* ★「できること」（職種 × 年数）。⚠️★**職種だけの版を使う**——事業領域は
      `company_id` から引くので、社名を伏せた職歴から企業側へ漏れる（関数の注記）。 */
import { buildRoleAutoSkills } from "@/lib/profile/autoSkillsServer";
import { canUse } from "@/lib/constants/plans";
import { approachTargets, getRecentlyApproached, type RecentApproach } from "@/lib/approaches/server";
import { isCandidateNotesEnabled, listCandidateStages } from "@/lib/candidateNotes/server";
import { isCompanyReviewed, COMPANY_REVIEW_BLOCKED_MESSAGE } from "@/lib/business/scoutGate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "候補者を探す | OPINIO Business" },
};

export default async function CandidatesPage() {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName="担当者" hasCompany={false}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: 40, textAlign: "center", maxWidth: "var(--max-w-form)", margin: "60px auto",
        }}>
          <p style={{ fontSize: 14, color: "var(--error)" }}>
            企業アカウントが見つかりませんでした。ログインし直してください。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  /* 未承認企業は候補者検索不可。
     ⚠️★**`ctx.isPublished` に戻さないこと**（2026-09-20 に直した）。
        `is_published` は**ページの取り下げ用**で、審査とは別のスイッチ。
        見ていた列と画面の文言（「運営審査が完了するまで」）が食い違っており、
        **承認済みなのにページを下げている企業が審査待ち扱い**になっていた。
        判定は `isCompanyReviewed` の1箇所（`lib/business/scoutGate.ts`）。 */
  if (!isCompanyReviewed(ctx)) {
    return (
      <BusinessLayout {...{
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: "48px 40px", textAlign: "center", maxWidth: 520, margin: "60px auto",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--warm-soft)", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            {COMPANY_REVIEW_BLOCKED_MESSAGE}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 0 }}>
            候補者検索は、運営による企業審査が完了した後にご利用いただけます。<br />
            審査が完了次第、メールでご連絡します。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  /* ══ プランが引けなかったとき ════════════════════════════════════════
     ⚠️★**`canUse` のゲートと分けること**（2026-09-29）。`canUse(null, ...)` は
        fail-closed で false になるが、**理由が「売り物だから」ではなく「異常」。**
        `planType` が null になるのは次の2つ:
          ① `ow_company_plans` に active な行が無い（本来ありえない。全社に1本ある前提）
          ② 取得に失敗した
        ⚠️★**ベータ中は `free` でも候補者検索が開く**ので、ここを分けないと
           「プラン行が無いだけ」の企業に**有料プランの売り込み**が出る。
        ⚠️ `source='user'` で作られた企業（求職者が経歴入力から登録）は
           **プラン行を持たない**（`/api/jobseeker/companies` は意図して触らない）。
           その企業に後から担当者が付くと①になる。**実際に3社あった**（2026-09-29 に補充）。 */
  if (ctx.planType === null) {
    return (
      <BusinessLayout {...{
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: "44px 40px", maxWidth: 620, margin: "48px auto",
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 14, lineHeight: 1.5 }}>
            候補者を探す
          </h1>
          {/* ⚠️ 「有料プランです」と書かないこと。**売り物の案内ではなく異常**。
                 利用者にできることが無いので、運営に繋ぐ。 */}
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 24 }}>
            この企業のプラン情報を確認できませんでした。お手数ですが{" "}
            <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
              contact@opinio.co.jp
            </a>{" "}
            までご連絡ください。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  /* ══ 有料プランのゲート ═══════════════════════════════════════════════
     ⚠️ **必ずここで返す。候補者を取得する前。**
        500件取ってからクライアントで隠すのは不可。一覧も詳細も同じ
        ペイロードに載るので、開発者ツールから全部見える。
     ⚠️ 集計の数字も出さない（2026-08-22 の判断）。登録者13人・職種2種類では
        検討材料にならず、出すと逆効果になるため。 */
  if (!canUse(ctx.planType, "candidateSearch")) {
    return (
      <BusinessLayout {...{
        userName: ctx.userName,
        tenantName: ctx.tenantName,
        tenantLogoGradient: ctx.logoGradient,
        tenantLogoLetter: ctx.logoLetter,
        memberships: ctx.allCompanies,
        currentTenantId: ctx.tenantId,
      }}>
        <div style={{
          background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
          padding: "44px 40px", maxWidth: 620, margin: "48px auto",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
            background: "var(--royal-50)", color: "var(--royal)",
            border: "1px solid var(--royal-100)", marginBottom: 18,
          }}>
            有料プランの機能
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 14, lineHeight: 1.5 }}>
            候補者を探す
          </h1>

          {/* ⚠️ 文言を「もうすぐ使えます」の方向に変えないこと。
                 登録者が揃っていないのは事実で、期待を持たせると
                 登録直後に空だと分かったときの落差になる。 */}
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
            候補者検索は有料プランの機能です。現在は登録者を増やしている段階のため、
            ご利用は人数が揃ってからをお勧めしています。
          </p>

          <div style={{
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            borderRadius: 12, padding: "20px 22px", marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
              候補者検索でできること
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {/* ⚠️★ここは「できること」の約束。**実際の絞り込みと必ず一致させること。**
                     「希望する企業フェーズ」は 2026-08-27 に絞り込みごと外したので
                     この一覧からも消した（残すと**出来ないことを約束する**ことになる）。
                     ⚠️ 絞り込みを足す／外すときは、この配列も同時に直す。 */}
              {[
                /* ⚠️★「現在の役職」と書かないこと（2026-10-01 に直した）。絞り込んでいるのは
                      自由入力の `role_title` で、5択の役職（`rank`）ではない。
                      `CandidatesClient` の入力欄と**必ず同じ語**にする。 */
                "職種（大分類・小分類）", "現在の会社名", "社内での呼び方",
                "雇用形態", "社会人年数", "希望勤務地", "希望年収",
                "希望する職種", "働き方",
                /* ★2026-09-19 追加。⚠️ 絞り込み（CandidatesClient）と必ず一致させること。 */
                "転職意欲", "転職意欲の更新時期",
              ].map((t) => (
                <span key={t} style={{
                  fontSize: 12, padding: "5px 11px", borderRadius: 100,
                  background: "#fff", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", whiteSpace: "nowrap",
                }}>{t}</span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8, marginTop: 14, marginBottom: 0 }}>
              これらの条件で絞り込み、候補者のプロフィールを閲覧できます。
            </p>
          </div>

          {/* ⚠️ 金額は書かない。有料プランは未実装で、LPにも金額を出していない。 */}
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, margin: 0 }}>
            プランのご相談は{" "}
            <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
              contact@opinio.co.jp
            </a>{" "}
            までご連絡ください。
          </p>
        </div>
      </BusinessLayout>
    );
  }

  /* ⚠️★★スカウトは 2026-10-08 に廃止した（提案に一本化）。送信可否・送信枠・
        「送信済み」の判定はすべて外した。**戻さないこと。**
     ⚠️★**下の `can_send_scout()` は残す。** 名前に反して中身は
        「この企業にこの候補者を見せてよいか」（転職意欲／自社在籍者の除外／
        求職者の手動ブロック／転職勧奨禁止）で、この一覧の母集団を決めている。 */

  const adminClient = createAdminClient();

  // 並列取得: プロフィール・転職禁止
  const [profileRows, blockedPlacements] = await Promise.all([
    adminClient
      .from("ow_profiles")
      /* ⚠️★`desired_phase` / `transfer_timing` は 2026-08-27 に**引くのをやめた**。
            同日に本人側の入力欄を消したので、企業に見せると
            「本人が直せない値で絞り込む／表示する」ことになる。
            ⚠️ **列と値は残っている。** 入力欄を戻すならここも戻すこと。 */
      /* ★`career_stance_updated_at` も引く（2026-09-19）。「転職意欲の更新時期」で絞るため。
            ⚠️★**`stance_updated_at` を使わないこと。** あちらは「転職・面談の状況カードの
               最終更新」で、**面談OK の登録・公開切替でも打たれる**。使うと
               「面談OK を触っただけの人」が「転職意欲を更新した人」として当たる。 */
      .select("user_id, onboarding_completed, desired_work_styles, desired_prefectures, desired_salary_min, desired_salary_max, career_stance, career_stance_updated_at, accept_company_approaches")
      /* ★母集合を `scout_enabled` から `career_stance` に付け替えた（2026-08-27 / フェーズ3）。
         ⚠️★**未設定（null）は入れない。** 本人が一度も答えていない状態を
            「受け取る」と読み替えて企業に開示することになる。
            `can_send_scout()` と**同じ条件**にしてある。片方だけ変えないこと。
         ⚠️ 止めるのは `no_contact` だけ。`researching`（情報収集として）は入る。 */
      .not("career_stance", "is", null)
      .neq("career_stance", "no_contact")
      .then(r => r.data ?? []),
    // 転職勧奨禁止（就職後2年以内かつ在職中）
    adminClient
      .from("ow_placements")
      .select("candidate_id")
      .is("resigned_at", null)
      .gte("joined_at", new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .then(r => r.data ?? []),
  ]);

  const blockedCandidateIds = new Set((blockedPlacements).map((p: any) => p.candidate_id as string));

  // 声をかけてよい（career_stance が未設定でも no_contact でもない）ユーザーの auth_id 一覧
  const scoutAuthIds = profileRows.map((p: any) => p.user_id as string);

  /* ow_users 取得。
     ⚠️ **`birth_date` は取らない**（2026-08-20）。候補者一覧に年齢を出さず、
        年齢での絞り込みもしないと決めたため。取ってしまうと、いつでも書ける状態が残る。
        絞り込みは「社会人年数」（下の tenureMonths）で行う。
        理由: 労働施策総合推進法9条で募集・採用時の年齢制限は原則禁止。
        表示だけなら各社もしているが、**年齢で絞り込む機能**は禁止行為を直接手助けする形になる。 */
  const { data: rawUsers, error: rawUsersError } = scoutAuthIds.length > 0
    ? await adminClient
        .from("ow_users")
        .select("id, name, headline, location, created_at, auth_id")
        .in("auth_id", scoutAuthIds)
        .neq("visibility", "private")
        .not("is_system", "eq", true)
        /* ★`is_test` はここで絞らない（2026-10-09）。判定は `can_send_scout()` の1箇所で、
              **見る企業と候補者の is_test が一致するときだけ**出す
              （実在の企業には実在の利用者だけ／検証用の企業には検証用だけ）。
           ⚠️★ここに `.eq("is_test", false)` を戻すと、**検証用の企業が誰も見えなくなる**
              （実在は関数が落とし、検証用はここが落とす）。 */
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [], error: null };

  if (rawUsersError) {
    console.error("[candidates] ow_users fetch error:", rawUsersError);
  }

  const userIds = (rawUsers ?? []).map((u: any) => u.id as string);

  // auth_id → profile マップ
  const profilesByAuthId = new Map<string, {
    onboarding_completed: boolean;
    desired_work_styles: string[] | null;
    desired_prefectures: string[] | null;
    desired_salary_min: number | null;
    desired_salary_max: number | null;
    /** 「転職について」の意思表示。⚠️ null は「まだ答えていない」（2026-08-26 / フェーズ2） */
    career_stance: string | null;
    /** ★転職意欲を最後に変えた日時（2026-09-19）。⚠️ `stance_updated_at` とは別の列 */
    career_stance_updated_at: string | null;
    /** ★企業からの声かけを受け取るか（2026-10-09）。⚠️ 画面へは「送れるか」の真偽だけを渡す */
    accept_company_approaches: boolean | null;
  }>();
  for (const p of profileRows) {
    profilesByAuthId.set(p.user_id as string, p as any);
  }


  /* 転職勧奨禁止除外（`can_send_scout()` の条件4と二重の守り）。
     ⚠️★`ow_placements.candidate_id` は **auth 空間**（auth.users を指す FK）。
        2026-10-09 まで `u.id`（ow_users 空間）と比べていて**一度も当たらなかった**。 */
  const eligibleUsers = (rawUsers ?? []).filter(
    (u: any) => !blockedCandidateIds.has(u.auth_id as string),
  );

  /* can_send_scout RPC（自社在籍者・手動ブロックの除外）。
     ⚠️★スカウト廃止後も**消さない**（名前に反して「見せてよいか」の判定）。 */
  const canSendResults = await Promise.all(
    eligibleUsers.map(async (u: any) => {
      const authId = u.auth_id as string | null;
      if (!authId) return false;
      /* ⚠️ error を捨てない（2026-08-20）。失敗すると `data !== true` で
            **その候補者が黙って一覧から消える**（fail-closed だが気づけない）。 */
      const { data, error } = await adminClient.rpc("can_send_scout", {
        p_company_id: ctx.tenantId,
        p_candidate_id: authId,
      });
      if (error) console.error("[candidates] can_send_scout:", error.message);
      return data === true;
    })
  );

  // 現職情報 + 在籍期間（employment_type・started_at 追加）
  /* ⚠️★`error` を捨てない（2026-09-12）。捨てていたせいで、出向先の FK が増えて
        埋め込みが PGRST201 になったことに**24時間気づけなかった**（会社名が全員空になった）。 */
  const { data: currentExps, error: currentExpsErr } = userIds.length > 0
    ? await adminClient
        .from("ow_experiences")
        /* ★`visibility_company` を必ず取る（2026-09-10）。理由は下の置換のコメント。 */
        .select(`user_id, role_title, role_category_id, employment_type, started_at, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
        .in("user_id", userIds)
        .eq("is_current", true)
    : { data: [], error: null };
  if (currentExpsErr) console.error("[biz/candidates] ow_experiences:", currentExpsErr.message);

  /* ★社会人年数の元データ（2026-08-20）。
     ⚠️ 上の `currentExps` は `is_current=true` だけなので使えない。
        社会人年数は**すべての職歴のうち最も古い started_at** から出す。
     ⚠️ **その都度計算する。列にもトリガーにもしない。**
        職歴を1件足した瞬間に変わる値なので、保存すると必ず古くなる
        （`ow_profiles.experience_years` を自動計算に置き換えた 2026-08-07 と同じ理由）。 */
  /* ★`ended_at` と `role_category_id` も取る（2026-09-20）。「できること」の材料。
     ⚠️★**`company_id` は取らない。** 取ると事業領域が引けてしまい、
        社名を伏せた職歴の属性が企業側に漏れる（`buildRoleAutoSkills` の注記）。 */
  const { data: allExpStarts, error: allExpErr } = userIds.length > 0
    ? await adminClient
        .from("ow_experiences")
        .select("user_id, started_at, ended_at, role_category_id")
        .in("user_id", userIds)
    : { data: [], error: null };
  /* ⚠️ error を捨てない。捨てると社会人年数も「できること」も黙って空になる。 */
  if (allExpErr) console.error("[biz/candidates] ow_experiences(all):", allExpErr.message);

  const startedAtsByUser = new Map<string, string[]>();
  /** ★「できること」の材料。⚠️ 現職だけでなく**全職歴**を足して年数にする */
  const expRowsByUser = new Map<string, { started_at: string | null; ended_at: string | null; role_category_id: string | null }[]>();
  for (const e of allExpStarts ?? []) {
    const uid = (e as { user_id: string }).user_id;
    const row = e as { started_at: string | null; ended_at: string | null; role_category_id: string | null };
    if (!expRowsByUser.has(uid)) expRowsByUser.set(uid, []);
    expRowsByUser.get(uid)!.push(row);
    if (!row.started_at) continue;
    if (!startedAtsByUser.has(uid)) startedAtsByUser.set(uid, []);
    startedAtsByUser.get(uid)!.push(row.started_at);
  }

  const currentExpByUser = new Map<string, {
    role_title: string | null;
    role_category_id: string | null;
    company: string | null;
    employment_type: string | null;
    started_at: string | null;
  }>();
  for (const exp of currentExps ?? []) {
    if (!currentExpByUser.has(exp.user_id as string)) {
      // master（company_id → ow_companies.name）を最優先。
      // ここは以前 company_text だけを見ていたため、マスタ紐づけの職歴
      // （2026-08-03 時点で 18件中13件）が全て社名なしで表示されていた。
      /* ★★本人が社名を伏せている行は、社名を出さない（2026-09-10）。
         ⚠️★**`createAdminClient`（RLS バイパス）で引いているので、条件を書かないと
            全件が実名で出る。** 2026-08-13 に `/biz/employees` で同じ問題を踏んでいる。
            そのときのコメントがこの判断の根拠:
              「伏せた人が気にしているのは**社名が出ること**ではなく
               **転職を考えていると今の会社に知られること**なので、
               ここに出るのはチェックボックスの文面から誰も予想できない」
         ⚠️★**空欄にしないこと。** 空にすると企業側から「離職中」または「未入力」に見え、
            社名が出るのとは別の不利益を本人に与える。**伏せてあることが分かる形にする。**
         ⚠️★**`masked` と `hidden` で表示を分けない。** 候補者検索は「どの会社の人か」で
            絞る画面なので、代替ラベル（「SaaS（シリーズB・50名規模）」）は絞り込みに使えず、
            置いても企業側に**新しい状態が1つ増えるだけ**。`hidden` は `masked` より強い
            意思なので、弱い表示にもできない。**どちらも同じ扱いにする。**
         ⚠️★**文言は既存の語彙に揃えてある。** `generateMaskedCompanyLabel()`
            （`lib/utils/timeline.ts`）のフォールバックと同じ文字列。新しく作らない。
         ⚠️★**表示だけでなく絞り込みもこれで塞がる。** クライアント側の会社名フィルタと
            フリーワードは**どちらもこの `currentCompany` を読む**ので、
            ここで置き換えれば「表示は伏せたが検索では当たる」が起きない。
            ⚠️ フィルタ側に社名の生値を渡す経路を新しく作らないこと。 */
      const vis = (exp as { visibility_company?: string | null }).visibility_company ?? "real";
      const company = vis === "real"
        ? resolveExperienceCompanyName(exp)
        : MASKED_COMPANY_LABEL;
      currentExpByUser.set(exp.user_id as string, {
        role_title: exp.role_title as string | null,
        role_category_id: exp.role_category_id as string | null,
        company,
        employment_type: exp.employment_type as string | null,
        started_at: exp.started_at as string | null,
      });
    }
  }

  // 職種（ow_roles）。
  // ⚠️ 2026-08-04 まで自由記述のスキルタグを出していた。
  //    表記揺れがあり絞り込みの精度が出ないため、マスタに紐づいた職種に置き換えた。
  //    子階層があれば子（フィールドセールス）、無ければ大分類（営業）を出す。
  const roleTree = await getRoleTree();

  /* ★「できること」用の職種マスタ（2026-09-20）。名前＋親の名前。
     ⚠️ 親の名前は「子職種を親名でも当てる」ために要る（`computeAutoSkills` の規則）。
     ⚠️★**ここで帯の規則を書かないこと。** 年数の帯は `lib/profile/autoSkills.ts` の
        `BANDS`（YOUTRUST 相当の5段階／2026-08-29 に柴さんが指定）が唯一の正。 */
  const roleInfoById = new Map<string, { name: string; parent_name: string | null }>();
  roleTree.byId.forEach((node, id) => {
    const parent = node.parentId ? roleTree.byId.get(node.parentId) : undefined;
    roleInfoById.set(id, { name: node.name, parent_name: parent?.name ?? null });
  });

  // 希望職種（ow_profile_desired_roles）。auth.users.id 引き
  const desiredByAuthId = await getDesiredRolesFor(
    eligibleUsers.map((u: any) => u.auth_id as string | null).filter((id: string | null): id is string => !!id)
  );


  /* ★企業からの「声かけ」。送れるかは DB 関数 `can_send_company_approach()` の1か所（2026-10-10 / 段2）。
       受け取る設定・受け取る範囲・受け取らない企業・送る担当者との is_test 一致まで、すべてその中で見る。
       ⚠️★ここで条件を組み立てないこと。送信の API（`isApproachTarget`）と同じ関数なので、
          ボタンの表示と API の結果は食い違わない。
       ⚠️ 取得に失敗したら null → ボタンを出さない（fail-closed）。 */
  const approachAllowed = canUse(ctx.planType, "companyApproach");
  const approachOk = approachAllowed
    ? await approachTargets({
        companyId: ctx.tenantId,
        senderOwUserId: ctx.currentOwnId,
        candidateOwUserIds: eligibleUsers.filter((_u: any, i: number) => canSendResults[i] === true).map((u: any) => u.id as string),
      })
    : null;
  const recentlyApproached = approachAllowed
    ? await getRecentlyApproached(ctx.tenantId, eligibleUsers.map((u: any) => u.id as string))
    : new Map<string, RecentApproach>();

  /* ★社内の状態（2026-10-10 / 段5）。フラグがオンのときだけ。⚠️ 取れなければ null（カードに出さない） */
  const notesEnabled = isCandidateNotesEnabled();
  const stages = notesEnabled
    ? await listCandidateStages(ctx.tenantId, eligibleUsers.filter((_u: any, i: number) => canSendResults[i] === true).map((u: any) => u.id as string))
    : null;

  const candidates = eligibleUsers
    .filter((_u: any, i: number) => canSendResults[i] === true)
    .map((u: any) => {
      const authId = u.auth_id as string | null;
      const profile = authId ? (profilesByAuthId.get(authId) ?? null) : null;
      const currentExp = currentExpByUser.get(u.id as string) ?? null;
      return {
        id: u.id as string,
        name: (u.name as string) || "名前未設定",
        /* ★★本人が書いた1行（`ow_users.headline`。2026-09-23 / 柴さんの指示）。
              ⚠️★**それまで `/biz` 配下は headline を1ファイルも参照していなかった**のに、
                 本人側の入力欄には「一覧や**スカウト画面**で最初に読まれる行です」と（2026-10-08 に「企業の候補者検索」へ改めた）
                 書いてあった（守れない約束）。ここに出して初めて本当になる。
              ⚠️ 空文字は null に畳む（空の行を1本出さないため）。
              ⚠️★**公開情報。** `/u/[id]` の氏名の下に出ているものと同じで、
                 `visibility_company`（勤務先を伏せる設定）とは無関係。 */
        headline: ((u.headline as string | null) ?? "").trim() || null,
        location: (u.location as string) || null,
        /* ★「転職検討中」バッジの根拠を `ow_users.is_open_to_work`（boolean）から
              `ow_profiles.career_stance` に付け替えた（2026-08-26 / フェーズ2）。
           ⚠️ **バッジを出すのは `active`（積極的に検討中）だけ。** 移行では
              `is_open_to_work = true` の3件だけを `active` に写しているので、
              **この画面に出る顔ぶれは変わらない**（移行前後で実測して確認済み）。
           ⚠️ `open`（いい話があれば聞きたい）でバッジを出すかは**別の判断**。
              広げると「検討中」の意味が変わるので、決めてから足すこと。 */
        isActivelyLooking: profile?.career_stance === "active",
        /* ★★転職意欲そのものと、その更新日時（2026-09-19 / 柴さんの指示）。
              ⚠️ 母集合は既に `no_contact` と未設定を落としてあるので、ここに来るのは
                 `active` / `open` / `researching` の3値のいずれか。
              ⚠️★**更新日時は `career_stance_updated_at`。** `stance_updated_at` は
                 面談OK の操作でも動くので使わない（select のコメント参照）。
              ⚠️ **NULL を「古い」に倒さない。** 2026-09-19 に入れた列なので、
                 それ以前に答えた人は NULL のまま（実測: 実ユーザー9人中、
                 `stance_updated_at` があるのは4人だが、新しい列は全員 NULL から始まる）。
                 絞り込み側は NULL を**落とすだけ**で、日付を作らない。 */
        careerStance: (profile?.career_stance as string | null) ?? null,
        careerStanceUpdatedAt: (profile?.career_stance_updated_at as string | null) ?? null,
        /* ⚠️ 職歴が0件なら `calcTotalExperience` が null を返す。**0年で埋めない**
              （新卒と未登録が同じになる。CLAUDE.md「値が無いことを、ある値に置き換えない」）。
              絞り込み側は null を落とさず、そのまま表示する。 */
        tenureMonths: calcTotalExperience(startedAtsByUser.get(u.id as string) ?? [])?.months ?? null,
        currentRole: currentExp?.role_title ?? null,
        currentCompany: currentExp?.company ?? null,
        employmentType: currentExp?.employment_type ?? null,
        startedAt: currentExp?.started_at ?? null,
        roleName: (() => {
          const rid = currentExp?.role_category_id;
          return rid ? roleTree.byId.get(rid)?.name ?? null : null;
        })(),
        topRoleName: (() => {
          const top = resolveTopRole(roleTree, currentExp?.role_category_id);
          return top?.name ?? null;
        })(),
        /* 希望職種は ow_profile_desired_roles（複数可）。
           ⚠️ 絞り込みは expandedIds（職種＋祖先）、表示は names（選ばれたものだけ）。
              展開後の名前を出すと、選んでいない「営業」まで出て嘘になる。 */
        desiredRoleIds: authId ? (desiredByAuthId.get(authId)?.expandedIds ?? []) : [],
        desiredRoleNames: authId ? (desiredByAuthId.get(authId)?.names ?? []) : [],
        workStyles: (profile?.desired_work_styles as string[] | null) || null,
        /* 希望勤務地。⚠️ 表示のみ。絞り込みUIの追加は別タスク。 */
        desiredPrefectures: (profile?.desired_prefectures as string[] | null) || null,
        /* ⚠️ NULL のときは鮮度を出さない。「不明」とも書かない（既存39件は全て NULL） */
        desiredSalaryMin: profile?.desired_salary_min ?? null,
        desiredSalaryMax: profile?.desired_salary_max ?? null,
        onboardingCompleted: profile?.onboarding_completed || false,
        createdAt: u.created_at as string,
        /* ★「できること」（職種 × 年数）。2026-09-20。
           ⚠️ 本人が選んだスキルではなく**職歴からの計算**。保存しない（都度計算）。
           ⚠️★カードが狭いので**上位4件まで**。全部見るのはプロフィール側。 */
        autoSkills: buildRoleAutoSkills(expRowsByUser.get(u.id as string) ?? [], roleInfoById)
          .slice(0, 4)
          .map((sk) => ({ label: sk.label, band: sk.band })),
        /* ⚠️ 取得に失敗した（recentlyApproached が null）ときはボタンを出さない（fail-closed） */
        approach: approachAllowed && recentlyApproached && approachOk
          ? {
              eligible: approachOk.get(u.id as string) === true,
              sent: recentlyApproached.get(u.id as string) ?? null,
            }
          : undefined,
        /* ★社内の状態（段5）。undefined = フラグがオフか取れなかった（カードに出さない） */
        stage: stages ? (stages.get(u.id as string) ?? null) : undefined,
      };
    });

  /* 職種フィルタ用の階層。ow_roles を正にする（JOB_TYPES の自由文字列は廃止）。
     ⚠️ 大分類を選んだら配下の子も当たるよう、候補者側は祖先まで展開済みの
        desiredRoleIds を持たせてある。クライアントは includes() で判定するだけ。
     ⚠️ is_it_saas = true の10件に絞る。非IT系の大分類7件（医療・介護・福祉 等）は
        **過去の職歴を書くために用意した葉**で子を持たず、
        IT の候補者サーチで「希望職種」として出しても選ばれない。 */
  const { data: itSaasTopRows } = await adminClient
    .from("ow_roles").select("id").is("parent_id", null).eq("is_active", true).eq("is_it_saas", true);
  const itSaasTopIds = new Set((itSaasTopRows ?? []).map((r) => r.id as string));
  const roleFilterTree = roleTree.topLevel
    .filter((top) => itSaasTopIds.has(top.id))
    .map((top) => ({
      id: top.id,
      name: top.name,
      children: Array.from(roleTree.byId.values())
        .filter((r) => r.parentId === top.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((r) => ({ id: r.id, name: r.name })),
    }));

  const layoutProps = {
    userName: ctx.userName,
    tenantName: ctx.tenantName,
    tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter,
    memberships: ctx.allCompanies,
    currentTenantId: ctx.tenantId,
  };


  return (
    <BusinessLayout {...layoutProps}>
      <CandidatesClient candidates={candidates} roleFilterTree={roleFilterTree} />
    </BusinessLayout>
  );
}
