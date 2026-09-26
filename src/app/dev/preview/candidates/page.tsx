"use client";

import CandidatesClient, { type Candidate } from "@/app/biz/candidates/CandidatesClient";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 候補者を探す（/biz/candidates）のプレビュー（2026-09-20）。
 *
 * ⚠️★**実画面は誰も見られない。** 有料プランが**0社**（2026-09-20 実測）なので、
 *    `canUse(planType, "candidateSearch")` のゲートで全社が止まる。
 *    柴さんも一度も見たことがない画面で、**確認手段はここしかない。**
 *
 * ⚠️ 実データも薄い。企業に見えるのは「転職について」に答えた人だけで、
 *    2026-08-28 の実測では**実ユーザー2人**だった。
 *    0件・1件・条件を効かせた状態はここでしか作れない。
 *
 * ⚠️★**この配下で DB を読まないこと。** 固定データだけを渡す。
 * ⚠️ スカウトボタンは `scoutSendingEnabled={false}` で出していない（実環境と同じ）。
 */

const IS_DEV = process.env.NODE_ENV !== "production";

const ROLE_TREE = [
  { id: "r-sales", name: "営業", children: [
    { id: "r-ae", name: "アカウントエグゼクティブ" },
    { id: "r-fs", name: "フィールドセールス" },
    { id: "r-is", name: "インサイドセールス" },
  ] },
  { id: "r-eng", name: "エンジニア", children: [
    { id: "r-be", name: "バックエンドエンジニア" },
    { id: "r-fe", name: "フロントエンドエンジニア" },
  ] },
  { id: "r-cs", name: "カスタマーサクセス", children: [] },
];

function cand(over: Partial<Candidate> & { id: string; name: string }): Candidate {
  return {
    /* ★既定は null（肩書きを書いていない人）。実データでは**こちらが普通**
          —— 2026-09-23 実測で肩書きを持つ実ユーザーは 0人。 */
    headline: null,
    location: null, isActivelyLooking: false,
    careerStance: "open", careerStanceUpdatedAt: null,
    tenureMonths: null, currentRole: null, currentCompany: null,
    employmentType: null, startedAt: null, roleName: null, topRoleName: null,
    desiredRoleIds: [], desiredRoleNames: [], workStyles: null,
    desiredPrefectures: null, desiredSalaryMin: null, desiredSalaryMax: null,
    onboardingCompleted: true, alreadyScouted: false,
    createdAt: "2026-09-01T00:00:00Z", autoSkills: [],
    ...over,
  };
}

const FULL: Candidate[] = [
  cand({
    id: "c1", name: "五十嵐 健二", location: "東京都渋谷区",
    /* ★★上限の40字ちょうど（`HEADLINE_MAX`）。⚠️ 実データで踏めないので**ここで見る**。
          ⚠️ 数え直すときは `[...s].length`（サロゲートペアを1文字と数える）。 */
    headline: "SaaSの法人営業／ISからFSまで10年。次はエンタープライズの立ち上げへ挑戦",
    isActivelyLooking: true, careerStance: "active",
    careerStanceUpdatedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
    tenureMonths: 148, currentRole: "エンタープライズ営業部 マネージャー",
    currentCompany: "株式会社セールスフォース・ジャパン", employmentType: "正社員",
    roleName: "アカウントエグゼクティブ", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-ae"], desiredRoleNames: ["アカウントエグゼクティブ"],
    workStyles: ["hybrid"], desiredPrefectures: ["東京都", "神奈川県"],
    desiredSalaryMin: 900, desiredSalaryMax: 1200,
    createdAt: "2026-09-19T00:00:00Z",
    /* ★できること。⚠️ 帯の文言は `lib/profile/autoSkills.ts` の BANDS と同じもの。
          ⚠️★**上限の4件ちょうど**を入れてある（実画面はサーバーで `.slice(0, 4)`）。
             ここで5件に増やしても実画面とは一致しない —— 切るのはサーバー側なので、
             **このプレビューで上限そのものは検証できない。** */
    autoSkills: [
      { label: "アカウントエグゼクティブ", band: "10年以上" },
      { label: "営業", band: "10年以上" },
      { label: "インサイドセールス", band: "3年以上" },
      { label: "マネジメント", band: "1年以上" },
    ],
  }),
  cand({
    id: "c2", name: "安藤 誠司", location: "大阪府大阪市",
    /* ★短い肩書き。⚠️ c3 以降は `headline: null`（無い人）のまま残してある —— 
          **出さない側の見え方も同じ画面で並べて確かめるため。** */
    headline: "医療SaaSのフィールドセールス",
    careerStance: "researching",
    careerStanceUpdatedAt: new Date(Date.now() - 20 * 86400e3).toISOString(),
    tenureMonths: 40, currentRole: "フィールドセールス", currentCompany: "株式会社ZAP",
    employmentType: "正社員", roleName: "フィールドセールス", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-fs"], desiredRoleNames: ["フィールドセールス"],
    workStyles: ["remote"], desiredSalaryMin: 600,
    alreadyScouted: true, createdAt: "2026-09-10T00:00:00Z",
    autoSkills: [
      { label: "フィールドセールス", band: "3年以上" },
      { label: "営業", band: "3年以上" },
    ],
  }),
  cand({
    /* ⚠️ 社会人年数が未算出（職歴0件）。**「0年」と出ないこと**／
          「社会人年数」で絞っても**落ちないこと**（注記が出る） */
    id: "c3", name: "中里 康貴", location: null,
    careerStance: "open", tenureMonths: null,
    desiredRoleIds: ["r-eng"], desiredRoleNames: ["バックエンドエンジニア"],
    createdAt: "2026-09-05T00:00:00Z",
  }),
  cand({
    /* ⚠️ 長い名前・長い役職・希望勤務地が多い。**操作列が押し出されないこと** */
    id: "c4", name: "グローバル・エンタープライズ 太郎",
    location: "神奈川県横浜市西区みなとみらい",
    isActivelyLooking: true, careerStance: "active",
    careerStanceUpdatedAt: new Date(Date.now() - 5 * 86400e3).toISOString(),
    tenureMonths: 11,
    currentRole: "グローバルエンタープライズセールス統括本部 アカウントエグゼクティブ",
    currentCompany: "アマゾンウェブサービスジャパン合同会社",
    employmentType: "契約社員", roleName: "インサイドセールス", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-is"], desiredRoleNames: ["インサイドセールス", "フィールドセールス"],
    workStyles: ["office"],
    desiredPrefectures: ["東京都", "神奈川県", "千葉県", "埼玉県", "大阪府"],
    desiredSalaryMin: 1200, createdAt: "2026-08-20T00:00:00Z",
  }),
];

const QUOTA = { monthlyLimit: 30, bonusCredits: 0, usedThisMonth: 4, remaining: 26 };

export default function CandidatesPreview() {
  if (!IS_DEV) return null;
  return (
    <div>
      <PreviewHeader title="候補者を探す（/biz/candidates）">
        有料プランのゲートの<strong>内側</strong>です。<strong>実画面は有料プラン0社で誰も開けません。</strong>
        <br />
        見るところ：条件が<strong>上部の「詳細検索」1つ</strong>に畳まれていること／
        閉じると<strong>選択中の条件がチップで外に出る</strong>こと／並び替えがあること／
        <strong>「転職検討中」が緑でない</strong>・<strong>「メンター」バッジが出ない</strong>こと／
        <strong>「できること」（職種 × 年数）</strong>が出ること（YOUTRUST を参考にした。
        ⚠️ 本人の入力ではなく<strong>職歴からの計算</strong>）。
      </PreviewHeader>

      <Variant
        label="4名（通常）"
        note="⚠️ 詳細検索を開くと条件が横に並ぶこと。閉じるとチップだけが残ること"
      >
        <CandidatesClient candidates={FULL} scoutQuota={QUOTA} roleFilterTree={ROLE_TREE} />
      </Variant>

      <Variant
        label="0名（母集合が空）"
        note="⚠️ 文言が「『転職について』に答えている求職者がまだいません」であること（古い『スカウトを受け取る設定』ではない）"
      >
        <CandidatesClient candidates={[]} roleFilterTree={ROLE_TREE} />
      </Variant>

      <Variant
        label="1名（職歴なし・年数が未算出）"
        note="⚠️ 「社会人0年」と出ないこと。所属が無くても行が崩れないこと"
      >
        <CandidatesClient candidates={[FULL[2]]} roleFilterTree={ROLE_TREE} />
      </Variant>
    </div>
  );
}
