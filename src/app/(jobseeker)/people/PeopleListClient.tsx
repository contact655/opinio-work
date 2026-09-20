"use client";

import { SearchAllLink } from "@/components/jobseeker/SearchAllLink";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { DirectoryPerson } from "@/lib/people/directory";
import type { SearchAlias } from "@/lib/supabase/queries";
import { FollowUserButton } from "../u/[id]/FollowUserButton";
import { SortSelect } from "@/components/common/SortSelect";
import { useSearchParams, usePathname } from "next/navigation";
import { PeopleSidebar } from "@/components/people/PeopleSidebar";
import { FilterChip } from "@/components/common/FilterChip";
import type { PeopleSidebarData } from "@/lib/people/sidebarData";

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
 *   verified … ow_company_members 由来。社名のテキストのみ
 *   self     … ow_experiences の現職。verified と同じ見た目
 *   past      … 現職が無い人の直近の所属。「元 Salesforce」の形
 *   education … 職歴がまだ無い人の最終学歴。学帽アイコン + 学校名
 *   none      … 何も出さない（この人はそもそも一覧に出ない）
 *
 * ⚠️ verified は「企業が在籍を確認した」という意味ではない。2026-08-04 実測で、
 *    公開中の4件はすべて invited_at / invited_by が空＝運営が直接作った行であり、
 *    企業側の招待フローを通っていない。ドメイン認証済みの企業も 85社中0社。
 *    在籍確認済みを示す ✓ を出していたが、根拠が無いため同日削除した。
 *    企業側の確認フローが実際に回り始めるまで、確認済みを示す印を復活させないこと。
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

  if (a.kind === "self") {
    /* ⚠️★verified と**同じ見た目**にしてある（2026-09-20）。
          それまで self だけ弱く出していたが、区別の担い手はロゴだった
          （CSS に「企業ロゴを付けない = 承認済みと区別が付く」と書いてあった）。
          ロゴを外した以上、**文字の太さだけが違う**状態は読み手に解読できない。
       ⚠️ そもそも verified は「企業が在籍を確認した」という意味ではない（冒頭の注記）。
          **弱く出し直さないこと。** */
    return (
      <div className="ppl-company">
        <span>{a.companyName}</span>
      </div>
    );
  }

  /* verified。⚠️★**企業ロゴを出さないこと**（2026-09-20 / 柴さんの指示）。
        それまでは社名の左に 22px のロゴ（画像が無い企業は「K」「A」の文字四角）を
        置いていたが、**文字四角は隣の社名と同じ情報しか運んでいない**うえ、
        実ロゴを持つ企業（HPE・CTC）と持たない企業（KOSKA・Archi Village）で
        **同じ一覧の中に「アイコン付きの行」と「テキストだけの行」が混在**していた。
        LinkedIn の「つながりの提案」も社名はテキストだけ。**画像を足し戻さない。** */
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

// ── グリッドカード ────────────────────────────────────────────────────
function GridCard({ card, myUserId, followedUserIds }: {
  card: AmbassadorCard; myUserId: string | null; followedUserIds: string[];
}) {
  const router = useRouter();
  // ⚠️ ow_company_members.role_title（自由記述）ではなく ow_roles の職種名を出す。
  //    自由記述は「営業」「Enterprise Account Executive」「セールス（デジタルセールス）」
  //    「営業（金融ソリューション）」のように粒度がばらばらで、
  //    同じ職種でも読み手が毎回解釈することになるため（2026-08-04）。
  //    肩書きそのものに意味がある /u/[id] と /biz/candidates では役職名を残している。
  const role = card.roleName;
  /* ★判定は `ow_company_members` で公開中 ＋ その企業に在籍中の経歴（2026-08-23 / B-1）。
        ⚠️ 以前は `ow_users.can_casual_meeting`（運営が個別に立てるフラグ）だった。
           本人の申請＋企業の承認へ一本化したので、運営フラグは見ない。
        ⚠️ **企業の受付状態は見ない**（方針D）。バッジは「申し込める」ではなく
           「この会社について話してよいと言っている人」を意味する。 */
  const isAvailable = card.canTalk;

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      className="ppl-grid-card"
      style={{ position: "relative" }}
    >
      {/* 右上 面談可バッジ */}
      {isAvailable && (
        <span style={{
          position: "absolute", top: 10, right: 10,
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, fontWeight: 700,
          padding: "3px 9px", borderRadius: 100,
          background: "#FFF7ED", color: "#C2410C",
          border: "1px solid #FED7AA", whiteSpace: "nowrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          zIndex: 1,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
          {/* ★バッジは**本人が同意していれば「面談可」**（2026-08-23 に方針変更）。
                 会社の受付状態では出し分けない。
              ⚠️ **一度は受付状態で出し分けていた**（受付中だけ「面談可」、
                 それ以外は「話を聞けます」）が、柴さんの判断で一本化した。
              ⚠️ そのぶん**申し込めない相手にも「面談可」と出る。**
                 実測（2026-08-23）でバッジが出る4名のうち会社が受付中なのは1社だけ。
                 画面下の注釈で「申込可否は会社ごとに異なる」ことを必ず書いておくこと。
              ⚠️ 文言は企業ページ・`/u/[id]` のバッジと揃える（出所が同じ）。 */}
          面談OK
        </span>
      )}

      {/* アバター */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
        <Avatar card={card} size={88} />
      </div>

      {/* 名前・役職・所属 */}
      <div style={{ textAlign: "center", marginBottom: 12, marginTop: 6, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }}>
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
      <div style={{ marginTop: "auto", width: "100%", display: "flex", gap: 6, alignItems: "stretch" }}>
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
        {myUserId !== null && card.userId !== myUserId && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexShrink: 0 }}
          >
            {/* ⚠️★`refreshOnChange` を外さないこと。外すとサイドバーの「フォロー中 N人」と
                   `?rel=following` の絞り込みがサーバーの値のまま取り残される。 */}
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              isAuthenticated
              compact
              refreshOnChange
            />
          </div>
        )}
      </div>
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
function ListRow({ card, myUserId, followedUserIds }: {
  card: AmbassadorCard;
  myUserId: string | null;
  followedUserIds: string[];
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
          {card.canTalk && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
              background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA",
              whiteSpace: "nowrap",
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
              {/* ⚠️ 文言はカード・企業ページ・/u/[id] と揃える（出所が同じ） */}
              面談OK
            </span>
          )}
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

      </div>

      {/* ── CTA（縦積み）──
          ⚠️ 幅は `minWidth` で固定する。「フォロー」→「フォロー中」で列幅が動くため
             （企業一覧の「保存」→「保存済」と同じ理由）。
          ⚠️ 意匠は白のまま。navy 塗りにしないこと（グリッドカードと同じ判断。
             行全体が /u/[id] への導線なので、ここを塗ると一覧が主導線だらけになる）。 */}
      <div className="ppl-row-cta">
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
        {myUserId !== null && card.userId !== myUserId && (
          /* ⚠️ `flexDirection: column` にすること。row のままだと中のボタンが
                内容幅（実測 102px）のままになり、上のプロフィール（列幅124px）と
                **幅が違って左に寄る**。column なら交差軸が横になり、
                既定の align-items: stretch で列幅いっぱいに伸びる。 */
          <div className="ppl-row-follow" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            {/* ⚠️★グリッド側と同じ理由で `refreshOnChange` が要る（上の注記）。 */}
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              isAuthenticated
              refreshOnChange
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 選択中の条件のチップ（2026-09-18）。
 *
 * ⚠️★**詳細検索を畳んだときに、いま効いている条件を外に出すためのもの。消さないこと。**
 *    8条件を畳んだ `/jobs` と同じ理由で、無いと「絞り込んだ結果を見ている最中に
 *    理由が画面から消える」。
 */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 999,
      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      color: "var(--royal)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {label}
      <button type="button" onClick={onRemove} aria-label={`${label} を外す`}
        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12, lineHeight: 1 }}>
        ✕
      </button>
    </span>
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
export function PeopleListClient({ ambassadors, roleSlugToId, roleAliases, myUserId, followedUserIds, followerUserIds, sidebar }: Props) {
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
  const meetingOnly = searchParams.get("meeting") === "1";
  /* ★詳細検索の条件（2026-09-18）。**すべて URL**。共有・リロード・戻るで同じ結果になる。
     ⚠️ 同じ項目の中は OR、項目どうしは AND（`/companies` と同じ約束）。 */
  const ages = useMemo(
    () => (searchParams.get("age") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    [searchParams],
  );
  const foreignOnly = searchParams.get("foreign") === "1";

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
  /** 複数選択の1件を入れ替える。⚠️ 同じ項目の中は OR なので、単に足し引きするだけ */
  const toggleIn = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  /* ★詳細検索パネルの開閉。⚠️ URL には入れない（条件ではなく画面の状態）。
        ⚠️ 条件が付いているときは**開いた状態で始める**。閉じたまま結果だけ絞られていると
           理由が画面から読めない（`/jobs` で 2026-09-09 に同じ判断をしている）。 */
  const activeFilterCount = roles.length + ages.length + (foreignOnly ? 1 : 0) + (meetingOnly ? 1 : 0);
  const [detailOpen, setDetailOpen] = useState(false);

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
  useEffect(() => {
    const saved = window.localStorage.getItem("people-view");
    if (saved === "list" || saved === "grid") setView(saved);
  }, []);
  const changeView = (v: "grid" | "list") => {
    setView(v);
    try { window.localStorage.setItem("people-view", v); } catch { /* プライベートモード等。表示は続ける */ }
  };
  const [keyword, setKeyword] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
  }

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

  /* 「同じ会社にいた人」用。⚠️ id の集合で突き合わせる（社名の文字列で比べない）。
        表記ゆれで別会社を同じと見なすし、本人が伏せた社名を復元することにもなる。 */
  const myCompanyIdSet = useMemo(
    () => new Set(sidebar?.myCompanyIds ?? []),
    [sidebar],
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchRole(a, roles, roleSlugToId)) return false;
      /* ★面談OK。⚠️ 判定は directory.ts の `canTalk`（lib/companyMembers/talkable.ts）。
            ここで display_consent 等の条件を書き直さないこと。 */
      if (meetingOnly && !a.canTalk) return false;
      /* ★外資。⚠️ 判定は directory.ts の `hasForeignExperience`（`ow_companies.is_foreign`）。
            `/companies` の「外資系」と同じ元データ。会社名から推測しない。
         ⚠️ マスタに紐付いていない職歴（自由入力の社名）の人は false になり、
            **外資で絞り込んだときだけ**落ちる。 */
      if (foreignOnly && !a.hasForeignExperience) return false;
      /* ★年代。⚠️ 生年月日が無い人（ageBand === null）は**ここで絞ったときだけ**落ちる。
            ⚠️ 帯は `directory.ts` が10年刻みに畳んだもの。ここで実年齢を計算しないこと
               （2つ目の計算を作らない。`lib/age.ts` の `getUserAge()` が唯一） */
      if (ages.length > 0 && !(a.ageBand && ages.includes(a.ageBand))) return false;
      /* ★関係の絞り込み（2026-09-18）。⚠️ 自分は常に対象外（自分をフォローはできない） */
      if (rel === "following" && !followedUserIds.includes(a.userId)) return false;
      if (rel === "followers" && !followerUserIds.includes(a.userId)) return false;
      if (rel === "coworkers") {
        if (a.userId === myUserId) return false;
        /* ⚠️ マスタ紐付きの経歴だけが対象。自由入力の社名は突き合わせない（推測しない） */
        if (!(a.companyIds ?? []).some((id) => myCompanyIdSet.has(id))) return false;
      }
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
      meetingOnly, rel, followedUserIds, followerUserIds, myUserId, myCompanyIdSet,
      foreignOnly, ages]);

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
        /* ★左サイドバー（240px）が入ったぶん、列を1つ減らした（2026-09-18）。
           ⚠️★**実測して決めた値。** 1440px では wrap 1300 − 左右padding 48 − サイドバー 240
              − gap 24 = 988px を4列で割って **1枚 235px**。
              これは 2026-08-04 に「職種が2行に折り返さない下限」として実測した幅と同じ。
           ⚠️ 900〜1439px は wrap 1100 なので 3列（1枚 252px）。ここを4列に増やすと
              1枚 185px になり、カード内の「プロフィール」+「+フォロー」の横並びが割れる。 */
        .ppl-layout { display: flex; gap: 24px; align-items: flex-start; }
        .ppl-main { flex: 1; min-width: 0; }
        .ppl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        @media (min-width: 1440px) {
          .ppl-wrap { max-width: 1300px; }
          .ppl-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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
        @media (max-width: 560px)  { .ppl-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }

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
        .ppl-company {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.35;
          margin-bottom: 6px; overflow-wrap: anywhere;
        }
        /* 元所属（元◯◯）と学校名。現職の社名より弱く出す。
           ⚠️★**現職（verified / self）には付けない。** 2026-09-20 に企業ロゴを外すまで、
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
          /* ⚠️ 子セレクタ（>）を書かないこと。React はこの style の中身を
                テキストとして扱うので **&gt; に化けて規則ごと死ぬ**（実測）。
                クラス名で指定する。 */
          /* ⚠️ flex: 1 だと**幅が揃わない**（実測 162px / 123px）。
                プロフィール側の padding + border 39px ぶんだけ広くなる。
                半分ずつに固定する（4px は gap 8px の半分）。 */
          .ppl-row-profile-btn, .ppl-row-follow { flex: 0 0 calc(50% - 4px); }
        }

        /* FilterChip */
        .ppl-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 999px;
          border: 1.5px solid #e2e8f0; background: #fff;
          color: var(--ink); font-size: 13px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: all 0.12s; font-family: inherit; flex-shrink: 0;
        }
        .ppl-chip:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        /* ⚠️★active の見た目は components/common/FilterChip と揃えてある（2026-09-18）。
              同じ行に「詳細検索 / 外資 / 面談OK」（このクラス）と
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
      `}</style>

      <h1 className="sr-only">登録ユーザーを探す</h1>


      {/* ── 検索 + フィルタバー ── */}
      <div
        ref={wrapRef}
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
        <div className="ppl-wrap" style={{ margin: "0 auto", padding: "0 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 検索インプット。
                ⚠️★フォーカスの表示は `.search-shell:focus-within`（globals.css）。
                   JS でインラインの style を書き換える形から寄せた（2026-09-09）。
                   この殻は入力欄側の二重枠も止める（丸の中に四角が重なっていた）。 */}
            <div className="search-shell" style={{
              /* ⚠️ ここに残すのは**配置だけ**。枠と背景は `.search-shell`（globals.css）。 */
              position: "relative", flex: "1 1 220px", minWidth: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="名前・会社・職種で検索"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "var(--ink)", background: "transparent", padding: "9px 0", minWidth: 0, fontFamily: "inherit" }}
                aria-label="ユーザーを検索"
              />
              {keyword && (
                <button type="button" onClick={() => { setKeyword(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 16, padding: "2px" }} aria-label="クリア">✕</button>
              )}
            </div>

            {/* ★「詳細検索」（2026-09-18）。**`/companies` と同じ形**にした。
                   ⚠️ 2026-09-17 の注記が「2つ目の絞り込みを足して1行に収まらなくなったら
                      `/companies` と同じ『詳細検索』にすること（**選択中の条件を外に出す**のも
                      セット）」と予告していた形そのもの。予告どおり両方やっている。
                ⚠️★**職種はここへ移した。** 上部に単独で出さないこと（入口が2つになる）。 */}
            <button
              type="button"
              onClick={() => setDetailOpen(!detailOpen)}
              className={`ppl-chip${detailOpen || activeFilterCount > 0 ? " active" : ""}`}
              aria-expanded={detailOpen}
            >
              詳細検索{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
            </button>

            {/* ── ★並び替え・表示形式・件数（2026-09-17 に下の帯からここへ移した）──────
                   それまで sticky な帯が2本あり、一覧が始まるのは 275px 前後だった。
                   `/jobs`（162px）・`/companies`（164px）を同日に1本にしたのと同じ形に揃えた。

                ⚠️★**白いカードの装飾（枠・影・角丸）は外した。** 帯が1本になったので、
                   同じ行の中にもう1枚カードを置くと「窓の中の窓」になり、
                   行の高さが跳ね上がる（`/companies` で実測 62px → ツールバー 121px）。

                ⚠️★**`/companies` と違い、チップは畳んでいない。** あちらは6つあって
                   1行に収まらなかったが、ここは**職種の1つだけ**（2026-09-17 に
                   外資系を外した）。畳むと、**唯一の絞り込みをクリックの奥に隠す**ことになる。
                   ⚠️ 2つ目のチップを足して収まらなくなったら、そのときに
                      `/companies` と同じ「詳細検索」の形にすること
                      （**選択中の条件を外に出す**のもセット）。

                ⚠️ 件数を右端に寄せるのは `marginLeft: auto`。**行を折ったときだけ効く。** */}
            {/* ⚠️★`flexShrink: 0` にしないこと（2026-09-17 に入れて 375px で実際にはみ出した）。
                   この群の intrinsic は **383px** で、375px のときの親は **327px**。
                   縮めないと親を 56px 超える。`flexWrap` で中を折り、`minWidth: 0` で縮めさせる。
                ⚠️ `marginLeft: auto` は**行を折ったときだけ効く**（1行のときは余白が無いので 0）。 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, rowGap: 8,
              flexWrap: "wrap", minWidth: 0, marginLeft: "auto",
            }}>
          {/* ★並び替え（2026-09-17 にドロップダウンへ）。実体は components/common/SortSelect。
                 `/jobs`・`/companies` と**同じ部品**。⚠️ ここに直書きしないこと。

              ⚠️★**選択肢は2つしかないので、1クリックが2クリックになる。** 承知のうえで
                 揃えた（柴さんの指示）。**3つの一覧で同じ操作が同じ見た目であること**を
                 優先している —— ビュートグルを 2026-08-27 に揃えたのと同じ理由。
              ⚠️ 3つ目の選択肢を足す日が来ても、ここは変えなくてよい（SORT_OPTIONS に足すだけ）。 */}
          <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} />
          {/* 表示モードと件数。
              ★意匠は `/companies` のビュートグル（`components/companies/GridSortBar.tsx`）と
                揃えてある（2026-08-27）。**同じ操作が2つの一覧で別の見た目だったため。**
                `.view-btn` は globals.css の共通クラスで、あちらと同じものを使っている。
                ⚠️ **片方だけ変えないこと。** 揃えたのが目的なので、ずらすと意味が無くなる。

              ⚠️ ラベルを「一覧 / 詳細」にしたが、**2026-08-04 に撤去した同名のトグルとは別物。**
                 あれは詳細ビューのほうが**情報量が少なく**、差が伝わらないので外した。
                 いまの1列表示は**カードより情報が増える**（業種の移り変わり）ので、
                 「詳細」という語が実態と合っている。
                 ⚠️ **情報が減る切り替えを作らないこと**（この制約は変わっていない）。

              ⚠️ state の値（`grid` / `list`）と localStorage のキー（`people-view`）は
                 変えていない。**見た目だけの変更。** 保存済みの設定がそのまま効く。 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div role="group" aria-label="表示の切り替え" style={{
              display: "flex", gap: 2,
              background: "var(--line-soft)", borderRadius: 8, padding: 2,
            }}>
              <button type="button" onClick={() => changeView("grid")}
                aria-pressed={view === "grid"} className="view-btn" title="コンパクト一覧"
                style={{
                  background: view === "grid" ? "var(--royal)" : "transparent",
                  color: view === "grid" ? "#fff" : "var(--ink-mute)",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                一覧
              </button>
              <button type="button" onClick={() => changeView("list")}
                aria-pressed={view === "list"} className="view-btn" title="詳細リストビュー"
                style={{
                  background: view === "list" ? "var(--royal)" : "transparent",
                  color: view === "list" ? "#fff" : "var(--ink-mute)",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
                詳細
              </button>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--line)" }} />
            <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "var(--font-inter), sans-serif", fontSize: 16 }}>
                {sorted.length}
              </strong> 名
            </span>
          </div>
            </div>
          </div>

            {/* ── ★詳細検索のパネル（2026-09-18）。押すと下に1行で開く ──────────────
                   ⚠️★**同じ項目の中は OR、項目どうしは AND**（`/companies` と同じ約束）。
                   ⚠️★**値を持たない人は、その項目で絞ったときだけ落ちる。**
                      現職なし → 職種のときだけ／生年月日なし → 年代のときだけ／
                      マスタ紐付きの職歴なし → 外資のときだけ。他の条件では落とさない。 */}
            {detailOpen && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, rowGap: 8,
                flexWrap: "wrap", minWidth: 0, paddingTop: 10,
              }}>
                <FilterChip
                  label="職種" value="" values={roles}
                  options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onSelect={() => setRoles([])}
                  onToggleValue={(v) => setRoles(toggleIn(roles, v))}
                  isOpen={openChip === "role"} onToggle={() => toggleChip("role")}
                />
                {/* ⚠️ 0人の年代も出す（AGE_OPTIONS の注記）。実データから作らないこと */}
                <FilterChip
                  label="年代" value="" values={ages} options={AGE_OPTIONS}
                  onSelect={() => setAges([])}
                  onToggleValue={(v) => setAges(toggleIn(ages, v))}
                  isOpen={openChip === "age"} onToggle={() => toggleChip("age")}
                />
                {/* ON/OFF は選択肢が2つしか無いのでチップにしない（開く意味が無い） */}
                <button type="button" className={`ppl-chip${foreignOnly ? " active" : ""}`}
                  onClick={() => setParam({ foreign: foreignOnly ? "" : "1" })} aria-pressed={foreignOnly}>
                  外資
                </button>
                <button type="button" className={`ppl-chip${meetingOnly ? " active" : ""}`}
                  onClick={() => setParam({ meeting: meetingOnly ? "" : "1" })} aria-pressed={meetingOnly}>
                  面談OK
                </button>
              </div>
            )}

            {/* ── ★選択中の条件（2026-09-18）。**閉じていても出す。消さないこと。**
                   8条件を畳んだ `/jobs` と同じ理由 —— これが無いと、絞り込んだ結果を
                   見ている最中に理由が画面から消える。
                ⚠️ ✕ は近道であって唯一の入口ではない（パネルを開けばチップからも外せる）。 */}
            {!detailOpen && activeFilterCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, rowGap: 6, flexWrap: "wrap", paddingTop: 8 }}>
                {roles.map((v) => (
                  <ActiveChip key={`r-${v}`} label={ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    onRemove={() => setRoles(roles.filter((x) => x !== v))} />
                ))}
                {ages.map((v) => (
                  <ActiveChip key={`a-${v}`} label={AGE_OPTIONS.find((o) => o.value === v)?.label ?? v}
                    onRemove={() => setAges(ages.filter((x) => x !== v))} />
                ))}
                {foreignOnly && <ActiveChip label="外資" onRemove={() => setParam({ foreign: "" })} />}
                {meetingOnly && <ActiveChip label="面談OK" onRemove={() => setParam({ meeting: "" })} />}
              </div>
            )}
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "16px 24px 80px" }}>
       <div className="ppl-layout">
        {/* ⚠️ `sidebar` が null なのは未ログイン（middleware で入れないはず）か
               自分の行が引けなかったとき。そのときは出さず、面談OKの注意書きだけ下で補う。 */}
        {sidebar && (
          <PeopleSidebar
            me={sidebar.me}
            counts={sidebar.counts}
            nextStep={sidebar.nextStep}
            meetingOk={sidebar.meetingOk}
            rel={rel}
            onRel={(v) => setParam({ rel: v })}
            meetingFilter={meetingOnly}
            onMeetingFilter={(v) => setParam({ meeting: v ? "1" : "" })}
            myRole={sidebar.myRole}
            roleFilter={roles}
            onRole={setRoles}
            hasCompanyHistory={sidebar.myCompanyIds.length > 0}
          />
        )}
        <div className="ppl-main">
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
            {/* ★この窓は名前・会社・職種の絞り込みで、業種は対象外。
                   「IT」のような語は0件が正しいが、行き止まりにしない（2026-08-27）。 */}
            <SearchAllLink q={keyword} />
          </div>
        ) : (
          view === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map((card) => (
                <ListRow key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} />
              ))}
            </div>
          ) : (
          <div className="ppl-grid">
            {sorted.map((card) => (
              <GridCard key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} />
            ))}
          </div>
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
