// ─── Salary Formatting ──────────────────────────────

export function formatSalary(salaryText: string | null | undefined): string {
  if (!salaryText) return "応相談";
  return salaryText
    .replace(/(\d+)〜(\d+)万円?/, (_, a: string, b: string) =>
      `${Number(a).toLocaleString()}万〜${Number(b).toLocaleString()}万`)
    .replace(/(\d{4,})万/, (_, n: string) => `${Number(n).toLocaleString()}万`);
}

export function formatSalaryRange(min: number | null, max: number | null): string {
  if (!min && !max) return "応相談";
  const fmtMin = min ? `${min.toLocaleString()}万` : "?";
  const fmtMax = max ? `${max.toLocaleString()}万` : "?";
  return `${fmtMin}〜${fmtMax}`;
}
