import { PersonAvatar } from "@/components/common/PersonAvatar";
import { RailBox, RailRow, RAIL_LIST_STYLE, RAIL_THUMB } from "@/components/feed/railKit";
import { HIRING_FILTER_LABEL, HIRING_LIST_HREF } from "@/lib/nextManager/constants";
import type { HomeHiringManager } from "@/lib/nextManager/homeRail";

/**
 * ★採用中のマネージャー（ホームの右の列・スマホの差し込み。2026-11-25 / 柴さんの指示）。
 *   外した「相談にのれる人」の箱（FeaturedConsultantsRail）と同じ位置・同じ形（RailBox / RailRow）。
 *   各行: 顔写真・名前・「会社名 ／ 職種」。下に「すべて見る →」（/people の採用中のマネージャー）。
 * ⚠️ 0人なら何も出さない。箱の見た目は railKit のまま（ここで style を書き直さない）。
 */
export function HiringManagersRail({ items }: { items: HomeHiringManager[] }) {
  if (items.length === 0) return null;
  return (
    <RailBox title={HIRING_FILTER_LABEL} state="home-hiring-managers" moreHref={HIRING_LIST_HREF}>
      <div style={RAIL_LIST_STYLE}>
        {items.map((m) => {
          const sub = [m.companyName, m.roleName].filter(Boolean).join(" ／ ") || null;
          return (
            <RailRow
              key={m.userId}
              state="home-hiring-manager"
              thumb={<PersonAvatar name={m.name} url={m.avatarUrl} size={RAIL_THUMB} colorByName />}
              name={m.name}
              sub={sub}
              title={sub ?? undefined}
              href={`/u/${m.userId}`}
            />
          );
        })}
      </div>
    </RailBox>
  );
}
