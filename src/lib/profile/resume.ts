/**
 * ★職務経歴書（2026-10-18 / 柴さんの指示。「1人で使って得をする」入口）。
 *   入力済みのプロフィールから、日本の転職でそのまま使える職務経歴書の形を組み立てる。
 *   画面は /mypage/resume（本人だけ）。印刷・PDF の保存はブラウザの印刷で行う。
 *
 * ⚠️★入れないもの: 年収・入社/退職の理由・連絡先（メール・電話）・住所・生年月日・性別。
 *    本人が企業へ渡す書類だが、OPINIO が勝手に入れてよいものではない（必要なら本人が書き足す）。
 * ⚠️ 値が無い項目は出さない（「—」や既定値で埋めない）。
 * ⚠️ この関数は何も import しない（固定データで確かめられるように。テストは scripts/check-resume.mjs）。
 */

export type ResumeExperienceInput = {
  id: string;
  companyName: string | null;
  role: string | null;
  department: string | null;
  rank: string | null;
  employmentType: string | null;
  startedAt: string | null;
  endedAt: string | null;
  isCurrent: boolean;
  description: string | null;
  secondmentCompanyName: string | null;
  /** 会社をまとめる鍵（company_id か、自由入力の社名）。無ければ行ごと */
  companyKey: string | null;
};
export type ResumeAchievementInput = { experienceId: string | null; title: string; value: string | null; unit: string | null; description: string | null };

export type ResumeRole = {
  id: string;
  period: string;
  role: string | null;
  department: string | null;
  rank: string | null;
  employmentType: string | null;
  secondment: string | null;
  description: string | null;
  achievements: string[];
};
export type ResumeCompany = { key: string; name: string; period: string; roles: ResumeRole[] };

/** "2020-07-01" / "2020-07" → "2020年7月"。読めなければ null */
export function ymLabel(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{1,2})/.exec(iso);
  if (!m) return null;
  return `${Number(m[1])}年${Number(m[2])}月`;
}

export function periodLabel(startedAt: string | null, endedAt: string | null, isCurrent: boolean): string {
  const s = ymLabel(startedAt);
  const e = isCurrent ? "現在" : ymLabel(endedAt);
  if (!s && !e) return "";
  return `${s ?? ""}〜${e ?? ""}`;
}

function achievementLine(a: ResumeAchievementInput): string {
  const head = [a.title, [a.value, a.unit].filter(Boolean).join("")].filter((x) => !!x && x.trim()).join("：");
  return a.description?.trim() ? `${head}（${a.description.trim()}）` : head;
}

/**
 * 職歴を会社ごとにまとめる（新しい順）。同じ会社が続く役割は1社の下に並べる。
 * ⚠️ 会社の期間は、まとめた役割の最も古い開始〜最も新しい終了（どれかが在籍中なら「現在」）。
 */
export function buildResumeCompanies(exps: ResumeExperienceInput[], achievements: ResumeAchievementInput[]): ResumeCompany[] {
  const sorted = [...exps].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.startedAt ?? "").localeCompare(a.startedAt ?? "");
  });
  const achBy = new Map<string, string[]>();
  for (const a of achievements) {
    if (!a.experienceId) continue;
    const line = achievementLine(a);
    if (line) achBy.set(a.experienceId, [...(achBy.get(a.experienceId) ?? []), line]);
  }
  const out: ResumeCompany[] = [];
  for (const e of sorted) {
    const role: ResumeRole = {
      id: e.id,
      period: periodLabel(e.startedAt, e.endedAt, e.isCurrent),
      role: e.role?.trim() || null,
      department: e.department?.trim() || null,
      rank: e.rank?.trim() || null,
      employmentType: e.employmentType?.trim() || null,
      secondment: e.secondmentCompanyName?.trim() || null,
      description: e.description?.trim() || null,
      achievements: achBy.get(e.id) ?? [],
    };
    const last = out[out.length - 1];
    const key = e.companyKey ?? `row:${e.id}`;
    if (last && last.key === key) {
      last.roles.push(role);
    } else {
      out.push({ key, name: e.companyName?.trim() || "（会社名未入力）", period: "", roles: [role] });
    }
  }
  /* 会社の期間 */
  const byId = new Map(exps.map((e) => [e.id, e]));
  for (const c of out) {
    const rows = c.roles.map((r) => byId.get(r.id)!).filter(Boolean);
    const starts = rows.map((r) => r.startedAt).filter((x): x is string => !!x).sort();
    const current = rows.some((r) => r.isCurrent);
    const ends = rows.map((r) => r.endedAt).filter((x): x is string => !!x).sort();
    c.period = periodLabel(starts[0] ?? null, ends[ends.length - 1] ?? null, current);
  }
  return out;
}

/** 印刷物の日付（「2026年10月18日現在」）。日本時間 */
export function asOfLabel(now: Date): string {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const v = (t: string) => ps.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}年${v("month")}月${v("day")}日現在`;
}
