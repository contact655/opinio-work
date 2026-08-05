"use client";

/**
 * ON/OFF スイッチ。管理画面の即時反映トグルはすべてこれを使う。
 *
 * ── なぜ共通化したか（2026-08-05）──────────────────────────────────────────
 * 同じ「ON/OFF」が6箇所で個別実装されており、
 *   ・スイッチ型（丸が動く）とピル型（テキストが変わる）が混在
 *   ・スイッチ型どうしでも 36×20 と 44×24 で寸法が違う
 *   ・ピル型どうしでも padding が 4/12 と 3/10 で違う
 * という状態だった。共通部品が無いことが原因なので、部品を作って全部差し替えた。
 *
 * ⚠️ 寸法は 44×24（つまみ18）に統一した。36×20 ではなくこちらを採った理由は、
 *    表の行の中で押す対象なので、当たり判定が大きいほうが誤操作が減るため。
 *    44px はモバイルの最小タップ領域の目安にも一致する。
 *
 * ── これを使わないもの ────────────────────────────────────────────────────
 * ⚠️ 取り消しのない一方向の操作（企業審査の「承認」など）はトグルにしない。
 *    ON/OFF の語彙にすると「戻せる」ように見えるため、ボタンのままにすること。
 *
 * ── 失敗したときの扱い ────────────────────────────────────────────────────
 * ⚠️ この部品は見た目だけを持つ。楽観更新とロールバックは呼び出し側の責任。
 *    Server Action は ActionResult（{ok:true} | {ok:false,error}）を返すので、
 *    失敗したら必ず値を戻すこと。握り潰すと「効いたように見えて DB は変わっていない」
 *    状態になる（2026-08-05 に企業審査で実際に起きていた）。
 */

export function Toggle({
  checked,
  onToggle,
  disabled = false,
  pending = false,
  label,
  onColor = "var(--royal)",
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** 通信中。押せなくなり、薄くなる */
  pending?: boolean;
  /** スクリーンリーダー用。「掲載」「面談可」など、何のON/OFFかを書く */
  label: string;
  /** ON のときの色。既定は royal */
  onColor?: string;
}) {
  const isDisabled = disabled || pending;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={checked ? `${label}（クリックでOFF）` : `${label}（クリックでON）`}
      onClick={onToggle}
      disabled={isDisabled}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        padding: 0,
        background: checked ? onColor : "#CBD5E1",
        cursor: pending ? "wait" : isDisabled ? "not-allowed" : "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
        opacity: isDisabled ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
