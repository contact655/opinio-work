# ν-8 段階6-3-3 計画ドキュメント

**作成**: 2026-05-11
**前段階**: 段階6-3-2(完了、handover-2026-05-10-nu8-stage6-3-2-complete.md 参照)
**スコープ確定方針**: Hisato さん + Claude(チャット)で 2026-05-11 セッションに振り分け実施

---

## 🎯 段階6-3-3 の概要

段階6-3-2 で「6-3-3 送り」となった 9 項目 + 6-3-2 で発見された技術的負債 1 項目 = 計 10 項目を、
**段階6-3-3 の 1 段階で完遂**する方針で計画。

10 項目すべてを 1 段階で実施することは過去の段階(6-2 = 10 コミット最大)を超える規模となる
ため、内部で **4 つの Phase** に分割して運用する。

---

## 📊 段階6-3-3 全体構成

| Phase | コンセプト | 項目 | 推定コミット数 |
|---|---|---|---|
| Phase 1 | 技術的負債整理 | C-3, B-4, C-1, C-2 | 4-6 |
| Phase 2 | タイムライン視覚 | A-2, A-1 | 3-5 |
| Phase 3 | Stories ポートフォリオ化 | B-3, B-2 | 5-7 |
| Phase 4 | 整理整頓 | A-3, B-1 | 5-7 |

**累計推定: 17-26 コミット + Migration 2-4 + Storage 設定 + DnD ライブラリ導入**

---

## 🔢 Phase × 項目順序(確定)

```
段階6-3-3
│
├─ Phase 1(技術的負債整理)
│   1. C-3: video URL エラーフィードバック         (1 コミット)
│   2. B-4: period_start / period_end UI          (1 コミット)
│   3. C-1: timeline.ts 2 系統統一                  (1-2 コミット)
│   4. C-2: UserProfileCard 学歴重複解消           (1-2 コミット)
│   ── Phase 1 完了 → 振り返り
│
├─ Phase 2(タイムライン視覚)
│   5. A-2: 並行勤務の横並び表示                    (1-2 コミット)
│   6. A-1: 学歴・職歴のロゴ対応                    (2-3 コミット)
│   ── Phase 2 完了 → 振り返り
│
├─ Phase 3(Stories ポートフォリオ化)
│   7. B-3: Storage 連携(画像アップロード)         (3-4 コミット)
│   8. B-2: 画像/動画/リンクカードの実レンダリング   (2-3 コミット)
│   ── Phase 3 完了 → 振り返り
│
└─ Phase 4(整理整頓)
    9. A-3: サブセクション機能                      (3-4 コミット)
    10. B-1: 並べ替え機能(DnD)                    (2-3 コミット)
    ── Phase 4 完了 → 段階6-3-3 完了報告(F)
```

---

## 📝 各項目の詳細

### Phase 1: 技術的負債整理

#### 1. C-3: video URL エラーフィードバック

**現状**: Stories の video type で「YouTube URL」バリデーション失敗時、`canSaveDraft=false`
だけでエラー理由が表示されない(段階6-3-2 で発見された負債)。

**やること**:
- フロント側に video URL バリデーションメッセージ追加
- 「YouTube URL を入力してください」等の具体メッセージ表示

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`(StoryForm 内)

**規模**: 1 コミット

---

#### 2. B-4: period_start / period_end UI

**現状**: API は対応済み(`ow_experience_stories.period_start` / `period_end` カラム存在)、
UI のみ未実装。

**やること**:
- StoryForm に date picker 2 つ追加(period_start / period_end)
- 任意フィールドとして実装

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`(StoryForm 内)

**規模**: 1 コミット

---

#### 3. C-1: timeline.ts 2 系統統一

**現状**: `toTimelineCareerEntries`(`/u/[id]` 用、LegacyCareerEntry 受け取り)と
`buildTimelineCareerEntriesFromRaw`(`/mypage` 用、Raw 受け取り)が並存。
段階6-3-2 で「将来統一予定」と handover に明記済み。

**やること**:
- `/u/[id]/page.tsx` を `buildTimelineCareerEntriesFromRaw` に移行
- 旧関数 `toTimelineCareerEntries` を削除
- `DB_NAME_TO_SLUG` の利用箇所を確認、削除可能なら削除

**影響ファイル(予測)**:
- `src/app/(jobseeker)/u/[id]/page.tsx`
- `src/lib/utils/timeline.ts`(旧関数削除)
- `src/lib/utils/career.ts`(`DB_NAME_TO_SLUG` 確認)

**規模**: 1-2 コミット

---

#### 4. C-2: UserProfileCard 学歴重複解消

**現状**: `/mypage` で `UserProfileCard` 内学歴 + `MergedTimeline` 内学歴の二重表示。
段階6-3-2 で「暫定許容、後続コミットで整理予定」と handover に明記済み。

**やること**:
- `UserProfileCard` から学歴表示部分を切り離す
- 影響範囲を調査(他で UserProfileCard が学歴表示を使っていないか)

**影響ファイル(予測)**:
- `src/components/profile/UserProfileCard.tsx`
- `UserProfileCard` を使っている他のページ(調査必要)

**規模**: 1-2 コミット

---

### Phase 2: タイムライン視覚

#### 5. A-2: 並行勤務の横並び表示

**現状**: 段階6-3-2 で「縦スタック + `[並行]` バッジ」で実装。Wantedly 本家のような
横並び表示は未対応。

**やること**:
- 同月開始の career が 2 件以上のとき横並びレイアウトに切り替え
- 調査メモ案 B(`groupOverlappingCareers` 流用)を参考に
- モバイル幅では縦スタックを維持(横並びは狭すぎる)

**影響ファイル(予測)**:
- `src/components/profile/MergedTimeline.tsx`

**規模**: 1-2 コミット

---

#### 6. A-1: 学歴・職歴のロゴ対応

**現状**: Lucide アイコン(Briefcase / GraduationCap)で固定。

**やること**:
- ロゴソースの確定(`ow_companies.logo_url` カラム追加 + 手動登録 / Brandfetch 等の外部 API / その他)
- スキーマ変更(必要なら)
- MergedTimeline のアイコン円にロゴ表示
- フォールバック: ロゴ未登録時は Lucide アイコンに戻す

**着手前に判断点を多く扱う重要項目**:
- ロゴデータソース(自前管理 / 外部 API / ハイブリッド)
- 学歴ロゴの取り扱い(`ow_user_educations` には company_id 相当のマスタ参照がない)
- ロゴサイズ・余白・形状(円形クロップ等)

**影響ファイル(予測)**:
- `src/components/profile/MergedTimeline.tsx`
- Migration 新規(`ow_companies.logo_url` 追加等)
- `src/lib/utils/timeline.ts`(ロゴ URL 解決ロジック)

**規模**: 2-3 コミット

---

### Phase 3: Stories ポートフォリオ化

#### 7. B-3: Storage 連携(画像アップロード)

**現状**: image type は外部 image_url 直貼り。Supabase Storage 未連携。

**やること**:
- Supabase Storage バケット作成(`stories-images` 等)
- RLS ポリシー(自分の experience に紐づくストーリーのみアップロード可)
- アップロード UI(StoryForm 内に file input + プレビュー)
- 画像最適化(リサイズ、フォーマット統一等は判断必要)
- 既存 image_url との互換性維持(外部 URL も引き続き受け付け)

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`(StoryForm)
- 新規: Storage アップロード API or Supabase クライアント直接利用
- Supabase ダッシュボードで Storage バケット + RLS 設定

**規模**: 3-4 コミット

---

#### 8. B-2: 画像/動画/リンクカードの実レンダリング

**現状**: type バッジ + URL 省略表示のみ。実コンテンツ(画像本体、動画埋め込み、OGP カード)は未表示。

**やること**:
- image type: `<img src>` で表示(B-3 で Storage 経由になる)
- video type: YouTube 埋め込み iframe
- card type: タイトル + description のリッチカード
- link type: OGP メタ取得 + サムネイル付きカード(OGP 取得 API 検討必要)

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`(StoryCard 表示モード)
- 新規: OGP メタ取得サーバー側 API or 外部サービス

**規模**: 2-3 コミット

---

### Phase 4: 整理整頓

#### 9. A-3: サブセクション機能

**現状**: stories はフラット表示(experience_id ごと)。グループ化なし。

**やること**:
- スキーマ判断: `ow_experience_stories.section_id` 追加 or 新テーブル `ow_story_sections` 作成
- セクションの追加・編集・削除 UI
- StoryAccordion 内のセクション別グループ化
- セクションをまたいだ並べ替え対応(B-1 と相互影響)

**着手前に判断点を多く扱う重要項目**:
- スキーマ設計(カラム追加 / 新テーブル)
- セクション内に未分類ストーリーをどう扱うか
- 既存 stories のマイグレーション戦略

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`(大改修)
- Migration 新規(セクション関連)
- 新規: `src/components/profile/StorySection.tsx` 等

**規模**: 3-4 コミット

---

#### 10. B-1: 並べ替え機能(DnD)

**現状**: `sort_order` カラムは存在、ただし MAX+1 で固定追加のみ。並べ替え UI なし。

**やること**:
- DnD ライブラリ導入(dnd-kit 推奨、`react-beautiful-dnd` は非アクティブ)
- StoryCard をドラッグ可能化
- ドロップ時に `sort_order` 一括更新 API
- A-3 のサブセクション内並べ替え + セクションをまたぐ移動の対応

**影響ファイル(予測)**:
- `src/components/profile/StoryAccordion.tsx`
- `package.json`(dnd-kit 追加)
- 新規: 並べ替え API or 既存 PUT を拡張

**規模**: 2-3 コミット

---

## 🛡️ Phase 完了ごとの振り返り(必須)

判断疲労を測るため、各 Phase 完了時に以下 3 点を確認:

1. **判断精度**: 良い / 普通 / 落ちている気がする
2. **体力**: 続けられる / 一旦休みたい
3. **次の Phase に進む意思**: そのまま進む / 順序入れ替え / 中断

「落ちている」or「休みたい」が出たら、次のセッションに持ち越す。

---

## 🔴 段階6-3-3 全体の前提・制約

### 前提

- 段階6-3-2 完了済み(commit `2318e5e` 時点)
- 累計 35 コミット + 9 migration(段階6 全体)
- 今日(2026-05-11)時点のリポジトリ状態を正と扱う

### 制約

- 段階6-3-2 で完成したファイル(MergedTimeline.tsx, FutureSectionEditor.tsx,
  StoryAccordion.tsx, timeline.ts)は段階6-3-3 で**改修・拡張対象**(段階6-3-2 のときの
  「触らない」ルールは終了)
- ただし**機能を壊さない**ことが最優先。動作確認をスキップしない
- 段階6-3-1.5 で確立した明示保存 + 変身パターンは引き続き踏襲
- 段階6-3-1 の AchievementEditor スタイルも踏襲対象

---

## 🗂️ 段階6-3-3 開始時のチェックリスト

新スレッド開始時に確認:

1. このドキュメント(`docs/research-2026-05-11-nu8-stage6-3-3-plan.md`)を新スレッドの
   Claude(チャット)が読み込んだか
2. `docs/handover-2026-05-10-nu8-stage6-3-2-complete.md` も併せて読み込んだか
3. dev server 起動確認(`lsof -i :3000` → `npm run dev`)
4. 最新コミット確認(`git log --oneline -10`、`2318e5e` 以降があれば不整合)
5. Phase 1 項目 1(C-3: video URL エラーフィードバック)から着手

---

## 📂 重要なファイル(段階6-3-3 で頻繁に触る)

- `src/components/profile/MergedTimeline.tsx`(タイムライン本体、Phase 2 で改修)
- `src/components/profile/StoryAccordion.tsx`(Stories 編集 UI、Phase 1/3/4 で改修)
- `src/components/profile/UserProfileCard.tsx`(Phase 1 で学歴切り離し)
- `src/components/profile/FutureSectionEditor.tsx`(段階6-3-2 完成、Phase 4 で触るかも)
- `src/lib/utils/timeline.ts`(Phase 1 で 2 系統統一)
- `src/app/(jobseeker)/u/[id]/page.tsx`(Phase 1 で更新、Phase 2 でも触るかも)
- `src/app/(jobseeker)/mypage/MypageClient.tsx`(Phase 1 で UserProfileCard 切り離し連動)

---

## 🌅 新スレッド開始時の挨拶テンプレ

```
ν-8 段階6-3-3 から再開したいです。
以下の計画ドキュメントを読んでください。

[docs/research-2026-05-11-nu8-stage6-3-3-plan.md の内容を貼り付け、またはファイル添付]

Phase 1 項目 1(C-3: video URL エラーフィードバック)から着手したいです。
事前 report → 承認 → 実装の流れでお願いします。
```

---

*計画作成: 2026-05-11(段階6-3-2 完了直後)*
