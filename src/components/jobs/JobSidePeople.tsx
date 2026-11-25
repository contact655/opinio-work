"use client";

import { useEffect, useState } from "react";
import { JobRelatedPeopleCard } from "@/components/jobs/JobRelatedPeopleCard";
import { JobCompanyPeopleCard } from "@/components/jobs/JobCompanyPeopleCard";
import type { RelatedPerson } from "@/lib/jobs/relatedPeopleTypes";

/**
 * 求人ページのサイドバーの人の2枚（2026-11-26）。
 *   ①「この募集に関わる人」（/api/jobseeker/jobs/[id]/related-people）
 *   ②「この会社で働く人」（①に出た人を除く。0人なら枠ごと出さない）
 *
 * ⚠️★どちらもブラウザから取りに行く。人の情報を ISR の HTML に入れないため（ページは全員に共有される）。
 * ⚠️ ②は①が読み終わってから出す。先に出すと、同じ人が一瞬2つの枠に並ぶ。
 * ⚠️ ①が読めなかったときは①を出さず、②は除外なしで出す（②まで消さない）。
 */
export function JobSidePeople({ jobId, companyId, companyHref, preview, peopleTitle }: {
  jobId: string;
  companyId: string;
  companyHref: string | null;
  preview: boolean;
  peopleTitle: React.ReactNode;
}) {
  const [related, setRelated] = useState<RelatedPerson[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobseeker/jobs/${encodeURIComponent(jobId)}/related-people`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((j: { people?: RelatedPerson[] }) => { if (alive) setRelated(Array.isArray(j.people) ? j.people : []); })
      .catch((e) => { console.error("[JobSidePeople]", e); if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [jobId]);

  if (related === null) return null;
  return (
    <>
      <JobRelatedPeopleCard people={related} preview={preview} />
      <JobCompanyPeopleCard
        companyId={companyId}
        companyHref={companyHref}
        title={peopleTitle}
        excludeUserIds={related.map((p) => p.userId)}
      />
    </>
  );
}
