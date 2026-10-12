/**
 * ★候補者と企業の「接点」の事実と、その文（2026-10-10 / 提案の根拠に求人・部門と職種・業界の経験を足す）。
 *
 * ⚠️★**同じ事実を、候補者探しの「貴社との接点」と提案の根拠で別の言い方にしないため、文はここ1か所で作る。**
 *    判定は `lib/business/candidates/touchpoints.ts`（`getCompanyCandidateTouchpoints`）の1か所。
 *    候補者探しは `fitText(fact, "company")`、提案は表示するときに見る人に合わせて `fitText(fact, audience)`。
 *
 * ⚠️★**提案に保存するのは事実だけ（`Evidence.fact`）。文は表示するときに作る。**
 *    スナップショット（`ow_proposals.evidence`）は企業と候補者の両方が読むので、
 *    人称の入った文を保存すると、片方に相手向けの文が出る（2026-09-18 に踏んだ。engine.ts の `Audience`）。
 *    既存の4種類（same_path など）は人称の無い文を保存しているので、そのまま `label` を出す。
 *
 * ⚠️★**このファイルは何も import しない**（型の import だけ。素の Node の型ストリップで消える）。
 *    `engine.ts` のテストと、クライアントの `EvidenceList` から読むため。
 */

import type { Evidence } from "./engine";

export type FitAudience = "company" | "candidate";

export type FitFact =
  /** ① 求人の職種 × 経験職種。months は経験の合計月数。
   *  ★2026-10-12: 求人が経験年数を求めていて満たすときだけ requiredYears と roleName（候補者が経験した職種名）が入る。
   *  ⚠️ 2026-10-12 より前に保存された提案の事実には無い（無ければ従来の文） */
  | { kind: "job_role"; jobId: string; jobTitle: string; months: number; requiredYears?: number; roleName?: string }
  /** ② 企業が登録した職種（部門）× 経験職種／関心のある職種。
   *  ★2026-10-12: 何と何が一致したかを具体的に書くため、候補者側の職種名（expRoleName / desiredRoleName）を持つ。
   *  ⚠️ それより前に保存された事実には無い（無ければ従来の文） */
  | { kind: "company_role"; companyJobRoleId: string; roleName: string; departments: string[]; byExperience: boolean; byDesired: boolean; expRoleName?: string; desiredRoleName?: string; standardRoleName?: string }
  /** ④a 企業の顧客の業界 × 職歴の業種 */
  | { kind: "target_industry"; industryId: string; industryName: string }
  /** ④b 企業の事業領域 × 前の勤務先の事業領域 */
  | { kind: "business_domain"; domainIds: string[]; domainNames: string[] };

function yearsLabel(months: number): string | null {
  return months >= 12 ? `経験${Math.floor(months / 12)}年` : null;
}

/** 事実 → 1文。⚠️ 文はここ以外で組み立てないこと */
export function fitText(fact: FitFact, audience: FitAudience): string {
  switch (fact.kind) {
    case "job_role": {
      /* ★経験年数を満たす（2026-10-12）。例: 「フィールドセールスを5年経験（求人『FS』の求める経験：3年以上）」 */
      if (fact.requiredYears && fact.roleName) {
        const years = Math.floor(fact.months / 12);
        return audience === "company"
          ? `${fact.roleName}を${years}年経験（求人『${fact.jobTitle}』の求める経験：${fact.requiredYears}年以上）`
          : `あなたの${fact.roleName}の経験${years}年は、求人『${fact.jobTitle}』の求める経験（${fact.requiredYears}年以上）を満たしています`;
      }
      const y = yearsLabel(fact.months);
      return audience === "company"
        ? `求人『${fact.jobTitle}』と同じ職種の経験があります${y ? `（${y}）` : ""}`
        : `あなたの経験と同じ職種の求人『${fact.jobTitle}』があります${y ? `（あなたの経験：${Math.floor(fact.months / 12)}年）` : ""}`;
    }
    case "company_role": {
      /* ★何と何が一致したかを書く（2026-10-12）。例: 「関心のある職種『FS』が、営業部の職種『FS』と一致」 */
      if (fact.expRoleName || fact.desiredRoleName) {
        const target = `${fact.departments.length ? `${fact.departments.join("・")}の` : "貴社の"}職種『${fact.roleName}』`;
        const mine = [
          fact.byExperience && fact.expRoleName ? `経験した職種『${fact.expRoleName}』` : null,
          fact.byDesired && fact.desiredRoleName ? `関心のある職種『${fact.desiredRoleName}』` : null,
        ].filter(Boolean).join("・");
        /* ⚠️ 親子（「営業」と「インサイドセールス」）で合ったときは「一致」と言わない。同じ職種のときだけ「一致」 */
        const names = [fact.byExperience ? fact.expRoleName : null, fact.byDesired ? fact.desiredRoleName : null].filter(Boolean);
        const exact = !!fact.standardRoleName && names.every((n) => n === fact.standardRoleName);
        const tail = exact ? "と一致" : "と同じ系統の職種です";
        return audience === "company"
          ? `${mine}が、${target}${tail}`
          : `あなたの${mine}が、${target.replace("貴社の", "この会社の")}${tail}`;
      }
      const where = fact.departments.length ? `部門『${fact.departments.join("・")}』の職種` : `職種『${fact.roleName}』`;
      const what = fact.byExperience && fact.byDesired ? "経験職種・関心のある職種" : fact.byExperience ? "経験職種" : "関心のある職種";
      return audience === "company" ? `${where}と、${what}が合っています` : `あなたの${what}が、${where}と合っています`;
    }
    case "target_industry":
      return audience === "company"
        ? `貴社の顧客の業界（${fact.industryName}）での経験があります`
        : `あなたが経験した業界（${fact.industryName}）は、この会社の顧客の業界です`;
    case "business_domain":
      return audience === "company"
        ? `同じ事業領域（${fact.domainNames.join("・")}）の会社での経験があります`
        : `あなたが経験した会社と同じ事業領域（${fact.domainNames.join("・")}）の会社です`;
  }
}

/**
 * 提案の根拠1件 → 画面に出す1文。
 * ⚠️ 事実（`fact`）を持つものは見る人に合わせて作り、持たないもの（既存の4種類）は保存された文をそのまま出す。
 */
export function evidenceText(e: Pick<Evidence, "label" | "fact">, audience: FitAudience): string {
  if (e.fact) return fitText(e.fact, audience);
  return e.label ?? "";
}
