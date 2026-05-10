# ν-8 段階6-3-2 完了引き継ぎ（2026-05-10）

## 概要

Stage 6-3-2: プロフィールの **Wantedly 風マージドタイムライン UI** を実装。
職歴・学歴・未来セクションを一本のタイムラインに統合し、職歴には **ストーリー編集 UI** を追加。

- `MergedTimeline` コンポーネント（Server Component、no "use client"）を新規作成
- `/u/[id]`（公開プロフィール）と `/mypage`（マイページダッシュボード）の両方に統合
- `future_aspirations`（目指す姿）を基本情報タブから `MergedTimeline` のトップ行に昇格
- `FutureSectionEditor`（"use client"）でタイムライン上からインライン編集を実現
- `StoryAccordion`（"use client"）で各職歴の `ow_experience_stories` を CRUD（遅延ロード）

---

## コミット一覧（全6コミット）

| コミット | ハッシュ | 内容 |
|---------|---------|------|
| A | (research doc のみ) | 事前調査 `docs/research-2026-05-10-nu8-stage6-3-2-timeline.md` |
| B | `692a642` | `MergedTimeline.tsx` 新規作成（Server Component） |
| B 修正 | `e34618b` | 未来アイコン: Star → `avatar_color` グラデーション + initial に修正 |
| C-1 | `e31d94d` | `/u/[id]` に `MergedTimeline` 統合 + `timeline.ts` ヘルパー作成 |
| C-2 | `9cd475c` | `/mypage` に `MergedTimeline` 統合 + `timeline.ts` に新関数追加 |
| D | `1a4c6f1` | `future_aspirations` を `MergedTimeline` インライン編集に昇格 |
| E | `f9ba095` | `StoryAccordion` 新規作成（`ow_experience_stories` CRUD） |

---

## 各コミットの主要変更

### Commit B（`692a642`）— MergedTimeline 新規作成

**変更ファイル:**
- `src/components/profile/MergedTimeline.tsx` +693行（新規）

**主要設計:**

| 判断 | 採用案 | 理由 |
|------|-------|------|
| Server/Client 境界 | no "use client"（Server Component） | `FutureSectionEditor` は後で子として import するため、親が Server でも動作 |
| `FutureContent` 実装 | 静的表示プレースホルダー（Commit D で置換予定） | CTA クリック処理は Client 機能のため Commit D に分離 |

**B 修正（`e34618b`）— デザイン修正**

`FutureIcon` が Lucide `<Star>` になっていた設計ドリフトを修正。
正しくは `avatar_color` グラデーション 40px 円 + initial 文字（`FutureData` 型を追加）。

---

### Commit C-1（`e31d94d`）— /u/[id] 統合

**変更ファイル:**
- `src/app/(jobseeker)/u/[id]/page.tsx` +134行 / -96行
- `src/lib/utils/timeline.ts` +155行（新規）

**主要設計:**

| 判断 | 採用案 | 理由 |
|------|-------|------|
| timeline.ts の位置 | `src/lib/utils/timeline.ts`（utils 配下） | Page→Component→lib の依存方向を維持 |
| ow_roles.name 変換 | `SLUG_TO_LABEL` マップ（`toTimelineCareerEntries`） | `/u/[id]` は既存 LegacyCareerEntry 経由のため slug 変換が必要 |
| viewerIsOwner 判定 | `ow_users.auth_id` カラムを追加 SELECT、`supabase.auth.getUser()` と並列取得 | 追加クエリなし、並列で遅延ゼロ |
| キャリアタイムラインの配置 | 「経歴 / TIMELINE」セクションに MergedTimeline を単独配置 | 旧キャリア+学歴の 2 セクションを 1 本に統合、`CareerTimeline` は削除せず保留 |
| TS エラー（TS2448）修正 | `timelineCareers` の変換を `experiences` 配列構築後に移動 | 変数未定義エラー: let 宣言前の参照 |

---

### Commit C-2（`9cd475c`）— /mypage 統合

**変更ファイル:**
- `src/app/(jobseeker)/mypage/page.tsx` +55行 / -4行
- `src/app/(jobseeker)/mypage/MypageClient.tsx` +33行 / -1行
- `src/lib/utils/timeline.ts` +76行

**主要設計:**

| 判断 | 採用案 | 理由 |
|------|-------|------|
| ow_experiences フェッチ | 既存 `Promise.all([tags, edus, certs])` を 5 本並列に拡張 | クエリ追加で遅延ゼロ |
| CareerEntry 構築 | `buildTimelineCareerEntriesFromRaw` を `timeline.ts` に追加 | `/mypage` は DB 生データで `ow_roles.name` が直接表示ラベルのため slug 変換不要 |
| 2 系統設計コメント | timeline.ts 冒頭に両系統の使い分け + 将来統一予定を明記 | 将来の混乱防止（6-3-3 で `/u/[id]` を `buildTimelineCareerEntriesFromRaw` に移行 → `toTimelineCareerEntries` 削除予定） |
| 学歴の重複 | 暫定許容（UserProfileCard の学歴表示と MergedTimeline が重複） | 解消は 6-3-3 送り |

---

### Commit D（`1a4c6f1`）— FutureSectionEditor 昇格

**変更ファイル:**
- `src/components/profile/FutureSectionEditor.tsx` +292行（新規）
- `src/components/profile/MergedTimeline.tsx` +66行 / -84行（`FutureContent` 削除、`FutureSectionEditor` import）
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` -88行（`futureAspirations` 4 箇所削除）

**主要設計:**

| 判断 | 採用案 | 理由 |
|------|-------|------|
| コンポーネント分割 | 新規 `FutureSectionEditor.tsx`（"use client"）、props: `initialText: string \| null` + `viewerIsOwner: boolean` | `FutureData` を受け取ると `MergedTimeline` との循環 import が発生するため `initialText` で回避 |
| futureAspirations 削除タイミング | このコミットで即削除（4 箇所: BasicInfo 型 / 初期 state×2 / handleSaveBasic body / JSX FormSection） | 新 UI と並存させると 2 経路書き込みが発生するため |
| 空状態の挙動 | CTA クリック → 編集モード。テキストありの場合: ✎ 編集ボタン常時表示 → 編集モード | FutureSectionEditor 内で自己完結 |
| コミット分割 | 1 コミット | API 変更なし、UI 置き換えのみで分割メリット小 |
| maxLength / Toast | maxLength=500、インライン justSaved 表示（タイトル行に "✓ 保存しました"） | Toast より目立たず自然。保存ボタンも変身（warm → success） |

---

### Commit E（`f9ba095`）— StoryAccordion 新規作成

**変更ファイル:**
- `src/components/profile/StoryAccordion.tsx` +791行（新規）
- `src/components/profile/CareerHistoryEditor.tsx` +4行

**主要設計:**

| 判断 | 採用案 | 理由 |
|------|-------|------|
| API 実装状況 | A — 完成済み | GET/POST/PUT/DELETE 全メソッドが実装済み、バリデーション・RLS 認可も完全 |
| コミット分割 | A — 1 コミット | API 完全実装済みのため UI のみが残作業、分割メリットなし |
| フォーム起動 UI | A — AchievementEditor と同一パターン | hover ✎/× + formBox（bg-tint + royal border）で視覚的一貫性 |
| type 選択 UI | A — 4 ボタン横並び | 4 種類は少ないためボタンが直感的。type 別にフィールドを動的切り替え |
| type 別必須フィールド | image→image_url* / video→YouTube URL* / link→link_url* / card→title か description か | API バリデーションと 1:1 対応 |
| image type 扱い | A — URL 直貼り仮実装 | `image_url` カラムは Storage path と互換（6-3-3 で path に置き換えるだけ） |
| period_start/end | API 対応済み、UI は省略 | シンプル化のため UI に出さない（6-3-3 以降で追加） |

---

## 段階6-3-2 全体の設計判断（21 点）

| # | コミット | 判断項目 | 採用案 |
|---|---------|---------|-------|
| 1 | B | Server/Client 境界 | no "use client" |
| 2 | B | FutureContent 初期実装 | 静的プレースホルダー |
| 3 | B修正 | FutureIcon | avatar_color gradient + initial |
| 4 | C-1 | timeline.ts 位置 | lib/utils/timeline.ts |
| 5 | C-1 | ow_roles.name 変換 | SLUG_TO_LABEL（/u/[id] 向け） |
| 6 | C-1 | viewerIsOwner 判定 | auth_id 追加 SELECT + 並列 |
| 7 | C-1 | 配置・タイトル | 「経歴 / TIMELINE」単独セクション |
| 8 | C-1 | TS2448 修正 | 変換コードを配列構築後に移動 |
| 9 | C-2 | ow_experiences フェッチ | Promise.all 5 本並列 |
| 10 | C-2 | CareerEntry 構築 | buildTimelineCareerEntriesFromRaw（slug 変換不要） |
| 11 | C-2 | 2 系統設計 | コメント明記 + 将来統一予定 |
| 12 | C-2 | 学歴重複 | 暫定許容（6-3-3 送り） |
| 13 | D | コンポーネント分割 | initialText prop で循環 import 回避 |
| 14 | D | futureAspirations 削除タイミング | このコミットで即削除 |
| 15 | D | 空状態挙動 | CTA クリック → 編集モード |
| 16 | D | コミット分割 | 1 コミット |
| 17 | D | maxLength / フィードバック | 500 字 + インライン justSaved |
| 18 | E | API 実装状況 | A（完成済み） |
| 19 | E | コミット分割 | A（1 コミット） |
| 20 | E | フォーム起動 UI | AchievementEditor と同一 |
| 21 | E | type 選択 UI | 4 ボタン横並び + 動的フィールド |
| 22 | E | type 別必須フィールド | API バリデーション準拠 |
| 23 | E | image type 扱い | URL 直貼り仮実装 |
| 24 | E | period_start/end | API 対応済み、UI は省略 |

（判断 22〜24 は E の小判断として追加、合計 24 点）

---

## 段階6-3-3 への申し送り

### タイムライン表示

| 項目 | 現状 | 6-3-3 での対応 |
|------|------|--------------|
| 会社ロゴ/アイコン対応 | Lucide `<Briefcase>` / `<GraduationCap>` 固定 | `ow_companies.logo_url` から画像取得に変更 |
| 並行勤務の横並び表示 | 縦スタック + 「並行」バッジ | 同一開始月の職歴を横並びにするレイアウト変更 |
| サブセクション機能 | フラット表示のみ | 職歴内のプロジェクト/チームをグループ化 |

### Stories（StoryAccordion）

| 項目 | 現状 | 6-3-3 での対応 |
|------|------|--------------|
| 並べ替え | なし（`sort_order` は追加順） | ドラッグ&ドロップ（DnD Kit 等） |
| 実レンダリング | URL 省略表示のみ | image→`<img>` プレビュー / video→YouTube embed / link→OGP カード |
| Storage 連携 | 画像 URL 直貼り仮実装 | Supabase Storage へのアップロード UI + `image_url` を Storage path に置換 |
| period_start/end | API 対応済み、UI 非表示 | フォームに「対象期間（任意）」欄を追加 |

### timeline.ts

| 項目 | 現状 | 6-3-3 での対応 |
|------|------|--------------|
| 2 系統 CareerEntry 変換 | `toTimelineCareerEntries`（/u/[id] 向け）と `buildTimelineCareerEntriesFromRaw`（/mypage 向け）が並存 | `/u/[id]` を `buildTimelineCareerEntriesFromRaw` に移行後、`toTimelineCareerEntries` 削除（SLUG_TO_LABEL が不要になる） |

### /mypage

| 項目 | 現状 | 6-3-3 での対応 |
|------|------|--------------|
| UserProfileCard + MergedTimeline の学歴重複 | UserProfileCard の学歴リストと MergedTimeline の EducationEntry が二重表示 | UserProfileCard の学歴表示を削除するか、MergedTimeline の EducationEntry を /mypage で渡さない方針を決定 |

### StoryAccordion のフロント側バリデーション

- API 側は YouTube URL 正規表現チェック・type 別必須チェックが実装済み
- StoryAccordion の `canSaveDraft` 関数も同等チェックを実装済み
- ただし **video type の YouTube URL エラーメッセージ** が `canSaveDraft = false`（ボタン disabled）のみで、ユーザーへのフィードバックなし → 6-3-3 でフォーム内エラー表示を追加推奨

---

## 動作確認結果

各コミット完了後に Hisato さんが実機（localhost:3000）で確認 OK。
詳細はチャット履歴参照（スクリーンショット未保存）。

| コミット | 確認内容 |
|---------|---------|
| B + B修正 | MergedTimeline の外観・未来アイコン修正 |
| C-1 | `/u/[id]` でキャリア + 学歴が 1 本に統合表示 |
| C-2 | `/mypage` ダッシュボードで MergedTimeline が表示 |
| D | `/mypage` 未来セクションから直接インライン編集が動作 |
| E | StoryAccordion が展開・CRUD 動作（遅延ロード確認） |

---

## 数字で見る進捗

### コミット数

| 段階 | コミット数 |
|------|---------|
| 6-1 | 7 |
| 6-2 | 10（+ 5 migration） |
| 6-3-1 | 4（+ 4 migration） |
| 6-3-1.5 | 7 |
| 6-3-2 | 6（B 修正含む） |
| **合計** | **34 コミット + 9 migration** |

### 段階6-3-2 の行数差分

| コミット | +行 | -行 | 主要ファイル |
|---------|-----|-----|------------|
| B | +693 | 0 | MergedTimeline.tsx（新規） |
| B修正 | +33 | -17 | MergedTimeline.tsx |
| C-1 | +193 | -96 | u/[id]/page.tsx, timeline.ts（新規） |
| C-2 | +164 | -4 | mypage/page.tsx, MypageClient.tsx, timeline.ts |
| D | +308 | -88 | FutureSectionEditor.tsx（新規）, MergedTimeline.tsx, ProfileEditClient.tsx |
| E | +795 | 0 | StoryAccordion.tsx（新規）, CareerHistoryEditor.tsx |
| **合計** | **+2,186** | **-205** | **純増 +1,981行** |

---

## 新規作成ファイル一覧

| ファイル | 行数 | 役割 |
|---------|-----|------|
| `src/components/profile/MergedTimeline.tsx` | ~710 | 職歴・学歴・未来を統合する Server Component タイムライン |
| `src/lib/utils/timeline.ts` | ~232 | MergedTimeline 向けデータ変換ヘルパー |
| `src/components/profile/FutureSectionEditor.tsx` | ~292 | `future_aspirations` のインライン編集 Client Component |
| `src/components/profile/StoryAccordion.tsx` | ~791 | `ow_experience_stories` の CRUD アコーディオン Client Component |

---

## 次セッション（段階6-3-3）の冒頭で確認すべきこと

1. **段階6-3-3 のスコープ確定**: 6-3-3 送り項目のうち、どれから着手するか優先度付け
2. **timeline.ts 2 系統統一の実施方針**: `/u/[id]` を `buildTimelineCareerEntriesFromRaw` に移行する際の影響範囲確認
3. **UserProfileCard 学歴重複の解消方針**: UserProfileCard の学歴を削除するか、MergedTimeline に渡さないか
4. **Stories 実レンダリングの優先度**: image/video/link の rich preview は 6-3-3 スコープか、後続段階か
5. **Supabase テーブル確認**: `ow_experience_stories` の実データ状況（migration 089 が実際に Supabase Dashboard で適用済みか）
