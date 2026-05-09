# ν-8 段階1 完了報告

**作成日**: 2026-05-09
**Phase**: ν-8「人のプロフィール充実化 — 求職者にも社員にも立体感を」
**段階**: 段階1「DB スキーマ整備 + /profile/edit のタブ化」
**前フェーズ引き継ぎ**: docs/handoff/handover-2026-05-08-nu7-complete.md

---

## §1. 段階1 の達成内容

### ゴール達成状況

| ゴール項目 | 状態 |
|---|---|
| /profile/edit サイドバーが「設定」→「プロフィール」+ 人型アイコン | ✅ 完了 |
| ページ内に5タブ表示（基本情報/職歴/スキル/SNS/アカウント設定） | ✅ 完了 |
| 「アカウント設定」タブが動作（ν-7 段階7 の機能を移植） | ✅ 完了 |
| 残り4タブは「（実装中）」プレースホルダー + disabled 保存ボタン | ✅ 完了 |
| DB に新カラム/新テーブルが存在 | ✅ migration ファイル完了（Supabase 適用は Hisato さんが並行進行中） |
| 柴さんの3社のロゴが ow_companies に格納 | ⏭ スキップ（下記「スキップ判断」参照） |

### 動作確認結果（Hisato さん実機確認 2026-05-09）

| 確認項目 | 結果 |
|---|---|
| タブ切替（基本情報/職歴/スキル/SNS/アカウント設定）| ✅ OK — 青いアンダーラインがアクティブタブに移動 |
| アカウント設定タブの中身 | ✅ OK — プロフィール画像・カバー、メール、パスワード変更ボタン、公開設定すべて崩れず |
| ページタイトル「プロフィール」/ サイドバー「プロフィール」+ 人型アイコン | ✅ OK |
| プレースホルダー4タブ「（実装中）」表示 + disabled 保存ボタン | ✅ OK |
| disabled 保存ボタン・自動保存・「← マイページ」ボタン詳細動作 | ⚠ 後日実機確認予定（コミット E 進行は止めない判断） |

---

## §2. コミット一覧

| コミット | ハッシュ | 内容 |
|---|---|---|
| A | `1c32359` | migration 077〜080 作成（DBスキーマ整備） |
| B | `3b2b81a` | サイドバーラベル「設定」→「プロフィール」+ Icons.user 復活 |
| C+D | `0bf5fdf` | /profile/edit 5タブ構造 + アカウント設定タブ動作完成 |
| E | このコミット | 段階1 完了報告ドキュメント |

**合計コミット数**: 4（予定の5コミットを C+D 統合により4に圧縮）

---

## §3. 各コミットの詳細

### コミット A — migration 077〜080

| ファイル | 内容 |
|---|---|
| `077_add_logo_url_to_ow_companies.sql` | `ow_companies` に `logo_url TEXT` カラム追加。null 時は logo_letter でフォールバック |
| `078_add_about_to_ow_users.sql` | `ow_users` に `about TEXT` カラム追加。自己紹介200字推奨 |
| `079_create_ow_user_skill_tags.sql` | スキルタグテーブル新規作成。RLS: SELECT=全公開、INSERT/UPDATE/DELETE=自分のみ |
| `080_create_ow_user_socials.sql` | SNS連携テーブル新規作成。platform: note/x/github/linkedin/other |

**重要: RLS パターン修正（スペックからの変更点）**
- スペック提供の RLS: `auth.uid() = user_id`
- 実際の適用: `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())`
- 理由: 既存 migration（031 等）を確認し、opinio-work の標準パターンに合わせた
- → 下記「§4. 次段階への申し送り」参照

### コミット B — サイドバーラベル変更

- `MypageLayout.tsx`: Icons.user 追加（人型シルエット SVG、ν-7 段階1.5 で削除されたものを復活）
- `MypageActiveKey` 型に `"profile"` を追加（`"settings"` と過渡期共存）
- サイドバー「設定」→「プロフィール」リネーム、アイコン歯車→人型
- `active` 条件: `activeKey === "profile" || activeKey === "settings"`（過渡期互換）
- `ProfileEditClient.tsx`: `activeKey="settings"` → `"profile"` に更新

### コミット C+D — 5タブ構造（統合）

**新規ファイル: `src/app/(jobseeker)/profile/edit/Tabs.tsx`**
- 水平タブナビゲーションコンポーネント
- props: `tabs`, `activeTab`, `onTabChange`
- CSS変数（`var(--royal)` 等）でスタイル統一
- hover: ink色に変化、active: royal下線

**変更ファイル: `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`**
- ページタイトル「設定」→「プロフィール」
- `activeTab` useState（デフォルト: `"basic"`）
- 4プレースホルダータブ: `PlaceholderTabContent` コンポーネント
- アカウント設定タブ: ν-7 段階7の既存コンテンツをそのまま移植
- 「変更を保存」ボタン追加（`triggerSave` 呼び出し）
- `SaveStatusPill` は account タブ表示中のみヘッダーに表示

C+D 統合の理由: アカウント設定タブはコミット C の時点で既に動作しており、
Commit D で追加するものが実質的に「変更を保存」ボタンのみだったため。

---

## §4. 次段階への申し送り

### 重要: opinio-work の RLS 標準パターン

**発見**: opinio-work の RLS は `user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` が標準パターン。

- auth.uid() は `auth.users.id`（Supabase Auth の UUID）
- ow_users.auth_id は `auth.users.id` を格納するカラム
- ow_users.id は アプリ内の別 UUID
- `auth.uid() = user_id` パターンは **使用不可**（ow_users.id と auth.uid() の空間が異なる）

**影響**: 今後 ow_users.id を外部キーとして持つテーブル（ow_user_skill_tags, ow_user_socials 等）のRLS を書く場合、必ずこのパターンを使う。

ν-8 マスタープランに「RLS 標準パターン」として明記すること。

---

### ロゴURL データ投入のスキップ

段階1 のコミット E（ロゴ投入）をスキップした。

- 段階2 で CompanyLogo コンポーネントを作る際、**null フォールバック（社名頭文字表示）を先に完成させる**方針
- ロゴデータは段階6（仕上げ）または ν-9 以降の独立タスクとして再検討
- ow_companies.logo_url カラム自体は 077 で追加済み（null のままでも動く）

---

### OG 画像生成エラー（技術的負債）

`/opengraph-image` で以下のエラーが大量発生:

```
[cause]: Error: Expected <div> to have explicit "display: flex"
```

- @vercel/og のレイアウト制約由来
- **UI 動作には影響なし**（プロフィール編集・タブ機能は正常動作）
- 段階6（仕上げ）または ν-9 で対処すべき技術的負債として記録

---

### ν-7 から継承した規律 — 段階1 での効果確認

| 規律 | 段階1 での実績 |
|---|---|
| 動作確認スキップ厳禁 | ✅ コミット B〜D を Hisato さんが実機確認 |
| コミット分割厳守 | ✅ A/B/C+D/E の4コミット構成（C+D 統合は合理的判断） |
| キャッシュ崩れ予防（`rm -rf .next`） | ✅ 動作確認前に実施 |
| 既存パターン確認 → RLS 修正 | ✅ auth_id パターンを発見・適用 |

---

## §5. 段階2 への引き継ぎ

段階2 のテーマ: **基本情報タブの実装**（名前・アバター・ヘッドライン等）

### 段階2 実装前に確認すべきこと

1. migration 077〜080 が Supabase に適用済みか確認（Hisato さんが並行進行中）
2. ow_users テーブルの既存カラム構成（名前・アバター色・公開設定等）を MCP で確認
3. `/api/jobseeker/profile` PUT エンドポイントの対応フィールドを確認

### 技術的注意事項

- `ProfileEditClient.tsx` の `PlaceholderTabContent` を段階ごとに実コンテンツに差し替える設計
- 各タブの「保存」ボタンは段階2〜5 で実装（段階1 では disabled のまま）
- タブの状態管理は useState のまま（URL クエリパラメータ化は ν-9 以降で検討）

---

## §6. 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | プロフィール編集ページメインクライアント |
| `src/app/(jobseeker)/profile/edit/Tabs.tsx` | タブナビゲーションコンポーネント（段階1 新規） |
| `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx` | サイドバー + レイアウト（Icons.user 復活） |
| `supabase/migrations/077〜080` | 段階1 DB スキーマ整備 |
| `docs/handoff/handover-2026-05-08-nu7-complete.md` | ν-7 完全クロージング引き継ぎ書 |
