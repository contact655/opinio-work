import type { Touchpoint } from "@/lib/business/candidates/model";

/**
 * ★「合うところ」の見せ方（2026-10-18 / 柴さんの指示）。**この人の事実を主語にして、合う先をまとめる。**
 *
 *   それまで: 1件ずつ「項目／この人／自社」を並べていた。
 *     ✓ 職種  この人 営業（経験）  Third Box インサイドセールス（営業部）
 *     ✓ 職種  この人 営業（経験）  Third Box フィールドセールス
 *   → 同じ「営業（経験）」と「職種」が何度も出て、自社の名前も毎行出ていた（見ているのは自社の人事なので自明）。
 *   いま:
 *     ✓ 営業の経験   インサイドセールス（営業部）・フィールドセールスに合う
 *
 * ⚠️ 判定（touchpoints.ts）と Touchpoint の形は変えていない。ここは表示だけ（クライアントからも読む）。
 * ⚠️ 並びは touchpoints の順（重い順）を保つ。まとめた行は最初に出た位置に置く。
 */
export type TouchpointGroup = {
  key: string;
  /** この人の事実（「営業の経験」「プロダクトに関心」「東京都在住」） */
  label: string;
  /** 合う先・中身（「インサイドセールス（営業部）・フィールドセールスに合う」）。無ければ null */
  detail: string | null;
  /** カードの1行に並べる短い形（「同業の経験（Salesforce）」など） */
  short: string;
};

/** 「営業 5年（経験）」→「営業 5年の経験」／「プロダクト（関心）」→「プロダクトに関心」／「東京都（居住地）」→「東京都在住」 */
export function personPhrase(person: string): string {
  const m = person.match(/^(.*)（(経験|関心|居住地)）$/);
  if (!m) return person;
  const [, base, src] = m;
  return src === "経験" ? `${base}の経験` : src === "関心" ? `${base}に関心` : `${base}在住`;
}
function baseOf(person: string): string {
  return person.replace(/（(経験|関心|居住地)）$/, "");
}

/** 職種どうしの一致（合う先の職種を1行にまとめる種類） */
const ROLE_KINDS = new Set<Touchpoint["kind"]>(["job_role", "company_role"]);

export function groupTouchpoints(tps: Touchpoint[] | undefined | null): TouchpointGroup[] {
  if (!tps || tps.length === 0) return [];
  const out: TouchpointGroup[] = [];
  const roleIndex = new Map<string, { i: number; ours: string[] }>();
  tps.forEach((t, idx) => {
    const r = t.row;
    if (!r) {
      out.push({ key: `${t.kind}:${idx}`, label: t.text, detail: null, short: t.text });
      return;
    }
    if (t.kind === "business_domain") {
      const base = baseOf(r.person);
      const hasCo = !base.endsWith("の会社");
      out.push({ key: `${t.kind}:${idx}`, label: "同業の経験", detail: r.summary ?? r.ours, short: hasCo ? `同業の経験（${base}）` : "同業の経験" });
      return;
    }
    if (t.kind === "alumni") {
      /* 「株式会社Xの出身」／「貴社に同じ会社の出身者が2名」 */
      const n = r.ours.match(/(\d+)名$/)?.[1];
      out.push({ key: `${t.kind}:${idx}`, label: `${baseOf(r.person)}の出身`, detail: n ? `貴社に同じ会社の出身者が${n}名` : r.ours, short: `${baseOf(r.person)}の出身` });
      return;
    }
    if (t.kind === "business_stage") {
      /* 「株式会社X（シリーズB）の経験」／「同じ事業ステージ」 */
      const [co, stage] = baseOf(r.person).split("・");
      const label = stage ? `${co}（${stage}）の経験` : personPhrase(r.person);
      out.push({ key: `${t.kind}:${idx}`, label, detail: "同じ事業ステージ", short: stage ? `${stage}の経験` : label });
      return;
    }
    const label = personPhrase(r.person);
    if (ROLE_KINDS.has(t.kind) && r.item === "職種") {
      const g = roleIndex.get(label);
      if (g) {
        if (!g.ours.includes(r.ours)) g.ours.push(r.ours);
        out[g.i] = { ...out[g.i], detail: `${g.ours.join("・")}に合う` };
        return;
      }
      roleIndex.set(label, { i: out.length, ours: [r.ours] });
      out.push({ key: `${t.kind}:${idx}`, label, detail: `${r.ours}に合う`, short: label });
      return;
    }
    const detail =
      t.kind === "location" ? `勤務地：${r.ours}`
      : t.kind === "position_level" ? (() => { const m = r.ours.match(/（(求人『.+』)）$/); return m ? `${m[1]}のレベルに合う` : `${r.ours}に合う`; })()
      : t.kind === "target_industry" ? `${r.ours.replace(/^顧客の業界：(.+)$/, "顧客の業界（$1）")}に合う`
      : `${r.ours}に合う`;
    out.push({ key: `${t.kind}:${idx}`, label, detail, short: label });
  });
  return out;
}
