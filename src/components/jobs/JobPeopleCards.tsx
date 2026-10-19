import type React from "react";
import type { CompanyEmployee } from "@/lib/supabase/queries";
import { AVATAR_COLOR } from "@/lib/avatarColor";

/**
 * ★求人詳細の「人」を縦長のカードで並べる見本（2026-10-20 / 柴さんの提案「企業と同じように横型に」）。
 *   見本は /dev/preview/job-people。★2026-10-20 に求人詳細へ入れた（JobEmployeesSection の中。3つの欄すべて）。
 *
 *   ・3人以上 … 横にスクロール（ホームの「新しく掲載された企業」と同じ作り。端のカードを少し見せて続きがあると分かる）
 *   ・1〜2人 … 横に流さず左寄せで並べる（1枚だけ流れると空いて見える）
 *   ・カードは顔・名前・肩書きだけ。押すとプロフィールへ
 * ⚠️ 「メッセージ」ボタンは付けない。人ごとに連絡のボタンを並べると「この人が話してくれる」と読める
 *    （2026-10-16 に撤去した「話を聞ける人」の意味づけに戻る）。
 * ⚠️ 色は AVATAR_COLOR（全員同じ）。職種で色を変えない（lib/avatarColor.ts）。
 * ⚠️ style タグの中に不等号・引用符を書かない（ハイドレーションが壊れる）。
 * ⚠️ .jpc-avatar の position: relative を外さない。企業ページの写真（next/image の fill）が枠の外まで広がる。
 */
export const JOB_PEOPLE_CSS = `
  .jpc-row { display: flex; gap: 10px; }
  .jpc-row.jpc-scroll { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding: 2px 24px 4px; margin: 0 -24px; }
  .jpc-row.jpc-scroll::-webkit-scrollbar { display: none; }
  .jpc-row.jpc-scroll .jpc-card { flex: 0 0 132px; }
  .jpc-card { flex: 0 1 132px; scroll-snap-align: start; border: 1px solid var(--line); border-radius: 12px; padding: 16px 10px 14px;
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; text-decoration: none; color: var(--ink); background: #fff; min-width: 0; }
  .jpc-avatar { position: relative; width: 64px; height: 64px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;
    font-family: var(--font-noto-serif); font-weight: 700; font-size: 24px; margin-bottom: 6px; border: 2px solid var(--line-soft); flex-shrink: 0; }
  .jpc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .jpc-name { font-size: 13.5px; font-weight: 700; line-height: 1.4; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .jpc-role { font-size: 12px; color: var(--ink-mute); line-height: 1.45; min-height: 2.9em; max-width: 100%;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .jpc-link { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; min-width: 0; text-decoration: none; color: var(--ink); }
  .jpc-badge { font-size: 11px; font-weight: 600; color: var(--ink-soft); background: var(--bg-tint); border-radius: 999px; padding: 1px 8px; margin-top: 2px; }
  .jpc-act { margin-top: 8px; width: 100%; display: flex; }
  @media (max-width: 767px) {
    .jpc-row.jpc-scroll { padding: 2px 14px 4px; margin: 0 -14px; }
  }
`;

/**
 * カードを並べる行だけ（中身は呼び出し側）。3枚以上なら横スクロール、1〜2枚は左寄せ。
 * ★企業ページの社員・OB/OG（2026-10-20）が使う。⚠️ 並べ方の決まり（3枚から横スクロール）は JobPeopleCards と同じ。ここ1か所で決める
 */
export function PeopleCardRow({ count, children }: { count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  const scroll = count >= 3;
  return (
    <div className={scroll ? "jpc-row jpc-scroll" : "jpc-row"} data-state={scroll ? "people-scroll" : "people-static"}>
      {children}
    </div>
  );
}

export function JobPeopleCards({ people }: { people: CompanyEmployee[] }) {
  if (people.length === 0) return null;
  return (
    <PeopleCardRow count={people.length}>
      {people.map((emp) => (
        <a key={emp.userId} href={`/u/${emp.userId}`} className="jpc-card" title={[emp.name, emp.roleTitle].filter(Boolean).join(" / ")}>
          <span className="jpc-avatar" style={{ background: emp.avatarUrl ? undefined : AVATAR_COLOR.bg, color: AVATAR_COLOR.text }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {emp.avatarUrl ? <img src={emp.avatarUrl} alt="" /> : (emp.avatarInitial ?? emp.name.charAt(0))}
          </span>
          <span className="jpc-name">{emp.name}</span>
          <span className="jpc-role">{emp.roleTitle ?? ""}</span>
        </a>
      ))}
    </PeopleCardRow>
  );
}
