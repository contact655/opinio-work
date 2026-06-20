"use client";

// ── CareerSalarySparkline ─────────────────────────────────────────
// Lightweight inline-SVG sparkline for salary curves.
// - Only renders when 2+ salary data points exist
// - Warm orange line (#F39C12), start dot + end dot + end label
// - Non-public salary gaps cause the segment to be skipped (line is split)

type Props = {
  /** Salary values in chronological order (万円). Must have length >= 2 to render. */
  curve: number[];
  width?: number;
  height?: number;
};

export function CareerSalarySparkline({ curve, width = 120, height = 32 }: Props) {
  if (curve.length < 2) return null;

  const PAD_L = 6;
  const PAD_R = 38; // room for end label
  const PAD_T = 4;
  const PAD_B = 4;
  const W = width - PAD_L - PAD_R;
  const H = height - PAD_T - PAD_B;

  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 1;

  const toX = (i: number) => PAD_L + (i / (curve.length - 1)) * W;
  const toY = (v: number) => PAD_T + H - ((v - min) / range) * H;

  const points = curve.map((v, i) => ({ x: toX(i), y: toY(v) }));

  // Build polyline points string
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const last = points[points.length - 1];
  const endValue = curve[curve.length - 1];

  const COLOR = "#F39C12";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot (最新年収を強調) */}
      <circle cx={last.x} cy={last.y} r={3.5} fill={COLOR} />
      {/* End label (最新年収のみ) */}
      <text
        x={last.x + 6}
        y={last.y + 4}
        fontSize={9}
        fontWeight={700}
        fontFamily="Inter, sans-serif"
        fill={COLOR}
      >
        {endValue}万
      </text>
    </svg>
  );
}
