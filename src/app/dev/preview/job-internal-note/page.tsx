import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { JobInternalNote } from "@/components/business/JobInternalNote";

/**
 * ★求人の社内メモ（2026-10-12）。選考管理の「この求人の社内メモ」（読むだけ）と、編集画面の右の枠。
 * ⚠️ 実データ（Third Box）には応募・面談が無く、選考管理での見え方を描けない。ここで見る。
 * ⚠️ DB は読まない（固定データ。`fixed` を渡すと読み込まない）。
 */
const short = { body: "二次面接は営業部長が担当。\n年収は上限まで相談可。", updatedAt: "2026-10-12T06:21:00Z", updatedByName: "柴 久人" };
const long = { body: "採用の背景：既存の営業メンバー2名が来期から新規事業に移るため、その穴を埋める。\n面接官への申し送り：フィールドセールスの経験年数より、立ち上げ期の動き方を重視。\n".repeat(4), updatedAt: "2026-10-01T01:00:00Z", updatedByName: "担当者A" };

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="求人の社内メモ（求職者には表示されません）">
        <p>選考管理の応募者の詳細では「この求人の社内メモ」を開閉で読むだけ。メモが無ければ何も出ない。（編集画面の枠は Third Box の求人で実物を見られる）</p>
      </PreviewHeader>
      <Variant label="選考管理：読むだけ（短い）" note="閉じた状態で出る。押すと本文と「柴 久人・10月12日 15:21 更新」">
        <div style={{ maxWidth: 520 }}><JobInternalNote jobId="demo" variant="readonly" fixed={short} /></div>
      </Variant>
      <Variant label="選考管理：読むだけ（長い）" note="改行を保つ">
        <div style={{ maxWidth: 520 }}><JobInternalNote jobId="demo" variant="readonly" fixed={long} /></div>
      </Variant>
      <Variant label="選考管理：メモが無い" note="何も描かれないのが正しい">
        <div style={{ maxWidth: 520 }}><JobInternalNote jobId="demo" variant="readonly" fixed={null} /></div>
      </Variant>
    </div>
  );
}
