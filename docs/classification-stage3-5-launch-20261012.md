# 会社の分類 段3〜5 — 出荷の手順・書き換える会社・戻し方（2026-10-12）

段3（入力の画面）と段5（求職者側の表示と絞り込み）をまとめて作った。**最後の migration（新しい行の有効化と後回しにした付け替え）はまだ当てていない**（`supabase/pending/20261013010000_classification_launch.sql`）。柴さんの「出してよい」を待つ。

## 1. 作ったもの

| 段 | 画面・処理 | 実体 |
|---|---|---|
| 3 | 企業側 `/biz/company` の「どんな会社かを登録する」（4つの質問・右側のプレビュー・公開まであと◯つ） | `components/companies/classification/ClassificationEditor.tsx`・`ClassificationPreview.tsx`。値は下書き（draft_data）に入り「変更を公開する」で反映（`lib/companies/applyDraft.ts`） |
| 3 | 事業をその場で追加（確認待ち。追加した会社にだけ出る） | `POST /api/biz/company/business-domains`。記録は `ow_business_domain_proposals`（運営専用） |
| 3 | 運営 `/admin/companies/[id]` の「分類」タブ（旧「事業領域」「対象業界」タブを1つにまとめた） | 同じ部品。保存は「保存する」でまとめて（業種＝PUT、事業＝business-domains、③④＝`PUT …/classification`） |
| 3 | 運営 `/admin/companies/classification`（一括設定） | 大分類だけ／ステージが空／外資で国が空 で絞り、チェックしてまとめて付ける。候補は表示だけ |
| 3 | 運営 `/admin/business-domains`（追加された事業） | そのまま採用する／既存の事業にまとめる（別名に残す） |
| 3 | 公開の条件 | `companyRequirements.ts` に 小分類・事業（全業種で必須）・資本（外資なら国）・事業ステージ。**公開・掲載に切り替える一手と「変更を公開する」でだけ**効く（提案B。運営の「要対応」は旧条件のまま） |
| 5 | 企業ページのサイドバー（業種 › 小分類／事業（主が先頭）／タイプ／お客さま）・見出しの事業ステージ | `CompanyInfoBox.tsx`・`queries.ts`（`fetchClassificationDisplay`） |
| 5 | `/companies` の絞り込み：業種（2段・`?ind=`）／事業（検索して選ぶ・`?industry=`）／外資系（`capital_type`）／事業ステージ（`?stage=`） | `lib/search/companies.ts`（`resolveIndustryFilterIds`・`resolveDomainCompanyIds`）・`CompanySearchBar.tsx`・`FilterChip`（`searchOnly`・別名で探す） |

DB（適用済み）: `20261013000000_classification_stage3_input.sql` … 業種に `retired_at`（使わなくなった印）・「業種特化」を rejected・`set_company_business_domains` を status で判定（運営が認めたもの＋その会社が追加した確認待ち）。

## 2. 出す順番（推奨）

1. **コード（段3・段5）を push してデプロイ**（`/api/health` で commit を確認）。この時点では新しい行は無効のままで、求職者側は今の分類で動く（Third Box で確認済み）
2. `./scripts/dump-tables.sh ow_industries ow_business_domains ow_company_business_domains ow_company_customer_industries ow_companies`
3. `supabase/pending/20261013010000_classification_launch.sql` を `supabase/migrations/` へ移し、`supabase migration list` で保留がこれ1本だけと確かめて `db push`
4. 移したファイルを commit して push（データだけの migration でもデプロイを走らせる。事業のキャッシュは5分）
5. `/companies` の絞り込みを前後で突き合わせる（段2と同じ24通り＋業種・ステージ）

⚠️ 先に migration を当てないこと。今の本番のコードは事業のチップに「有効な事業すべて」を出すので、約190件が並ぶ。
⚠️ 1 と 3 のあいだに、実在の会社の担当者が新しい事業・業種を選べる（入力の選択肢には出す前の行も出るため）。選んでも、有効にするまでは求職者側に表示されないだけで壊れない。

## 3. 最後の migration で書き換わる会社（今 → 新）

| 会社 | 何が | 今 | 新 |
|---|---|---|---|
| PIVOT株式会社 | 業種 | 広告・メディア › 出版・放送 | 広告・メディア › Webメディア |
| 大塚製薬株式会社 | 業種 | 医療・介護 | メーカー › 医薬品・医療機器 |
| 株式会社JTB | 業種 | その他サービス | 生活・サービス › 旅行・観光 |
| アップルジャパン合同会社 | 事業 | ★ハードウェア・半導体 | ★電子部品 |
| デル・テクノロジーズ株式会社 | 事業 | ★ハードウェア・半導体／クラウド・インフラ | ★電子部品／クラウド・インフラ |
| レノボ・ジャパン合同会社 | 事業 | ★ハードウェア・半導体／クラウド・インフラ | ★電子部品／クラウド・インフラ |
| 株式会社日本HP | 事業 | ★ハードウェア・半導体 | ★電子部品 |
| DocuSign Japan株式会社 | 事業 | ★リーガルテック | ★電子契約 |
| 株式会社コンカー | 事業 | ★経理・財務 | ★経費精算 |
| キリバ株式会社 | 事業 | ★経理・財務 | ★フィンテック |
| ウーバー・ジャパン株式会社 | 事業 | ★マーケットプレイス | ★フードデリバリー |
| トランス・コスモス株式会社 | 事業 | （なし） | ★カスタマーサポート代行／BPO／広告運用 |

名前が変わるだけ（紐付けは動かない）: 事業「ハードウェア・半導体」→「半導体」（インテル・エヌビディア・クアルコム）、「経理・財務」→「会計ソフト」（Apptio・クーパ・ブラックライン、Sansan・ワークデイの2件目）。
業種の行: 飲食・外食／エンタメ・映像・音楽／その他サービス を「生活・サービス」の小分類へ（会社は JTB だけで、上の表のとおり旅行・観光へ移る）。
有効にする行: 業種 13・事業 178。**公開120・掲載24は変えない**（migration の中で突き合わせ、違えば全部巻き戻す）。

## 4. 戻し方

| 何を | どうする |
|---|---|
| 最後の migration | `supabase/pending/rollback_20261013010000_classification_launch.sql` を新しい番号で migrations に置いて `db push`。出荷後に新しい業種を選んだ会社がいれば止まる（1社ずつ判断）。事業は新しい行を選んだ会社の紐付けは残る（無効なので求職者には出ない） |
| それでも合わないとき | 手順2のダンプ（`.dumps/`）から該当の表の行を戻す（表ごとの COPY。Supabase の日次バックアップはプロジェクト全体の巻き戻しになるので最後の手段） |
| コード | 段3・段5のコミットを revert して push（`/api/health` で確認） |
| 段1〜段3の DB（適用済み） | 追加だけなので戻す必要は無い。戻す場合は 新しい列・表（`ow_company_customer_industries` / `ow_business_domain_proposals` / `retired_at` ほか）を DROP し、`set_company_business_domains` を `20261012220000` 以前の定義に戻す。段2の書き換えは `.dumps/20261012-2045-…` から |

## 5. 確かめたこと（2026-10-12）

- Third Box（検証用・掲載中）で 4つの質問の入力 → 「変更を公開する」 → DB（業種・事業3件（確認待ち1件を含む）・資本・国・ステージ・お客さま）→ 企業ページのサイドバー・見出し → `/companies` の絞り込み（業種・事業・外資系・ステージの組み合わせ10通りで、当たる／当たらないが条件どおり）。スクリーンショットは `~/Desktop/opinio-screenshots/batch-20261012/cls-*`
- 375px で横のはみ出し 0件（入力画面・一覧・企業ページ。陽性対照つき）
- 4件目の事業と、お客さまに小分類 → どちらも DB が断る（検証用の会社で、書き込まれないことも確認）
- Third Box は作業前の状態に戻した（列の差 0）。追加した確認待ちの事業・申請記録・検証で付いた規約同意1件は削除済み
- tsc 0／lint 0／テスト 267 件すべて成功／check-biz-wording 7（変わらず）／check-embeds・check-columns・check-definer-grants すべて 0（自己テストつき）

**確かめられなかったこと**: 運営の画面（`/admin/companies/[id]` の「分類」タブ・一括設定・追加された事業）を画面で操作していない。運営の権限を持つアカウントが柴さんご本人のもの（s.hisato1020 / hshiba）しか無いため。型・lint と、同じ関数（`setCompanyCustomerIndustries`・RPC）を企業側の経路で通したことまで。

## 6. 出す前の状態で見えるもの（出したあと消える）

- 入力の選択肢: 業種の大分類に「飲食・外食」「その他サービス」がまだ並ぶ（最後の migration で生活・サービスの小分類になる）
- 新しい事業（決済など）を選んでも、有効にするまで求職者側には出ない
