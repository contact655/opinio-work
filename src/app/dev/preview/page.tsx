import Link from "next/link";
import { devOnly } from "./guard";

/**
 * UI プレビューの索引（2026-08-30）。
 *
 * ── なぜ作ったか ────────────────────────────────────────────────────────────
 * **実データが薄く、多くの画面を「データがある状態」で見られない。**
 * 実測（2026-08-30 / 本番）: ツールあり **1社** / 福利厚生あり **2社** /
 * 公開求人 **2件** / 導入事例あり **3社** / 職歴のある実ユーザー **4人**。
 *
 * ⚠️★**dev と本番が同じ DB** なので「dev だけにデータを入れる」ができない。
 *    さらに `is_test` は **46箇所で無条件に除外**されるので（`is_published` と違い
 *    dev 緩和が無い）、検証データを入れても求職者側には出ない。
 *    → **DB を使わず、実コンポーネントに固定データを渡して見る**のがこの画面。
 *
 * ⚠️ 実際に困った例: 2026-08-30 に求人詳細の OB・OG を作ったとき、
 *    **「カードが出る側」を一度も描画できないまま出した**（該当0名だったため）。
 *
 * ── 使い方 ──────────────────────────────────────────────────────────────────
 * `npm run dev` → http://localhost:3000/dev/preview
 * ⚠️ 幅の確認は**ブラウザ自体をリサイズ**する（固定幅の箱に入れていない）。
 *
 * ⚠️★**この配下で DB を読まないこと。** 読むと本番データを本番の外へ出す経路になる。
 * ⚠️ 新しいセクションを作ったら**ここにも足す**。足さないと誰も見に来ない。
 */
const ITEMS = [
  { href: "/dev/preview/people-cards", label: "登録ユーザーのカード（/people）",
    note: "★肩書きを持つ実ユーザーが0人。しかも /people は is_test を除外するので、出る側はここでしか見られない" },
  { href: "/dev/preview/candidates", label: "候補者を探す（/biz/organization の隣）",
    note: "★実画面は有料プラン0社で誰も開けない。ゲートの内側はここでしか見られない" },
  { href: "/dev/preview/biz-applications", label: "応募一覧（企業側）",
    desc: "本番は0件。内定・採用確定の表示と、採用確定の報告フォームはここで見る" },
  { href: "/dev/preview/scouts", label: "スカウト履歴（/biz/scouts）",
    desc: "本番は0件・送信停止中。状態のバッジ・全文表示・引けない候補者はここで見る" },
  { href: "/dev/preview/stories", label: "企業ストーリー（/biz/posts と企業ページ）",
    desc: "公開・下書き・長文・カバー画像あり／なし。実データは検証用の1件だけ" },
  { href: "/dev/preview/org-tree", label: "組織体制の編集（/biz/organization）",
    desc: "部門・職種の木。0件／5階層ちょうど／長い名前。移動ボタンが押せる・押せない境界はここでしか見られない" },
  { href: "/dev/preview/evidence-gaps", label: "根拠の棚卸し（/admin）",
    note: "運営権限が無いと実画面を開けないので、状態はここで見る" },
  { href: "/dev/preview/proposals", label: "根拠つき提案（②⑨）",
    note: "実データは n=1 が最大。比率を出す分岐はここでしか見られない" },
  { href: "/dev/preview/benefits",  label: "福利厚生",
    desc: "カテゴリ分けの境界（3カテゴリ目と4カテゴリ目）と、緑にしてよい項目" },
  { href: "/dev/preview/company-employees", label: "現役社員（企業ページ）",
    desc: "⚠️ 職種ごとに分かれる側は本番に該当企業が無い。5名以上＋職種2種類以上でしか出ない" },
  { href: "/dev/preview/biz-employees", label: "社員管理（/biz/employees）",
    desc: "⚠️ 管理者バッジ・面談OKバッジ・職種の併記は、ログインできるどの企業にも該当者が居ない。ここでしか見られない" },
  { href: "/dev/preview/employees", label: "現役社員 / OB・OG",
    desc: "0件の空状態、1件、3件、12件。長い氏名・役職での折り返し" },
  { href: "/dev/preview/tools",     label: "ツール",
    desc: "5グループへの束ね方と、グループ内が増えたときの伸び方" },
  { href: "/dev/preview/cases",     label: "導入事例",
    desc: "4件目から挟まる折りたたみ。products 4つ・長い usecase でのカードの伸び方" },
  { href: "/dev/preview/teams",     label: "組織体制・チーム",
    desc: "部門での束ね方。division 未設定のチームが消えないか" },
  { href: "/dev/preview/products",  label: "製品・導入事例",
    desc: "2製品のときに右が空く件。事例があると主な顧客が出なくなる分岐" },
  { href: "/dev/preview/company-cards", label: "企業カード（一覧）",
    desc: "項目が欠けた企業。空が「0名」「—」に化けないか。グリッドとリストの2形態" },
  { href: "/dev/preview/company-pane", label: "企業ペイン（分割ビューの右側）",
    desc: "⚠️★この画面だけ固定幅の箱で見る。CompanyPane はメディアクエリを持たず、幅はコンテナで決まるため" },
  { href: "/dev/preview/job-conditions", label: "求人の「勤務条件」",
    desc: "勤務体系・休日・試用期間は本番0件。値が入った状態を見るのはここだけ" },
  { href: "/dev/preview/job-cards", label: "求人カード（一覧）",
    desc: "年収なし・下限だけ・上限だけ。会社が引けないときに落ちないか" },
  { href: "/dev/preview/job-pane", label: "求人ペイン（分割ビューの右側）",
    desc: "⚠️★固定幅かつ高さを固定した箱で見る。本番の公開求人は本文 205〜219字でペインが1pxもあふれず、内部スクロールも上に残る帯も一度も描画されない" },
  { href: "/dev/preview/timeline", label: "職歴タイムライン",
    desc: "同社グループ・出戻り・並行職・長期ブランク。行の2経路に編集操作が出るか" },
  { href: "/dev/preview/benefits-editor", label: "福利厚生の入力 → 保存 → 表示",
    desc: "企業が入力したものがどう保存され、求職者にどう見えるかを1画面で" },
  { href: "/dev/preview/listing-status", label: "掲載設定バナー（本人にだけ出る）",
    desc: "掲載中 / ログイン限定 / 非掲載 の3状態。実データで出せるのは1つだけ" },
  { href: "/dev/preview/industry-match", label: "◯◯の経験が活きる会社（/mypage）",
    desc: "0ブロックで何も出ないこと。長い社名が右カラム320pxではみ出さないこと。ログインの内側なので実画面では確かめにくい" },
  { href: "/dev/preview/applications", label: "応募・面談（/mypage/applications）",
    desc: "★本番は応募0件・面談0件。カードも進捗バーもおすすめも、実画面では一度も描画されない" },
  { href: "/dev/preview/meeting-cta", label: "カジュアル面談CTA の色（決着済み・案B）",
    desc: "現行は白文字 on #F59E0B で 2.15（必要 4.5）。橙を保ったまま直す3案を実寸で並べる" },
];

export default function PreviewIndex() {
  devOnly();
  return (
    <div>
      <h1 style={{
        margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "var(--ink)",
        fontFamily: "var(--font-noto-serif)",
      }}>UI プレビュー</h1>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
        <strong style={{ color: "var(--ink)" }}>実際のコンポーネント</strong>に固定データを渡して、
        データが揃ったときの見え方を先に確かめる画面です。
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8 }}>
        DB は読みません。本番では 404 になります。
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} style={{
            display: "block", padding: "16px 18px", borderRadius: 12,
            background: "#fff", border: "1px solid var(--line)", textDecoration: "none",
          }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4,
              fontFamily: "var(--font-noto-serif)",
            }}>{it.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
