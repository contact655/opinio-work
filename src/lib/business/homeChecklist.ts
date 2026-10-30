import type { HomeChecklistItem } from "@/lib/business/homeTypes";
import type { ScoutAccessState } from "@/lib/business/scoutGate";

/**
 * ★ホームの「はじめにやること」の項目と判定（2026-10-12 / 柴さんの指示）。**純粋関数**（/dev/preview からも使う）。
 *
 * ⚠️★判定を二重に持たない。材料は呼び出し側が既存の関数で数えてから渡す:
 *   企業ページの「公開まであと〇つ」… `checkPublishable(..., { useDraft: true, forListing: true })`（companyRequirements.ts。/biz/company と同じ数）
 *   求人の「公開まであと〇つ」    … `fetchJobsForCompany` の `publishMissingCount`（publishRequirements.ts と禁止表現。求人管理と同じ数）
 *   部門・職種 … `getEvidenceMaterials().roles` ／ 社員 … `getCompanyEmployees`（企業ページに出ている人）
 * ⚠️ 取れなかった材料（null）は**未完了に倒す**（済んだと嘘をつかない）。
 */
export type HomeChecklistInput = {
  /** 企業ページが一覧に掲載中 */
  listed: boolean;
  /** 企業ページの「公開まであと〇つ」。取れなければ null */
  companyMissing: number | null;
  /** 求人の数（全状態）。取れなければ null */
  totalJobs: number | null;
  publishedJobs: number | null;
  /** 公開にいちばん近い下書き（あと〇つ が最も少ないもの） */
  nearestDraft: { id: string; title: string; missing: number } | null;
  /** 職種を設定した部門の数。取れなければ null */
  roles: number | null;
  /** 企業ページに出ている社員・OB/OG の数。取れなければ null */
  employees: number | null;
  /** カジュアル面談を受け付けているか。取れなければ null */
  acceptingCasualMeetings: boolean | null;
  /** ★企業ページを OPINIO が作ったか（`ow_companies.source` が biz_self 以外）。省略は false（項目を出さない） */
  pageBuiltByOpinio?: boolean;
  /** 担当者が企業ページを一度でも保存したか（ow_activities の company_info_updated）。取れなければ null */
  pageEditedByStaff?: boolean | null;
  /**
   * ★スカウト機能（候補者を探す・最初のメッセージ）の状態（2026-10-28 / 柴さんの指示）。省略は項目を出さない。
   *   everSent … この会社が一度でも最初のメッセージ（ow_company_approaches）を送ったか。取れなければ null（未完了に倒す）
   * ⚠️ 停止中は出さない（上の停止中の帯が案内する）。
   */
  scout?: { state: ScoutAccessState; suspended: boolean; everSent: boolean | null };
};

/** ★候補者を探すへの入口（1項目）。許可済みなら「探して送る」、それ以外は「利用を依頼する」。
 *  ⚠️ どちらも行き先は /biz/candidates（許可されていない企業には、そこに依頼のボタンがある） */
function candidateSearchItem(s: NonNullable<HomeChecklistInput["scout"]>): HomeChecklistItem | null {
  if (s.suspended) return null;
  if (s.state === "granted") {
    return {
      key: "candidateSearch", label: "候補者を探して、最初のメッセージを送る", href: "/biz/candidates",
      done: s.everSent === true,
      hint: "転職を考えている登録者を条件で探し、声をかける理由を添えて送れます",
    };
  }
  return {
    key: "candidateSearch", label: "スカウト機能の利用を依頼する", href: "/biz/candidates",
    done: false,
    hint: s.state === "requested"
      ? "依頼を受け付けました。運営が確認してメールでお知らせします"
      : "許可されると、登録者を条件で探してメッセージを送れます",
  };
}

export function buildHomeChecklist(i: HomeChecklistInput): HomeChecklistItem[] {
  const draftHint = i.nearestDraft
    ? i.nearestDraft.missing > 0 ? `下書き「${i.nearestDraft.title}」は公開まであと${i.nearestDraft.missing}つ` : `下書き「${i.nearestDraft.title}」は公開できます`
    : null;
  const scoutItem = i.scout ? candidateSearchItem(i.scout) : null;
  return [
    /* ★候補者を探すへの入口（2026-10-28）。いちばん上に置く（未完了の項目は配列の順に並ぶ） */
    ...(scoutItem ? [scoutItem] : []),
    /* ★OPINIO が作った企業ページを、担当者に確かめてもらう（2026-10-17 / 柴さんの指示）。
          公開中の企業は「公開する」が最初から済みなので、説明が古い・違うことに気づく入口がほかに無い。
          ⚠️ 済みの判定は「一度でも保存したか」。直すところが無かった人は済みにならないが、
             確認したという記録を持つ列が無いので、保存で代える（DB を増やさない判断）。 */
    ...(i.pageBuiltByOpinio ? [{
      key: "review" as const, label: "OPINIO が作った企業ページの内容を確認する", href: "/biz/company",
      done: i.pageEditedByStaff === true,
      hint: "公開情報をもとに作成しています。会社の説明・従業員数・拠点などが正しいか確認し、違えば直してください",
    }] : []),
    {
      /* ★2026-10-28 から企業が自分で公開する（それまでは「掲載を依頼する」→ 運営が掲載） */
      key: "listing", label: "企業ページを公開する", href: "/biz/company",
      done: i.listed,
      hint: i.companyMissing === null ? null : i.companyMissing > 0 ? `公開まであと${i.companyMissing}つ` : "必要な項目はそろっています",
    },
    { key: "jobCreate", label: "求人を作成する", href: "/biz/jobs/new", done: (i.totalJobs ?? 0) > 0, hint: "ポジション・給与・業務内容を登録します" },
    {
      key: "jobPublish", label: "求人を公開する", href: i.nearestDraft ? `/biz/jobs/${i.nearestDraft.id}/edit` : "/biz/jobs",
      /* ★下書きが無いときも説明を出す（2026-10-30。この項目だけ説明が無かった） */
      done: (i.publishedJobs ?? 0) > 0, hint: draftHint ?? "作成した求人を公開すると、求職者に表示されます",
    },
    { key: "roles", label: "部門・職種を登録する", href: "/biz/organization?tab=roles", done: (i.roles ?? 0) > 0, hint: "登録した職種の経験者に、貴社がおすすめされやすくなります" },
    { key: "employees", label: "社員に登録を呼びかける", href: "/biz/employees", done: (i.employees ?? 0) > 0, hint: "社員・OB/OG の画面に、社員へ送る案内文があります" },
    { key: "casualMeeting", label: "カジュアル面談の受付を始める", href: "/biz/company", done: i.acceptingCasualMeetings === true, hint: "企業ページから面談を申し込めるようになります" },
  ];
}
