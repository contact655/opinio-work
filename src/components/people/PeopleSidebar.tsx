"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProfileCard, type ProfileCardData } from "@/components/common/ProfileCard";

/*
 * `/people` の左サイドバー（2026-09-18）。
 *
 * ── 何を置くか ─────────────────────────────────────────────────────────────
 *   ① ミニプロフィール（＋「プロフィールを見る」）
 *   ② 次に埋めるとよい項目を**1つだけ**
 *   ③ フォロー中 / フォロワー / フォロー中の企業
 *   ④ 面談OKだけ見る（＋自分の状態と設定への入口）＋ 面談OKの注意書き
 *   ⑤ 近い人（同じ職種 / 同じ会社にいた人）
 *
 * ⚠️★**%（完成度）を出さないこと**（2026-09-18 / 柴さんの判断）。
 *    完成度バーは 2026-08-16 に廃止され、2026-09-10 に「%も『あと N 項目』も出さない」と
 *    決めてある（docs/profile-progress-20260910.md）。②は**割合も件数も出さず、
 *    次の1件だけ**を出す形にしてある。**「あと3項目」に変えないこと。**
 *
 * ⚠️★**②に生年月日を入れないこと。** 文言が「入力すると他のユーザーに経歴が伝わります」
 *    の方向なので、**他のユーザーに出ない項目**を混ぜると嘘になる
 *    （生年月日は画面に出さない。年代の絞り込みにしか使わない）。
 *
 * ⚠️★**③は 0 でも「0人」と出す。** 誘導文に置き換えないこと（2026-09-18 / 柴さんの指示）。
 *    ⚠️ `lib/people/followCounts.ts` の JSDoc は「0 のときは項目ごと出さない」と
 *       書いてあるが、**あれは `/u/[id]` と `/mypage` のメタ行の話**。ここは別。
 *    ⚠️ 実測（2026-09-18 / 本番）: `ow_user_follows` も `ow_company_follows` も **0行**。
 *       つまり今日はどの利用者が押しても 0件 になる。**これは仕様であって不具合ではない。**
 *
 * ⚠️★**④のトグル本体はここに作らないこと。** ONの操作は「在籍中の全社ぶんの行を
 *    作る／有効化する」多段処理で、実体は `components/profile/editor/IntentCard.tsx` の
 *    `runTalk` にある。複製すると片方だけ直る形になる。
 *    ここは**いまの状態を出して `/mypage` へ送るだけ**。
 *    ⚠️ 行が無い人（在籍中かつ企業マスタに紐づく会社が無い人）には **`meetingOk` に
 *       `null` が来る。そのときは行ごと出さない**（2026-09-18 / 柴さんの判断）。
 *
 * ⚠️★**狭い画面で中身ごと消さないこと。** `hidden lg:flex` の形にしない。
 *    900px 未満では一覧の上に畳んで出し、**③と④だけは畳まずに見せる**。
 */

export type PeopleSidebarProps = {
  /** ⚠️ 中身は `components/common/ProfileCard` が描く。ここで組み立て直さないこと */
  me: ProfileCardData["me"];
  /** ⚠️★型は `ProfileCard` に集約している。ここで作り直さないこと（割れると片方だけ直る） */
  counts: ProfileCardData["counts"];
  /** 次に埋めるとよい項目。**1件だけ**。無ければ null（「完了！」は出さない） */
  nextStep: { label: string; href: string } | null;
  /** 自分の面談OK。**`null` は「行が無い」＝この行ごと出さない** */
  meetingOk: boolean | null;
  /** いま効いている関係の絞り込み。"" / "following" / "followers" / "coworkers" */
  rel: string;
  onRel: (v: string) => void;
  meetingFilter: boolean;
  onMeetingFilter: (v: boolean) => void;
  /** 自分の現職の職種。**無ければ「同じ職種の人」を出さない**（推測で埋めない） */
  myRole: { slug: string; label: string } | null;
  roleFilter: string[];
  onRole: (slugs: string[]) => void;
  /** 職歴にマスタ紐付きの会社があるか。**無ければ「同じ会社にいた人」を出さない** */
  hasCompanyHistory: boolean;
};

function Row({
  label, active, onClick, right,
}: { label: string; active: boolean; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`pps-row${active ? " active" : ""}`}>
      <span className="pps-row-label">{label}</span>
      {right !== undefined && <span className="pps-row-right">{right}</span>}
    </button>
  );
}

/* ⚠️ 面談OK の注意書き（`MeetingOkNotice`）は 2026-09-18 に削除した（柴さんの指示）。
      ⚠️★**書き戻すなら1箇所に。** 以前はサイドバーと一覧の2箇所から同じ部品を呼んでいた。
         文言を各所に直書きすると割れる。 */

export function PeopleSidebar(p: PeopleSidebarProps) {
  /* 狭い画面の畳み。⚠️ 既定は閉じる。③④は畳みの外に出してあるので、閉じていても見える */
  const [open, setOpen] = useState(false);

  return (
    <aside className="pps" aria-label="自分のつながり">
      <style>{`
        .pps {
          width: 240px; flex-shrink: 0;
          font-family: var(--font-inter), var(--font-noto);
        }
        .pps-card {
          background: #fff; border: 1px solid var(--line); border-radius: 12px;
          padding: 14px; margin-bottom: 10px;
        }
        .pps-title {
          font-size: 11px; font-weight: 700; color: var(--ink-mute);
          letter-spacing: 0.04em; margin-bottom: 8px;
        }
        .pps-row {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          width: 100%; padding: 7px 8px; border: none; border-radius: 7px;
          background: none; cursor: pointer; font-family: inherit;
          font-size: 13px; color: var(--ink-soft); text-align: left;
        }
        .pps-row:hover { background: var(--bg-tint); color: var(--royal); }
        .pps-row.active { background: var(--royal-50); color: var(--royal); font-weight: 700; }
        .pps-row-label { min-width: 0; overflow-wrap: anywhere; }
        .pps-row-right {
          flex-shrink: 0; font-size: 13px; font-weight: 700;
          font-family: var(--font-inter), var(--font-noto); color: var(--ink);
        }
        .pps-row.active .pps-row-right { color: var(--royal); }
        .pps-note { font-size: 11px; color: var(--ink-mute); line-height: 1.75; }
        .pps-link { font-size: 12px; color: var(--royal); text-decoration: none; font-weight: 600; }
        .pps-toggle { display: none; }

        /* ── 狭い画面。⚠️ 中身ごと消さない。畳んで一覧の上に出す ── */
        @media (max-width: 899px) {
          .pps { width: auto; margin-bottom: 14px; }
          .pps-toggle {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; padding: 9px 12px; border-radius: 8px;
            border: 1px solid var(--line); background: #fff; cursor: pointer;
            font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink-soft);
          }
          .pps-collapsible { display: none; }
          .pps-collapsible.is-open { display: block; }
        }
      `}</style>

      {/* ── ①② いつも畳む側。⚠️ カード本体は `components/common/ProfileCard`
             （フィードの左カラムと**同じ部品**）。ここに描き直さないこと。 */}
      {/* ── 狭い画面の開閉。⚠️ 広い画面では display:none ── */}
      <button type="button" className="pps-toggle" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ marginBottom: 10 }}>
        <span>自分のつながり</span>
        <span aria-hidden>{open ? "閉じる" : "開く"}</span>
      </button>

      {/* ⚠️ 畳むのは**ミニプロフィールと「次に埋める1件」だけ**。
             数字（フォロー中／フォロワー）は `topClassName` の外なので畳まれない。 */}
      <ProfileCard
        me={p.me} counts={p.counts} nextStep={p.nextStep} activeRel={p.rel}
        topClassName={`pps-collapsible${open ? " is-open" : ""}`}
      />

      {/* ── ④ 畳まない ────────────────────────────────────────────────── */}
      <div className="pps-card">
        <Row label="面談OKだけ見る" active={p.meetingFilter} onClick={() => p.onMeetingFilter(!p.meetingFilter)} />
        {/* ⚠️ 行が無い人（meetingOk === null）には出さない（冒頭の注記） */}
        {p.meetingOk !== null && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 8px" }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              自分の面談OK：<strong style={{ color: p.meetingOk ? "var(--royal)" : "var(--ink-mute)" }}>{p.meetingOk ? "ON" : "OFF"}</strong>
            </span>
            <Link href="/mypage" className="pps-link" style={{ fontSize: 11.5 }}>設定</Link>
          </div>
        )}
      </div>

      {/* ── ⑤ 近い人。⚠️ 自分の職種・職歴が無ければ、その行ごと出さない ── */}
      {(p.myRole || p.hasCompanyHistory) && (
        <div className={`pps-card pps-collapsible${open ? " is-open" : ""}`}>
          <div className="pps-title">近い人</div>
          {p.myRole && (
            <Row
              label="同じ職種の人"
              active={p.roleFilter.length === 1 && p.roleFilter[0] === p.myRole.slug}
              onClick={() => p.onRole(p.roleFilter.length === 1 && p.roleFilter[0] === p.myRole!.slug ? [] : [p.myRole!.slug])}
              right={p.myRole.label}
            />
          )}
          {p.hasCompanyHistory && (
            <Row label="同じ会社にいた人" active={p.rel === "coworkers"} onClick={() => p.onRel(p.rel === "coworkers" ? "" : "coworkers")} />
          )}
        </div>
      )}
    </aside>
  );
}

export default PeopleSidebar;
