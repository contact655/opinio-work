# /career-consultation ページ 現状調査レポート

作成日: 2026-05-15
調査者: Claude Code

---

## 1. エグゼクティブサマリー

`/career-consultation` はメンター一覧 + 個別プロフィールを提供するキャリア相談 LP として、2026-04-05 に作成された。Supabase の `ow_mentors` テーブル（および `ow_profiles`）に直接接続しており、ログインユーザーのプロフィールを元にしたメンターマッチング機能を持つ実動ページである。ヘッダーナビゲーションに「メンターに相談」として常時掲載されており、流入経路は多い。一方で、`(jobseeker)` ルートグループ内に `/mentors` という別の実装が存在し、同じ `ow_mentors` テーブルを参照する類似ページが並立している。最終的な申込先は `/consultation-request`（`consultation_requests` テーブルへ INSERT + メール通知）であり、機能は稼働中と判断できる。

---

## 2. ページの基本情報

| 項目 | 値 |
|---|---|
| ファイルパス（一覧） | `/Users/hisato/opinio-work/src/app/career-consultation/page.tsx` |
| ファイルパス（クライアント） | `/Users/hisato/opinio-work/src/app/career-consultation/CareerConsultationClient.tsx` |
| ファイルパス（詳細） | `/Users/hisato/opinio-work/src/app/career-consultation/[id]/page.tsx` |
| ルートグループ | ルートグループなし（`app/` 直下） |
| `dynamic` | `force-dynamic`（SSR、毎リクエスト再取得） |
| metadata title | `キャリア相談 | opinio.jp` |
| metadata description | `現役SaaS実務家10名に無料で転職相談。営業・CS・マーケの現役プロが転職のリアルを正直に話します。` |
| sitemap 掲載 | あり（`priority: 0.8`、`changeFrequency: monthly`） |
| git 作成日 | 2026-04-05（`feat: career consultation page, nav reorder with badges`） |
| git 最終更新日 | 2026-04-30（`chore(domain): switch from opinio.work to opinio.jp`） |

---

## 3. ページ構成詳述

### `/career-consultation`（一覧ページ）

| セクション | 内容 |
|---|---|
| H1 | 「メンターに相談する」（`text-xl font-medium`） |
| サブコピー | 「IT業界出身のメンターが、転職の本音を一緒に整理します。完全無料・30分。」 |
| フィルターバー（sticky） | 「悩みで絞る」+ 5タグ（すべて / 転職タイミング / 年収交渉 / キャリアチェンジ / 外資転職 / スタートアップ） |
| おすすめセクション | ログイン済み + プロフィール設定済みユーザーのみ表示。スコアリング上位2名を「あなたにおすすめのメンター」として先頭に表示 |
| プロフィール未設定プロンプト | ログイン済みだがプロフィール未設定 → `/dashboard/profile` への誘導バナー |
| 未ログインプロンプト | 未ログイン → `/auth/signup` への無料登録誘導バナー |
| メンターグリッド | 3列 / 2列 / 1列切替（localStorage 保存）、フィルター後件数表示 |
| メンターカード | 氏名・現職・キャリアパス（元→現）・得意相談タグ・キャッチフレーズ・実績数・「プロフィールを見る →」ボタン |
| Bottom CTA | 「まずは気軽に30分、話してみませんか？」+ ページ内アンカー `#mentors` へのスクロール |

### `/career-consultation/[id]`（メンター詳細ページ）

| セクション | 内容 |
|---|---|
| Breadcrumb | メンター一覧 › {名前} |
| H1 | メンター氏名（ヘッダーカード内・白文字） |
| 自己紹介 | `mentor.bio` |
| キャリア | `mentor.career_history`（構造化JSON）または `mentor.career_history_text`（テキスト）でタイムライン表示 |
| 実際の相談事例 | `mentor.consultation_cases`（JSON配列）があれば表示、なければ `mentor.concerns` でフォールバック |
| こんな悩みに答えられます | concerns タグ一覧（相談事例がない場合） |
| Sticky サイドバー CTA | 「{名前}さんに相談する」→ `/consultation-request?mentor_id=…&mentor_name=…` へリンク |
| サイドバー統計 | `total_sessions` / `success_count` の表示 |
| メンター一覧に戻る | `/career-consultation` へのリンク |

---

## 4. 機能・データ依存

| 項目 | 詳細 |
|---|---|
| ページ種別 | 動的機能ページ（LP + 一覧 + 詳細 + 申込フォームへの誘導） |
| DB接続（読み取り） | `ow_mentors`（一覧・詳細）、`ow_profiles`（ログインユーザーのプロフィール取得） |
| DB接続（書き込み） | なし（このページ自体は書き込まない） |
| API Route | なし（Server Component が直接 Supabase クライアントを呼ぶ） |
| 申込先 | `/consultation-request` ページ → `consultation_requests` テーブルへ INSERT + `/api/consultation-request/notify` でメール通知 |
| ライブラリ | `src/lib/mentorMatching.ts`（スコアリングロジック）、`src/lib/utils/mentorAvatar.ts`（アバター表示） |
| 認証連携 | `supabase.auth.getUser()` でログイン判定 → おすすめ表示 / 未ログインCTA の出し分け |
| `ow_profiles` 参照カラム | `job_type`, `experience_years`, `worry`, `consultation_tags`, `current_company_type` |

**重要な注意点**: `ow_mentors` テーブルは 2026-04-30 の `Commit V` でリネームされたが、Supabase の実テーブル名が `mentors` のままである場合、クエリが失敗する可能性がある（CLAUDE.md では「`mentors`（ow_ なし）」と記載されており差異がある）。

---

## 5. リンク状況

### このページへの内部リンク（表形式）

| ファイル | 行番号 | 該当コード |
|---|---|---|
| `src/components/Header.tsx` | 129 | `<Link href="/career-consultation">メンターに相談（モバイルナビ）` |
| `src/components/Header.tsx` | 167 | `<Link href="/career-consultation">メンターに相談（デスクトップナビ）` |
| `src/components/Footer.tsx` | 35 | `<Link href="/career-consultation">キャリア相談（フッターリンク）` |
| `src/app/(jobseeker)/page.tsx` | 239 | `<Link href="/career-consultation">` （トップページ中段CTA） |
| `src/app/(jobseeker)/page.tsx` | 790 | `<Link href="/career-consultation">` （トップページ下段CTA） |
| `src/app/(jobseeker)/page.tsx` | 830 | `<Link href="/career-consultation">` （トップページBottom CTA） |
| `src/app/HeroSection.tsx` | 266 | `<Link href="/career-consultation">` （ヒーローセクションメインCTA） |
| `src/app/not-job-changing/page.tsx` | 107 | `<Link href="/career-consultation">先にメンターに相談する` |
| `src/app/about/selection-criteria/page.tsx` | 188 | `href="/career-consultation"` |
| `src/app/users/[id]/page.tsx` | 209 | `<Link href="/career-consultation">` （緑ボタン） |
| `src/app/consultation-cases/ConsultationCasesClient.tsx` | 283 | `href="/career-consultation"` |
| `src/app/consultation-request/page.tsx` | 127 | `router.push("/career-consultation")` （戻り遷移） |
| `src/app/companies/[id]/articles/[articleId]/ArticleDetailClient.tsx` | 128 | `href="/career-consultation"` |
| `src/app/sitemap.ts` | 49 | `url: \`${baseUrl}/career-consultation\`` |

### このページからの外部リンク（CTA一覧）

| リンク先 | 文言 | 条件 |
|---|---|---|
| `/career-consultation/${mentor.id}` | メンターカード全体（プロフィールを見る →） | 全ユーザー |
| `/dashboard/profile` | プロフィールを設定する（1分） | ログイン済み・プロフィール未設定 |
| `/auth/signup` | 無料で登録する | 未ログイン |
| `#mentors`（ページ内アンカー） | メンターを選んで予約する | 全ユーザー（Bottom CTA） |
| `/consultation-request?mentor_id=…&mentor_name=…` | 相談を申し込む | 詳細ページのサイドバーCTA |
| `/career-consultation` | ← メンター一覧に戻る | 詳細ページのみ |

---

## 6. メンター機能との関係性評価

### 2つのメンター一覧ページの並立

| 比較項目 | `/career-consultation` | `/mentors`（`(jobseeker)` ルート） |
|---|---|---|
| ファイルパス | `src/app/career-consultation/` | `src/app/(jobseeker)/mentors/` |
| データソース | `ow_mentors`（Supabase直接） | `getMentors()` in `queries.ts`（Supabase経由） |
| ナビ掲載 | ヘッダーナビ「メンターに相談」 | 掲載なし（直接アクセスのみ） |
| メタデータ title | `キャリア相談 | opinio.jp` | `先輩に相談する — Opinio` |
| デザイン系統 | グリーン（`#1D9E75`）ベース、Cover色あり | Royal blue（`var(--royal)`）ベース、デザインシステム準拠 |
| フィルター | worries タグで絞り込み、3/2/1列切替 | 職種・会社別フィルターバー（MentorFilterBar） |
| 個別詳細ページ | `/career-consultation/[id]`（独自実装） | `/mentors/[id]`（`getMentorById()` 経由、reserve へリンク） |
| 申込先 | `/consultation-request`（フォーム送信 → メール通知） | `/mentors/[id]/reserve`（メンター予約フロー） |
| ログイン連携 | あり（スコアリング・プロンプト出し分け） | なし（静的一覧） |
| マッチング機能 | あり（`mentorMatching.ts`） | なし |

### 評価

- **役割の重複**: 両ページとも `ow_mentors` の同一データを表示するメンター一覧であり、目的が重複している
- **デザイン不統一**: `/career-consultation` はグリーン系、`/mentors` はデザインシステム（royal blue）に準拠しており、一貫性がない
- **申込フロー分岐**: `/career-consultation` → `/consultation-request`（運営介在型・メール通知）、`/mentors` → `/mentors/[id]/reserve`（予約フロー）と異なる申込経路を持つ
- **流入の主軸**: ヘッダーナビ・トップページ・フッター等の多数の内部リンクはすべて `/career-consultation` を指しており、こちらが現在のメインの導線
- **`/mentors` の位置付け**: `(jobseeker)` ルートグループ内にありながらナビに掲載されておらず、Phase 5 Stage 1 の Supabase 接続実装として新規に作られたと思われる。現時点では事実上デッドページに近い

---

## 7. 運用状態

| 項目 | 状態 |
|---|---|
| デプロイ状況 | デプロイ済み（`https://opinio.jp/career-consultation`） |
| sitemap 掲載 | あり（`priority: 0.8`） |
| ヘッダーナビ掲載 | あり（デスクトップ・モバイル両方） |
| 申込フロー | 稼働中（`consultation_requests` テーブルへの INSERT + メール通知） |
| データ更新 | `ow_mentors` テーブルに依存。admin ページ（`/admin/mentors`）で編集可能 |
| 最終コード更新 | 2026-04-30（ドメイン変更 HH commit）。機能変更は 2026-04-05 以降なし |
| 潜在的バグ | `ow_mentors` テーブル名（旧 `mentors` からリネーム）の実態と一致しているか要確認 |

---

## 8. 棲み分け選択肢の比較

| 選択肢 | 内容 | メリット | デメリット |
|---|---|---|---|
| A | 維持・併存（現状維持） | 変更コスト最小、既存流入を保護 | 2つの類似ページが並立し続け混乱を招く。デザイン不統一が放置される |
| B | `/career-consultation` を廃止し `/mentors` に統合・置換 | デザインシステム統一、コード削減、一本化 | 多数の内部リンクの更新が必要。マッチング機能・`consultation-request` フローの移植または廃止の意思決定が必要 |
| C | 目的を再定義して棲み分ける（例: `/career-consultation` = 申込LP、`/mentors` = 閲覧専用一覧） | ページの役割を明確化できる | 現状の作りでは `/career-consultation` が既に一覧 + 詳細 + 申込導線を完結しており、分離の根拠が薄い |
| D | `/career-consultation` を将来的な再設計まで一旦 404 または redirect | 技術負債の凍結、明確なリセット | ヘッダー・トップ・フッターなど全流入が切れる。対応範囲が広くリスクが高い |

---

## 9. 推奨アクション

Hisato の判断が必要な事項:

1. **`ow_mentors` テーブル名の実態確認**: `Commit V` で `mentors → ow_mentors` にリネームされたが、CLAUDE.md には「Supabase のテーブル名は `mentors`（ow_ なし）」と記載されている。現在の `/career-consultation` が `ow_mentors` を参照しており、実際に動作しているかを確認する必要がある。

2. **2ページ並立の解消方針を決定**: `/career-consultation` と `(jobseeker)/mentors` のどちらを残すか、または両方を維持するかを決定する。現在の主要流入は `/career-consultation` に集中しているため、短期的には `/career-consultation` を正とし、`(jobseeker)/mentors` を整理する選択肢（選択肢 B の逆）が現実的。

3. **申込フローの一本化**: `/consultation-request`（運営介在型）と `/mentors/[id]/reserve`（直接予約型）の2経路が存在する。どちらを標準とするかを決定し、メンター詳細ページでの導線を統一する。

4. **マッチング機能（`mentorMatching.ts`）の扱い**: ログインユーザーの `ow_profiles` データを使ったスコアリング機能は `/career-consultation` 固有の機能。`(jobseeker)/mentors` には同機能がない。この差別化を活かすか廃止するかの意思決定が必要。
