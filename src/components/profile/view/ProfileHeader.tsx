import Link from "next/link";
import { FollowCounts } from "@/components/profile/FollowCounts";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";
import { ProfileSocialLinks } from "./ProfileSections";
import type { CareerEntry } from "@/components/profile/MergedTimeline";
import { isPlaceholderCompanyName } from "@/lib/experiences/companyName";
import type { FollowCounts as Counts } from "@/lib/people/followCounts";

/** 会社名から法人格プレフィックス・サフィックスを除去して短縮名を返す。
    ⚠️ `u/[id]/page.tsx` にあった同名関数をそのまま移した（呼び出し側は消してある） */
export function shortCompanyName(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim() || name;
}

/**
 * プロフィールのヘッダー（カバー＋アバター＋名前＋現職＋メタ行＋SNS）。
 *
 * ⚠️ **`u/[id]/page.tsx` に直書きされていた160行をそのまま移した**（2026-08-16 / 2-7）。
 *    `/mypage` と `/u/[id]` の**両方**がこれを使う。同じ見た目を2箇所に書かない。
 *
 * ⚠️ 右上（`topRight`）と CTA 群（`metaActions`）だけがページごとに違う。
 *    `/u/[id]` は共有ボタンとカジュアル面談・メッセージ・フォロー、`/mypage` は鉛筆だけ。
 *
 * ⚠️ **右側に置くのは在籍企業のブロックだけ**（2026-08-23）。ボタンを右へ戻さない。
 *
 * ⚠️ **現職・年齢は導出値**（職歴と生年月日から作る）なので、ここには編集導線を置かない。
 */
export function ProfileHeader({
  name, headline, initial, avatarUrl, avatarColor, coverPhotoUrl, coverColor,
  location, followCounts, socialLinks,
  currentCareer, isCurrentCompanyKnown, talkableBadge,
  topRight, metaActions, promos,
  onAvatarClick, onCoverClick,
}: {
  name: string;
  headline?: string | null;
  initial: string;
  avatarUrl?: string | null;
  avatarColor: string;
  coverPhotoUrl?: string | null;
  coverColor: string;
  /**
   * ★★写真の差し替え導線（2026-09-23 / 柴さんの指示）。
   *
   * **渡したときだけ**アバターとカバーが押せるようになり、カメラのバッジが出る。
   * ⚠️★**`/u[id]`（公開プロフィール）には渡さないこと。** この部品は本人と
   *    第三者の両方が使う。渡すと他人のページで押せてしまう。
   *
   * ── なぜ足したか（実測 2026-09-23 / 本番・実ユーザー13人）──────────────
   * プロフィール画像あり **1人（8%）** ／ カバーあり 1人。経路は生きているので
   * 「起こせるのに、ほとんど起きていない」状態だった。入口が
   * 「✎ → モーダル → **閉じている**『写真・カバー』行を開く」の**3手**しかなく、
   * **顔写真そのものが押せなかった**のが理由。
   *
   * ⚠️★**モーダルの行を既定で開く方向で解決しないこと。** あの行は 2026-08-16 に
   *    「375px で 380px を占めていて、名前を1文字直すだけでもここを越えないと
   *    保存ボタンに届かなかった」という理由で畳んである。ここは並びを動かさない。
   */
  onAvatarClick?: () => void;
  onCoverClick?: () => void;
  location?: string | null;
  followCounts: Counts;
  socialLinks: Record<string, string> | null;
  /** 現職。無ければ null */
  currentCareer?: CareerEntry | null;
  /** 現職の企業がマスタにあり、企業ページへのリンクを張ってよいか */
  isCurrentCompanyKnown?: boolean;
  /** ★「面談可」のバッジ（2026-08-23 / B-1）。**氏名の右**に出す。
   *  ⚠️ 判定は呼び出し側（`lib/companyMembers/talkable.ts`）。ここでは描くだけ。
   *  ⚠️ `/mypage` も同じ部品を使う。渡さなければ何も出ない。
   *  ⚠️ 会社ブロック（右側）へ戻さない。見落とされるため移した。 */
  talkableBadge?: React.ReactNode;
  /** カバー右上。`/u/[id]` は共有ボタン、`/mypage` は鉛筆 */
  topRight?: React.ReactNode;
  /**
   * ★CTA 群。**メタ行（年齢・所在地・フォロー数）のすぐ下**に出す（2026-08-23）。
   *
   * ⚠️ **以前は右側（会社ブロックの隣）に置いていた** が、LinkedIn に合わせて
   *    「右は在籍企業だけ・操作は本人の情報の下」に変えた。
   *    右に置くと、社名入りの可変長ボタン（「〇〇 の企業ページ」）が
   *    狭い画面で親をはみ出す問題も抱えていた（2026-08-08 に一度対処している）。
   * ⚠️ `/mypage` は渡さない（フォロー・DM・カジュアル面談は本人には要らない）。
   */
  metaActions?: React.ReactNode;
  /** SNS の下に出す促し。`/mypage` だけ */
  promos?: React.ReactNode;
}) {
  return (
    <>
  {/* ⚠️ **モバイル調整はこの部品が持つ**（2026-08-16 に `u/[id]/page.tsx` から移設）。
         ページ側に置くと、同じ部品を使うもう一方（`/mypage`）に効かない。
         実際そうなっていて、`/mypage` だけカバー200px・アバター120px・名前30px だった。
      ⚠️ 子孫セレクタの記号と引用符を使わない（hydration mismatch になる）。 */}
  <style>{`
    @media (max-width: 960px) {
      .profile-cover { height: 140px !important; }
      .profile-avatar { width: 88px !important; height: 88px !important; font-size: 32px !important; }
      .profile-avatar-wrap { margin-top: -44px !important; }
      .profile-name { font-size: 22px !important; }
      .profile-header-body { padding: 0 20px 24px !important; }
    }
  `}</style>
  {/* Cover + Avatar header — full width above grid */}
  {/* ⚠️ 影は他のカード（`ProfileSections`）と同じ値にそろえる（2026-08-27）。
         この1枚だけ影が無く、薄グレーの地の上で境目が弱かった。 */}
  <div style={{
    background: "#fff", border: "1px solid var(--line)",
    borderRadius: 16, overflow: "hidden", marginBottom: "var(--space-6)",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  }}>
    {/* Cover area: photo or gradient */}
    <div className="profile-cover" style={{ height: 200, position: "relative", background: coverPhotoUrl ? undefined : coverColor, overflow: "hidden" }}>
      {coverPhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverPhotoUrl}
          alt=""
          loading="eager"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {/* Subtle dot pattern overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />
      {/* Bottom fade gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
        background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.25))",
      }} />
      {/* ★カバー全面を押せるようにする（本人のときだけ）。
          ⚠️ 右上の `topRight`（鉛筆）とアバターは**後ろの兄弟**なので、重なっても
             そちらがクリックを受ける。この当たり判定が上に乗ることはない。 */}
      {onCoverClick && (<>
        <button
          type="button"
          onClick={onCoverClick}
          aria-label="カバー写真を変更"
          style={{
            position: "absolute", inset: 0, padding: 0,
            background: "transparent", border: "none", cursor: "pointer",
          }}
        />
        {/* ⚠️★`pointerEvents: none` を外さないこと。外すとこのバッジが
               上のボタンのクリックを食う（`aria-label` が付いているのは上だけ）。
            ⚠️★**hover で出す形にしないこと。** タッチ端末には hover が無く、
               「隠れている」という今回の指摘がそのまま戻る。常に出す。 */}
        {/* ⚠️★**右上に置く。右下に置かないこと**（2026-09-23 に実測して直した）。
               `topRight`（`/mypage` の鉛筆）は本文の `top:16` にあり、本文は
               `marginTop: -60` なのでカバーの**下端から 44px 上**に描かれる。
               右下だと鉛筆と重なる（実画面で重なっていた）。
            ⚠️ 767px 以下でもカバーは 140px あるので、上端 16px は鉛筆（下端から44px）と離れる。 */}
        <span aria-hidden="true" style={{
          position: "absolute", right: 16, top: 16, pointerEvents: "none",
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 100,
          background: "rgba(15,23,42,0.55)", color: "#fff",
          fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          カバー写真
        </span>
      </>)}
    </div>

    <div className="profile-header-body" style={{ padding: "0 32px 32px", marginTop: -60, position: "relative" }}>
      {/* Share button — absolute top-right */}
      <div style={{ position: "absolute", top: 16, right: 24, zIndex: 10 }}>
        {topRight}
      </div>
      {/* Avatar: photo or gradient letter */}
      {/* ⚠️★クラス（`profile-avatar` / `profile-avatar-wrap`）を**この要素から動かさない**。
             767px 以下のメディアクエリが 88px と `margin-top: -44px` をここに当てている。
          ⚠️★`onAvatarClick` があるときは `overflow` を `visible` にしてバッジを外へ出す。
             写真は `<img>` 側の `borderRadius: 50%` で丸いままなので、見た目は変わらない。 */}
      <div className="profile-avatar profile-avatar-wrap" style={{
        width: 120, height: 120, borderRadius: "50%",
        background: avatarUrl ? undefined : avatarColor,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 42, fontWeight: 600,
        border: "5px solid #fff",
        boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
        marginBottom: "var(--space-3)", position: "relative",
        overflow: onAvatarClick ? "visible" : (avatarUrl ? "hidden" : "visible"),
      }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            loading="eager"
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : initial}
        {/* ★顔写真そのものを押せるようにする（本人のときだけ）。
               ⚠️★**これが今回の主眼。** 3手（✎ → モーダル → 畳まれた行を開く）を1手にする。 */}
        {onAvatarClick && (<>
          <button
            type="button"
            onClick={onAvatarClick}
            aria-label="プロフィール画像を変更"
            style={{
              position: "absolute", inset: 0, padding: 0, borderRadius: "50%",
              background: "transparent", border: "none", cursor: "pointer",
            }}
          />
          {/* ⚠️★`pointerEvents: none`（理由はカバー側と同じ）。
              ⚠️ 大きさは 32px。モーダルのプレビューの 18px は 56px のアバター向けで、
                 こちらは 120px（767px 以下では 88px）なので比率を合わせてある。 */}
          <span aria-hidden="true" style={{
            position: "absolute", right: 2, bottom: 2, pointerEvents: "none",
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--royal)", border: "3px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(15,23,42,0.2)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </span>
        </>)}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {/* ★左の列は**縮められるようにする**（2026-08-24）。
               ⚠️ `flex` を付けないと列幅が max-content になり、狭い器では
                  右の会社ブロックが**次の行に折り返して左端に落ちる**。
                  実際 `/mypage`（器 680px・実測 614px）でそうなっていた:
                  左列 452px ＋ 会社 230px ＋ gap 16px = 698px > 614px。
                  `/u/[id]` は器が広いので折り返しておらず、**同じ部品なのに
                  2つの画面で会社の位置が違う**状態だった。
               ⚠️ basis は 300px。0 や auto にすると狭い画面でも折り返さなくなり、
                  375px で氏名の列が潰れる。300px を切る器では今までどおり折り返す。 */}
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="profile-name" style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: 30, fontWeight: 700, color: "var(--ink)",
            marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {name}
            {/* ★「面談可」は**氏名の右**（2026-08-23）。
                   ⚠️ 一度は会社ブロック（右側・社名の下）に置いたが、
                      **視線の外で見落とされる**という指摘を受けて移した。
                      ページで最も見られるのは氏名の行なので、そこに添える。
                   ⚠️ 「どの会社の話を聞けるか」は右の会社ブロックが示している。
                      在籍企業は1社なので、離れても対応は取れる。 */}
            {talkableBadge}
          </div>
          {/* 肩書き1行。⚠️ 空なら何も出さない（空欄も既定文言も出さない）。 */}
          {headline && (
            <div style={{
              fontSize: 15, fontWeight: 600, color: "var(--ink-soft)",
              marginBottom: 8, lineHeight: 1.6,
            }}>
              {headline}
            </div>
          )}
          {/* Current role subtitle */}
          {currentCareer && (
            <div style={{ marginBottom: "var(--space-2)", lineHeight: 1.5 }}>
              <span className="u-role-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                {currentCareer.role_title || currentCareer.role_label}
              </span>
              {/* ⚠️ 括弧をやめて中点にした（2026-08-23）。会社ブロックを右へ出したぶん
                     この行が狭くなり、括弧付きだと折り返したときに
                     「（エンタープライズセールス）」だけが次行に取り残されて
                     注釈のように見えていた。中点なら1行でも折り返しても同じに読める。 */}
              {currentCareer.role_title && currentCareer.role_title !== currentCareer.role_label && (
                <span style={{ fontSize: 13, color: "var(--ink-mute)", marginLeft: 8 }}>
                  <span aria-hidden style={{ marginRight: 6 }}>·</span>{currentCareer.role_label}
                </span>
              )}
              {/* ⚠️ ここに「@ 会社名」を戻さないこと（2026-08-23）。
                     会社は右の**会社ブロック**（ロゴ＋社名）に移した。LinkedIn と同じ形。
                     役職名は長いことがあり（実データに「金融営業本部 営業第1部 /
                     法人営業（アカウント営業）」がある）、そこへ社名とバッジまで並べると
                     1行に4要素が詰まって折り返し、どこで切れるか読めなかった。
                  ⚠️ **バッジも会社ブロックへ移した。** 「どの会社の話を聞けるのか」が
                     要点なので会社名から離さない、という条件はそちらで満たしている。 */}
            </div>
          )}
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            {/* ★年齢は 2026-08-29 に外した（柴さんの判断）。⚠️ **戻さないこと。**
                   同日にタイムラインの年チップ（年＋年齢）も外しており、
                   **求職者側で年齢を出す場所は無くなった。**
                   ⚠️ 戻すなら、CLAUDE.md「年齢は詳細だけ。一覧に出さず、年齢で絞り込ませない」
                      の節も合わせて更新すること（あの節はこの行を前提に書かれている）。 */}
            {location && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </span>
            )}
            {/* フォロー数。年齢・所在地と同じ控えめなメタ行に置く。
                名前・職種・所属より下であることが条件（主役は経歴なので、
                数字が価値の代理指標に見えないようにする）。0 は出ない。 */}
            <FollowCounts counts={followCounts} />
          </div>
          {/* ★CTA 群はここ（メタ行の直下）。⚠️ 右側へ戻さないこと（`metaActions` の説明を参照） */}
          {metaActions}
          <ProfileSocialLinks socialLinks={socialLinks} />
          {promos}
        </div>

        {/* ★在籍企業（2026-08-23）。LinkedIn と同じく**ロゴ＋社名**を右側に置く。
               ⚠️ 会社名はここが唯一の置き場。役職行には戻さない（上のコメント）。
               ⚠️ マスタに無い企業（自由入力）はリンクにしない。ロゴも出ない。
               ⚠️ 代替表示（「不明な企業」「非公開企業」「非公開」）は**社名ではない**ので出さない。
                  以前から役職行で除外していた条件をそのまま持ってきている。
               ⚠️★**文字列を並べて比較しないこと**（2026-09-15 にやめた）。判定は
                  `isPlaceholderCompanyName()` の1箇所。定数を改名しても追従する。 */}
        {currentCareer?.company_name &&
          !(currentCareer.is_placeholder_company ?? isPlaceholderCompanyName(currentCareer.company_name)) && (
          <div className="profile-company-block" style={{
            display: "flex", alignItems: "center", gap: 10,
            flexShrink: 0, minWidth: 0,
          }}>
            {isCurrentCompanyKnown && (
              <CompanyLogoImg
                logoUrl={currentCareer.logo_url}
                logoLetter={currentCareer.logo_letter ?? null}
                logoGradient={currentCareer.logo_gradient ?? null}
                name={currentCareer.company_name}
                size={40}
              />
            )}
            <div style={{ minWidth: 0 }}>
              {isCurrentCompanyKnown ? (
                <Link href={`/companies/${currentCareer.company_id!}`} style={{
                  fontSize: 14, fontWeight: 700, color: "var(--ink)",
                  textDecoration: "none", display: "block",
                }}>
                  {shortCompanyName(currentCareer.company_name)}
                </Link>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  {shortCompanyName(currentCareer.company_name)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
    </>
  );
}
