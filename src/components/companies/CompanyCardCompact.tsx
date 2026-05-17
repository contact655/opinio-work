import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Users } from 'lucide-react';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  company: CompanyForCarousel;
};

// モックと同じ6色パステル（企業名のハッシュで決定論的に選択）
const PLACEHOLDER_COLORS = [
  { bg: '#d4f0e3', text: '#1f7a48' }, // green
  { bg: '#fce8b8', text: '#8b5e0f' }, // yellow
  { bg: '#fcd5dc', text: '#a8324a' }, // pink
  { bg: '#d8e6ff', text: '#1e63d8' }, // blue
  { bg: '#e8dcf5', text: '#6b3b9e' }, // purple
  { bg: '#f5f7fa', text: '#5b6471' }, // gray
];

function getPlaceholderColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

const REMOTE_STATUS_LABEL: Record<string, string> = {
  full_remote: 'フルリモート',
  hybrid: 'ハイブリッド',
  on_site: '出社',
};

export function CompanyCardCompact({ company }: Props) {
  const ph = getPlaceholderColor(company.name);
  const initial = company.logo_letter ?? company.name.slice(0, 1);

  // メタ: 所在地 ・ 従業員数 ・ 募集中N
  type MetaItem = { icon?: React.ReactNode; label: string };
  const metaItems: MetaItem[] = [];
  if (company.location)
    metaItems.push({ icon: <MapPin size={14} strokeWidth={1.5} color="#8b95a3" />, label: company.location });
  if (company.employee_count)
    metaItems.push({ icon: <Users size={14} strokeWidth={1.5} color="#8b95a3" />, label: company.employee_count });
  if (company.job_count > 0)
    metaItems.push({ label: `募集中${company.job_count}` });

  return (
    <Link href={`/companies/${company.id}`} className="genre-card">
      {/* ロゴエリア — 16:10 アスペクト比 */}
      <div style={{
        aspectRatio: '16 / 10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: company.logo_url ? '#f5f7fa' : ph.bg,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {company.logo_url ? (
          <Image
            src={company.logo_url}
            alt={`${company.name}のロゴ`}
            fill
            style={{ objectFit: 'contain', padding: '12%' }}
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, (max-width: 1280px) 33vw, 20vw"
          />
        ) : (
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            color: ph.text,
            letterSpacing: '-0.02em',
          }}>
            {initial}
          </span>
        )}
      </div>

      {/* カード本体 */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 社名 */}
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#1a1d24',
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {company.name}
        </div>

        {/* メタ情報 */}
        {metaItems.length > 0 && (
          <div style={{ fontSize: 12, color: '#5b6471', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0 }}>
            {metaItems.map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <span style={{ color: '#8b95a3', margin: '0 6px' }}>・</span>}
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
        )}

        {/* タグ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {company.accepting_casual_meetings && (
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#e6f5ed',
              color: '#1f7a48',
              fontWeight: 500,
            }}>
              面談OK
            </span>
          )}
          {company.remote_work_status && REMOTE_STATUS_LABEL[company.remote_work_status] && (
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f3f5f9',
              color: '#4a5260',
              fontWeight: 500,
            }}>
              {REMOTE_STATUS_LABEL[company.remote_work_status]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
