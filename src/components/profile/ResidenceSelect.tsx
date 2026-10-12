"use client";

import { OVERSEAS, RESIDENCE_OPTION_GROUPS, buildResidence, parseResidence } from "@/lib/utils/location";

/**
 * ★お住まいの入力（2026-10-12）。47都道府県＋「海外」（国名は任意）＋「非公開」。
 *   オンボーディング1画面目・/mypage の編集モーダル・/mypage/settings の3か所が同じ部品を使う。
 *
 * ⚠️ 値は `ow_users.location` の文字列のまま受け渡す（「海外（アメリカ）」の形）。分け方と組み立ては
 *    `lib/utils/location.ts` の `parseResidence` / `buildResidence` の1か所。
 * ⚠️ 選択肢に当てはまらない古い値（「東京都渋谷区」など）は、対応づけた県を選んだ状態で出し、
 *    次に保存したときに選択式の値になる（API 側でもそろえる）。読めない値は「いまの値」として下に出す。
 */
export function ResidenceSelect({ id, value, onChange, selectStyle, inputStyle, emptyLabel = "選択してください", required }: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  selectStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  emptyLabel?: string;
  required?: boolean;
}) {
  const { choice, country, raw } = parseResidence(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select id={id} value={choice} required={required} data-state="residence-select"
        onChange={(e) => onChange(buildResidence(e.target.value, e.target.value === OVERSEAS ? country : ""))} style={selectStyle}>
        <option value="">{emptyLabel}</option>
        {RESIDENCE_OPTION_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.prefectures.map((p) => <option key={p} value={p}>{p}</option>)}
          </optgroup>
        ))}
      </select>
      {choice === OVERSEAS && (
        <input id={`${id}-country`} type="text" value={country} maxLength={40} placeholder="国名（任意）例：アメリカ"
          aria-label="お住まいの国名（任意）" data-state="residence-country"
          onChange={(e) => onChange(buildResidence(OVERSEAS, e.target.value))} style={inputStyle ?? selectStyle} />
      )}
      {raw && (
        <span data-state="residence-raw" style={{ fontSize: 12, color: "var(--ink-mute)" }}>
          いまの登録：{raw}{choice ? "（保存すると上の選択に置き換わります）" : "（選び直してください）"}
        </span>
      )}
    </div>
  );
}
