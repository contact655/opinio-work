"use client";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { RailBox, RailStackRow, RAIL_ACTION_STYLE, RAIL_LIST_STYLE, RAIL_TEXT_STYLE, RAIL_THUMB } from "@/components/feed/railKit";
import { DMButton } from "@/components/profile/DMButton";
import { CAREER_GENERAL_KEY } from "@/lib/constants/careerConsult";
import Link from "next/link";
import { CONSULTANTS_LIST_HREF, CONSULTANTS_NOTE, CONSULTANTS_SETTINGS_HREF, CONSULTANTS_TITLE, routeTalkTagLabel } from "@/lib/constants/careerRoutes";
import type { ConsultantCard } from "@/lib/featuredConsultants/server";

/**
 * ★相談できる人（ホームの右の列。2026-11-12 / 柴さんの指示）。中身は /people の左サイドバーと同じ（getFeaturedConsultants）。
 *   右の列の「提案の箱」なので3行の形（RailStackRow）: 名前／今の会社と職種（無ければ話せること）／「相談する」。
 * ⚠️ 箱の見た目は railKit の RailBox。ここで style を書き直さないこと。
 * ⚠️ 0人なら箱ごと出さない。「話を聞ける」「面談OK」の語は使わない。
 * ⚠️ 相談は既存のキャリア相談を「キャリア全般」で開く（/people と同じ）。自分自身には DMButton がボタンを出さない。
 * ⚠️ sample: 見本（/dev/preview）用。相談のボタンを押せない形にする（DB を読まない）。
 */
export function FeaturedConsultantsRail({ items, sample = false }: { items: ConsultantCard[]; sample?: boolean }) {
  if (items.length === 0) return null;
  return (
    <RailBox title={CONSULTANTS_TITLE} state="home-consultants" moreHref={CONSULTANTS_LIST_HREF}>
      <div style={RAIL_LIST_STYLE}>
        {items.map((c) => {
          const nowLine = [c.currentCompany, c.currentRole].filter(Boolean).join(" ");
          const sub = nowLine ? `${c.isCurrent ? "" : "以前: "}${nowLine}` : c.talkTags.map(routeTalkTagLabel).join("・") || null;
          return (
            <RailStackRow
              key={c.userId}
              state="home-consultant"
              thumb={<PersonAvatar name={c.name} url={c.avatarUrl} size={RAIL_THUMB} colorByName />}
              name={c.name}
              sub={sub}
              title={c.message ?? undefined}
              href={`/u/${encodeURIComponent(c.profileKey)}`}
              action={sample
                ? <span aria-hidden style={RAIL_ACTION_STYLE}>相談する</span>
                : <DMButton targetUserId={c.userId} targetName={c.name} label="相談する" variant="rail"
                    consultPreset={{ about: CAREER_GENERAL_KEY, points: [], note: "" }} />}
            />
          );
        })}
      </div>
      {/* ★「すべて見る」は一覧（/people?consult=1）。「あなたも載る」は説明の文の後ろの小さなリンクに（2026-11-12） */}
      <p style={{ ...RAIL_TEXT_STYLE, marginTop: 12 }}>
        {CONSULTANTS_NOTE}{" "}
        <Link href={CONSULTANTS_SETTINGS_HREF} data-action="consultants-settings" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>あなたも載る →</Link>
      </p>
    </RailBox>
  );
}
