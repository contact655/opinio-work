import Link from "next/link";
import { can } from "@/lib/auth/roles";
import { guardBizPage } from "@/lib/auth/companyAccess";
import { PROFILE_CLIENT_MODULES } from "@/components/candidates/profileClientModules";
/* ★右欄（候補者のプロフィール）の中身が使う client コンポーネントを、このページから参照しておく（profileClientModules.ts の注記） */
void PROFILE_CLIENT_MODULES;
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import CandidatesClient from "./CandidatesClient";
import { canUse } from "@/lib/constants/plans";
import { isCompanyReviewed, COMPANY_REVIEW_BLOCKED_MESSAGE } from "@/lib/business/scoutGate";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { isCandidateNotesEnabled } from "@/lib/candidateNotes/server";
import { isCandidateAgeFilterEnabled } from "@/lib/business/candidates/ageFilter";
import { isCandidateActivityEnabled } from "@/lib/business/candidates/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { ensureLastViewed, getSavedSearchForViewer } from "@/lib/business/savedSearchServer";
import { parseSavedFilters, type SavedCandidateFilters } from "@/lib/business/savedSearch";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "候補者を探す | OPINIO Business" },
};

export default async function CandidatesPage({ searchParams }: { searchParams?: { selected?: string; saved?: string; new?: string; approach?: string; f?: string; position?: string } }) {
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
  /* ★役割（2026-10-12）。権限が無ければホームへ（サイドバーにも出していない） */
  guardBizPage(ctx.currentPermission, "candidates.viewProfile");

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
            審査は、企業ページの「掲載を依頼する」から始まります。審査が完了次第、メールでご連絡します。
          </p>
          {/* ★審査のきっかけへの道（2026-10-19） */}
          <Link href="/biz/company" style={{ display: "inline-block", marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>
            企業ページを編集する →
          </Link>
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
                /* ★2026-10-13: 職種は経験職種と希望職種の2軸。会社名・社内での呼び方は検索窓に一本化。
                      希望年収・働き方の絞り込みは外した。居住地は本人のお住まい（希望勤務地ではない） */
                "経験職種", "希望職種", "キーワード（名前・職種・会社・居住地）",
                "雇用形態", "社会人年数", "居住地",
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

  /* ⚠️★★スカウトは 2026-10-08 に廃止した（提案に一本化）。**戻さないこと。**
     ★母集団・判定・候補者の形は `lib/business/candidates/load.ts` の1か所（2026-10-10 に切り出した）。
        段3の新着メールも同じ関数を呼ぶ。⚠️ ここに条件を書き戻さないこと。 */
  const [{ candidates, limitReached, roleFilterTree, approachJobs, touchpointMaterials, positions, positionFits, testMismatch }, coRow] = await Promise.all([
    loadCompanyCandidates({
      companyId: ctx.tenantId,
      viewerOwUserId: ctx.currentOwnId,
      planType: ctx.planType,
    }),
    /* ⚠️ 企業側の上限（返事待ち10件）の1行は 2026-10-18 に枠ごと外した */
    /* ★カードの「〈会社名〉と合うところ（〇）」の会社名（プレビューと同じ表示名。2026-10-11） */
    createAdminClient().from("ow_companies").select("name, name_en").eq("id", ctx.tenantId).maybeSingle(),
  ]);
  if (coRow.error) console.error("[biz/candidates] ow_companies:", coRow.error.message);
  const companyShortName = coRow.data ? companyDisplayName(coRow.data.name as string, (coRow.data.name_en as string | null) ?? null).displayName : null;

  /* ★保存した条件で開く（段3）。`?saved=<id>`（この条件で探す）／`&new=1`（新着を見る）。
     ⚠️ 見られる条件（自分のもの・共有）だけ。新着の基準は**開く前**の前回見た日時
        （前回見た日時を今にするのは、画面が開いたあとクライアントから）。 */
  let initialSaved: { id: string; name: string; filters: import("@/lib/business/savedSearch").SavedCandidateFilters; newSince: string | null } | null = null;
  if (searchParams?.saved && /^[0-9a-f-]{36}$/.test(searchParams.saved)) {
    const sv = await getSavedSearchForViewer({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, id: searchParams.saved });
    if (sv) {
      const since = (await ensureLastViewed([sv.id], ctx.currentOwnId)).get(sv.id) ?? null;
      initialSaved = { id: sv.id, name: sv.name, filters: sv.filters, newSince: searchParams.new === "1" ? since : null };
    }
  }

  /* ★URL の条件（`?f=`。2026-10-12）。保存した条件と同じ形の JSON を `parseSavedFilters` で読む（知らないキー・壊れた値は捨てる）。
     ⚠️ 読めなければ条件なしで開く（エラーにしない）。保存した条件で開いたとき（`?saved=`）はそちらが優先 */
  let initialFilters: SavedCandidateFilters | null = null;
  if (searchParams?.f && searchParams.f.length <= 4000) {
    try { initialFilters = parseSavedFilters(JSON.parse(searchParams.f)); } catch { initialFilters = null; }
  }

  const layoutProps = {
    userName: ctx.userName,
    tenantName: ctx.tenantName,
    tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter,
    memberships: ctx.allCompanies,
    currentTenantId: ctx.tenantId,
  };


  return (
    /* ★2列（一覧＋右のプレビュー）なので本文の最大幅を外す（2026-10-13 / 柴さんの指示。それまでは 1440px）。
          一覧と詳細の幅を3段で切り替えるため、1680・1920 の画面で余白を残さない。⚠️ この画面だけ。他の画面は変えない */
    <BusinessLayout {...layoutProps} mainMaxWidth="none">
      <CandidatesClient candidates={candidates} roleFilterTree={roleFilterTree}
        canAct={can(ctx.currentPermission, "candidates.search")}
        initialSaved={initialSaved}
        initialFilters={initialFilters}
        companyShortName={companyShortName}
        /* ★右欄が使う会社の材料（2026-10-13）。右欄は一覧の Candidate とこれで描く（1人ずつ取り直さない） */
        approachJobs={approachJobs}
        positions={positions}
        positionFits={positionFits}
        initialPosition={/^[0-9a-f-]{36}$/.test(searchParams?.position ?? "") ? searchParams!.position! : null}
        touchpointMaterials={touchpointMaterials}
        notesEnabled={isCandidateNotesEnabled()}
        limitReached={limitReached}
        /* ★検証用かどうかが担当者と合わない人を外したときの1行（2026-10-26） */
        testMismatch={testMismatch}
        /* ⚠️ 名前が引けないときの「ご担当者」（getTenantContext の最後の倒し先）は名前として渡さない */
        viewerName={ctx.userName && ctx.userName !== "ご担当者" ? ctx.userName : null}
        /* ★段（一覧と詳細の幅）を覚えるキーに使う（会社・担当者ごと。2026-10-13） */
        stageStorageKey={`biz-cand-stage:${ctx.tenantId}:${ctx.currentOwnId}`}
        /* ★右欄の2列表示（プロフィール｜メッセージ）の比率を覚えるキー（外側とは別。2026-10-13） */
        columnsStorageKey={`biz-cand-cols:${ctx.tenantId}:${ctx.currentOwnId}`}
        /* ★年齢の絞り込み・並び替え（本番は無効。CANDIDATE_AGE_FILTER_ENABLED） */
        ageFilterEnabled={isCandidateAgeFilterEnabled()}
        /* ★最近の利用（本番は無効。CANDIDATE_ACTIVITY_ENABLED） */
        activityEnabled={isCandidateActivityEnabled()}
        /* ⚠️ 一覧に居ない id は開かない（プレビューの API も 404 を返す）。uuid の形だけ確かめる */
        initialSelected={/^[0-9a-f-]{36}$/.test(searchParams?.selected ?? "") ? searchParams!.selected! : null} />
    </BusinessLayout>
  );
}
