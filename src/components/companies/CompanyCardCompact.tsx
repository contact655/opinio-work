import Link from 'next/link';
import Image from 'next/image';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  company: CompanyForCarousel;
};

const LOGO_BG_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-pink-100 text-pink-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
];

function getLogoColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LOGO_BG_COLORS[hash % LOGO_BG_COLORS.length];
}

function getInitials(name: string): string {
  // 全角文字なら先頭2文字、半角なら先頭2文字
  return name.slice(0, 2);
}

export function CompanyCardCompact({ company }: Props) {
  const logoColorClass = getLogoColor(company.name);
  const initials = getInitials(company.name);
  const meta = [
    company.industry,
    company.funding_stage,
    company.employee_count ? `${company.employee_count}名` : null,
  ].filter(Boolean).join('・');

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all h-full"
    >
      {/* ロゴエリア（正方形） */}
      <div className="w-full aspect-[4/3] bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
        {company.logo_url ? (
          <div className="relative w-full h-full bg-white flex items-center justify-center">
            <Image
              src={company.logo_url}
              alt={`${company.name}のロゴ`}
              fill
              className="object-contain p-4"
              sizes="280px"
            />
          </div>
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-2xl font-bold ${logoColorClass}`}>
            {initials}
          </div>
        )}
      </div>

      {/* 社名 */}
      <h3 className="text-base font-semibold mb-1 line-clamp-1">
        {company.name}
      </h3>

      {/* メタ情報 */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-1">
        {meta || '—'}
      </p>

      {/* 説明文（2行省略） */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
        {company.description || '—'}
      </p>

      {/* タグ */}
      <div className="flex gap-1.5 flex-wrap">
        {company.accepting_casual_meetings && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
            面談OK
          </span>
        )}
        {company.remote_work_status && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {company.remote_work_status}
          </span>
        )}
      </div>
    </Link>
  );
}
