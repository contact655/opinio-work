import { JobsForYouPanel, type JobsForYouItem } from "@/components/jobs/JobsForYouPanel";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * ★/jobs の一番上の「あなたの希望に合う募集」の見本（2026-10-20）。部品は components/jobs/JobsForYouPanel。
 * ⚠️ この配下で DB を読まない（固定データだけ）。会社名・募集名は架空のもの。
 */
const SUMMARY = "営業・カスタマーサクセス ／ ハイブリッド ／ 年収 600万円〜";

const ITEMS: JobsForYouItem[] = [
  { id: "1", href: "#", title: "エンタープライズ営業（SaaS・大手企業担当）", companyName: "サンプル株式会社", logoUrl: null, logoLetter: "サ", logoGradient: "linear-gradient(135deg,#002366,#3B5FD9)", location: "東京都（ハイブリッド）", reason: "希望職種「営業」に合致・ハイブリッド勤務", connections: 3 },
  { id: "2", href: "#", title: "カスタマーサクセスマネージャー", companyName: "テストテック", logoUrl: null, logoLetter: "テ", logoGradient: "linear-gradient(135deg,#0f766e,#14b8a6)", location: "東京都", reason: "希望職種「カスタマーサクセス」に合致", connections: 0 },
  { id: "3", href: "#", title: "インサイドセールス リーダー候補（立ち上げフェーズのため裁量が大きく、営業組織づくりから関われるポジションです）", companyName: "見本ソリューションズ株式会社", logoUrl: null, logoLetter: "見", logoGradient: "linear-gradient(135deg,#7c3aed,#c084fc)", location: null, reason: null, connections: 22 },
];

export default function JobsForYouPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="あなたの希望に合う募集（/jobs の一番上）">
        LinkedIn の「設定に基づく求人」を参考にした枠。<strong>最大3件</strong>。ログイン中だけ出し、未ログインには出さない。
        ✎ は /mypage の「転職の状況」へ。
      </PreviewHeader>
      <Variant label="合う募集が3件" note="★長い募集名は2行で省略／勤務地・理由・つながりは無ければ行ごと出さない">
        <JobsForYouPanel state={{ kind: "list", summary: SUMMARY, items: ITEMS }} />
      </Variant>
      <Variant label="合う募集が1件" note="いまの本番（公開中の募集2件）では、多くの人がこの形か下の2つになる">
        <JobsForYouPanel state={{ kind: "list", summary: SUMMARY, items: ITEMS.slice(0, 1) }} />
      </Variant>
      <Variant label="希望はあるが0件" note="⚠️ 他の募集で埋めない。「出たらお知らせ」と書かない（仕組みが無い）">
        <JobsForYouPanel state={{ kind: "empty", summary: SUMMARY }} />
      </Variant>
      <Variant label="希望が未入力" note="希望の入力へ案内するだけ">
        <JobsForYouPanel state={{ kind: "no_settings" }} />
      </Variant>
    </div>
  );
}
