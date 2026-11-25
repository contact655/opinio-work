"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobRelatedPeopleCard } from "@/components/jobs/JobRelatedPeopleCard";
import type { RelatedPerson } from "@/lib/jobs/relatedPeopleTypes";
import { MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";

/**
 * ★企業ページのサイドバー「話せる人」（2026-11-26 / 柴さんの指示）。並び: 採用中のマネージャー → 採用担当。
 *   見た目は求人ページの「この募集に関わる人」と同じ部品（JobRelatedPeopleCard）。
 *
 * ⚠️★人の情報はブラウザで取る（/api/jobseeker/companies/[id]/contacts）。ISR の HTML に入れない。
 * ⚠️ 各人のボタンは面談を受け付けている会社だけ「カジュアル面談を申し込む」（行き先は会社の申込ページ。指名はしない）。
 *    受け付けていない会社では各人のボタンを出さず、募集があればカードの下に「募集を見る」。
 *    どちらも無ければカードごと出さない（今までの採用担当者カードと同じ）。
 * ⚠️ 0人ならカードは出さず、担当者の入口（staffEntry）だけを出す（入口を消さないため）。
 * ⚠️ 見出しに「話を聞ける」と書かない（2026-10-16 の撤去の判断）。見出しは「話せる人」（柴さんの指示）。
 */
export function CompanyContactsCard({ companyId, meetingHref, jobsHref, staffEntry }: {
  companyId: string;
  meetingHref: string | null;
  jobsHref: string | null;
  staffEntry?: React.ReactNode;
}) {
  const [people, setPeople] = useState<RelatedPerson[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobseeker/companies/${encodeURIComponent(companyId)}/contacts`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d: { people?: RelatedPerson[] }) => { if (alive) setPeople(d.people ?? []); })
      .catch((e) => { console.error("[CompanyContactsCard]", e); if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [companyId]);

  if (people === null) return null;
  const showCard = people.length > 0 && (meetingHref || jobsHref);
  /* ⚠️ カードが無いときは、担当者の入口だけをサイドバーの一番下へ回す（order。サイドバーは縦の flex） */
  if (!showCard) return staffEntry ? <div data-state="company-staff-entry-only" style={{ order: 10, padding: "0 4px" }}>{staffEntry}</div> : null;

  return (
    <JobRelatedPeopleCard
      people={people}
      preview={false}
      title="話せる人"
      state="company-contacts"
      roleLabels={{ manager: "採用中のマネージャー" }}
      renderAction={() => meetingHref ? (
        <Link href={meetingHref} data-state="contact-meeting" style={{
          display: "flex", alignItems: "center", justifyContent: "center", minHeight: 40,
          borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none",
          background: "#fff", color: "var(--ink)", border: `1.5px solid rgb(${MEETING_CTA_SHADOW_RGB})`,
        }}>
          カジュアル面談を申し込む
        </Link>
      ) : null}
      footer={
        <>
          {!meetingHref && jobsHref && (
            <a href={jobsHref} style={{ display: "block", marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
              募集に応募すると、担当者に届きます。募集を見る →
            </a>
          )}
          {staffEntry}
        </>
      }
    />
  );
}
