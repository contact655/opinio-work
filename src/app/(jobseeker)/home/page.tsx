import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSimilarPaths } from "@/lib/companyFlow/server";
import type { SimilarPaths } from "@/lib/companyFlow/compute";
import { reasonStatusForUser, companyKey } from "@/lib/experiences/reasonAnswers";
import { EXPERIENCE_COMPANY_COLS, resolveExperienceCompanyLabel } from "@/lib/experiences/companyName";
import { loadTurnTendency } from "@/lib/careerTurns/server";
import { buildForYou } from "@/lib/forYou/rank";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";
import { formatMonths } from "@/lib/profile/tenure";
import { chipStyle } from "@/lib/utils/chipVariant";
import ForYouSection from "../mypage/proposals/ForYouSection";
import { toForYouViews } from "../mypage/proposals/forYouViews";
import HomeTurnCard from "./HomeTurnCard";
import { homeStateOf, homeHeadline, HOME_FOR_YOU_LIMIT } from "@/lib/home/homeState";

/**
 * ★ホーム「あなたの次の一手」（2026-10-27 / 柴さんの決定）。ログイン後の着地。
 *
 *   状態 A 職歴なし         … 職歴1件の入力 → 合う会社
 *   状態 B 振り返り0件       … 振り返りの1問目 → 似た経歴の集計（出せる人だけ）→ 合う会社
 *   状態 C 集計が下限未満    … 本人の傾向 → 合う会社
 *   状態 D 集計が出せる      … 似た経歴の集計 → 合う会社 → 本人の傾向 → 振り返りの進み具合
 * ⚠️★どの状態でも空の箱を出さない（中身が無いブロックは描かない）
 * ⚠️ 似た経歴の集計は lib/companyFlow の computeSimilarPaths（「人の流れ」と同じ規則・同じ下限）。必ず「〇人の動きから」を添える
 * ⚠️ 1年後に合っていた割合は5人分たまるまで項目ごと出さない（文言も出さない）。見出しもそれに合わせて切り替える（homeHeadline）
 * ⚠️ 認証は middleware の needsAuth にも入れてある（loading の境界の内側の redirect は 200 になるため）
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "ホーム | OPINIO" },
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=%2Fhome");
  const db = createAdminClient();
  const { data: me, error: meErr } = await db.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[home] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fhome");
  const owId = me.id as string;

  const [expRes, status, forYou, proposedRes] = await Promise.all([
    db.from("ow_experiences").select(`id, started_at, is_current, ${EXPERIENCE_COMPANY_COLS}`).eq("user_id", owId),
    reasonStatusForUser(owId),
    buildForYou(owId),
    db.from("ow_proposals").select("company_id").eq("candidate_user_id", owId),
  ]);
  if (expRes.error) console.error("[home] experiences:", expRes.error.message);
  if (proposedRes.error) console.error("[home] proposals:", proposedRes.error.message);
  type Exp = { id: string; started_at: string | null; is_current: boolean | null; company_id: string | null; company_text: string | null; company_anonymized: string | null; ow_companies: { name: string | null; name_en: string | null } | null };
  const exps = (expRes.data ?? []) as unknown as Exp[];

  /* ★振り返りの進み具合。/mypage の帯（「N つの転機のうち M つ回答済み」）と同じ数え方（会社ごと・答えた＝2） */
  const companies = new Set(exps.map((e) => companyKey(e)));
  const done = new Set(exps.filter((e) => status?.[e.id] === 2).map((e) => companyKey(e)));
  const latest = [...exps].filter((e) => e.started_at)
    .sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true) || (b.started_at as string).localeCompare(a.started_at as string))[0] ?? null;

  const similar = exps.length > 0 ? await getSimilarPaths(owId) : { key: null, summary: null };
  const state = homeStateOf({ hasExperience: exps.length > 0, answeredTurns: done.size, hasSimilar: !!similar.summary });
  const tendency = state === "C" || state === "D" ? await loadTurnTendency(owId) : null;

  const proposed = new Set(((proposedRes.data ?? []) as { company_id: string }[]).map((p) => p.company_id));
  const forYouViews = toForYouViews(forYou, me.is_test === true, proposed);
  const latestName = latest ? resolveExperienceCompanyLabel({ ...latest, visibility_company: "real" }) ?? "直近の会社" : null;

  const forYouBlock = (
    <ForYouSection
      companies={forYouViews}
      loadFailed={!forYou.ok}
      noReasons={false}
      declineReasons={CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label }))}
      compact={{ limit: HOME_FOR_YOU_LIMIT, moreHref: "/mypage/proposals", title: "あなたに合う会社" }}
    />
  );

  return (
    <main data-state={`home-${state}`} style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px", display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {/* ⚠️ この style タグの中に不等号や山かっこを書かないこと（ハイドレーションが壊れる） */}
      <style>{`
        .home-box { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 16px; min-width: 0; }
        .home-h2 { font-size: 17px; font-weight: 800; color: var(--ink); margin: 0; line-height: 1.5; }
        .home-lead { font-size: 12.5px; color: var(--ink-mute); line-height: 1.8; margin: 6px 0 0; }
        @media (max-width: 767px) { .home-box { padding: 16px 14px 14px; } .home-h2 { font-size: 16px; } }
      `}</style>

      {state === "A" && (
        <section data-state="home-first-experience" className="home-box">
          <h2 className="home-h2">直近の職歴を1件入れましょう</h2>
          <p className="home-lead">
            会社と職種と入社年月だけで入れられます。入れると、あなたと似た経歴の人の動き方と、あなたに合う会社の理由が出ます。
          </p>
          <Link href="/mypage?add=career" data-action="home-add-experience"
            style={{ display: "inline-block", marginTop: 12, padding: "9px 18px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>
            職歴を入れる
          </Link>
        </section>
      )}

      {state === "B" && latest && latestName && <HomeTurnCard experienceId={latest.id} companyName={latestName} />}

      {(state === "B" || state === "D") && similar.summary && similar.key && (
        <SimilarBlock s={similar.summary} k={similar.key} />
      )}

      {state === "D" && forYouBlock}
      {state === "C" && tendency && tendency.length > 0 && <TendencyBlock lines={tendency} />}
      {state !== "D" && forYouBlock}
      {state === "D" && tendency && tendency.length > 0 && <TendencyBlock lines={tendency} />}

      {state === "D" && companies.size > 0 && (
        <section data-state="home-progress" className="home-box">
          <h2 className="home-h2">提案の精度を上げる</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            {`${companies.size}つの転機のうち${done.size}つ回答済み`}
          </p>
          {done.size < companies.size && (
            <Link href="/mypage#career" style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
              続きを答える →
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

/** ★似た経歴の人の動き方。見出しは出せる中身で切り替える。必ず「〇人の動きから」を添える */
function SimilarBlock({ s, k }: { s: SimilarPaths; k: { roleLabel: string; industryLabel: string } }) {
  const chip = chipStyle("neutral");
  const Rows = ({ rows }: { rows: { label: string; count: number }[] }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rows.map((r) => (
        <span key={r.label} style={{ display: "inline-flex", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, maxWidth: "100%" }}>
          {r.label}<span style={{ fontWeight: 700, color: "var(--ink-soft)" }}>{r.count}人</span>
        </span>
      ))}
    </div>
  );
  const Item = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
  return (
    <section data-state="home-similar" className="home-box">
      <h2 className="home-h2">{homeHeadline(!!s.fitAfterYear)}</h2>
      <p className="home-lead" data-state="home-similar-basis">
        直近の職歴が「{k.roleLabel} × {k.industryLabel}」の人を、似た経歴としています。
        <strong style={{ color: "var(--ink)" }}>{s.movers}人の動きから</strong>数えています（あなたは含みません）。業界と職種は大分類でまとめ、人数の少ない項目は出していません。
      </p>
      <div style={{ display: "grid", gap: 14, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
        {s.next && <Item title="移った先の業界"><Rows rows={s.next.byIndustry} /></Item>}
        {s.nextRoles && <Item title="移った先の職種"><Rows rows={s.nextRoles.byRole} /></Item>}
        {s.tenure && (
          <Item title="移る前の会社での在籍（平均）">
            <strong style={{ fontSize: 18, color: "var(--ink)" }}>{formatMonths(s.tenure.avgMonths)}</strong>
          </Item>
        )}
        {s.fitAfterYear && (
          <Item title="入って1年たったころ、合っていた">
            <strong style={{ fontSize: 18, color: "var(--ink)" }}>{s.fitAfterYear.goodShare}%</strong>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 6 }}>{s.fitAfterYear.respondents}人の回答から</span>
          </Item>
        )}
      </div>
    </section>
  );
}

/** ★本人の傾向（転機の回答から作る。本人にだけ出す） */
function TendencyBlock({ lines }: { lines: string[] }) {
  return (
    <section data-state="home-tendency" className="home-box">
      <h2 className="home-h2">あなたの転機の傾向</h2>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="home-lead">あなたの回答だけから作っています。ほかの人には見えません。</p>
    </section>
  );
}
