"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { formatMonths } from "@/lib/profile/tenure";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { DirectoryPerson } from "@/lib/people/directory";
import type { SearchAlias } from "@/lib/supabase/queries";
import { FollowUserButton } from "../u/[id]/FollowUserButton";
import { usableLogoUrl } from "@/lib/utils/companyLogo";

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

/* ★年齢の選択肢（AGE_OPTIONS）と「年齢」フィルタは 2026-08-20 に撤去した。
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

// ── FilterChip ────────────────────────────────────────────────────────
function FilterChip({
  label, value, options, onSelect, isOpen, onToggle,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const activeOpt = options.find((o) => o.value === value);
  const isActive = !!value;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        className={`ppl-chip${isActive ? " active" : ""}`}
      >
        {isActive && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {isActive ? activeOpt?.label : label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 12, marginLeft: 1, opacity: 0.75 }}
            aria-label="クリア"
          >✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: "1.5px solid var(--royal)",
          borderRadius: 12, padding: "8px 0",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: 180, maxHeight: 320, overflowY: "auto",
        }}>
          {options.map((o) => {
            const sel = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 16px",
                  background: sel ? "var(--royal-50)" : "none",
                  color: sel ? "var(--royal)" : "var(--ink)",
                  fontSize: 13.5, fontWeight: sel ? 700 : 400,
                  cursor: "pointer", border: "none", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function companyInitial(name: string, letter: string | null): string {
  if (letter) return letter;
  return (
    name
      .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人|公益社団法人)\s*/, "")
      .replace(/\s*(株式会社|合同会社|有限会社)$/, "")
      .charAt(0) || name.charAt(0) || "社"
  );
}

/**
 * 所属の表示。出どころで見た目を変える。
 *
 *   verified … ow_company_members 由来。企業ロゴ付き
 *   self     … ow_experiences の現職。ロゴなしのテキストのみ
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
    return (
      <div className="ppl-company ppl-company-self">
        <span>{a.companyName}</span>
      </div>
    );
  }

  // ⚠️ 死んでいると分かっている配信元（Clearbit）は null に潰れる。
  //    判定は lib/utils/companyLogo の usableLogoUrl 1箇所に集約している。
  const logoSrc = usableLogoUrl(a.logoUrl);
  return (
    <div className="ppl-company">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="ppl-company-logo" />
      ) : (
        <span
          className="ppl-company-logo ppl-company-logo-fallback"
          style={{ background: a.logoGradient ?? "linear-gradient(135deg, #001233, #002366)" }}
        >
          {companyInitial(a.companyName, a.logoLetter)}
        </span>
      )}
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
          面談可
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
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              isAuthenticated
              compact
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
 *    横に広い行なので、カードに入らなかった**社会人年数**と**外資系経験**を足してある。
 *    ここを削って見た目だけ変えると、同じ理由でまた撤去することになる。
 *
 * ⚠️ 年齢は出さない（`PeopleCard` の型にそもそも無い。一覧に年齢を出さない方針）。
 */
function ListRow({ card, myUserId, followedUserIds }: {
  card: AmbassadorCard;
  myUserId: string | null;
  followedUserIds: string[];
}) {
  const router = useRouter();
  const months = card.experienceMonths;
  const hasTenure = months !== null && months > 0;
  const tenure = hasTenure ? formatMonths(months) : null;
  /* スタット列は「大きい数字 ＋ 小さい単位」の形（企業一覧の StatCol と同じ）。
     ⚠️ 端数の月を捨てて「N年」に丸めないこと。単位側に寄せて全部出す
        （1年未満の人は月数を数字側に出す）。 */
  const tenureYears = hasTenure ? Math.floor(months / 12) : 0;
  const tenureRest  = hasTenure ? months % 12 : 0;

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

      <div style={{ flex: 1, minWidth: 0 }}>
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
              面談可
            </span>
          )}
        </div>

        {/* 会社 → 職種。カードと同じ並び（どこの人かが先に読めるほうが探しやすい）。
            ⚠️ 所属は会社とは限らない（学校・元所属もある）。自前で組み立てず
               `AffiliationBlock` を通す。型がユニオンなので `companyName` を
               直接読むと学校の分岐で落ちる。 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          <AffiliationBlock card={card} />
          {card.roleName && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{card.roleName}</span>
          )}
        </div>

        {/* ★ここが1列表示の存在理由。カードには入らない情報を出す。
            外資系は企業一覧のメタ行の業種タグと同じ意匠にしてある。 */}
        {card.hasForeignExperience && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11, color: "var(--ink-soft)",
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              padding: "2px 8px", borderRadius: "var(--radius-sm)",
              whiteSpace: "nowrap",
            }}>外資系の経験あり</span>
          </div>
        )}

        {/* 社会人年数（狭幅用）。
            ⚠️ 企業一覧はスタット列を 767px 以下で丸ごと隠すが、こちらは**1列表示の
               存在理由**なので消さない。列を隠すかわりにここへテキストで出す。 */}
        {tenure && (
          <div className="ppl-row-tenure-inline" style={{ marginTop: 4, fontSize: 12, color: "var(--ink-mute)" }}>
            社会人 {tenure}
          </div>
        )}
      </div>

      {/* ── スタット列（企業一覧の StatCol と同じ組み） ──
          ⚠️ 値が無い人は列ごと出さない。「0年」で埋めない。 */}
      {hasTenure && (
        <div className="ppl-row-stats" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--ink)" }}>
                {tenureYears > 0 ? tenureYears : tenureRest}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                {tenureYears > 0 ? (tenureRest > 0 ? `年${tenureRest}ヶ月` : "年") : "ヶ月"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>社会人歴</div>
          </div>
        </div>
      )}

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
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              isAuthenticated
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── フィルタ判定 ─────────────────────────────────────────────────────
/** v は ow_roles の slug。roleSlugToId は page 側で解決して渡す */
function matchRole(card: AmbassadorCard, v: string, roleSlugToId: Record<string, string>): boolean {
  if (!v) return true;
  const id = roleSlugToId[v];
  if (!id) return true;          // slug が解決できない = 絞り込まない（黙って0件にしない）
  return card.topRoleId === id;
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, roleSlugToId, roleAliases, myUserId, followedUserIds }: Props) {
  const [role, setRole] = useState("");

  /* 外資系。⚠️ **これまでの職歴に1社でもあればヒット**（現職に限らない）。
     判定は directory.ts の `hasForeignExperience` に集約している。 */
  const [foreign, setForeign] = useState("");
  /* ★既定は「新着順」（2026-08-18 に「プロフィール順」を外したため） */
  const [sort, setSort] = useState("newest");

  /* ★表示モード（2026-08-23）。既定はグリッド。
     ⚠️ **2026-08-04 に撤去した「一覧/詳細」トグルとは別物。**
        あのときの理由は「詳細ビューのほうが情報量が少なく、差が伝わらない」だった。
        今回の1列表示は**カードより情報が増える**（社会人年数・外資系経験を足す）ので、
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
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

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchRole(a, role, roleSlugToId)) return false;
      if (foreign === "yes" && !a.hasForeignExperience) return false;
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
  }, [ambassadors, role, foreign, keyword, roleSlugToId, keywordRoleIds]);

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

  /* ⚠️ `foreign` を必ず含めること（2026-08-15 修正）。
        以前は両方から漏れており、**外資系だけを選ぶと「✕ すべてクリア」が出ず、
        他の条件と一緒にクリアしても外資系だけ残っていた。**
        絞り込みを1つ足したら、この2つにも足す。 */
  const hasFilter = !!(keyword || role || foreign);

  function clearAll() {
    setKeyword(""); setRole(""); setForeign("");
  }

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
        .ppl-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        @media (min-width: 1440px) {
          .ppl-wrap { max-width: 1300px; }
          .ppl-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }
        @media (max-width: 1024px) { .ppl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
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
        /* 自己申告の所属。企業ロゴを付けない = 承認済みと区別が付く */
        .ppl-company-self { font-weight: 500; color: var(--ink-soft); }
        .ppl-company-logo {
          width: 22px; height: 22px; border-radius: 5px; flex-shrink: 0;
          object-fit: contain; background: #fff; border: 1px solid var(--line);
        }
        .ppl-company-logo-fallback {
          display: flex; align-items: center; justify-content: center;
          border: none; font-size: 12px; font-weight: 800; color: #fff;
        }
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
        .ppl-row-cta {
          flex-shrink: 0; display: flex; flex-direction: column;
          align-items: stretch; gap: 8px; min-width: 124px;
        }
        .ppl-list-row:hover { box-shadow: 0 4px 24px rgba(0,35,102,0.12); border-color: #d0daf5; }
        .ppl-list-row:hover .ppl-row-name { color: var(--royal); }
        /* 社会人年数は、広い画面ではスタット列・狭い画面では本文のテキストで出す。
           ⚠️ 両方同時に出さないこと（同じ値が2回出る）。 */
        .ppl-row-tenure-inline { display: none; }
        @media (max-width: 767px) {
          .ppl-row-stats { display: none !important; }
          .ppl-row-tenure-inline { display: block !important; }
        }
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
        .ppl-chip.active {
          border-color: var(--royal); background: var(--royal);
          color: #fff; font-weight: 700;
          box-shadow: 0 2px 10px rgba(0,35,102,0.25);
        }

        /* モバイル: フィルタ折りたたみ */
        .ppl-filter-chips { display: contents; }
        .ppl-filter-toggle { display: none; }
        @media (max-width: 767px) {
          .ppl-filter-toggle {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 12.5px; color: var(--ink-soft); cursor: pointer;
            white-space: nowrap; border: 1.5px solid #e2e8f0;
            border-radius: 999px; padding: 6px 12px;
            background: #fff; font-family: inherit; font-weight: 500;
            transition: border-color 0.15s, background 0.15s; flex-shrink: 0;
          }
          .ppl-filter-toggle.active { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
          .ppl-filter-chips { display: none; flex-wrap: wrap; gap: 6px; padding: 4px 0; width: 100%; }
          .ppl-filter-chips.expanded { display: flex; }
        }
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
          padding: "20px 0 0",
        }}
      >
        <div className="ppl-wrap" style={{ margin: "0 auto", padding: "0 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 検索インプット */}
            <div style={{
              position: "relative", flex: "1 1 220px", minWidth: 0,
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
              padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
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

            {/* モバイル: フィルタトグル */}
            <button
              type="button"
              className={`ppl-filter-toggle${(role || foreign) ? " active" : ""}`}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              絞り込む{filtersExpanded ? " ▴" : " ▾"}
            </button>

            {/* フィルタチップ */}
            <div className={`ppl-filter-chips${filtersExpanded ? " expanded" : ""}`}>
              <FilterChip label="職種" value={role} options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setRole(v ?? ""); setOpenChip(null); }} isOpen={openChip === "role"} onToggle={() => toggleChip("role")} />
              {/* ⚠️ 並びは 職種 → 年齢 → 外資系。
                  外資系は **押すだけのトグル**。`/companies` と同じ `.foreign-toggle` を使う。
                  ⚠️ FilterChip（ドロップダウン）に戻さないこと。2026-08-15 まで
                     選択肢が「外資系の経験あり」1つだけのドロップダウンで、
                     開く → 選ぶ の2手が要り、同じ意味のフィルタなのに
                     `/companies` と操作も見た目も違っていた。
                  ⚠️ 見た目を変えるときは globals.css の `.foreign-toggle` を直す。
                     ここに個別のスタイルを書くと2ページでまたズレる。 */}
              <button
                type="button"
                className={`foreign-toggle${foreign === "yes" ? " active" : ""}`}
                onClick={() => { setForeign(foreign === "yes" ? "" : "yes"); setOpenChip(null); }}
                aria-pressed={foreign === "yes"}
              >
                外資系{foreign === "yes" && <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>}
              </button>
              {hasFilter && (
                <button type="button" onClick={clearAll} style={{ fontSize: 12, fontWeight: 500.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "5px 4px", whiteSpace: "nowrap", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-mute)"; }}
                >
                  ✕ すべてクリア
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 並び替えバー ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "12px 24px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
          padding: "10px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
        }}>
          {/* 並び替え */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, flexShrink: 0 }}>並び替え</span>
            <div style={{ width: 1, height: 18, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 6 }}>
              {SORT_OPTIONS.map((o) => {
                const active = sort === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setSort(o.value)} style={{
                    padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: "pointer", border: active ? "none" : "1.5px solid var(--line)",
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink-soft)",
                    transition: "all 0.15s", fontFamily: "inherit",
                    boxShadow: active ? "0 2px 8px rgba(0,35,102,0.25)" : "none",
                  }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 表示モードと件数。
              ⚠️ 2026-08-04 に撤去した「一覧/詳細」トグルを戻したわけではない。
                 あれは詳細ビューのほうが**情報量が少なく**、差が伝わらないので外した。
                 ここで足す1列表示は**カードより情報が増える**（社会人年数・外資系経験）。
                 情報が減る切り替えを作らないこと。 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div role="group" aria-label="表示の切り替え" style={{ display: "flex", gap: 4 }}>
              {([["grid", "グリッド"], ["list", "1列"]] as const).map(([v, label]) => {
                const active = view === v;
                return (
                  <button key={v} type="button" onClick={() => changeView(v)}
                    aria-pressed={active}
                    style={{
                      padding: "5px 11px", borderRadius: 100, fontSize: 12,
                      fontWeight: active ? 700 : 500, cursor: "pointer",
                      border: active ? "none" : "1.5px solid var(--line)",
                      background: active ? "var(--royal)" : "#fff",
                      color: active ? "#fff" : "var(--ink-soft)",
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ width: 1, height: 18, background: "var(--line)" }} />
            <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "var(--font-inter), sans-serif", fontSize: 16 }}>
                {sorted.length}
              </strong> 名
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* ── コンテンツ ── */}
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "16px 24px 80px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
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

        <div style={{
          marginTop: 24, padding: "14px 18px",
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          borderRadius: 10, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.8,
        }}>
          {/* ⚠️ バッジを「面談可」に一本化した以上（2026-08-23）、
                 **申込可否がここでしか伝わらない。** この2行を消さないこと。
                 実測では、バッジが出る4名のうち会社が受付中なのは1社だけ。 */}
          ※ <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>面談可</strong> は、いま在籍している会社について話を聞かれてもよいと登録している方です。<br />
          <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>実際に申し込めるかどうかは会社ごとに異なります。</strong>企業ページでご確認ください。<br />
          所属・職種・経歴はご本人の登録内容です。OPINIO は在籍確認を行っていません。
        </div>
      </div>
    </>
  );
}
