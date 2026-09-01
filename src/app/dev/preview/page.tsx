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
  { href: "/dev/preview/benefits",  label: "福利厚生",
    desc: "カテゴリ分けの境界（3カテゴリ目と4カテゴリ目）と、緑にしてよい項目" },
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
  { href: "/dev/preview/job-cards", label: "求人カード（一覧）",
    desc: "年収なし・下限だけ・上限だけ。会社が引けないときに落ちないか" },
  { href: "/dev/preview/timeline", label: "職歴タイムライン",
    desc: "同社グループ・出戻り・並行職・長期ブランク。行の2経路に編集操作が出るか" },
  { href: "/dev/preview/benefits-editor", label: "福利厚生の入力 → 保存 → 表示",
    desc: "企業が入力したものがどう保存され、求職者にどう見えるかを1画面で" },
  { href: "/dev/preview/listing-status", label: "掲載設定バナー（本人にだけ出る）",
    desc: "掲載中 / ログイン限定 / 非掲載 の3状態。実データで出せるのは1つだけ" },
  { href: "/dev/preview/meeting-cta", label: "カジュアル面談CTA の色（判断待ち）",
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
