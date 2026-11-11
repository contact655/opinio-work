"use client";

import Link from "next/link";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { DMButton } from "@/components/profile/DMButton";
import { CAREER_GENERAL_KEY } from "@/lib/constants/careerConsult";
import { CONSULTANTS_NOTE, CONSULTANTS_SETTINGS_HREF, CONSULTANTS_TITLE, routeTalkTagLabel } from "@/lib/constants/careerRoutes";
import type { ConsultantCard } from "@/lib/featuredConsultants/server";

/**
 * ★相談できる人（/people の左サイドバー。2026-11-12 / 柴さんの決定）。
 *   運営が選び、本人の同意を記録して承認した人だけ（判定は consultantBlockers）。0人なら欄ごと出さない。
 * ⚠️ 「話を聞ける」「面談OK」の語は使わない（2026-10-16 に撤去した別の仕組み）。
 * ⚠️ 相談は既存のキャリア相談を「キャリア全般」で開く。自分自身・送れない相手には DMButton がボタンを出さない。
 * ⚠️ 名前・写真はプロフィールへのリンク。相談のボタンはリンクの外に置く。
 * ⚠️ sample: 見本（/dev/preview）用。相談のボタンを押せない形にする（DB を読まない）。
 */
export function FeaturedConsultantsCard({ items, sample = false }: { items: ConsultantCard[]; sample?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section data-state="featured-consultants" className="fcs" aria-label={CONSULTANTS_TITLE}>
      <style>{`
        /* ⚠️ サイドバーの .pps-card と同じ見た目。見本（/dev/preview）でも崩れないよう自前で持つ */
        .fcs { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
        .fcs-title { font-size: 11px; font-weight: 700; color: var(--ink-mute); letter-spacing: 0.04em; margin-bottom: 8px; }
        .fcs-more { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 600; color: var(--royal); text-decoration: none; }
        .fcs-note { margin: 12px 0 0; font-size: 11px; color: var(--ink-mute); line-height: 1.75; }
        .fcs-list { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
        .fcs-item { display: grid; gap: 8px; min-width: 0; }
        .fcs-item + .fcs-item { border-top: 1px solid var(--line); padding-top: 14px; }
        .fcs-head { display: flex; gap: 10px; align-items: center; text-decoration: none; color: inherit; min-width: 0; min-height: 44px; }
        .fcs-name { font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.4; overflow-wrap: anywhere; }
        .fcs-now { font-size: 12px; color: var(--ink-soft); line-height: 1.5; overflow-wrap: anywhere; }
        .fcs-tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
        .fcs-tag { padding: 2px 8px; border-radius: 999px; background: var(--royal-50); color: var(--royal); font-size: 11.5px; font-weight: 600; }
        .fcs-msg { margin: 0; font-size: 12.5px; color: var(--ink); line-height: 1.7; overflow-wrap: anywhere;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .fcs-sample { display: flex; align-items: center; justify-content: center; min-height: 44px; border-radius: 8px; background: var(--royal); color: #fff; font-size: 13px; font-weight: 700; }
      `}</style>
      <div className="fcs-title">{CONSULTANTS_TITLE}</div>
      <ul className="fcs-list">
        {items.map((c) => {
          const nowLine = [c.currentCompany, c.currentRole].filter(Boolean).join(" ");
          return (
            <li key={c.userId} className="fcs-item" data-state="featured-consultant">
              <Link href={`/u/${encodeURIComponent(c.profileKey)}`} className="fcs-head">
                <PersonAvatar name={c.name} url={c.avatarUrl} size={40} colorByName />
                <div style={{ minWidth: 0 }}>
                  <div className="fcs-name">{c.name}</div>
                  {nowLine && <div className="fcs-now">{c.isCurrent ? "" : "以前: "}{nowLine}</div>}
                </div>
              </Link>
              {c.talkTags.length > 0 && (
                <ul className="fcs-tags" aria-label="話せること">
                  {c.talkTags.map((t) => <li key={t} className="fcs-tag">{routeTalkTagLabel(t)}</li>)}
                </ul>
              )}
              {c.message && <p className="fcs-msg" title={c.message}>{c.message}</p>}
              {sample ? (
                <div className="fcs-sample" aria-hidden>相談する</div>
              ) : (
                <DMButton targetUserId={c.userId} targetName={c.name} label="相談する" variant="block"
                  consultPreset={{ about: CAREER_GENERAL_KEY, points: [], note: "" }} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="fcs-note">{CONSULTANTS_NOTE}</p>
      <Link href={CONSULTANTS_SETTINGS_HREF} className="fcs-more" data-action="consultants-settings">あなたも載る →</Link>
    </section>
  );
}
