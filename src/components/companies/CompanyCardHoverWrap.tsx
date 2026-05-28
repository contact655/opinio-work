"use client";
import { CompanyCardCompact } from "./CompanyCardCompact";
import type { MemberPreview } from "./CompanyCardCompact";
import type { CompanyForCarousel } from "@/types/genre";

type Props = { company: CompanyForCarousel; members?: MemberPreview[] };

export function CompanyCardHoverWrap({ company, members }: Props) {
  return <CompanyCardCompact company={company} compact members={members} />;
}
