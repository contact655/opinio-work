// src/components/companies/CompanyCardCompact.tsx
// ジャンル別カルーセル用コンパクトカード
// 段階：genres-feature Phase C

import Link from "next/link";
import type { CompanyForCarousel } from "@/types/genre";

type Props = {
  company: CompanyForCarousel;
};

const LOGO_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-800",
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-pink-100 text-pink-800",
];

function getLogoColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}

export function CompanyCardCompact({ company }: Props) {
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const logoClass = getLogoColor(company.name);

  const meta = [
    company.industry,
    company.funding_stage,
    company.employee_count ? `${company.employee_count}名` : null,
  ]
    .filter(Boolean)
    .join("・");

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
    >
      <div className="flex gap-2 items-center mb-2">
        {company.logo_gradient ? (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0 text-white"
            style={{ background: company.logo_gradient }}
          >
            {initial}
          </div>
        ) : (
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0 ${logoClass}`}
          >
            {initial}
          </div>
        )}
        <p className="text-xs font-medium truncate">{company.name}</p>
      </div>
      <p className="text-[10px] text-gray-500 mb-1.5 truncate">{meta || "—"}</p>
      <div className="flex gap-1 flex-wrap">
        {company.accepting_casual_meetings && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium">
            面談OK
          </span>
        )}
        {company.remote_work_status && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {company.remote_work_status}
          </span>
        )}
      </div>
    </Link>
  );
}
