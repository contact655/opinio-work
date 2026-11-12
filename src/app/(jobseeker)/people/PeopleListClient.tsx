"use client";

import { SearchAllLink } from "@/components/jobseeker/SearchAllLink";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { DirectoryPerson } from "@/lib/people/directory";
import type { SearchAlias } from "@/lib/supabase/queries";
import { FollowUserButton } from "../u/[id]/FollowUserButton";
import { DMButton } from "@/components/profile/DMButton";
import { SortSelect } from "@/components/common/SortSelect";
import { useSearchParams, usePathname } from "next/navigation";
import { PeopleSidebar } from "@/components/people/PeopleSidebar";
import type { PeopleSidebarData } from "@/lib/people/sidebarData";
import { useHideOnScroll } from "@/lib/hooks/useHideOnScroll";
import { PeopleFilterDrawer, type PeopleFilterValues } from "@/components/people/PeopleFilterDrawer";
import { CONSULTANTS_PARAM, CONSULTANTS_NOTE, CONSULTANT_BADGE_LABEL } from "@/lib/constants/careerRoutes";
import { showFollowOnCard } from "@/lib/people/followButton";
import { prevParams, type PrevSelection } from "@/lib/people/prevCareer";
import type { PathsOption, PathsStartView } from "@/lib/paths/server";

/**
 * カード1枚のデータ。取得は src/lib/people/directory.ts。
 * 2026-08-04 に「企業が承認した所属を持つ人」から「登録ユーザー全体」に変えたため、
 * 社名・役職は必ずあるとは限らない（affiliation.kind === "none" の人がいる）。
 */
export type AmbassadorCard = DirectoryPerson;

type Props = {
  ambassadors: AmbassadorCard[];
  /** ow_roles の slug → id。フィルタの照合に使う。page 側で解決して渡す */
  roleSlugToId: Record<string, string>;
  /**
   * 職種辞書（職種名 ＋ ow_role_aliases）。**`/jobs` の検索と同じ `getRoleAliases()`**。
   * ⚠️ **ここで2つ目の辞書を作らないこと。** 辞書が割れると、同じ語で
   *    `/jobs` と `/people` の挙動がまた食い違う（それを直したのがこの変更）。
   */
  roleAliases: SearchAlias[];
  /** 閲覧者の ow_users.id。自分のカードにフォローボタンを出さないために使う */
  myUserId: string | null;
  /** 閲覧者が既にフォローしている ow_users.id */
  followedUserIds: string[];
  /** ★閲覧者を**フォローしている** ow_users.id（2026-09-18）。サイドバーの「フォロワー」用 */
  followerUserIds: string[];
  /** ★左サイドバーの中身（2026-09-18）。未ログイン・自分の行が無いときは null */
  sidebar: PeopleSidebarData | null;
  /** ★相談可能なユーザー全員の ow_users.id（2026-11-12。?consult=1 の絞り込み）。読めなかったら null（絞り込みのチップを出さない） */
  consultantUserIds?: string[] | null;
  /** ★前の経歴（2026-11-03。旧 /paths）。読み込めなかったときは null（チップを出さない） */
  prevCareer?: PrevCareerProps | null;
};

/**
 * ★前の経歴（2026-11-03。旧 /paths をまとめた）。page.tsx が lib/paths/server の getPathsView から作る。
 * ⚠️★notes が null でないとき（前の経歴を選んでいるとき）は、一覧を notes のキーの人だけに絞り、
 *    **人数（N名・残りN名）を出さない**（旧 /paths の「個人カードの人数は出さない」。出すと5人未満の人数が分かる）。
 */
export type PrevCareerProps = {
  options: { roles: PathsOption[]; industries: PathsOption[]; companies: PathsOption[] };
  selfStart: PathsStartView | null;
  selected: PrevSelection;
  activeLabel: string | null;
  /** その経歴から次へ進んだ人（ow_users.id → 「以前: A → 次: B」）。選んでいなければ null */
  notes: Record<string, string> | null;
  /** 一覧の上に出す集計（PrevCareerSummary） */
  summary: React.ReactNode;
};

// ── フィルタ・ソート定数 ────────────────────────────────────────────
/**
 * 職種フィルタ。ow_roles のトップレベル9件（slug 付き）に対応する。
 *
 * ⚠️ 2026-08-04 まで role_title の正規表現マッチだった。
 *    自由記述との照合なので「営業」が「営業企画」にも当たるなど精度が出ず、
 *    カードに出す職種（ow_roles 由来）と軸も食い違っていた。
 *    値は ow_roles の slug で、page 側で slug → id に解決して topRoleId と比較する。
 *    ここに無い slug を足すときは ow_roles 側にも同じ slug があることを確認すること。
 */
const ROLE_OPTIONS = [
  { value: "sales",     label: "営業" },
  { value: "cs",        label: "カスタマーサクセス" },
  { value: "marketing", label: "マーケティング" },
  { value: "product",   label: "プロダクト" },
  { value: "engineer",  label: "エンジニア" },
  { value: "data-ai",   label: "データ・AI" },
  { value: "bizdev",    label: "事業開発" },
  { value: "corporate", label: "コーポレート" },
  { value: "exec",      label: "経営・CxO" },
];

/**
 * ★年代の選択肢（2026-09-18 に柴さんの判断で戻した）。
 *
 * ⚠️★**0人の年代も出す**（柴さんの指示）。実データから作らないこと ——
 *    歯抜けの梯子になる（`/companies` のフェーズ・都道府県と同じ扱い）。
 * ⚠️ 値は `directory.ts` の `ageBand` と同じ形（`20s` 〜 `70s`）。**片方だけ変えないこと。**
 * ⚠️ 生年月日が無い人は `ageBand` が null で、**年代で絞り込んだときだけ**落ちる。
 *    実測（2026-09-18 / 本番）: 実ユーザー7人中3人しか生年月日を持っていない。
 */
const AGE_OPTIONS = [
  { value: "20s", label: "20代" },
  { value: "30s", label: "30代" },
  { value: "40s", label: "40代" },
  { value: "50s", label: "50代" },
  { value: "60s", label: "60代" },
  { value: "70s", label: "70代" },
];

/* ★旧「年齢」フィルタは 2026-08-20 に撤去されていた。
   ⚠️ **一覧に年齢を出さないだけでなく、年齢で絞り込ませない。**
      カードの表示は 2026-08-18 に外していたが、フィルタだけが残っていた。
      `PeopleCard` の型からも `age` を落としてあるので、書こうとしても書けない。 */

/* ★並べ替えは2つだけ（2026-08-18）。
      「プロフィール順」（publicScore 降順）と「経験が長い順」を外した。
   ⚠️ **サーバー側の既定の並び（publicScore 降順）は残っている。**
      外したのは選択肢で、`getAmbassadorDirectory` が返す順序は変えていない。
      既定を「新着順」にしたので、初期表示はその順に並べ替えられる。 */
const SORT_OPTIONS = [
  { value: "newest",  label: "新着順" },
  /* 「プロフィールを最後に直した順」。⚠️ 職歴・学歴を足しても動かない
        （`ow_users` の行が変わったときだけ。directory.ts の `updatedAt` 参照）。 */
  { value: "updated", label: "更新順" },
];

// ★FilterChip は 2026-09-18 に `components/common/FilterChip.tsx` へ寄せた。
//    ⚠️ `/companies` と**同じ部品**。ここに書き戻すと、また同じ名前の別実装が2つになる。
//    ⚠️ 旧実装にあった `:hover` と active の box-shadow は引き継いでいない
//       （`/companies` の見た目を変えないことを優先した）。

// ── Avatar ────────────────────────────────────────────────────────────
/**
 * ★★カードまわりの CSS（2026-09-23 に切り出した）。
 *
 * ⚠️★**`/dev/preview/people-cards` と本番の一覧が同じものを使う。**
 *    切り出す前はこの `<style>` が `PeopleListClient` の JSX の中にあり、
 *    `GridCard` / `ListRow` だけを別の画面に置くと**CSS が付いてこなかった**
 *    （プレビューで確かめても本番の見え方と一致しない）。
 * ⚠️ 中身は1行も変えていない。**コピーを作らないこと。**
 * ⚠️★この style はテンプレートリテラル。コメントにバッククォートを書かない。
 */
export function PeopleCardStyles() {
  return (
          <style suppressHydrationWarning>{`
            .ppl-row-btn-mobile { display: none; }
            .ppl-row-btn-desktop { display: flex; }
            @media (max-width: 600px) {
              .ppl-row-btn-mobile { display: block; }
              .ppl-row-btn-desktop { display: none !important; }
            }

            /* グリッド: 3列 → 2列 → 1列 */
            /* ── コンテナ幅と列数（2026-08-04）──────────────────────────────────
               1440px 以上で 5列にする。人数が増えたときのための変更で、現時点では4名。

               ⚠️ 1100px のまま5列にすると 1枚 198px になり、職種が2行に折り返す。
                  「セールス（デジタルセールス）」が「ス）」だけ2行目に落ちる状態。
                  なので 1440px 以上ではコンテナも 1300px に広げ、1枚 235px を確保する。
                  4列時（251px）とほぼ同じ幅なので、カード内の見え方は今と変わらない。
                  社名だけは18文字級（日本ヒューレット・パッカード合同会社）が2行になるが、
                  これは現在の4列でも同じで、今回の変更による劣化ではない。

               ⚠️ maxWidth をインラインに戻さないこと。インラインはメディアクエリに勝つので
                  下の 1300px が一切効かなくなる（CLAUDE.md 参照）。 */
            /* ⚠️ 基底ルールを先に書くこと。同じ詳細度なので、後に書いたほうが勝つ。
                  .ppl-grid の4列指定をメディアクエリより後ろに置くと 5列が効かない。 */
            .ppl-wrap { max-width: 1100px; }
            /* ★カード下部のフォロー（文字つき）とメッセージ（アイコン）。2026-11-03。
               幅が足りないとき（スマホの2列）は折り返し、フォローが1行目いっぱい・メッセージが2行目の中央になる */
            .ppl-grid-icons { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; width: 100%; }
            .ppl-grid-follow { display: flex; flex: 1 1 96px; min-width: 0; }
            .ppl-grid-msg { display: flex; flex: 1 1 96px; min-width: 0; }
            /* ★左サイドバー（240px）が入ったぶん、列を1つ減らした（2026-09-18）。
               ⚠️★**実測して決めた値。** 1440px では wrap 1300 − 左右padding 48 − サイドバー 240
                  − gap 24 = 988px を4列で割って **1枚 235px**。
                  これは 2026-08-04 に「職種が2行に折り返さない下限」として実測した幅と同じ。
               ⚠️ 900〜1439px は wrap 1100 なので 3列（1枚 252px）。ここを4列に増やすと
                  1枚 185px になり、カード内の「プロフィール」+「+フォロー」の横並びが割れる。 */
            .ppl-layout { display: flex; gap: 24px; align-items: flex-start; }
            .ppl-main { flex: 1; min-width: 0; }
            .ppl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
            /* ★1440px 以上は5列（2026-10-23 / 柴さんの指示）。1枚 約188px（988px − gap 12 × 4 を5で割る）。
                  ⚠️ この幅では文字のボタン「メッセージ」「＋フォロー」が横に並ばない（9/18 の実測）ので、
                     他の人のカードはアイコンだけの丸いボタン2つにした（2026-10-23）。カードの左右の余白は 20 → 12px */
            @media (min-width: 1440px) {
              .ppl-wrap { max-width: 1300px; }
              .ppl-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
              .ppl-grid-card { padding: 22px 12px 14px; }
              .ppl-grid-name { font-size: 15px !important; }
            }
            /* ⚠️ 899px 未満はサイドバーが一覧の上に畳まれる（横に並ばない）ので、
                  本文が全幅に戻る。**サイドバーを display:none にしていない**（中身ごと消さない）。 */
            @media (max-width: 899px) {
              .ppl-layout { display: block; }
              .ppl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
            }
            @media (max-width: 768px)  { .ppl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
            /* ⚠️ 1列に落とすのは 560px。420px にすると 421〜560px の帯で
                  2列 × 180〜250px になり、5列時（235px）より細いカードが出てしまう。
                  「狭い画面ほどカードが細い」わけではないので、境界は列数から逆算すること。 */
            /* ★スマホ（560px 以下）は縦長のカードを2列（2026-10-19 / 柴さんの判断「ユーザーは縦型の方が見やすい」）。
                  それまでは1人1行（CompactRow）だった。カードは小さめにし、ボタンは縦に積む */
            @media (max-width: 560px)  {
              .ppl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
              .ppl-grid-card { padding: 16px 10px 12px; border-radius: 14px; }
              .ppl-grid-card .ppl-company { font-size: 12.5px; }
              .ppl-grid-card .ppl-role { font-size: 12px; }
              .ppl-grid-name { font-size: 14.5px !important; }
            }

            /* ★スマホのコンパクトな行（2026-10-17）。カードの中身と同じものを横に並べる */
            .ppl-compact-list { display: flex; flex-direction: column; background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
            .ppl-compact-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; }
            .ppl-compact-row + .ppl-compact-row { border-top: 1px solid var(--line-soft); }
            .ppl-compact-aff .ppl-company { justify-content: flex-start; margin: 2px 0 0; font-size: 13px; }
            .ppl-compact-role { font-size: 12px; color: var(--ink-mute); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            /* ★「相談可能」の印はカードの右上（2026-11-12）。細いカードでは文字を隠してアイコンだけにする */
            .ppl-consult-corner { position: absolute; top: 10px; right: 10px; line-height: 0; }
            @media (min-width: 1440px), (max-width: 560px) {
              .ppl-consult-corner .ppl-consult-label { display: none; }
              .ppl-consult-corner .ppl-consult-badge { padding: 5px !important; }
              .ppl-consult-corner { top: 8px; right: 8px; }
            }

            /* グリッドカード */
            .ppl-grid-card {
              background: #fff;
              border: 1px solid var(--line);
              border-radius: 18px;
              padding: 28px 20px 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
            }
            /* ── 役職・所属 ─────────────────────────────────────────────────────
               役職は2行までにクランプする。自己申告の役職名は部署名を含んで長く、
               5列時のカード幅（235px）に1行で収まらないことがあるため。
               途中で切り詰めない（切れた役職名は誤読のもとになる）。 */
            /* ★会社が先、職種が後（2026-08-18）。余白は会社の下に持たせる */
            .ppl-role {
              font-size: 13px; color: var(--ink-soft); line-height: 1.5;
              min-height: 20px;
              display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
              overflow: hidden; overflow-wrap: anywhere;
            }
            /* ⚠️ .ppl-headline と .ppl-headline-row は 2026-09-30 に削除した
                  （本人が書いた1行を一覧から外したため。理由は JSX 側の注記に書いてある）。
                  ⚠️★この style はテンプレートリテラル。コメントにバッククォートを書かないこと。 */
            .ppl-company {
              display: flex; align-items: center; justify-content: center; gap: 7px;
              font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.35;
              margin-bottom: 6px; overflow-wrap: anywhere;
            }
            /* 元所属（元◯◯）と学校名。現職の社名より弱く出す。
               ⚠️★**現職（self）には付けない。** 2026-09-20 に企業ロゴを外すまで、
                  この弱い見た目は「ロゴが無い＝自己申告」の補助だった。ロゴが無くなった今は
                  「現職の社名」と「それ以外」を分けるためだけに使う。
               ⚠️★.ppl-company-logo と .ppl-company-logo-fallback は同日に削除した。
                  （この style はテンプレートリテラルなので、コメントにバッククォートを書かない）
                  **社名の横に画像や文字四角を足し戻さないこと。** */
            .ppl-company-self { font-weight: 500; color: var(--ink-soft); }
            /* 職歴がまだ無い人の学校名。企業と取り違えないようアイコンで分ける */
            .ppl-edu-icon { flex-shrink: 0; color: var(--ink-mute); }
            /* 現職が無い人の「元」。社名より弱く出す */
            .ppl-past-mark {
              flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--ink-mute);
              background: var(--bg-tint); border: 1px solid var(--line-soft);
              border-radius: 4px; padding: 1px 5px; line-height: 1.4;
            }
            /* ⚠️ .ppl-facts（年齢）は 2026-08-18 に削除した。カードには出さない。
                  ⚠️ この style はテンプレートリテラルなので、コメントにバッククォートを書かないこと。 */
            .ppl-grid-card:hover {
              box-shadow: 0 8px 32px rgba(0,35,102,0.12);
              transform: translateY(-3px);
              border-color: var(--royal-100);
            }

            /* ── 1列表示の行 ────────────────────────────────────────────────
               ★意匠は企業一覧の横カードに合わせてある（2026-08-24）。
                  hover の値は globals.css の .company-list-card と同じ。
                  片方を変えるときは必ずもう片方も見ること。 */
            .ppl-list-row {
              display: flex; align-items: center; gap: 18px;
              background: #fff; border: 1px solid var(--line); border-radius: 14px;
              box-shadow: 0 1px 4px rgba(15,23,42,0.06);
              padding: 18px 20px; cursor: pointer;
              transition: box-shadow 0.18s, border-color 0.18s;
            }
            /* CTA は縦積み。⚠️ 幅は min-width で固定する。「フォロー」→「フォロー中」で
               列幅が動くため（企業一覧の「保存」→「保存済」と同じ理由。実測 102px → 115px）。 */
            /* ⚠️★margin-left: auto が CTA を右端へ送る（2026-09-18）。
                  本文側の flex:1 を外したので、**これが唯一の押し出し**。
                  片方だけ戻すと、本文と CTA がくっつくか、余白が中央に戻る。
               ⚠️ この style はテンプレートリテラルの中。**バッククォートを書かないこと**
                  （文字列が終わって規則ごと壊れる。2026-09-18 に実際に壊した）。 */
            .ppl-row-cta {
              flex-shrink: 0; display: flex; flex-direction: column;
              align-items: stretch; gap: 8px; min-width: 124px; margin-left: auto;
            }
            .ppl-list-row:hover { box-shadow: 0 4px 24px rgba(0,35,102,0.12); border-color: #d0daf5; }
            .ppl-list-row:hover .ppl-row-name { color: var(--royal); }
            /* ⚠️★大きな数字のスタット列は 2026-09-18 にやめた。**メタ行のテキストに一本化した。**
                  以前は「広い画面＝大きい数字の列／狭い画面＝テキスト」の2通りを
                  .ppl-row-stats と .ppl-row-tenure-inline で切り替えていたが、
                  行の中身が短い人で**本文と数字のあいだに大きな空白**ができていた。
               ⚠️ 2通りに戻さないこと。戻すなら「両方同時に出ない」ことを必ず確かめる
                  （同じ値が2回並ぶ）。 */
            /* ⚠️ 企業一覧は 767px 以下で CTA を丸ごと隠すが、こちらは**隠さない**。
                  企業カードは全体が Link なので消しても導線が残るが、
                  フォローは他に押す場所が無い。折り返して全幅の1行に落とす。 */
            @media (max-width: 600px) {
              .ppl-list-row { flex-wrap: wrap; gap: 12px; padding: 14px 16px; }
              .ppl-row-cta { width: 100%; min-width: 0; flex-direction: row; }
              /* ⚠️★子セレクタの記号を書かないこと。React はこの style の中身を
                    テキストとして扱うので、**サーバー側だけが実体参照へ化けて
                    ハイドレーションが落ちる**（ui-debugging ⑲）。クラス名で指定する。
                 ⚠️★**この注意書き自身がその記号を含んでいて、実際に化けていた**
                    （2026-09-23 に実測。配信 HTML に1件だけ残っていた）。
                    **説明のためでも記号そのものを書かないこと。** */
              /* ⚠️ flex: 1 だと**幅が揃わない**（実測 162px / 123px）。
                    プロフィール側の padding + border 39px ぶんだけ広くなる。
                    半分ずつに固定する（4px は gap 8px の半分）。 */
              .ppl-row-profile-btn, .ppl-row-follow { flex: 0 0 calc(50% - 4px); }
            }

            /* FilterChip */
            .ppl-chip {
              display: inline-flex; align-items: center; gap: 5px;
              padding: 7px var(--chip-pad-x, 14px); border-radius: 999px;
              border: 1.5px solid #e2e8f0; background: #fff;
              color: var(--ink); font-size: 13px; font-weight: 500;
              cursor: pointer; white-space: nowrap;
              transition: all 0.12s; font-family: inherit; flex-shrink: 0;
            }
            .ppl-chip:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
            /* ⚠️★active の見た目は components/common/FilterChip と揃えてある（2026-09-18）。
                  同じ行に「詳細検索 / 外資」（このクラス）と
                  「職種 / 年代」（FilterChip）が並ぶので、ずれると2種類のチップに見える。
               ⚠️ 以前あった box-shadow と font-weight:700 はそのために外した。片方だけ戻さないこと。
               ⚠️ ここは style タグのテンプレートリテラルの中。バッククォートを書かないこと。 */
            .ppl-chip.active {
              border-color: var(--royal); background: var(--royal);
              color: #fff; font-weight: 600;
            }

            /* ★絞り込みのチップ（2026-09-17 に「絞り込む」で畳むのをやめた）。
               ⚠️ display: contents なので、チップは**ツールバーの行の直接の子として**並ぶ。
                  ここを block などに変えると、行の中に箱がもう1つできて高さが跳ねる。
               ⚠️ 2つ目の絞り込みを足して狭い画面で収まらなくなったら、
                  畳む仕掛けを戻すのではなく、企業一覧と同じ「詳細検索」にすること。
                  ⚠️ ここは style タグのテンプレートリテラルの中。**バッククォートを書かないこと**
                     （文字列がその場で閉じる。2026-09-17 にこの行で実際に踏んだ）。 */
            .ppl-filter-chips { display: contents; }
            /* ★つながりと他の条件の区切り（2026-11-12）。⚠️ ここも style タグの中。バッククォートを書かないこと */
            .ppl-chip-sep { width: 1px; height: 22px; background: var(--line); flex-shrink: 0; margin: 0 2px; }
            .ppl-all-filters { border-color: var(--royal); color: var(--royal); font-weight: 600; }
            /* ★/people の上部の見た目（2026-11-12 / 柴さんの指示）。検索欄を広げ、検索・フィルター・条件・並び替えの高さを 40px・丸い形にそろえる。
                  ⚠️ /people だけ（.ppl-toolbar）。/companies・/jobs は変えない。⚠️ ここも style タグの中。バッククォートを書かないこと */
            /* ⚠️ 共通の .lsb.lsb--always .lsb-field（42px・3クラス）に勝つよう4クラスにしてある */
            .ppl-toolbar .lsb.lsb--always .search-shell { height: 40px; box-sizing: border-box; }
            .ppl-toolbar .search-shell input { padding-top: 0; padding-bottom: 0; height: 100%; }
            .ppl-active-row { padding-bottom: 10px; flex-wrap: wrap; }
            /* ★1023px 以下は3段（検索 ／ フィルターと並び替え（右寄せ） ／ 効いている条件） */
            @media (max-width: 1023px) {
              .ppl-toolbar.lt-compact { display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; }
              .ppl-toolbar .lt-search-row.lt-search-row { flex-basis: 100%; }
              .ppl-toolbar .lt-result-row.lt-result-row { order: 2; flex: 1 1 100%; border-top: none; padding: 0 0 10px; }
              .ppl-toolbar .ppl-active-row { order: 3; flex-basis: 100%; }
            }
            .ppl-toolbar .ppl-chip, .ppl-toolbar .sort-select-btn { height: 40px; min-height: 40px; box-sizing: border-box; }
            .ppl-toolbar .ppl-chip { padding-left: 14px; padding-right: 14px; }
            .ppl-view-toggle { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: 999px; background: #fff; }
            .ppl-view-btn { width: 34px; height: 34px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 999px; background: transparent; color: var(--ink-mute); cursor: pointer; padding: 0; }
            .ppl-view-btn[aria-pressed="true"] { background: var(--bg-tint); color: var(--ink); }
            .ppl-view-btn:hover { color: var(--ink); }
            @media (min-width: 1024px) {
              /* ⚠️ 子の結合子（不等号）を使わない（style タグの中では書けない）。共通の .lt-compact の指定（4つ）に勝つよう、クラスを重ねて5つにしてある */
              /* ★検索欄は右のボタンまでの幅いっぱいに伸ばす（2026-11-12 / 柴さんの指示。それまでは最大 480px） */
              .ppl-toolbar.lt-compact .lt-search-row.lt-search-row.lt-search-row { flex: 1 1 auto; min-width: 280px; max-width: none; }
              .ppl-toolbar.lt-compact .lt-result-row.lt-result-row { flex: 0 0 auto; }
              .ppl-toolbar.lt-compact { flex-wrap: wrap; row-gap: 10px; }
              .ppl-toolbar .lt-result-row.lt-result-row { order: 2; }
              .ppl-toolbar .ppl-active-row { order: 3; flex-basis: 100%; padding-bottom: 0; }
              .ppl-toolbar .lt-search-row .lsb.lsb--always { width: 100%; max-width: none; }
            }
            .ppl-all-count {
              display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px;
              margin-left: 6px; border-radius: 999px; background: var(--royal); color: #fff; font-size: 11px; font-weight: 700;
            }
          `}</style>
  );
}
function Avatar({ card, size }: { card: AmbassadorCard; size: number }) {
  if (card.avatarUrl) {
    return (
      <Image
        src={card.avatarUrl}
        alt={card.name}
        width={size}
        height={size}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "3px solid #fff", boxShadow: "0 2px 12px rgba(0,0,0,0.14)", flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "3px solid #fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    }}>
      {card.initial}
    </div>
  );
}

/**
 * 所属の表示。出どころで見た目を変える。
 *
 *   self      … ow_experiences の現職。社名のテキストのみ
 *   past      … 現職が無い人の直近の所属。「元 Salesforce」の形
 *   education … 職歴がまだ無い人の最終学歴。学帽アイコン + 学校名
 *   none      … 何も出さない（この人はそもそも一覧に出ない）
 *
 * ⚠️ 在籍確認済みを示す ✓ を出さないこと（OPINIO は在籍確認をしていない）。
 *
 * ⚠️ カードに自由記述（自己紹介 / 役職名）は出さない。人によって品質がばらつき、
 *    一覧の比較軸が崩れるため。出すのは所属企業と ow_roles の職種だけ。
 */
function AffiliationBlock({ card }: { card: AmbassadorCard }) {
  const a = card.affiliation;

  if (a.kind === "none") return null;

  if (a.kind === "education") {
    // 職歴がまだ無い人。学校名を出す。企業と取り違えないよう、
    // 企業ロゴの位置に学帽アイコンを置いて出どころを分ける。
    return (
      <div className="ppl-company ppl-company-self">
        <svg className="ppl-edu-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
        </svg>
        <span>{a.schoolName}</span>
      </div>
    );
  }

  if (a.kind === "past") {
    return (
      <div className="ppl-company ppl-company-self">
        <span className="ppl-past-mark">元</span>
        <span>{a.companyName}</span>
      </div>
    );
  }

  /* self。⚠️★**企業ロゴを出さないこと**（2026-09-20 / 柴さんの指示）。
        文字四角は隣の社名と同じ情報しか運ばず、実ロゴの有無で行の形が混在していた。
     ⚠️ 2026-10-16 に `verified`（`ow_company_members` 由来）を撤去した。所属は職歴だけから作る。 */
  return (
    <div className="ppl-company">
      <span>{a.companyName}</span>
    </div>
  );
}

/* ⚠️ `CardFacts`（カードの年齢表示）は 2026-08-18 に削除した。
      **カードに年齢は出さない。** 2026-08-20 に「年齢」フィルタも撤去したので、
      `age` は型からも消してある
      （`matchesAge`）。カードに戻すときは、値が無い人には行ごと出さないこと。 */

/* ⚠️ 2026-11-03〜11-05 はここに「話を聞けます」の印（TalkOpenMark）があった。「話を聞ける」設定ごと外した（柴さんの指示）。戻さないこと */

/**
 * ★「相談可能」の印（2026-11-12 / 柴さんの指示）。本人がマイページで「相談にのれる」をオンにした人にだけ出す。
 *   出す人は ow_featured_consultants の listableRows（consultantBlockers を通った人）で、ホームの箱・?consult=1 と同じ。
 * ⚠️ 押しても何も起きない（カード全体がプロフィールへの導線）。申し込みの仕組みは作らない。
 * ⚠️ 語は CONSULTANT_BADGE_LABEL の1か所。「面談OK」「話を聞ける」にしない。
 * ⚠️ 色は塗らない（濃紺の線と文字）。一覧が主導線だらけにならないように。
 */
export function ConsultBadge() {
  return (
    <span data-state="ppl-consult-badge" className="ppl-consult-badge" title={CONSULTANTS_NOTE} aria-label={CONSULTANT_BADGE_LABEL}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
        border: "1px solid var(--royal-100)", background: "#fff", color: "var(--royal)",
        fontSize: 11.5, fontWeight: 700, lineHeight: 1.5, whiteSpace: "nowrap" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="ppl-consult-label" aria-hidden>{CONSULTANT_BADGE_LABEL}</span>
    </span>
  );
}

// ── グリッドカード ────────────────────────────────────────────────────
export function GridCard({ card, myUserId, followedUserIds, followerUserIds = [], narrow = false, pathNote, consultable = false }: {
  card: AmbassadorCard; myUserId: string | null; followedUserIds: string[];
  /** ★相談可能なユーザーか（2026-11-12）。印を出す */
  consultable?: boolean;
  /** ★前の経歴で絞っているときの「以前: A → 次: B」（2026-11-03） */
  pathNote?: string;
  /** ★自分をフォローしている人（ボタンが「つながり」になる。2026-10-21） */
  followerUserIds?: string[];
  /** ★スマホの2列（2026-10-19）。顔を小さくする */
  narrow?: boolean;
}) {
  const router = useRouter();
  // ⚠️ ow_company_members.role_title（自由記述）ではなく ow_roles の職種名を出す。
  //    自由記述は「営業」「Enterprise Account Executive」「セールス（デジタルセールス）」
  //    「営業（金融ソリューション）」のように粒度がばらばらで、
  //    同じ職種でも読み手が毎回解釈することになるため（2026-08-04）。
  //    肩書きそのものに意味がある /u/[id] と /biz/candidates では役職名を残している。
  const role = card.roleName;
  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      className="ppl-grid-card"
      style={{ position: "relative" }}
    >
      {/* ★「相談可能」はカードの右上に置く（2026-11-12 / 柴さんの指示）。
             名前の下に置いていたときは、会社名・職種の行数で上下の位置が人ごとにずれていた。
          ⚠️ カードが細い幅（1440px 以上の5列・560px 以下の2列）では顔と重なるので、
             CSS（.ppl-consult-corner）で文字を隠してアイコンだけにする。 */}
      {consultable && <div className="ppl-consult-corner"><ConsultBadge /></div>}

      {/* アバター */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
        <Avatar card={card} size={narrow ? 64 : 88} />
      </div>

      {/* 名前・役職・所属 */}
      <div style={{ textAlign: "center", marginBottom: 12, marginTop: 6, width: "100%" }}>
        <div className="ppl-grid-name" style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3, overflowWrap: "anywhere" }}>
          {card.name}
        </div>
        {/* ★並びは **名前 → 会社 → 職種**（2026-08-18）。
               どこの人かが先に読めるほうが、一覧をなぞるときに探しやすい。
            ⚠️ 役職が無いときに「—」を出さない。値が無いことを、ある値に置き換えない。
               高さは minHeight で揃える。
            ⚠️ **年齢はカードに出さない**（2026-08-18 に外した）。
               2026-08-20 に「年齢」フィルタも外し、型からも落とした。 */}
        <AffiliationBlock card={card} />
        <div className="ppl-role">{role}</div>
        {pathNote && (
          <div data-state="ppl-path-note" title={pathNote} style={{ marginTop: 6, fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{pathNote}</div>
        )}
        {/* ★★本人が書いた1行（`headline`）は 2026-09-30 に一覧から外した（柴さんの判断）。
               理由は**長いから** —— 自由記述で最大40字あり、2行に折り返すと
               カードの縦が伸びて、短い人と並んだときの見た目が揃わない
               （実測: 山下 真澄「インサイドセールス:エンタープライズを対象にBDRとして営業」）。
            ⚠️★**1列表示（`ppl-headline-row`）からも同時に外してある。**
               片方だけ戻さないこと —— あの2つは同じ画面のビュートグルで行き来するので、
               割れると「表示形式を変えたら情報が増減する」形になる。
            ⚠️★**肩書きが読めなくなったわけではない。** `/u/[id]` の `ProfileHeader` が
               今も出すので、`pickNextStep` の「肩書きを1行で書く」は嘘になっていない
               （sidebarData.ts の「埋めると他のユーザーに伝わる項目だけ勧める」規則を満たす）。
            ⚠️ `DirectoryPerson.headline` は**残してある**（型・クエリとも）。戻すのは
               この2箇所と CSS を書き戻すだけ。⚠️ 戻すなら**長い人の見え方を先に
               `/dev/preview/people-cards` で確かめること**（`HEADLINE_40` がその用途）。
            ⚠️ 自己紹介文（`about_me`）は**もともと一覧に出していない。** 混同しないこと。 */}
      </div>

      {/* CTAボタン
          ⚠️ 2026-08-08 に横並びにした。それまで「横並びにしないこと」と書いてあったのは
             ラベルが「プロフィールを見る」(約136px) で、5列時のカード内寸に
             フォローと並べると溢れたため。ラベルを「プロフィール」に短くして解消した。
             ⚠️ ラベルを長い文言に戻すときは、5列（1440px 以上）で実測してから戻すこと。
          ⚠️ 意匠は白のまま。navy 塗り＝主導線 / オレンジ＝人に届く の慣習に照らすと、
             どちらも「見るだけ」「自分用」で、カード自体が既に /u/[id] への導線なので
             ここを塗ると一覧が主導線だらけになる。
          ⚠️ onClick の伝播を止める。カード全体が router.push を持っているため、
             止めないとフォローと同時にプロフィールへ遷移する。 */}
      <div className="ppl-grid-cta" style={{ marginTop: "auto", width: "100%", display: "flex", gap: 6, alignItems: "stretch" }}>
        {/* ★他の人のカードでは「プロフィール」の代わりに「メッセージ」（2026-10-17）。カード自体がプロフィールへの導線なので、
               プロフィールのボタンは自分のカード（とログインしていないとき）だけに残す。
            ⚠️ 意匠は「プロフィール」と同じ白（塗らない。一覧が主導線だらけになるため） */}
        {/* ★他の人のカードは「フォローする／フォロー中」（アイコン＋文字）とメッセージ（アイコン）を並べる（2026-11-03 / 柴さんの指示）。
               それまでの人型アイコンだけのフォロー（2026-10-23）は、つながり申請と見分けがつかなかった。
            ⚠️ 幅が足りないとき（スマホの2列・1枚の中身 117px）は折り返して、フォローが1行目・メッセージが2行目になる（.ppl-grid-icons）。
            ⚠️ 自分のカード・未ログインにはフォローを出さない（showFollowOnCard） */}
        {/* ★2026-11-05 / 柴さんの指示: 「メッセージ」を主ボタン（塗り）、「フォロー」を副ボタンにして並べる。
               幅が足りないとき（スマホの2列）は折り返して、メッセージが1行目・フォローが2行目になる（.ppl-grid-icons）。 */}
        {showFollowOnCard(myUserId, card.userId) ? (
          <div className="ppl-grid-icons">
            <div className="ppl-grid-msg" onClick={(e) => e.stopPropagation()}>
              <DMButton targetUserId={card.userId} targetName={card.name} variant="primary" label="メッセージ" />
            </div>
            <div className="ppl-grid-follow" onClick={(e) => e.stopPropagation()}>
              {/* ⚠️★`refreshOnChange` を外さないこと（サイドバーのフォロー数と ?rel=following の絞り込みが取り残される） */}
              <FollowUserButton targetUserId={card.userId} initialFollowed={followedUserIds.includes(card.userId)}
                followsMe={followerUserIds.includes(card.userId)} isAuthenticated card refreshOnChange />
            </div>
          </div>
        ) : (
        <Link
          href={`/u/${card.userId}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "8px 10px",
            background: "#fff",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            border: "1.5px solid var(--royal-100)",
            whiteSpace: "nowrap",
          }}
        >
          プロフィール
        </Link>
        )}
      </div>
    </div>
  );
}

/**
 * ★スマホ（560px 以下）の行（2026-10-17 / 柴さんの指示。LinkedIn の「人」の一覧の形）。
 *   [アバター 52px] 名前 / 会社 / 職種 [＋フォロー]
 *
 * ⚠️ 中身は `GridCard` と**同じ**（名前・会社・職種・フォロー）。並べ方だけを変える。
 *    情報を足し引きしないこと（ビュートグルで情報が増減する形にしない、と同じ理由）。
 * ⚠️ スマホではビュートグルを出さず、常にこの行で出す（1列なので「一覧／詳細」の差が無い）。
 */
export function CompactRow({ card, myUserId, followedUserIds, followerUserIds = [] }: {
  card: AmbassadorCard; myUserId: string | null; followedUserIds: string[]; followerUserIds?: string[];
}) {
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/u/${card.userId}`)} className="ppl-compact-row">
      <Avatar card={card} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.name}
        </div>
        <div className="ppl-compact-aff"><AffiliationBlock card={card} /></div>
        {card.roleName && <div className="ppl-compact-role">{card.roleName}</div>}
      </div>
      {showFollowOnCard(myUserId, card.userId) && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexShrink: 0, gap: 6, alignItems: "center" }}>
          {/* ★メッセージ（2026-10-17）。2026-11-05 から塗りの主ボタン（狭いので丸いアイコン）。⚠️ GridCard と情報をそろえる */}
          <DMButton targetUserId={card.userId} targetName={card.name} variant="iconPrimary" />
          {/* ⚠️★`refreshOnChange` を外さないこと（GridCard と同じ理由）。見た目は GridCard と同じ（2026-11-03） */}
          <div style={{ width: 112, display: "flex" }}>
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              followsMe={followerUserIds.includes(card.userId)}
              isAuthenticated
              card
              refreshOnChange
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 1列表示の行（2026-08-23）。
 *
 * ⚠️ **カードより情報を増やすこと。** 2026-08-04 に「一覧/詳細」トグルを撤去した理由が
 *    「詳細ビューのほうが情報量が少なく、一覧との差が利用者に伝わらない」だった。
 *    横に広い行なので、カードに入らない**業種の移り変わり**（新卒入社 → 現在）を足してある。
 *    ⚠️★**2026-09-18 まで「社会人年数」と「外資系経験」だった**（柴さんの指示で差し替え）。
 *       差し替えであって削除ではない。**ここを空にしないこと** ——
 *       カードと同じ情報量になると、同じ理由でまた撤去することになる。
 *
 * ⚠️ 年齢は出さない（`PeopleCard` の型にそもそも無い。一覧に年齢を出さない方針）。
 */
export function ListRow({ card, myUserId, followedUserIds, followerUserIds = [], pathNote, consultable = false }: {
  card: AmbassadorCard;
  /** ★相談可能なユーザーか（2026-11-12）。名前の右に印を出す */
  consultable?: boolean;
  myUserId: string | null;
  followedUserIds: string[];
  followerUserIds?: string[];
  /** ★前の経歴で絞っているときの「以前: A → 次: B」（2026-11-03） */
  pathNote?: string;
}) {
  const router = useRouter();
  /* ★新卒入社（職歴のいちばん古い行）の業種 → 現在（いちばん新しい行）の業種
        （2026-09-18 / 柴さんの提案）。値は `lib/people/directory.ts` が
        `ow_companies.industry_id` から作る。ここで組み立て直さないこと。
     ⚠️★**同じ業種なら矢印を出さず1つだけ出す。** 職歴1件の人もここに落ちる。
        「IT・ソフトウェア → IT・ソフトウェア」は読む価値が無い。
     ⚠️★**引けなければ行ごと出さない。** 自由入力の会社・業種未設定の企業・職歴0件が
        該当する。「不明」や推測で埋めないこと。 */
  const industryPath =
    card.firstIndustry && card.currentIndustry
      ? (card.firstIndustry === card.currentIndustry
          ? card.currentIndustry
          : `${card.firstIndustry} → ${card.currentIndustry}`)
      : null;

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      /* ★意匠は企業一覧の横カード（globals.css の `.company-list-card`）に合わせてある。
            余白・角丸・影・hover・アバター寸法まで同じ値。片方だけ動かさないこと。
         ⚠️ 余白と gap をインラインに書き戻さないこと。狭幅で折り返す指定が効かなくなる。 */
      className="ppl-list-row"
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar card={card} size={68} />
      </div>

      {/* ⚠️★`flex: 1` にしないこと（2026-09-18）。伸ばすと、内容が短い人の行で
             **名前の塊と CTA のあいだに死んだ余白**ができる（実データは1〜2行しかない）。
             伸びない代わりに `.ppl-row-cta` の `margin-left: auto` が CTA を右へ送る。 */}
      <div style={{ flex: "0 1 auto", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="ppl-row-name" style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", transition: "color 0.15s" }}>{card.name}</span>
          {/* ⚠️ 名前の右の「面談OK」バッジは 2026-10-16 に撤去した。2026-11-12 から「相談可能」の印を出す（別の仕組み） */}
          {consultable && <ConsultBadge />}
        </div>

        {/* ★会社 → 職種 → 業種の移り変わりを**1行に畳んである**（2026-09-18）。
               カードと同じ並び（どこの人かが先に読めるほうが探しやすい）。
               ⚠️ 以前は項目ごとに別の行へ分けており、内容の少ない人の行が
                  縦にも横にも空いて見えていた。**別行に戻さないこと。**
               ⚠️ 所属は会社とは限らない（学校・元所属もある）。自前で組み立てず
                  `AffiliationBlock` を通す。型がユニオンなので `companyName` を
                  直接読むと学校の分岐で落ちる。 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <AffiliationBlock card={card} />
          {card.roleName && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{card.roleName}</span>
          )}
          {/* ★業種の移り変わり（2026-09-18）。
                 ⚠️★**社会人歴と「外資系の経験あり」はここから外した**（柴さんの指示）。
                    戻すと1行に4つ並ぶ。
                 ⚠️ **外資系の絞り込みは残してある**（`hasForeignExperience`）。
                    消えたのは行の表示だけで、詳細検索のチップは動いている。 */}
          {industryPath && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
              {industryPath}
            </span>
          )}
        </div>
        {pathNote && (
          <div data-state="ppl-path-note" style={{ marginTop: 4, fontSize: 12.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>{pathNote}</div>
        )}

        {/* ★★本人が書いた1行（`headline`）は 2026-09-30 にここからも外した。
               ⚠️★**グリッド側（`ppl-headline`）とセット。** 理由と戻し方はあちらの注記に
                  書いてある。**片方だけ戻さないこと。** */}

      </div>

      {/* ── CTA（縦積み）──
          ⚠️ 幅は `minWidth` で固定する。「フォロー」→「フォロー中」で列幅が動くため
             （企業一覧の「保存」→「保存済」と同じ理由）。
          ⚠️ 意匠は白のまま。navy 塗りにしないこと（グリッドカードと同じ判断。
             行全体が /u/[id] への導線なので、ここを塗ると一覧が主導線だらけになる）。 */}
      <div className="ppl-row-cta">
        {/* ★GridCard と同じく、他の人には「プロフィール」の代わりに「メッセージ」（2026-10-17） */}
        {myUserId !== null && card.userId !== myUserId ? (
          <div className="ppl-row-follow" style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* ★2026-11-05 から塗りの主ボタン（その下のフォローが副） */}
            <DMButton targetUserId={card.userId} targetName={card.name} variant="primary" label="メッセージ" />
          </div>
        ) : (
        <Link
          href={`/u/${card.userId}`}
          target="_blank"
          className="ppl-row-profile-btn"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
            border: "1.5px solid var(--royal-100)", background: "#fff",
            color: "var(--royal)", textDecoration: "none", whiteSpace: "nowrap",
          }}
        >
          プロフィール
        </Link>
        )}
        {showFollowOnCard(myUserId, card.userId) && (
          /* ⚠️ `flexDirection: column` にすること。row のままだと中のボタンが
                内容幅（実測 102px）のままになり、上のプロフィール（列幅124px）と
                **幅が違って左に寄る**。column なら交差軸が横になり、
                既定の align-items: stretch で列幅いっぱいに伸びる。 */
          <div className="ppl-row-follow" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* ⚠️★グリッド側と同じ理由で `refreshOnChange` が要る（上の注記）。見た目は GridCard と同じ（2026-11-03） */}
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              followsMe={followerUserIds.includes(card.userId)}
              isAuthenticated
              card
              refreshOnChange
            />
          </div>
        )}
      </div>
    </div>
  );
}


// ── フィルタ判定 ─────────────────────────────────────────────────────
/**
 * 職種。**`slugs` は ow_roles の slug の配列**（2026-09-18 に単一選択から複数選択へ）。
 * roleSlugToId は page 側で解決して渡す。
 *
 * ⚠️ 同じ項目の中は **OR**（企業一覧と同じ挙動）。
 * ⚠️ slug が1つも解決できないときは絞り込まない（黙って0件にしない）。
 * ⚠️★**現職が無い人は、職種で絞り込んだときだけ落ちる。**`topRoleId` は
 *    現職→直近の順で解決されるので（directory.ts の roleSource）、
 *    職歴が1件も無い人だけが null になる。
 */
function matchRole(card: AmbassadorCard, slugs: string[], roleSlugToId: Record<string, string>): boolean {
  if (slugs.length === 0) return true;
  const ids = slugs.map((v) => roleSlugToId[v]).filter(Boolean);
  if (ids.length === 0) return true;
  return !!card.topRoleId && ids.includes(card.topRoleId);
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, roleSlugToId, roleAliases, myUserId, followedUserIds, followerUserIds, sidebar, prevCareer = null, consultantUserIds = null }: Props) {
  /* ★前の経歴で絞っているとき（2026-11-03）。⚠️ 人数を出さない（PrevCareerProps の注記） */
  const prevNotes = prevCareer?.notes ?? null;
  /* ★絞り込みは URL に持つ（2026-09-18）。共有リンク・リロード・戻るで同じ結果になる。
     ⚠️★**`?view=` は使えない。** `/companies?view=list` は**表示形式**の意味で、
        同じ語を `/people` で「関係の絞り込み」に使うと、隣り合うページで1語が2つの意味を持つ。
        関係は **`?rel=`**（following / followers / coworkers）にしてある。
     ⚠️ 表示形式（grid / list）は URL に入れず localStorage のまま。
        あれは**人ごとの好み**で、共有したい状態ではない。 */
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const roles = useMemo(
    () => (searchParams.get("role") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    [searchParams],
  );
  const rel = searchParams.get("rel") ?? "";
  /* ⚠️ `?meeting=1`（面談OKだけ）は 2026-10-16 に撤去した。古いURLは無視される */
  /* ★詳細検索の条件（2026-09-18）。**すべて URL**。共有・リロード・戻るで同じ結果になる。
     ⚠️ 同じ項目の中は OR、項目どうしは AND（`/companies` と同じ約束）。 */
  const ages = useMemo(
    () => (searchParams.get("age") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    [searchParams],
  );
  const foreignOnly = searchParams.get("foreign") === "1";
  /* ★相談可能なユーザーだけ（2026-11-12。URL は ?consult=1。ホームの箱の「すべて見る」から来る）。
     ⚠️ 判定は lib/featuredConsultants/server.ts の getConsultantUserIds（箱と同じ条件）。ここで条件を作らない */
  const consultOnly = searchParams.get(CONSULTANTS_PARAM) === "1";
  const consultantSet = useMemo(() => new Set(consultantUserIds ?? []), [consultantUserIds]);
  /* ★つながりの選択肢（2026-11-12。上部のチップと「すべてのフィルター」が同じものを使う）。
     ⚠️ ログインしていない・自分の行が無いときは空。同じ会社にいた人は、マスタに紐づく職歴があるときだけ */
  const relOptions = useMemo(() => (sidebar
    ? [
        { value: "following", label: "フォロー中" },
        { value: "followers", label: "フォロワー" },
      ]
    : []), [sidebar]);
  const prevSelected = useMemo(() => prevCareer?.selected ?? { role: null, industry: null, company: null }, [prevCareer]);
  /* ★キーワード（q）もパネルで入れる（2026-11-12）。⚠️ keyword はこの下で宣言しているので、ここでは URL から直に読む */
  const qParam = searchParams.get("q") ?? "";
  const drawerValues = useMemo(() => ({ q: qParam, rel, roles, ages, foreign: foreignOnly, consult: consultOnly, prev: prevSelected }), [qParam, rel, roles, ages, foreignOnly, consultOnly, prevSelected]);
  /* 選んでいる条件の数（「すべてのフィルター」に添える。⚠️ 人数ではない） */
  const prevActive = !!(prevCareer?.selected.role || prevCareer?.selected.industry || prevCareer?.selected.company);
  const activeFilterCount = (qParam ? 1 : 0) + (rel ? 1 : 0) + roles.length + ages.length + (foreignOnly ? 1 : 0) + (consultOnly ? 1 : 0) + (prevActive ? 1 : 0);
  /* ★いま効いている条件（上部のチップ。2026-11-12）。✕ で1つずつ外す */
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(qParam ? [{ key: "q", label: `「${qParam}」`, onRemove: () => setParam({ q: "" }) }] : []),
    ...(rel && relOptions.some((o) => o.value === rel) ? [{ key: `rel-${rel}`, label: relOptions.find((o) => o.value === rel)!.label, onRemove: () => setParam({ rel: "" }) }] : []),
    ...roles.map((v) => ({ key: `role-${v}`, label: ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v, onRemove: () => setRoles(roles.filter((x) => x !== v)) })),
    ...ages.map((v) => ({ key: `age-${v}`, label: AGE_OPTIONS.find((o) => o.value === v)?.label ?? v, onRemove: () => setAges(ages.filter((x) => x !== v)) })),
    ...(foreignOnly ? [{ key: "foreign", label: "外資", onRemove: () => setParam({ foreign: "" }) }] : []),
    ...(consultOnly ? [{ key: "consult", label: "相談可能", onRemove: () => setParam({ [CONSULTANTS_PARAM]: "" }) }] : []),
    ...(prevActive && prevCareer?.activeLabel ? [{ key: "prev", label: `前の経歴: ${prevCareer.activeLabel}`, onRemove: () => setParam(prevParams({ role: null, industry: null, company: null })) }] : []),
  ];

  /** URL のパラメータを1つ書き換える。⚠️ 空文字は**キーごと消す**（`?role=` を残さない） */
  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    /* ⚠️ `scroll: false` を外さないこと。絞り込むたびに先頭へ飛ぶと、
          「条件を足しながら見比べる」という目的が成立しない（/companies と同じ）。 */
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };
  const setRoles = (v: string[]) => setParam({ role: v.join(",") });
  const setAges = (v: string[]) => setParam({ age: v.join(",") });

  /* ⚠️ 詳細検索のパネルは 2026-10-20 に外した（職種・年代・外資を3つとも上部の行に出したため） */

  /* ★既定は「新着順」（2026-08-18 に「プロフィール順」を外したため） */
  const [sort, setSort] = useState("newest");

  /* ★表示モード（2026-08-23）。既定はグリッド。
     ⚠️ **2026-08-04 に撤去した「一覧/詳細」トグルとは別物。**
        あのときの理由は「詳細ビューのほうが情報量が少なく、差が伝わらない」だった。
        今回の1列表示は**カードより情報が増える**（業種の移り変わりを足す）ので、
        同じ理由には当たらない。**情報が減る切り替えを作らないこと。**
     ⚠️ localStorage は**マウント後**に読む。初期値に使うとサーバーと食い違って
        hydration mismatch になる。 */
  const [view, setView] = useState<"grid" | "list">("grid");
  /* ★560px 以下か（2026-10-17）。スマホはコンパクトな行で出す（CompactRow）。
     ⚠️ 初期値 false（SSR と揃える）。.ppl-grid が1列になる境界（560px）と合わせてある */
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const saved = window.localStorage.getItem("people-view");
    if (saved === "list" || saved === "grid") setView(saved);
  }, []);
  const changeView = (v: "grid" | "list") => {
    setView(v);
    try { window.localStorage.setItem("people-view", v); } catch { /* プライベートモード等。表示は続ける */ }
  };
  /* ★キーワードを URL に入れた（2026-10-01 / 柴さんの判断 A-1）。
     ⚠️★**パラメータ名は `q`。** 他の3ページ（/companies /jobs /articles）と同じ名前に
        揃えてある。`/people` だけ別名にしないこと。
     ⚠️★それまで `useState("")` で、**リロードで消え、共有もできなかった。**
        同じ列の4ページで挙動が割れていた唯一の箇所。
     ⚠️ 書き込みは `setParam` の `router.replace`（`scroll: false`）。
        **確定（Enter）のときだけ**書くので履歴は積まれない。
     ⚠️ `kwDraft` は入力中の値。URL が変わったら追従させる（戻る・共有リンクで開いたとき）。 */
  const keyword = qParam;
  /* ★2026-11-12: 一覧の上の検索欄をやめ、キーワードは「フィルター」のパネルで入れる（柴さんの指示。ヘッダーの検索と縦に2つ並んでいた） */
  /* ★「すべてのフィルター」（2026-11-12 / LinkedIn を参考に）。開閉だけをここで持ち、条件は URL のまま */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  /* ★スマホで下へスクロールしたら上部を隠す（2026-10-21） */
  useHideOnScroll(wrapRef);


  /*
    ★キーワードが指す職種の ID 集合（2026-08-26）。

    ⚠️ **`/jobs` の `matchByAlias` と同じ辞書・同じ向き**で引く。
       辞書側は「その語が指す職種そのもの」だけを持ち（`getRoleAliases()` の JSDoc）、
       祖先方向へは広げない。広がりは**受け側の `roleIds` に祖先が入っていること**で作る。
         「営業」               → 営業 を roleIds に持つ人＝営業配下すべて
         「エンタープライズセールス」→ その職種の人だけ（兄弟は出ない）
       が同じ1本の判定で成立する。
    ⚠️ 辞書側を祖先方向に広げないこと。広げると「子職種で検索したのに祖先の兄弟まで出る」。
  */
  const keywordRoleIds = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return null;
    const hits = roleAliases.filter((a) => a.alias.toLowerCase().includes(q));
    if (hits.length === 0) return null;
    return new Set(hits.flatMap((a) => a.roleIds).filter(Boolean));
  }, [keyword, roleAliases]);


  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchRole(a, roles, roleSlugToId)) return false;
      /* ★外資。⚠️ 判定は directory.ts の `hasForeignExperience`（`ow_companies.is_foreign`）。
            `/companies` の「外資系」と同じ元データ。会社名から推測しない。
         ⚠️ マスタに紐付いていない職歴（自由入力の社名）の人は false になり、
            **外資で絞り込んだときだけ**落ちる。 */
      if (foreignOnly && !a.hasForeignExperience) return false;
      if (consultOnly && !consultantSet.has(a.userId)) return false;
      /* ★前の経歴（2026-11-03）。その経歴から次へ進んだ人だけ */
      if (prevNotes && !(a.userId in prevNotes)) return false;
      /* ★年代。⚠️ 生年月日が無い人（ageBand === null）は**ここで絞ったときだけ**落ちる。
            ⚠️ 帯は `directory.ts` が10年刻みに畳んだもの。ここで実年齢を計算しないこと
               （2つ目の計算を作らない。`lib/age.ts` の `getUserAge()` が唯一） */
      if (ages.length > 0 && !(a.ageBand && ages.includes(a.ageBand))) return false;
      /* ★関係の絞り込み（2026-09-18）。⚠️ 自分は常に対象外（自分をフォローはできない） */
      if (rel === "following" && !followedUserIds.includes(a.userId)) return false;
      if (rel === "followers" && !followerUserIds.includes(a.userId)) return false;
      /* ⚠️ 「同じ会社にいた人」（rel=coworkers）は 2026-11-12 に無くした（柴さんの指示）。古い URL は絞らない */
      if (!q) return true;
      // 検索対象。学歴の人は学校名で引けるようにする
      const aff = a.affiliation;
      const company =
        aff.kind === "none" ? "" : aff.kind === "education" ? aff.schoolName : aff.companyName;
      const roleLabel =
        aff.kind === "none" || aff.kind === "education" ? "" : (aff.roleTitle ?? "");
      const byText =
        a.name.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        roleLabel.toLowerCase().includes(q) ||
        (a.roleName ?? "").toLowerCase().includes(q);
      /* ★本文一致と辞書一致の**和集合**（`/jobs` も同じく union）。
            ⚠️ AND にしないこと。今より絞り込まれる語が出て、件数が黙って減る。
         ⚠️ `roleIds` は 2026-08-26 に足した列なので、`unstable_cache`
            （`directory-people` / revalidate 1800）に**古い形の配列が残っていると
            undefined になる**。`?? []` で受ける。 */
      const byAlias = !!keywordRoleIds && (a.roleIds ?? []).some((id) => keywordRoleIds.has(id));
      return byText || byAlias;
    });
  }, [ambassadors, roles, keyword, roleSlugToId, keywordRoleIds,
      rel, followedUserIds, followerUserIds,
      foreignOnly, consultOnly, consultantSet, ages, prevNotes]);

  const sorted = useMemo(() => {
    if (sort === "updated") {
      /* ⚠️ 値が無い人は末尾に置く。0 扱いにして先頭へ来ると
            「最近直した人」の並びとして誤って読める。 */
      return [...filtered].sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    }
    // 既定は「新着順」（登録日の降順）
    return [...filtered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [filtered, sort]);

  /* ★一度に描くのは PAGE_SIZE 人まで（2026-10-19。利用者が増えても画面が重くならないように）。
        絞り込み・並び替えを変えたら先頭に戻す。⚠️ 件数の表示（N名）は sorted の全件のまま */
  const PAGE_SIZE = 60;
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  useEffect(() => { setShownCount(PAGE_SIZE); }, [filtered, sort]);
  const shown = sorted.slice(0, shownCount);
  const moreButton = sorted.length > shownCount ? (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
      <button type="button" data-state="people-more" onClick={() => setShownCount((n) => n + PAGE_SIZE)}
        style={{ padding: "10px 24px", borderRadius: 999, border: "1.5px solid var(--royal-100)", background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
        {prevNotes ? "もっと見る" : `もっと見る（残り${sorted.length - shownCount}名）`}
      </button>
    </div>
  ) : null;

  /* ⚠️ かつてここに `hasFilter` と `clearAll` があった（「✕ すべてクリア」用）。
        2026-09-06 にボタンごと廃止したので消した。
        ⚠️ 復活させるなら **絞り込みを全部含めること**。2026-08-15 まで漏れがあり、
           「他の条件と一緒にクリアしても1つだけ残る」という壊れ方をしていた。
           絞り込みを1つ足したら忘れずに足す。 */

  if (ambassadors.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>まだ登録がありません</div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>プロフィールを登録した方から順に表示されます。</div>
      </div>
    );
  }

  return (
    <>
      <PeopleCardStyles />

      <h1 className="sr-only">登録ユーザーを探す</h1>


      {/* ── 検索 + フィルタバー ── */}
      <div
        ref={wrapRef}
        className="lt-sticky"
        style={{
          position: "sticky", top: 60, zIndex: 30,
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          /* ⚠️ 帯が1本になったぶん詰めた（20px -> 12px）。詰めすぎると検索窓が
                ヘッダーに貼り付いて見える。12 が下限（`/jobs` `/companies` と同じ）。 */
          padding: "12px 0 0",
        }}
      >
        {/* ★lt-compact: 1024px 以上では検索・チップ・件数を1行にまとめる（2026-10-21。globals.css） */}
        {/* ★下の余白は globals.css の .lt-compact が持つ（2026-11-04。/companies・/jobs とそろえた。それまでここに 14px）。
              ⚠️ padding をまとめて書かないこと（下の余白まで 0 で上書きしてしまう） */}
        <div className="ppl-wrap lt-compact ppl-toolbar" style={{ margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>
          {/* ★2026-10-20: 3行にした（柴さんの要望。見本 /dev/preview/list-toolbar。/companies・/jobs と同じ形）。
                 1行目 検索欄（常に開いている）／2行目 条件のチップ（職種・年代・外資）／3行目 件数と並び替え
              ⚠️★**「絞り込み」ボタンは置かない。** 条件が3つしか無く、3つとも外に出したので中身が空になる
                 （押しても何も起きないボタンになる）。条件を足して外に出しきれなくなったら /jobs と同じ形にすること
              ⚠️ 選択中の条件の行（ActiveFilterChips）も置かない。3つともチップ自身が選択状態を持つため */}

          {/* ★いま効いている条件（2026-11-12）。条件があるときだけ、1行目（検索・フィルター・並び替え・表示切替）の下に1行で出す */}
          {activeChips.length > 0 && (
            <div className="list-toolbar ppl-active-row" data-state="people-active-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeChips.map((c) => (
                <button key={c.key} type="button" className="ppl-chip active" data-state="people-active-chip"
                  onClick={c.onRemove} aria-label={`${c.label}の条件を外す`} title={c.label}
                  style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
                  {c.label}<span aria-hidden style={{ fontSize: 12, opacity: 0.85, marginLeft: 4 }}>✕</span>
                </button>
              ))}
            </div>
          )}

          {/* ★3行目: 「前の経歴で絞り込み中」（左）と、表示切替・並び替え（文字だけ）（右）
                ★人数は画面に出さない（2026-11-04 / 柴さんの指示。/companies・/jobs も同じ）。読み上げにだけ残す */}
          <div className="lt-result-row" data-state="people-result-row">
            {/* ⚠️ 前の経歴で絞っているときは人数を読み上げにも出さない（集計の下限を回り込まれる） */}
            {prevNotes ? (
              <span data-state="people-count-hidden" style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>前の経歴で絞り込み中</span>
            ) : (
              <span className="sr-only" aria-live="polite">{sorted.length}名</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, marginLeft: "auto" }}>
              {/* ★フィルターは並び替えの左に置く（2026-11-12 / 柴さんの指示）。それまでは検索欄のすぐ右の別の段にあった */}
              {/* ★2026-11-12: 上部は「すべてのフィルター」と、いま効いている条件のチップだけにした（柴さんの指示）。
                     条件はすべてパネル（PeopleFilterDrawer）で選ぶ。フォロー中・フォロワーは左のプロフィール欄の数字からも絞れる。
                  ⚠️★効いている条件のチップを消さないこと。パネルに隠した条件が画面から消えると、
                     絞り込んだ一覧を見ている理由が分からなくなる（ホームの「すべて見る」から来たとき特に）。
                  ⚠️★**同じ項目の中は OR、項目どうしは AND**（`/companies` と同じ約束）。 */}
              <button type="button" className={`ppl-chip ppl-all-filters${activeFilterCount > 0 ? " has-count" : ""}`} data-action="people-all-filters"
                onClick={() => setDrawerOpen(true)} aria-haspopup="dialog" aria-label={activeFilterCount > 0 ? `すべてのフィルター（${activeFilterCount}件の条件）` : "すべてのフィルター"}>
                {/* ★2026-11-12: 先頭に調整のアイコンを付け、文字は「フィルター」に短くした（柴さんの指示） */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden style={{ marginRight: 6, flexShrink: 0 }}>
                  <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2.2" fill="#fff" />
                  <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2.2" fill="#fff" />
                  <line x1="4" y1="18" x2="20" y2="18" /><circle cx="7" cy="18" r="2.2" fill="#fff" />
                </svg>
                フィルター{activeFilterCount > 0 && <span className="ppl-all-count">{activeFilterCount}</span>}
              </button>
              {/* ★並び替え（2026-11-12 / 柴さんの指示）。文字だけをやめて「並び替え: 新着順 ▾」のボタンにし、高さを上部の他の部品とそろえた（.ppl-toolbar）。
                  ⚠️ 選択肢は SORT_OPTIONS に足すだけ（部品は表示と開閉だけ） */}
              <SortSelect variant="pill" value={sort} options={SORT_OPTIONS} onChange={setSort} />
              {/* 表示モード。★2026-11-12: 濃紺の塗りをやめ、アイコンだけの小さな切り替えにして右端へ（選んでいる方だけ薄い灰色）。
                  ⚠️ 読み上げ名は aria-label。⚠️ 情報が減る切り替えを作らないこと。⚠️ 560px 以下では出さない（isNarrow） */}
              {!isNarrow && (
                <div role="group" aria-label="表示の切り替え" className="ppl-view-toggle">
                  <button type="button" onClick={() => changeView("grid")}
                    aria-pressed={view === "grid"} aria-label="一覧で表示" title="一覧" className="ppl-view-btn btn-fixed-size">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </button>
                  <button type="button" onClick={() => changeView("list")}
                    aria-pressed={view === "list"} aria-label="詳細で表示" title="詳細" className="ppl-view-btn btn-fixed-size">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                      <line x1="8" y1="6" x2="21" y2="6"/>
                      <line x1="8" y1="12" x2="21" y2="12"/>
                      <line x1="8" y1="18" x2="21" y2="18"/>
                      <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                      <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                      <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PeopleFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        values={drawerValues}
        relOptions={relOptions}
        roleOptions={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        ageOptions={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        showConsult={!!consultantUserIds}
        prevCareer={prevCareer ? { options: prevCareer.options, selfStart: prevCareer.selfStart } : null}
        onApply={(next: PeopleFilterValues) => setParam({ q: next.q, rel: next.rel, role: next.roles.join(","), age: next.ages.join(","), foreign: next.foreign ? "1" : "", [CONSULTANTS_PARAM]: next.consult ? "1" : "", ...prevParams(next.prev) })}
        onReset={() => setParam({ q: "", rel: "", role: "", age: "", foreign: "", [CONSULTANTS_PARAM]: "", ...prevParams({ role: null, industry: null, company: null }) })}
      />

      {/* ── コンテンツ ── */}
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "16px 24px 80px" }}>
       <div className="ppl-layout">
        {/* ⚠️ `sidebar` が null なのは未ログイン（middleware で入れないはず）か
               自分の行が引けなかったとき。そのときは出さない。 */}
        {sidebar && (
          <PeopleSidebar
            me={sidebar.me}
            counts={sidebar.counts}
            nextStep={sidebar.nextStep}
            rel={rel}
            onRel={(v) => setParam({ rel: v })}
            myRole={sidebar.myRole}
            roleFilter={roles}
            onRole={setRoles}
          />
        )}
        <div className="ppl-main">
        {prevNotes && prevCareer?.summary}
        {prevNotes && sorted.length > 0 && (
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: "0 0 10px" }}>この経歴から進んだ人</h2>
        )}
        {prevNotes && sorted.length === 0 ? (
          <div data-state="people-prev-none" style={{ textAlign: "center", padding: "32px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            この経歴から次へ進んだ人は、まだいません。
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
            {/* ★この窓は名前・会社・職種の絞り込みで、業種は対象外。
                   「IT」のような語は0件が正しいが、行き止まりにしない（2026-08-27）。 */}
            <SearchAllLink q={keyword} />
          </div>
        ) : (
          isNarrow ? (
            /* ★スマホは縦長のカードを2列（2026-10-19 / 柴さんの判断。それまでは1人1行の CompactRow）。ビュートグルは出さない */
            <><div className="ppl-grid">
              {shown.map((card) => (
                <GridCard key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} followerUserIds={followerUserIds} narrow pathNote={prevNotes?.[card.userId]} consultable={consultantSet.has(card.userId)} />
              ))}
            </div>{moreButton}</>
          ) : view === "list" ? (
            <><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((card) => (
                <ListRow key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} followerUserIds={followerUserIds} pathNote={prevNotes?.[card.userId]} consultable={consultantSet.has(card.userId)} />
              ))}
            </div>{moreButton}</>
          ) : (
          <><div className="ppl-grid">
            {shown.map((card) => (
              <GridCard key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} followerUserIds={followerUserIds} pathNote={prevNotes?.[card.userId]} consultable={consultantSet.has(card.userId)} />
            ))}
          </div>{moreButton}</>
          )
        )}

        {/* ⚠️★一覧下部の但し書きは 2026-09-18 に**2つとも**削除した（柴さんの指示）。
               ① 面談OK の説明（実際に申し込めるかは会社ごとに異なる）
               ② 在籍確認をしていないこと（所属・職種・経歴は本人の登録内容）
            ⚠️ ②は CLAUDE.md で「なりすましは3つで受ける」の③として挙げていたもの。
               **`/people` では出さなくなった。** 同じ趣旨の文言は企業ページ
               （`CompanyEmployeeSections`）・`/biz/members`・`/admin` の2画面・
               通知メールに**別の言い回しで残っている**（そちらは指示の対象外）。
            ⚠️ 枠ごと消してある。中身が無い `<div>` を残さないこと。 */}
        </div>
       </div>
      </div>
    </>
  );
}
