import { PreviewHeader, Variant } from "../Variant";
import { devOnly } from "../guard";
import { StanceReconfirmDemo } from "./Demo";

/**
 * 転職意欲の「変わりありませんか？」（2026-11-12）。/home に出すダイアログ。
 * ⚠️ 実データでは90日を超えた人がまだいない（最も古い確認が 2026-09-30）ので、見え方はここで見る。DB には読みも書きもしない。
 */
export default function StanceReconfirmPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="転職意欲の「変わりありませんか？」">
        最後に確かめてから90日たった人（日時が空の人を含む）に /home で出す。閉じたら30日は出さない。
      </PreviewHeader>
      <Variant label="4つの設定で開く" note="「いまの設定」の印・注記2行・375px で横にはみ出さないこと・Esc と外側のクリックで閉じること">
        <StanceReconfirmDemo />
      </Variant>
    </div>
  );
}
