import { JobPane } from "@/components/jobs/JobPane";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { JOB_PANE_LONG, JOB_PANE_THIN, PREVIEW_COMPANY_MAP } from "../fixtures";

/**
 * 求人ペイン（`JobPane`）のプレビュー（2026-09-17）。
 *
 * ⚠️★★**この画面は「固定幅かつ高さを固定した箱」に入れて見る。**
 *    他のプレビューは `Variant.tsx` の注記どおり固定幅で並べてはいけないが、
 *    `JobPane` は `CompanyPane` と同じく**メディアクエリを1つも持たない**（幅はコンテナが決める）。
 *    加えて、この部品で一番確かめたいのは
 *      ① **ペインの中だけでスクロールできるか**
 *      ② スクロールしたとき、**求人名・企業名・応募・保存の帯が残るか**
 *    の2つで、**高さを固定した `overflow-y: auto` の箱でしか再現できない。**
 *    ⚠️ 箱の `max-height` / `overflow-y` を外さないこと。外すと①②が両方見えなくなる。
 *
 * ⚠️★**なぜこの画面が要るか。** 本番の公開求人は2件だけで、本文が **205〜219字**しかない
 *    （2026-09-17 実測）。下書き13件は本文が**1文字も無い**。
 *    実データではペインが1pxもあふれず（scrollHeight 504 = clientHeight 504）、
 *    **内部スクロールも帯も一度も描画されない。**
 *
 * ⚠️★**長い本文を DB に入れて確かめないこと。** ローカルの dev も本番 Supabase に繋がる
 *    （CLAUDE.md「ローカルだから安全ではない」）。データは `fixtures.ts` に置く。
 */

/** 実測に基づく幅。レール 440px のとき、右ペインは 1280px で 724 / 1440px で 884 になる。 */
const WIDTHS = [464, 724, 884];

/** ⚠️ 本番の `.companies-pane` と同じ形（`max-height` ＋ `overflow-y: auto`）。 */
const PANE_MAX_HEIGHT = 730;

function Row({ job, company }: { job: typeof JOB_PANE_LONG; company?: (typeof PREVIEW_COMPANY_MAP) extends Map<string, infer C> ? C : never }) {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      {WIDTHS.map((w) => (
        <div key={w} style={{ flex: "0 0 auto" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6,
            fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            {w}px {w === 464 ? "（レール700 のときの 1280px。参考）" : w === 724 ? "（レール440 / 1280px）" : "（レール440 / 1440px）"}
          </div>
          {/* ⚠️★`companies-pane` の class を付けている。`JobPane` の
                 スクロール位置リセットが `closest(".companies-pane")` で器を探すため。
                 ⚠️ CSS 側の `.companies-pane` は `@media (min-width: 1280px)` の中なので、
                    この箱には効かない。**高さと overflow はここで直に指定している。** */}
          <div className="companies-pane" style={{
            width: w, background: "var(--bg-tint)", padding: 16, borderRadius: 12,
            maxHeight: PANE_MAX_HEIGHT, overflowY: "auto",
          }}>
            <JobPane job={job} company={company} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JobPanePreview() {
  devOnly();
  const company = PREVIEW_COMPANY_MAP.get("preview-co-1");
  /* ⚠️ 応募の導線は `company.application_open` のときだけ出る（カード・詳細ページと同じ）。
        検証用の会社には値が無いので、開いた状態と閉じた状態の両方を作る。 */
  const openCompany = company ? { ...company, application_open: true } : undefined;

  return (
    <div>
      <PreviewHeader
        title="求人ペイン（分割ビューの右側）"
        widthNote={
          <>
            ⚠️ <strong>この画面だけ、固定幅かつ高さを固定した箱に入れて見ます</strong>（464 / 724 / 884px）。
            <code>JobPane</code> は<strong>メディアクエリを1つも持たず</strong>、幅はコンテナで決まります。
            <strong>箱の中をスクロールしてください</strong> —— 上に残る帯（求人名・企業名・応募・保存）が確認点です。
          </>
        }
      >
        <code>JobPane</code> です。<strong>求人詳細（1,486行）は使い回していません</strong>
        （<code>ReadingProgress</code> が <code>window.scrollY</code> を見る、サイドバーが
        <code>hidden lg:flex</code> でビューポート基準、<code>JobMobileStickyBar</code> が
        <code>position: fixed</code>、の3つがペインの中では壊れるため）。
      </PreviewHeader>

      <Variant
        label="★厚い側（本文・メイン業務・スキル11件・選考6段）"
        note="⚠️★これが主目的。箱の中だけがスクロールすること／スクロールしても帯が残ること／帯の下に本文が透けないこと。⚠️ 本文は markdown（見出し・箇条書き・強調）として描かれること"
      >
        <Row job={JOB_PANE_LONG} company={openCompany} />
      </Variant>

      <Variant
        label="★薄い側（下書き13件と同じ。本文0字）"
        note="⚠️ 仕事内容・メイン業務・スキル・選考フロー・勤務条件が**見出しごと消えている**こと（「—」「0件」で埋めない）。⚠️ 年収なしが「年収0万円〜」に化けないこと"
      >
        <Row job={JOB_PANE_THIN} company={company} />
      </Variant>

      <Variant
        label="★会社が引けないとき（companyMap に無い）"
        note="⚠️ ロゴ・企業名・企業についてが**行ごと消える**こと。落ちないこと。⚠️ 応募の導線も出ない（application_open が分からないため）"
      >
        <Row job={JOB_PANE_LONG} company={undefined} />
      </Variant>

      <div style={{
        marginTop: 8, padding: "12px 14px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "var(--warm-ink)", lineHeight: 1.8,
      }}>
        ⚠️ <strong>ここに出していない項目は詳細ページにしかありません</strong>
        （福利厚生・ツール・拠点/資本関係・在籍者・採用担当者・関連する取材レポート・入社後90日・チーム構成）。
        <br />
        <strong>「詳細ページですべて見る →」を必ず残すこと。</strong>
        <br />
        ⚠️ <strong>保存ボタンは押さないでください。</strong>
        <code>BookmarkButton</code> は自分で <code>/api/bookmarks</code> を叩くので、
        <strong>本番の <code>ow_bookmarks</code> に行が入ります</strong>（プレビューの求人 ID は本番に無いので失敗しますが、叩くこと自体は起きます）。
      </div>
    </div>
  );
}
