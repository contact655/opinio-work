# メンター機能 削除調査レポート

> 作成日: 2026-06-03  
> ステータス: **Step 1 完了 — 削除実行前の承認待ち**  
> 目的: メンター関連の全実装を洗い出し、削除範囲と保持範囲を明確にする

---

## 0. エグゼクティブサマリー

メンター機能は **フロントエンド・バックエンド・DB の 3 層にわたって深く組み込まれている**。  
ただし「求職者が先輩を探して相談する」機能と「企業情報・経歴を見る」機能は明確に分離されており、  
後者（`ow_users`、`ow_experiences` 等）は完全に独立している。

- **完全削除できるファイル**: 約 **45 ファイル・5,200+ 行**
- **部分編集が必要なファイル**: 約 **20 ファイル**（共有コンポーネントから mentor 参照を外す）
- **絶対に触ってはいけないテーブル/ファイル**: `ow_users`、`ow_experiences`、`MergedTimeline` など

---

## 1. DB テーブル（Supabase）

### 1A. 削除候補テーブル（メンター専用）

| テーブル名 | 行数 | 説明 |
|-----------|------|------|
| `ow_mentors` | **13** | メンタープロフィール本体（写真・経歴・タグ等） |
| `ow_mentor_reservations` | **0** | メンター相談予約（申込者→メンター） |
| `ow_mentor_categories` | **0** | メンターのカテゴリ紐づけ |
| `ow_consultation_categories` | **6** | 相談カテゴリマスタ（「転職全般」等） |
| `ow_consultation_requests` | **0** | 相談申請（旧フロー用） |
| `ow_consultations` | **0** | 相談セッション |
| `consultation_cases` | **20** | 相談事例（記事コンテンツ型） |

> ⚠️ `consultation_cases` は 20 件のコンテンツがある。削除前に内容確認が必要。

### 1B. 保持テーブル（共有）—— **絶対削除禁止**

| テーブル名 | 理由 |
|-----------|------|
| `ow_users` | `is_mentor` カラムがあるが、テーブル自体は認証・プロフィールの基盤 |
| `ow_experiences` | キャリア経歴。企業在籍メンバー表示（`CurrentEmployeesSection`）に使用 |
| `ow_bookmarks` | `target_type = 'mentor'` 行があるが、会社・求人ブックマークも同テーブル |
| `ow_activities` | `type = 'mentor_reservation_received'` 行があるが、全業務ログ共有テーブル |

### 1C. ow_users への影響

`ow_users.is_mentor` (boolean) カラムがある。  
テーブル自体は残すが、このカラムは **後日 NULL 化 or 削除** することができる。  
削除フェーズでは `is_mentor` を参照するコード行のみ消す（テーブルは触らない）。

---

## 2. ページ・ルート（Next.js App Router）

### 2A. 完全削除できるページ・ルートグループ

| パス | ファイル | 行数 | 説明 |
|------|---------|------|------|
| `/mentors` | `src/app/(jobseeker)/mentors/page.tsx` | 514 | メンター一覧 |
| `/mentors/[id]` | `src/app/(jobseeker)/mentors/[id]/page.tsx` | 530 | メンター詳細 |
| `/mentors/[id]/reserve` | `src/app/(jobseeker)/mentors/[id]/reserve/page.tsx` | 23 | 予約ページ（薄いラッパー） |
| `/mentors/[id]/reserve` | `src/app/(jobseeker)/mentors/[id]/reserve/ReserveForm.tsx` | 787 | 予約フォーム本体 |
| `/mentors/[id]/reserve` | `src/app/(jobseeker)/mentors/[id]/reserve/loading.tsx` | — | skeleton |
| `/mentors` (loading) | `src/app/(jobseeker)/mentors/loading.tsx` | — | skeleton |
| `/mentors` (loading) | `src/app/(jobseeker)/mentors/[id]/loading.tsx` | — | skeleton |
| `/mentors` (mock) | `src/app/(jobseeker)/mentors/mockMentorData.ts` | — | mock データ |
| `/mentors` (filter) | `src/app/(jobseeker)/mentors/MentorFilterBar.tsx` | — | フィルターUI |
| `/career-consultation` | `src/app/career-consultation/page.tsx` | 80 | 旧キャリア相談一覧 |
| `/career-consultation` | `src/app/career-consultation/CareerConsultationClient.tsx` | — | Client版 |
| `/career-consultation/[id]` | `src/app/career-consultation/[id]/page.tsx` | — | 詳細 |
| `/career-consultation/loading` | `src/app/career-consultation/loading.tsx` | — | skeleton |
| `/consultation-cases` | `src/app/consultation-cases/page.tsx` | 51 | 相談事例一覧 |
| `/consultation-cases` | `src/app/consultation-cases/ConsultationCasesClient.tsx` | — | Client版 |
| `/consultation-cases/loading` | `src/app/consultation-cases/loading.tsx` | — | skeleton |
| `/consultation-request` | `src/app/consultation-request/page.tsx` | 304 | 相談申請フォーム（旧） |
| `/mentor` | `src/app/mentor/page.tsx` | 490 | メンター向けランディング |
| `/mentor-terms` | `src/app/mentor-terms/page.tsx` | 17 | メンター向け利用規約 |

**ディレクトリとして丸ごと削除できるフォルダ:**
```
src/app/(jobseeker)/mentors/
src/app/career-consultation/
src/app/consultation-cases/
src/app/consultation-request/
src/app/mentor/
src/app/mentor-terms/
```

### 2B. Admin ページ（削除候補）

| パス | ファイル | 行数 | 説明 |
|------|---------|------|------|
| `/admin/mentors` | `src/app/admin/mentors/page.tsx` | 613 | 管理者メンター管理 |
| `/admin/mentors/loading` | `src/app/admin/mentors/loading.tsx` | — | skeleton |
| `/admin/reservations` | `src/app/admin/reservations/page.tsx` | 353 | 予約管理 |
| `/admin/consultation-cases/new` | `src/app/admin/consultation-cases/new/page.tsx` | 231 | 相談事例投稿 |

---

## 3. API ルート

### 3A. 完全削除できる API

| パス | ファイル | 行数 | 説明 |
|------|---------|------|------|
| `POST /api/mentor-reservations` | `src/app/api/mentor-reservations/route.ts` | 155 | 予約作成・Resend通知 |
| `GET /api/mentors/preview` | `src/app/api/mentors/preview/route.ts` | 50 | トップページ向けプレビュー |
| `GET/PATCH /api/admin/mentors` | `src/app/api/admin/mentors/route.ts` | 16 | 管理者メンター一覧 |
| `GET/PATCH /api/admin/mentors/[id]` | `src/app/api/admin/mentors/[id]/route.ts` | 33 | 管理者メンター編集 |
| `POST /api/admin/mentors/[id]/photo` | `src/app/api/admin/mentors/[id]/photo/route.ts` | 43 | 写真アップロード |
| `POST /api/consultation-request/notify` | `src/app/api/consultation-request/notify/route.ts` | 61 | 相談申請メール送信 |
| `POST /api/consultation/book` | `src/app/api/consultation/book/route.ts` | 120 | 相談予約 |

### 3B. 部分削除が必要な API

| ファイル | 削除箇所 |
|---------|---------|
| `src/app/api/search/suggest/route.ts` | `ow_mentors` クエリ + `mentors:[]` レスポンスフィールド削除 |
| `src/app/api/stats/route.ts` | `mentors:` カウントフィールド削除 |

---

## 4. コンポーネント

### 4A. 完全削除できるコンポーネント

| ファイル | 行数 | 説明 |
|---------|------|------|
| `src/components/mentors/ConsultationSection.tsx` | 41 | 相談セクション |
| `src/components/mentors/MentorCardCompact.tsx` | 143 | メンターカードUI |
| `src/components/mentors/MentorCarousel.tsx` | 136 | カルーセル |
| `src/components/mentors/MentorTabs.tsx` | 152 | タブUI |

**フォルダごと削除:**
```
src/components/mentors/
```

### 4B. 部分削除が必要なコンポーネント

| ファイル | 削除箇所 | 影響度 |
|---------|---------|--------|
| `src/app/(jobseeker)/page.tsx` | `MentorsSection` コンポーネント（~200行）、Stats の `mentors` カウント、HowItWorks STEP02 の「先輩に相談する」リンク先変更 | 高 |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | `CompanyMentorsSection`（~150行）、`MentorSuggestionBanner`（~50行）、`_MentorCTAWidget`（~50行）、現役社員カードの `isMentor` バッジ・「相談する」ボタン | 高 |
| `src/app/(jobseeker)/jobs/[id]/page.tsx` | 先輩メンターセクション（~60行）、`getMentors()` インポート削除 | 中 |
| `src/app/(jobseeker)/articles/[slug]/page.tsx` | `ArticleMentorCTA` コンポーネント（~130行）、記事内 `MentorCTA`（~50行）、`is_mentor` バッジ | 中 |
| `src/app/(jobseeker)/u/[id]/page.tsx` | `is_mentor` チェック、「メンター相談を申し込む」ボタン、`mentorQuestionTags` セクション | 中 |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | `MentorReserveView`、`mentor-requests`/`mentor-schedule` ビュー、`mentorBookmarks` タブ、`BookmarksMentorMatch`、ダッシュボードカードの「メンター相談」KPI | 高 |
| `src/app/(jobseeker)/mypage/page.tsx` | `ow_mentor_reservations` フェッチ、`mentorBookmarks` フェッチ、`is_mentor` チェック | 中 |
| `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx` | `mentor-reserve`/`mentor-requests`/`mentor-schedule` 型・サイドバー項目 | 中 |
| `src/components/jobseeker/JobseekerHeader.tsx` | ナビリンク「メンター」、検索サジェストのメンターセクション | 低 |
| `src/components/jobseeker/JobseekerFooter.tsx` | 「先輩に相談」リンク、「メンター向け利用規約」リンク | 低 |
| `src/components/jobseeker/MobileBottomNav.tsx` | 「先輩相談」タブ（5→4タブ化が必要） | 中 |
| `src/components/Footer.tsx` | 「メンターに相談」「メンター向け利用規約」リンク削除 | 低 |
| `src/components/Header.tsx` | 「メンターに相談」ナビリンク削除 | 低 |
| `src/app/sitemap.ts` | `/mentors` / `/mentors/[id]` / `/career-consultation` / `/consultation-cases` / `/mentor` 削除 | 低 |

---

## 5. ライブラリ・ユーティリティ

### 5A. 完全削除できるライブラリ

| ファイル | 行数 | 説明 |
|---------|------|------|
| `src/lib/mentors.ts` | 81 | `fetchCategoriesWithMentors()` 等 |
| `src/lib/mentorMatching.ts` | 132 | マッチングスコア計算 |
| `src/lib/utils/mentorAvatar.ts` | 59 | アバター表示ユーティリティ |

### 5B. 部分削除が必要なライブラリ

| ファイル | 削除箇所 |
|---------|---------|
| `src/lib/supabase/queries.ts` | `MentorData` 型・`getMentors()`・`getMentorById()`・`mapMentor()`・`MENTOR_COLS`（約 120 行）、`CompanyWithEmployees` 内の `mentorId` 解決ロジック（~15 行） |
| `src/lib/business/activities.ts` | `mentor_reservation_received` イベント型マッピング（1行） |
| `src/lib/notify/templates.ts` | `mentorReservationAdminTemplate()`・`mentorReservationUserTemplate()`（~50 行） |
| `src/lib/conversations/createConversation.ts` | mentor 参照があれば削除（要確認） |

---

## 6. 全体ファイル数サマリー

| カテゴリ | 完全削除 | 部分編集 |
|---------|---------|---------|
| ページ (jobseeker) | 9ファイル | 5ファイル |
| ページ (admin) | 4ファイル | 1ファイル |
| API ルート | 7ファイル | 2ファイル |
| コンポーネント | 4ファイル | 9ファイル |
| ライブラリ | 3ファイル | 3ファイル |
| **合計** | **27ファイル** | **20ファイル** |

推定削除行数: **5,000 〜 6,000 行**（部分削除含む）

---

## 7. 絶対に削除・変更してはいけない資産

| 資産 | 理由 |
|-----|------|
| `ow_users` テーブル | 認証・プロフィールの根幹。`is_mentor` カラムは将来削除可能だが、テーブル自体は不可侵 |
| `ow_experiences` テーブル | 企業在籍メンバー（`CurrentEmployeesSection` / `AlumniSection`）の基盤 |
| `ow_bookmarks` テーブル | 会社・求人ブックマークも同居。`target_type='mentor'` 行のみ消去が必要（テーブル削除は不可） |
| `ow_activities` テーブル | 全業務ログ共有テーブル。`type='mentor_reservation_received'` 行のみ存在すれば削除でよい |
| `src/app/(jobseeker)/companies/[id]/page.tsx` の `CurrentEmployeesSection` / `AlumniSection` | `ow_experiences` 起点。メンター機能とは独立して残す |
| `src/app/(jobseeker)/u/[id]/page.tsx` の `MergedTimeline` | キャリア経歴タイムライン。メンター機能とは独立 |
| `src/lib/supabase/queries.ts` の `getCompanyWithEmployees()` 内 `isMentor` フラグ | `CurrentEmployeesSection` の「相談する →」ボタン用。削除後は `mentorId` 参照行のみ消せば OK（関数自体は残す） |

---

## 8. 想定されるリスクと注意事項

### Risk 1: Mobile BottomNav の 5→4 タブ化
現在は「先輩相談」が 3 番目のタブとして固定されている。  
削除後は「企業 / 求人 / 記事 / マイページ」の 4 タブに再構成が必要。

### Risk 2: `consultation_cases` テーブルの 20 件データ
`/consultation-cases` ページのコンテンツ。  
単純削除でよいか、他の形（記事として移行）で残すかを事前確認すること。

### Risk 3: `ow_users.is_mentor = true` ユーザーへの影響
現在 `is_mentor = true` のユーザーがいる場合、そのユーザーの `/u/[id]` に「メンター相談を申し込む」ボタンが表示されている。  
削除後はボタンが消えるが、ユーザー通知は不要（まだ実ユーザー少数のため）。

### Risk 4: Storage の孤立ファイル
`ow-uploads` バケット内 `mentors/photos/` に 12 枚のメンター写真がある。  
コード削除後も残るが、Storage への直接アクセスは発生しないため実害なし。  
後日バケットから手動削除可能。

### Risk 5: sitemap.ts の動的 mentors 行
`ow_mentors` テーブルを参照している。削除後はビルドエラーになるため、同時に修正必須。

---

## 9. 推奨削除順序（Step 2 で検討）

1. **API ルート削除**（最初に外す。これでフロントからのデータフロー切断）
2. **ライブラリ（queries.ts の mentor 関数）削除**
3. **専用ページ・コンポーネントディレクトリ丸ごと削除**（`src/app/(jobseeker)/mentors/` 等）
4. **共有コンポーネントの部分編集**（ナビ・Footer・mypage・companies/[id] 等）
5. **sitemap.ts 修正**
6. **DB: `ow_mentors` 等のテーブル DROP migration 作成**（⚠️ 最後、フロント修正完了後）

---

## 10. 調査外だったもの（要確認）

- `src/lib/conversations/createConversation.ts` に mentor 参照があるか詳細未確認
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` の mentor 参照が何か（おそらく「is_mentor 表示」程度）
- `src/app/admin/page.tsx` の mentor KPI カード（削除でよいか確認）
- Storage バケット `ow-uploads/mentors/photos/` の 12 枚の写真（削除可能か確認）

---

**以上で Step 1 調査完了。次のアクションは承認後の Step 2（削除計画の詳細化）。**
