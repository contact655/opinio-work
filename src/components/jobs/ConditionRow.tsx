/**
 * src/components/jobs/ConditionRow.tsx
 *
 * 求人詳細「勤務条件」の1行。
 *
 * ⚠️★**部品にしてあるのは `/dev/preview` から見るため**（2026-09-02）。
 *    実データが薄く、勤務体系・休日・試用期間は本番0件なので、
 *    `page.tsx` のローカル関数のままだと**値が入った状態を一度も描画せずに出す**ことになる
 *    （CLAUDE.md「データが薄い画面は /dev/preview で見る」）。
 *    ⚠️ ここに新しい行を足したら **`/dev/preview/job-conditions` にも足すこと。**
 */
/**
 * 「勤務条件」の1行。**値が無ければ何も描かない。**
 *
 * ⚠️ 「—」やプレースホルダで埋めないこと。空欄はそのまま空欄にする
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 * ⚠️ `icon` は 24x24 viewBox のパスだけを渡す。`stroke` は共通で `--ink-mute`。
 */
export function ConditionRow({
  label, value, icon,
}: { label: string; value?: string | null; icon: React.ReactNode }) {
  if (!value) return null;
  return (
    /* ⚠️ 枠・余白・背景は globals.css の .cond-row（求人詳細の 767px 以下で1列の項目行にするため。2026-10-29）。
          分割表示のペイン（JobPane）は従来どおりのタイル。インラインに戻さないこと */
    <div className="cond-row">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)"
             strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
        {/* ⚠️ 文字の大きさ・太さは globals.css の .cond-row-label / .cond-row-value（スマホで変えるため。2026-10-29） */}
        <span className="cond-row-label">{label}</span>
      </div>
      <span className="cond-row-value">{value}</span>
    </div>
  );
}

