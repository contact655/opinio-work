import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ApplicationsClient } from "@/app/biz/applications/ApplicationsClient";
import type { BizApplication } from "@/lib/business/applications";

/**
 * 企業側の応募一覧（/biz/meetings?tab=applications）のプレビュー（2026-09-22）。
 * ⚠️ 本番は ow_job_applications が0行で、空状態しか描かれない。
 * ⚠️ DB は読まない。ステータス変更・採用確定の報告は API を叩くので、この画面では失敗するのが正しい。
 */
function app(id: string, over: Partial<BizApplication>): BizApplication {
  return {
    id, jobId: "j1", jobTitle: "アカウントエグゼクティブ", userId: "u" + id, name: "山田 花子",
    email: "sample@example.com", phone: null, message: "よろしくお願いします。", status: "pending",
    createdAt: "2026-09-20T01:00:00Z", appliedAtLabel: "2日前", ...over,
  };
}

const APPS: BizApplication[] = [
  app("1", { status: "accepted", name: "佐藤 次郎" }),
  app("2", { status: "hired", name: "鈴木 一" }),
  app("3", { status: "interview" }),
  app("4", { status: "pending", name: "田中 三郎" }),
];

export default function BizApplicationsPreviewPage() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="応募一覧（企業側 /biz/meetings?tab=applications）">
        見るところ：内定（accepted）は「内定」と出ること／内定の詳細に「採用が決まりましたか？」が出て、
        緑でないこと／「請求書メール」の文言が出ないこと／採用確定（hired）の行が青系のバナーになること。
      </PreviewHeader>
      <Variant label="内定・採用確定・面接中・新着" note="⚠️ 行を押すと右に詳細が出る。内定の行で「採用確定を報告する」を押すとフォームが開く">
        <div style={{ height: 720 }}>
          <ApplicationsClient applications={APPS} hasPublishedJobs />
        </div>
      </Variant>
    </div>
  );
}
