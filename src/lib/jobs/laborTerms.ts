/**
 * ★求人の労働条件（法律で明示が必要な項目。2026-10-11 追加）。**選択肢・列・読み書きはここの1か所。**
 *
 * 根拠: 職業安定法 第5条の3・施行規則 第4条の2（募集時の労働条件の明示）。
 *       2024年4月の改正で「就業場所・業務の変更の範囲」「更新上限」が加わった。
 * 選択肢の言い方は厚生労働省の労働条件通知書（モデル様式）に合わせた。
 *
 * ⚠️★選択肢は UI・API・DB の CHECK の3つで揃える（CLAUDE.md）。値を足すときは
 *    migration の CHECK も同時に広げること。
 * ⚠️ クライアントからもサーバーからも読む。DB や server-only のものを import しないこと。
 * ⚠️ 業務委託は雇用ではないので、ここの項目は公開の条件にしない（publishRequirements.ts）。
 */

export const CONTRACT_PERIODS = [
  { value: "indefinite", label: "期間の定めなし" },
  { value: "fixed", label: "期間の定めあり" },
] as const;

export const CONTRACT_RENEWALS = [
  { value: "auto", label: "自動的に更新する" },
  { value: "possible", label: "更新する場合があり得る" },
  { value: "none", label: "契約の更新はしない" },
] as const;

export const WORKPLACE_CHANGE_SCOPES = [
  { value: "none", label: "変更なし" },
  { value: "company", label: "会社の定める場所（テレワークを行う場所を含む）" },
] as const;

export const DUTIES_CHANGE_SCOPES = [
  { value: "none", label: "変更なし" },
  { value: "company", label: "会社の定める業務" },
] as const;

export const YES_NO = [
  { value: "yes", label: "あり" },
  { value: "no", label: "なし" },
] as const;

export const SOCIAL_INSURANCES = [
  { value: "health", label: "健康保険" },
  { value: "pension", label: "厚生年金" },
  { value: "employment", label: "雇用保険" },
  { value: "workers_comp", label: "労災保険" },
] as const;

export const SMOKING_MEASURES = [
  { value: "indoor_ban", label: "屋内禁煙" },
  { value: "indoor_ban_with_room", label: "屋内原則禁煙（喫煙専用室あり）" },
  { value: "other", label: "その他" },
] as const;

type Opt = readonly { value: string; label: string }[];
export const labelOf = (opts: Opt, v: string | null | undefined) => opts.find((o) => o.value === v)?.label ?? null;

/** フォームで持つ形（空は ""、社会保険は配列） */
export type LaborTerms = {
  contractPeriod: string;
  contractPeriodDetail: string;
  contractRenewal: string;
  contractRenewalLimit: string;
  workplaceChangeScope: string;
  workplaceChangeNote: string;
  dutiesChangeScope: string;
  dutiesChangeNote: string;
  breakTime: string;
  overtime: string;
  fixedOvertime: string;
  fixedOvertimeHours: string;
  fixedOvertimePay: string;
  socialInsurance: string[];
  smokingMeasure: string;
  smokingNote: string;
};

export const EMPTY_LABOR_TERMS: LaborTerms = {
  contractPeriod: "", contractPeriodDetail: "", contractRenewal: "", contractRenewalLimit: "",
  workplaceChangeScope: "", workplaceChangeNote: "", dutiesChangeScope: "", dutiesChangeNote: "",
  breakTime: "", overtime: "", fixedOvertime: "", fixedOvertimeHours: "", fixedOvertimePay: "",
  socialInsurance: [], smokingMeasure: "", smokingNote: "",
};

/**
 * ★SELECT に足す列。⚠️ `.select()` には文字列リテラルを渡す規約なので、呼び出し側で
 *    この定数を**手で書き写さず**、テンプレートに埋めないこと。各 select にこの列名を並べてある
 *    （lib/business/jobs.ts / lib/supabase/queries.ts / admin）。列を足したらそこも足す。
 */
export const LABOR_COLUMNS = [
  "contract_period", "contract_period_detail", "contract_renewal", "contract_renewal_limit",
  "workplace_change_scope", "workplace_change_note", "duties_change_scope", "duties_change_note",
  "break_time", "overtime", "fixed_overtime", "fixed_overtime_hours", "fixed_overtime_pay",
  "social_insurance", "smoking_measure", "smoking_note",
] as const;

const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

/** DB の行 → フォーム。⚠️ 取得していない列は "" になる（SELECT から落とさないこと） */
export function laborFromRow(row: Record<string, unknown>): LaborTerms {
  return {
    contractPeriod: s(row.contract_period),
    contractPeriodDetail: s(row.contract_period_detail),
    contractRenewal: s(row.contract_renewal),
    contractRenewalLimit: s(row.contract_renewal_limit),
    workplaceChangeScope: s(row.workplace_change_scope),
    workplaceChangeNote: s(row.workplace_change_note),
    dutiesChangeScope: s(row.duties_change_scope),
    dutiesChangeNote: s(row.duties_change_note),
    breakTime: s(row.break_time),
    overtime: s(row.overtime),
    fixedOvertime: s(row.fixed_overtime),
    // ⚠️ numeric 列は "20.0" で返るので数に直してから文字にする（「月20.0時間分」と出さない）
    fixedOvertimeHours: row.fixed_overtime_hours == null || row.fixed_overtime_hours === "" ? "" : String(Number(row.fixed_overtime_hours)),
    fixedOvertimePay: s(row.fixed_overtime_pay),
    socialInsurance: Array.isArray(row.social_insurance) ? (row.social_insurance as string[]) : [],
    smokingMeasure: s(row.smoking_measure),
    smokingNote: s(row.smoking_note),
  };
}

const values = (opts: Opt) => new Set(opts.map((o) => o.value));

/**
 * フォーム → DB の行（API 用）。不正な選択肢は 400 にするため `error` を返す（黙って null にしない）。
 * ⚠️ 空は null。「期間の定めなし」なら期間・更新の欄は null に落とす（矛盾した値を残さない）。
 */
export function laborToRow(input: unknown): { row: Record<string, unknown> } | { error: string } {
  const t = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof LaborTerms, unknown>>;
  const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const pick = (v: unknown, opts: Opt, name: string): string | null | { error: string } => {
    if (v === undefined || v === null || v === "") return null;
    return values(opts).has(String(v)) ? String(v) : { error: `${name}の値が正しくありません` };
  };
  const num = (v: unknown, name: string, int: boolean): number | null | { error: string } => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || (int && !Number.isInteger(n))) return { error: `${name}は正の数で入力してください` };
    return n;
  };

  const contractPeriod = pick(t.contractPeriod, CONTRACT_PERIODS, "契約期間");
  const contractRenewal = pick(t.contractRenewal, CONTRACT_RENEWALS, "契約の更新");
  const workplace = pick(t.workplaceChangeScope, WORKPLACE_CHANGE_SCOPES, "就業場所の変更の範囲");
  const duties = pick(t.dutiesChangeScope, DUTIES_CHANGE_SCOPES, "業務の変更の範囲");
  const overtime = pick(t.overtime, YES_NO, "時間外労働");
  const fixedOvertime = pick(t.fixedOvertime, YES_NO, "固定残業代");
  const smoking = pick(t.smokingMeasure, SMOKING_MEASURES, "受動喫煙防止の措置");
  const hours = num(t.fixedOvertimeHours, "固定残業の時間", false);
  const pay = num(t.fixedOvertimePay, "固定残業代の金額", true);
  for (const v of [contractPeriod, contractRenewal, workplace, duties, overtime, fixedOvertime, smoking, hours, pay]) {
    if (v && typeof v === "object") return v;
  }
  const ins = Array.isArray(t.socialInsurance) ? (t.socialInsurance as unknown[]).map(String) : [];
  const insValues = values(SOCIAL_INSURANCES);
  if (ins.some((v) => !insValues.has(v))) return { error: "社会保険の値が正しくありません" };

  const fixed = contractPeriod === "fixed";
  const hasFixedOt = fixedOvertime === "yes";
  return {
    row: {
      contract_period: contractPeriod,
      contract_period_detail: fixed ? txt(t.contractPeriodDetail, 200) : null,
      contract_renewal: fixed ? contractRenewal : null,
      contract_renewal_limit: fixed ? txt(t.contractRenewalLimit, 200) : null,
      workplace_change_scope: workplace,
      workplace_change_note: txt(t.workplaceChangeNote, 300),
      duties_change_scope: duties,
      duties_change_note: txt(t.dutiesChangeNote, 300),
      break_time: txt(t.breakTime, 200),
      overtime,
      fixed_overtime: fixedOvertime,
      fixed_overtime_hours: hasFixedOt ? hours : null,
      fixed_overtime_pay: hasFixedOt ? pay : null,
      social_insurance: ins.length > 0 ? Array.from(new Set(ins)) : null,
      smoking_measure: smoking,
      smoking_note: txt(t.smokingNote, 300),
    },
  };
}

/**
 * ★求職者の求人ページの「労働条件」に出す行（入っている項目だけ。並びは労働条件通知書の順）。
 * ⚠️ 値が無い行は出さない（「—」で埋めない。CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 */
export function laborLines(t: LaborTerms): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const join = (...xs: (string | null | undefined)[]) => xs.filter((x) => x && x.trim()).join("　");
  if (t.contractPeriod === "indefinite") out.push({ label: "契約期間", value: "期間の定めなし" });
  if (t.contractPeriod === "fixed") {
    out.push({ label: "契約期間", value: `期間の定めあり${t.contractPeriodDetail ? `（${t.contractPeriodDetail}）` : ""}` });
    const renewal = labelOf(CONTRACT_RENEWALS, t.contractRenewal);
    if (renewal) out.push({ label: "契約の更新", value: join(renewal, t.contractRenewalLimit ? `更新の上限：${t.contractRenewalLimit}` : null) });
  }
  const wp = labelOf(WORKPLACE_CHANGE_SCOPES, t.workplaceChangeScope);
  if (wp || t.workplaceChangeNote) out.push({ label: "就業場所の変更の範囲", value: join(wp, t.workplaceChangeNote) });
  const du = labelOf(DUTIES_CHANGE_SCOPES, t.dutiesChangeScope);
  if (du || t.dutiesChangeNote) out.push({ label: "業務の変更の範囲", value: join(du, t.dutiesChangeNote) });
  if (t.breakTime) out.push({ label: "休憩時間", value: t.breakTime });
  const ot = labelOf(YES_NO, t.overtime);
  if (ot) out.push({ label: "時間外労働", value: ot });
  if (t.fixedOvertime === "no") out.push({ label: "固定残業代", value: "なし" });
  if (t.fixedOvertime === "yes") {
    const h = t.fixedOvertimeHours ? `月${t.fixedOvertimeHours}時間分` : null;
    const p = t.fixedOvertimePay ? `${Number(t.fixedOvertimePay).toLocaleString("ja-JP")}円` : null;
    out.push({ label: "固定残業代", value: `あり（${[h, p].filter(Boolean).join("・")}。超過分は追加で支給）` });
  }
  if (t.socialInsurance.length > 0) {
    out.push({ label: "社会保険", value: SOCIAL_INSURANCES.filter((o) => t.socialInsurance.includes(o.value)).map((o) => o.label).join("・") });
  }
  const sm = labelOf(SMOKING_MEASURES, t.smokingMeasure);
  if (sm || t.smokingNote) out.push({ label: "受動喫煙防止の措置", value: sm === "その他" ? join(t.smokingNote) || sm! : join(sm, t.smokingNote) });
  return out;
}
