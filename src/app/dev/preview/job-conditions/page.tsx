import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ConditionRow } from "@/components/jobs/ConditionRow";

/**
 * 求人詳細「勤務条件」のプレビュー（2026-09-02）。
 *
 * ⚠️★**この画面を作った理由。** 勤務体系 / 休日・休暇 / 試用期間 は
 *    本番20件すべてが空で、実ページでは**値が入った状態を一度も描画できない。**
 *    CLAUDE.md「カードが出る側を一度も描画しないまま本番へ出した」を繰り返さないため。
 *
 * ⚠️ ここで DB を読まないこと。固定データだけを渡す。
 */
const GRID: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
};

const ICONS = {
  location: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  work: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  person: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>,
  role: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  clock: <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
};

export default function Page() {
  devOnly();
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 80px" }}>
      <PreviewHeader title="求人の「勤務条件」">
        求人詳細ページの「勤務条件」ブロック。<strong>勤務体系 / 休日・休暇 / 試用期間</strong>は
        2026-09-02 に追加した行で、<strong>本番20件すべてが空</strong>のため実ページでは
        値が入った状態を描画できない。ここでだけ確認できる。
      </PreviewHeader>

      <Variant
        label="全項目あり（7行）"
        note="⚠️ 勤務体系 / 休日・休暇 / 試用期間 は本番20件すべて空なので、実ページではこの状態を描画できない。"
      >
        <div style={GRID}>
          <ConditionRow label="勤務地" value="東京都品川区北品川5-5-15 大崎ブライトコア4階" icon={ICONS.location} />
          <ConditionRow label="働き方" value="ハイブリッド" icon={ICONS.work} />
          <ConditionRow label="雇用形態" value="正社員" icon={ICONS.person} />
          <ConditionRow label="職種" value="エンタープライズセールス" icon={ICONS.role} />
          <ConditionRow label="勤務体系" value="所定労働時間8時間、フレックスタイム制" icon={ICONS.clock} />
          <ConditionRow label="休日・休暇" value="完全週休2日制、有給休暇（初年度10日）" icon={ICONS.cal} />
          <ConditionRow label="試用期間" value="あり（3ヶ月）" icon={ICONS.doc} />
        </div>
      </Variant>

      <Variant
        label="いまの本番（4行。新しい3行は空なので出ない）"
        note="✅ 値が無い行は出さないのが正しい。「—」で埋めない。"
      >
        <div style={GRID}>
          <ConditionRow label="勤務地" value="東京都" icon={ICONS.location} />
          <ConditionRow label="働き方" value="ハイブリッド" icon={ICONS.work} />
          <ConditionRow label="雇用形態" value="正社員" icon={ICONS.person} />
          <ConditionRow label="職種" value="エンタープライズセールス" icon={ICONS.role} />
          <ConditionRow label="勤務体系" value={null} icon={ICONS.clock} />
          <ConditionRow label="休日・休暇" value={undefined} icon={ICONS.cal} />
          <ConditionRow label="試用期間" value="" icon={ICONS.doc} />
        </div>
      </Variant>

      <Variant label="長文（折り返しても崩れないこと）">
        <div style={GRID}>
          <ConditionRow
            label="勤務体系"
            value="所定労働時間8時間、フレックスタイム制（コアタイム 11:00-15:00）。裁量労働制の適用対象となる場合があります"
            icon={ICONS.clock}
          />
          <ConditionRow
            label="休日・休暇"
            value="完全週休2日制（土日）、祝日、年末年始、有給休暇（初年度10日・入社時付与）、慶弔休暇、産前産後休暇、育児休暇"
            icon={ICONS.cal}
          />
        </div>
      </Variant>
    </div>
  );
}
