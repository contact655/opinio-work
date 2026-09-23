"use client";

import { GridCard, ListRow, PeopleCardStyles, type AmbassadorCard } from "@/app/(jobseeker)/people/PeopleListClient";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 登録ユーザーのカード（/people）のプレビュー（2026-09-23）。
 *
 * ⚠️★**作った理由は「肩書きが出る側を実データで描けない」こと。**
 *    実測（2026-09-23 / 本番）: 肩書きを持つ実ユーザーは **0人**。
 *    しかも `/people` は `is_test` を除外するので、唯一 肩書きを持っている
 *    検証用アカウントも一覧に出てこない。
 *    ⚠️★**`is_test` を一時的に false にして確かめないこと**（柴さんの指示）。
 *       その瞬間、実在企業のページに検証用アカウントが出る。
 *
 * ⚠️★**CSS は `PeopleCardStyles` を通すこと。** カードのクラス（`.ppl-grid-card` /
 *    `.ppl-role` / `.ppl-headline` …）はそこにしか無い。自前で書き写すと
 *    **プレビューだけ本番と違う見え方**になり、確かめた意味が無くなる。
 *
 * ⚠️★**この配下で DB を読まないこと。** 固定データだけを渡す。
 */

const IS_DEV = process.env.NODE_ENV !== "production";

function person(over: Partial<AmbassadorCard> & { userId: string; name: string }): AmbassadorCard {
  return {
    initial: over.name.charAt(0),
    gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
    avatarUrl: null,
    affiliation: { kind: "none" },
    /* ★既定は null（肩書きを書いていない人）。実データでは**こちらが普通** */
    headline: null,
    roleName: null, topRoleId: null, roleIds: [],
    hasForeignExperience: false,
    firstIndustry: null, currentIndustry: null,
    companyIds: [],
    canTalk: false, acceptingCasualMeetings: false,
    publicScore: 0, experienceMonths: null, ageBand: null,
    createdAt: "2026-09-01T00:00:00Z", updatedAt: null,
    ...over,
  };
}

/* ⚠️★40字は `HEADLINE_MAX` の上限ちょうど。数え直すときは
      [...s].length（サロゲートペアを1文字と数える）で数えること。 */
const HEADLINE_40 = "SaaSの法人営業／ISからFSまで10年。次はエンタープライズの立ち上げへ挑戦";

const PEOPLE: AmbassadorCard[] = [
  person({
    userId: "p1", name: "五十嵐 健二",
    affiliation: { kind: "verified", companyId: "c-sfdc", companyName: "株式会社セールスフォース・ジャパン", roleTitle: "マネージャー" },
    headline: HEADLINE_40,
    roleName: "アカウントエグゼクティブ",
    canTalk: true, currentIndustry: "IT・ソフトウェア",
  }),
  person({
    userId: "p2", name: "安藤 誠司",
    affiliation: { kind: "self", companyName: "株式会社ZAP", roleTitle: null },
    headline: "医療SaaSのフィールドセールス",
    roleName: "フィールドセールス",
  }),
  /* ⚠️ 肩書きが無い人。**行ごと出ないこと**（「—」で埋めないこと）を見る */
  person({
    userId: "p3", name: "木村 雅樹",
    affiliation: { kind: "past", companyName: "日本ヒューレット・パッカード合同会社", roleTitle: null, endedYear: 2024 },
    roleName: "インサイドセールス",
  }),
  /* ⚠️ 所属も職種も肩書きも無い人。カードが崩れないことを見る（実ユーザーに実在する形） */
  person({ userId: "p4", name: "高橋 みなみ" }),
];

export default function PeopleCardsPreview() {
  if (!IS_DEV) return null;
  return (
    <div>
      <PreviewHeader title="登録ユーザーのカード（/people）">
        見るところ：<strong>肩書き</strong>が<strong>職種の下</strong>に出ること／
        40字でも<strong>2行までにクランプ</strong>されること／
        <strong>肩書きが無い人は行ごと出ない</strong>こと（「—」で埋めない）／
        所属も職種も無い人でカードが崩れないこと。
        <br />
        ⚠️ 実データでは<strong>肩書きを持つ実ユーザーが0人</strong>で、
        しかも /people は is_test を除外するため、
        <strong>出る側はこの画面でしか見られません。</strong>
      </PreviewHeader>

      {/* ⚠️★CSS は本番と同じ1箇所から出す。ここで書き写さないこと */}
      <PeopleCardStyles />

      <Variant
        label="グリッド（4名）"
        note="⚠️ カードの下端が揃うこと。肩書きが2行を超えないこと"
      >
        <div className="ppl-grid">
          {PEOPLE.map((c) => (
            <GridCard key={c.userId} card={c} myUserId={null} followedUserIds={[]} />
          ))}
        </div>
      </Variant>

      <Variant
        label="一覧（4名）"
        note="⚠️ 肩書きが「会社・職種・業種」の1行と別の行に出ること"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PEOPLE.map((c) => (
            <ListRow key={c.userId} card={c} myUserId={null} followedUserIds={[]} />
          ))}
        </div>
      </Variant>

      <Variant
        label="肩書きが全員にある場合"
        note="⚠️ 一覧が肩書きだけで埋まらないか（職種・会社が読み取れるか）を見る"
      >
        <div className="ppl-grid">
          {PEOPLE.map((c) => (
            <GridCard
              key={c.userId}
              card={{ ...c, headline: c.headline ?? HEADLINE_40 }}
              myUserId={null}
              followedUserIds={[]}
            />
          ))}
        </div>
      </Variant>
    </div>
  );
}
