/**
 * 募集カード/ヒーロー用のグラデーションプリセット。
 * main_image_url が null のときのフォールバック背景として使う。
 */

export const gradientPresets = {
  warm:   'bg-gradient-to-br from-[#FFE5D9] to-[#F5A383]',
  cool:   'bg-gradient-to-br from-[#CFE9FF] to-[#6BA8E0]',
  green:  'bg-gradient-to-br from-[#D4F5E8] to-[#5CBA92]',
  purple: 'bg-gradient-to-br from-[#E8DFF5] to-[#8C6FC5]',
  dark:   'bg-gradient-to-br from-[#2A2D3A] to-[#1A1D2A]',
} as const;

export type GradientPreset = keyof typeof gradientPresets;

/**
 * 職種カテゴリから自動的にグラデーションを選ぶフォールバック。
 * 既存スキーマの `ow_jobs.job_category` を受け取る前提。
 */
export function getGradientByJobType(jobCategory: string | null | undefined): GradientPreset {
  if (!jobCategory) return 'warm';
  const s = jobCategory.toLowerCase();
  const mapping: Record<string, GradientPreset> = {
    engineer: 'cool',
    'エンジニア': 'cool',
    sales: 'warm',
    '営業': 'warm',
    cs: 'warm',
    'カスタマーサクセス': 'warm',
    pdm: 'purple',
    'PdM': 'purple',
    'プロダクトマネージャー': 'purple',
    designer: 'green',
    'デザイナー': 'green',
    corporate: 'dark',
    'コーポレート': 'dark',
  };
  // 完全一致
  if (mapping[s]) return mapping[s];
  if (mapping[jobCategory]) return mapping[jobCategory];
  // 部分一致(自由入力の揺れに対応)
  for (const [k, v] of Object.entries(mapping)) {
    if (jobCategory.includes(k)) return v;
    if (s.includes(k.toLowerCase())) return v;
  }
  return 'warm';
}

/**
 * gradient_preset カラムの値を安全に GradientPreset に正規化。
 * 想定外の値や null は 'warm' にフォールバック。
 */
export function normalizeGradientPreset(
  value: string | null | undefined
): GradientPreset | null {
  if (!value) return null;
  if (value in gradientPresets) return value as GradientPreset;
  return null;
}
