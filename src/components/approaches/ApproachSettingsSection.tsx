import Link from "next/link";
import { FormSection } from "@/components/profile/editor/formKit";
import { APPROACH_STOP_EXPLANATION } from "@/lib/constants/companyApproaches";

/**
 * ★`/mypage/settings` の「企業からのメッセージ」（2026-10-11 に説明だけにした / 柴さんの指示）。
 *
 * ⚠️★スイッチを戻さないこと。全員が最初から受け取る形にし、止める方法は「転職について」の
 *    「今は考えていない」で兼ねる（その人は企業の候補者検索に出ず、メッセージも届かない）。
 * ⚠️ 届く範囲（ApproachRangeSection）と受け取らない企業は今までどおり別の節にある。
 * ⚠️ リンク先は /mypage の「転職・面談の状況」カード（`IntentCard` の `id="intent"`）。
 */
export function ApproachSettingsSection() {
  return (
    <FormSection title="企業からのメッセージ">
      <p data-state="approach-stop-explanation" style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        {APPROACH_STOP_EXPLANATION}
      </p>
      <Link href="/mypage#intent" style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
        転職についてを変える →
      </Link>
    </FormSection>
  );
}
