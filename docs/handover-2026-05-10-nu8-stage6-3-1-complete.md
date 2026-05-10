# ν-8 段階6-3-1 完了引き継ぎ（2026-05-10）

## 概要

Stage 6-3-1: `/profile/edit` に「実績・受賞」タブを新設。
4 テーブル追加 + 8 API ルート + UI 3 エディターを実装。

---

## コミット一覧

| コミット | 内容 |
|---------|------|
| `8e815e0` | Commit B — migration 089〜092（4 テーブル作成） |
| `d58c658` | Commit C — API 8 ファイル（4 リソース × route.ts + [id]/route.ts） |
| `d81cd21` | Commit D — UI（ProfileEditClient.tsx + page.tsx）7 タブ + 3 エディター |

---

## DB 変更（要: Supabase Dashboard で手動実行）

以下 4 migration を **この順番で** 実行すること:

| ファイル | テーブル |
|---------|---------|
| `supabase/migrations/089_create_ow_experience_stories.sql` | `ow_experience_stories` |
| `supabase/migrations/090_create_ow_user_achievements.sql` | `ow_user_achievements` |
| `supabase/migrations/091_create_ow_user_awards.sql` | `ow_user_awards` |
| `supabase/migrations/092_create_ow_user_media_appearances.sql` | `ow_user_media_appearances` |

> **注意**: migration 実行前は `/profile/edit` → 「実績・受賞」タブを開くとエラー（テーブル不存在）。
> migration 実行後は問題なく動作する。

---

## API ルート一覧

| エンドポイント | 用途 |
|--------------|------|
| `GET/POST /api/jobseeker/achievements` | 数値実績 一覧・追加 |
| `PUT/DELETE /api/jobseeker/achievements/[id]` | 数値実績 更新・削除 |
| `GET/POST /api/jobseeker/awards` | 受賞歴 一覧・追加 |
| `PUT/DELETE /api/jobseeker/awards/[id]` | 受賞歴 更新・削除 |
| `GET/POST /api/jobseeker/media-appearances` | メディア掲載 一覧・追加 |
| `PUT/DELETE /api/jobseeker/media-appearances/[id]` | メディア掲載 更新・削除 |
| `GET/POST /api/jobseeker/experience-stories` | 職歴ストーリー 一覧・追加（将来利用） |
| `PUT/DELETE /api/jobseeker/experience-stories/[id]` | 職歴ストーリー 更新・削除（将来利用） |

---

## UI 変更点

### ProfileEditClient.tsx

- `ProfileTab` 型: `"achievements"` を追加（計 7 タブ）
- `PROFILE_TABS`: `{ key: "achievements", label: "実績・受賞" }` を `"certs"` と `"socials"` の間に追加
- 新型: `Achievement`, `Award`, `MediaAppearance`
- 新ヘルパー: `fmtYM()`, `monthToDate()`, `dateToMonth()`
- 新マイクロ component: `AchieveIconBtn`, `AchieveFormActions`, `AddSectionBtn`（3 エディター共通）
- 新エディター: `AchievementEditor`, `AwardEditor`, `MediaAppearanceEditor`
  - 各エディターはカード表示（ホバーで ✎ × 表示）+ インライン編集フォーム（royal ボーダー）+ 削除確認ダイアログ + Toast 通知
  - EducationEditor と同じフラットスタイル（白カードラッパーなし）
- 日付入力: `<input type="month">` → `"YYYY-MM"` → `"YYYY-MM-01"` 変換パターン

### page.tsx

- 並列フェッチを 3 → 6 テーブルに拡張（+ achievements / awards / media_appearances）
- `ProfileEditClient` に `initialAchievements`, `initialAwards`, `initialMediaAppearances` props 追加

---

## タブ構成（最終）

| # | key | label |
|---|-----|-------|
| 1 | basic | 基本情報 |
| 2 | career | 職歴・学歴 |
| 3 | skills | スキル |
| 4 | certs | 資格 |
| 5 | **achievements** | **実績・受賞**（新規） |
| 6 | socials | SNS |
| 7 | account | アカウント設定 |

---

## RLS 設計のポイント

### ow_experience_stories（他と異なる 2 段階 JOIN）

通常テーブル（achievements/awards/media）は `user_id` 直参照で RLS を書けるが、
`ow_experience_stories` は `user_id` を持たず `experience_id` → `ow_experiences` → `ow_users` の 2 段階 JOIN が必要:

```sql
experience_id IN (
  SELECT e.id FROM ow_experiences e
  JOIN ow_users u ON u.id = e.user_id
  WHERE u.auth_id = auth.uid()
)
```

---

## 次のステップ候補

### 短期（stage 6-3-2）
- 「未来」セクション（`future_aspirations` を視覚的に昇格）
- experience-stories UI（職歴に紐づくメディア/実績カード表示）

### 中期
- Phase 5 Stage 2: 認証フロー強化（メール認証後 onboarding）
- /biz/members チーム管理画面
