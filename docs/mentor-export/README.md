# Mentor Feature Export — 新サイト移植用資産

> 退避日: 2026-06-03  
> 元リポジトリ: `opinio-work` (`/Users/hisato/opinio-work`)  
> 用途: 人材紹介事業サイトへの移植用バックアップ

---

## ディレクトリ構成

```
docs/mentor-export/
├── README.md                    ← このファイル
├── ow_mentors.json              ← メンター13名の全データ（写真URL含む）
├── ow_consultation_categories.json ← 相談カテゴリ6件
├── ow_mentor_categories.json    ← メンターカテゴリ（0件・空テーブル）
├── consultation_cases.json      ← 相談事例20件（記事型コンテンツ）
└── components/
    ├── pages/                   ← ページコンポーネント
    ├── api/                     ← API ルート
    ├── components/              ← 再利用UIコンポーネント
    └── lib/                     ← ライブラリ・ユーティリティ
```

---

## データファイル

| ファイル | 件数 | 内容 |
|---------|------|------|
| `ow_mentors.json` | 13件 | 名前・bio・catchphrase・roles・photo_url・avatar_color など全カラム |
| `ow_consultation_categories.json` | 6件 | キャリアの方向性/市場価値/転職タイミング/現職/副業独立/人間関係 |
| `ow_mentor_categories.json` | 0件 | 空テーブル（スキーマ参照のみ） |
| `consultation_cases.json` | 20件 | 匿名の相談事例（悩み・インサイト・成果）※内容確認後に削除判断 |

### consultation_cases 内容一覧（20件）

| # | anon_profile | worry_category | 結果 |
|---|-------------|----------------|------|
| 1 | 28歳・SIer営業・3年目 | キャリアチェンジ | SaaS企業2社から面接オファー |
| 2 | 32歳・SaaS CS・5年目 | 年収交渉 | 年収650万オファー獲得 |
| 3 | 26歳・人材営業・2年目 | 転職タイミング | HRテック企業に内定 |
| 4 | 30歳・マーケター・4年目 | キャリアチェンジ | SaaS企業マーケで内定 |
| 5 | 35歳・事業開発・7年目 | スタートアップ | シリーズBに入社 |
| 6 | 29歳・IS 3年目 | 外資転職 | 外資SaaS内定・年収30%UP |
| 7 | FS 3年/20代後半/関東 | スタートアップ | シリーズA転職・6ヶ月後追加調達 |
| 8 | IS 2年/20代前半/関西 | キャリアチェンジ | FS転職・年収据え置き |
| 9 | CS 4年/30代前半/関東 | 年収交渉 | 520万→680万に引き上げ |
| 10 | マーケ 3年/20代後半/関東 | キャリアチェンジ | SaaSマーケ転職成功 |
| 11 | FS 7年/30代後半/関東 | 転職タイミング | SaaSシニアセールスへ転職 |
| 12 | CS 1年/20代前半/関東 | スタートアップ | シリーズAへ転職 |
| 13 | 事業会社マーケ 5年/30代前半/東海 | 外資転職 | 外資SaaSへ転職 |
| 14 | IS 3年/20代後半/関東 | 転職タイミング | 転職先決めてから入籍 |
| 15 | FS 5年/30代前半/関東 | 年収交渉 | シリーズCまで成長した企業に入社 |
| 16 | CS 3年/20代後半/関西 | キャリアチェンジ | SaaSスタートアップのPMへ |
| 17 | FS 2年/20代前半/関東 | 転職タイミング | 3ヶ月後に転職活動開始 |
| 18 | マーケ 4年/30代前半/関東 | 外資転職（RSU） | 外資SaaSへ転職決断 |
| 19 | IS 4年/30代前半/関東 | キャリアチェンジ | Midマーケット FSへ転職 |
| 20 | FS 8年/40代前半/関東 | 転職タイミング | エンタープライズ営業シニアMGRへ |

---

## コンポーネントファイル一覧

### pages/ — ページコンポーネント

| ファイル | 行数 | 概要 |
|---------|------|------|
| `pages/mentors/page.tsx` | 514 | メンター一覧ページ（検索・フィルター・グリッド表示）。Supabase `ow_mentors` 接続済み |
| `pages/mentors/MentorFilterBar.tsx` | — | メンター一覧のフィルターバー（役職・相談テーマ・受付中 切替）|
| `pages/mentors/mockMentorData.ts` | — | 開発用モックデータ（旧実装の名残、参考用） |
| `pages/mentors/loading.tsx` | — | メンター一覧のロードスケルトン |
| `pages/mentors/[id]/page.tsx` | 530 | メンター詳細ページ（プロフィール・経歴・相談テーマ・CTA）|
| `pages/mentors/[id]/loading.tsx` | — | メンター詳細のロードスケルトン |
| `pages/mentors/[id]/reserve/page.tsx` | 23 | 予約ページ（薄いラッパー、ReserveForm を呼ぶだけ）|
| `pages/mentors/[id]/reserve/ReserveForm.tsx` | 787 | メンター相談予約フォーム本体（5ステップ・相談テーマ・希望日程・POST API 呼び出し）|
| `pages/mentors/[id]/reserve/loading.tsx` | — | 予約ページのロードスケルトン |
| `pages/career-consultation/page.tsx` | 80 | キャリア相談一覧（旧フロー）|
| `pages/career-consultation/CareerConsultationClient.tsx` | — | カテゴリ別メンター一覧 Client コンポーネント |
| `pages/career-consultation/[id]/page.tsx` | — | キャリア相談詳細（旧フロー）|
| `pages/career-consultation/loading.tsx` | — | ロードスケルトン |
| `pages/consultation-cases/page.tsx` | 51 | 相談事例一覧ページ（`consultation_cases` テーブル参照）|
| `pages/consultation-cases/ConsultationCasesClient.tsx` | — | 相談事例のカード一覧 Client コンポーネント |
| `pages/consultation-cases/loading.tsx` | — | ロードスケルトン |
| `pages/consultation-request/page.tsx` | 304 | 相談申請フォーム（旧フロー・運営経由）|
| `pages/mentor/page.tsx` | 490 | メンター向けランディングページ（メンター募集・活動紹介）|
| `pages/mentor-terms/page.tsx` | 17 | メンター向け利用規約ページ |
| `pages/admin/mentors/page.tsx` | 613 | 管理者用メンター管理（一覧・編集・写真アップロード・公開切替）|
| `pages/admin/mentors/loading.tsx` | — | ロードスケルトン |
| `pages/admin/reservations/page.tsx` | 353 | 管理者用予約管理（予約一覧・ステータス変更・メンターへの転送）|
| `pages/admin/consultation-cases-new/page.tsx` | 231 | 管理者用相談事例作成フォーム |

### api/ — API ルート

| ファイル | 概要 |
|---------|------|
| `api/mentor-reservations/route.ts` | `POST`: 予約作成・ow_mentor_reservations INSERT・Resend メール通知（管理者 + ユーザー）・insertActivity |
| `api/mentors-preview/route.ts` | `GET`: トップページ・mypage 向けメンタープレビュー（最大 N 件、photo_url・catchphrase・roles 含む）|
| `api/admin-mentors/route.ts` | `GET`: 管理者向けメンター一覧 |
| `api/admin-mentors/[id]/route.ts` | `GET/PATCH`: 管理者向けメンター詳細取得・更新 |
| `api/admin-mentors/[id]/photo/route.ts` | `POST`: Supabase Storage へのメンター写真アップロード（`ow-uploads/mentors/photos/`）|
| `api/consultation-request-notify/route.ts` | `POST`: 相談申請の管理者通知メール送信 |
| `api/consultation-book/route.ts` | `POST`: 相談予約の booking 処理 |

### components/mentors/ — 再利用 UI コンポーネント

| ファイル | 概要 |
|---------|------|
| `components/mentors/MentorCardCompact.tsx` | メンターカード（写真/avatar・名前・会社・役職・catchphrase・相談ボタン）。一覧・詳細ページで共用 |
| `components/mentors/MentorCarousel.tsx` | メンターカードのカルーセル表示（横スクロール・矢印ナビ）|
| `components/mentors/MentorTabs.tsx` | カテゴリタブ切替 UI（全て/営業/CS/HR 等）|
| `components/mentors/ConsultationSection.tsx` | 「先輩に相談する」セクション（ページ内 CTA ブロック）|

### lib/ — ライブラリ・ユーティリティ

| ファイル | 概要 |
|---------|------|
| `lib/mentors.ts` | `fetchCategoriesWithMentors()`: `ow_consultation_categories` + `ow_mentors` の JOIN 取得関数 |
| `lib/mentorMatching.ts` | `calcMentorScore()` + `rankMentors()`: ユーザープロフィールとメンターのマッチングスコア計算ロジック |
| `lib/mentorAvatar.ts` | `getMentorAvatarProps()`: photo_url がある場合は画像、なければ gradient+initial を返す汎用アバターユーティリティ |

---

## 共有コンポーネント（コピー不要・参照元パスのみ記録）

新サイトでも再利用価値があるが、`opinio-work` 本体に残す共有コンポーネント。  
新サイト構築時はこれらを参照・複製すること。

| ファイル（opinio-work での絶対パス） | 概要 |
|--------------------------------------|------|
| `src/app/(jobseeker)/u/[id]/page.tsx` の `MergedTimeline` コンポーネント | 経歴タイムライン（career_chain を可視化）。新サイトのメンター詳細でも使える |
| `src/lib/supabase/queries.ts` の `getMentors()` / `getMentorById()` | Supabase クエリ関数（型マッピング込み）。新サイトの DB が同じスキーマなら流用可 |
| `src/lib/utils/mentorAvatar.ts` | 既に `lib/mentorAvatar.ts` としてコピー済み |
| `src/lib/notify/templates.ts` の `mentorReservationAdminTemplate()` / `mentorReservationUserTemplate()` | Resend メールテンプレート。新サイトでほぼそのまま使える |

---

## Supabase Storage（写真）

メンター写真 12 枚は以下のパスに保存されている:

```
ow-uploads/mentors/photos/
├── 01-shiba.png
├── 02-kimura-hayato.png
├── 03-matsumoto.png
├── 04-kimura-masaki.png
├── 05-shoto.png
├── 07-kojima.png
├── 08-yamazaki.png
├── 09-fujioka.png
├── 10-okada.png
├── 11-kimura-takuya.png
├── 12-kanazawa.png
└── 13-katayama.png
```

公開 URL パターン:  
`https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/mentors/photos/{filename}`

> ⚠️ 新サイトの Supabase プロジェクトへ写真を移行するには、各 URL からダウンロードして再アップロードが必要。`scripts/upload-mentor-photos.mjs` が参考になる（`opinio-work/scripts/` に存在）。

---

## 移植時の注意事項

1. **Supabase クライアント**: `src/lib/supabase/client.ts` / `server.ts` / `admin.ts` は新サイト用に書き換えが必要（project_ref が異なる）
2. **メール送信**: `RESEND_FROM_EMAIL` / `ADMIN_EMAIL` 環境変数が必要（`lib/notify/templates.ts` 参照）
3. **`ow_` テーブルプレフィックス**: `ow_mentors`・`ow_mentor_reservations` などのプレフィックスは、新サイトでそのまま使うか変更するかを事前決定すること
4. **CSS 変数**: `var(--royal)`・`var(--warm)` など OPINIO デザインシステム変数を多用。新サイトの `globals.css` に同じ変数を定義するか、Tailwind クラスに置き換えること
5. **`insertActivity()`**: `src/lib/business/activities.ts` の関数。新サイトにも活動ログ機能があれば移植可、なければ削除
