# ν-8 段階6-3-1.5 完了引き継ぎ（2026-05-10）

## 概要

Stage 6-3-1.5: `/profile/edit` の全タブを **明示保存（explicit save）** に統一 + 保存ボタン変身パターンを全体適用。

- 自動保存インフラ（`useDebouncedPatch`）を完全削除
- 全タブの保存ボタンが「保存」→「保存中…」→「✓ 保存しました（緑）」と変身
- タブレベルの保存: 3秒間グリーン表示後 disabled に戻る
- エディター内フォームの保存: 800ms グリーン表示後フォームが閉じる

---

## コミット一覧（全7コミット）

| コミット | ハッシュ | 内容 |
|---------|---------|------|
| A | `9fdaa4b` | 調査ドキュメント作成（research-2026-05-10-nu8-stage6-3-1-5-save-pattern.md） |
| B | `f040bbc` | アカウント設定タブ → 明示保存化 |
| C | `456c659` | SNS タブ → 明示保存化 |
| D | `3d807ba` | 資格タブ → 明示保存化（AchievementEditor スタイル） |
| E | `29e02b5` | 基本情報タブ → 明示保存化 |
| F | `ce4de75` | 自動保存インフラ全削除 |
| G | `adb0a4b` | 保存ボタン変身パターン（justSaved）を全体適用 |

---

## 保存方式統一の最終状態

| タブ | 保存方式 | 変身パターン |
|------|---------|------------|
| 基本情報 | タブ全体まとめて保存（保存/キャンセルボタン） | 3秒グリーン → disabled |
| 職歴・学歴 | カード単位で即時保存（StintForm + EducationForm） | 800ms グリーン → フォーム閉じる |
| スキル | アクション即時保存（追加/削除ごとに Toast） | なし（即時 → Toast のみ） |
| 資格 | カード単位で即時保存（AchieveFormActions） | 800ms グリーン → フォーム閉じる |
| 実績・受賞 | カード単位で即時保存（AchieveFormActions × 3） | 800ms グリーン → フォーム閉じる |
| SNS | タブ全体まとめて保存（保存/キャンセルボタン） | 3秒グリーン → disabled |
| アカウント設定 | タブ全体まとめて保存（保存/キャンセルボタン） | 3秒グリーン → disabled |

---

## 削除した自動保存インフラ

| 削除対象 | 種別 |
|---------|------|
| `src/lib/hooks/useDebouncedPatch.ts` | ファイル丸ごと削除 |
| `type SaveStatus` | 型定義 |
| `function SaveStatusPill` | コンポーネント |
| `basicInfoRef`, `patchBasic`, `basicSaveStatus`, `patchBasicInfo`, `handleBirthDateChange` | state / 関数 |
| `BASIC_FIELD_TO_DB` | 定数 |
| `socialRef`, `patchSocial`, `patchSocialLinks` | state / 関数 |
| `skillSaveStatus`, `setSkillSaveStatus`, `setSaveStatus` prop | state / prop |
| `certSaveStatus`, `setSaveStatus` prop (CertificationEditor旧版) | state / prop |
| `<SaveStatusPill>` in page header | JSX |

---

## 追加した UX 改善（Commit G の変身パターン）

### justSaved ステート設計

```typescript
// タブレベル（basic / SNS / account）: 3秒
const [xxxJustSaved, setXxxJustSaved] = useState(false);

// 保存成功時:
setXxxJustSaved(true);
setTimeout(() => setXxxJustSaved(false), 3000);
```

```typescript
// エディターレベル（career / edu / cert / ach / award / media）: 800ms
const [editJustSaved, setEditJustSaved] = useState(false);
const [addJustSaved,  setAddJustSaved]  = useState(false);

// 保存成功時（フォームクローズを遅延）:
showToast("〇〇を更新しました");
setEditJustSaved(true);
await new Promise((r) => setTimeout(r, 800));
setEditingId(null); setEditDraft(EMPTY_DRAFT);  // ← 800ms後に閉じる
setEditJustSaved(false);
```

### ボタン変身スタイル

```tsx
// タブレベルボタン（minWidth: 140）
background: xxxJustSaved ? "var(--success)" : (!isDirty || saving) ? "var(--ink-mute)" : "var(--royal)"
{saving ? "保存中…" : xxxJustSaved ? "✓ 保存しました" : "保存"}

// AchieveFormActions / EducationForm / StintForm（minWidth: 130）
background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)"
{isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
```

### キャンセルボタンの方針

- タブレベル: justSaved 中は disabled（誤操作防止）
- エディターレベル: isSaving 中のみ disabled（justSaved は未適用）
- キャンセルボタン自体の「変身」は不要（視覚的変化が大きいため過剰）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | 大部分（全コミット） |
| `src/components/profile/CareerHistoryEditor.tsx` | StintForm + saveEdit/saveAdd（Commit G） |
| `src/lib/hooks/useDebouncedPatch.ts` | 削除（Commit F） |

---

## 段階6-3-2 着手前のチェックリスト（柴さん向け）

- [ ] Supabase Dashboard で migration 089〜092 が実行済みか確認
  - `ow_experience_stories`, `ow_user_achievements`, `ow_user_awards`, `ow_user_media_appearances`
- [ ] `/profile/edit` の全タブで保存ボタンが正常動作するか確認
  - 基本情報: 保存 → ✓ 保存しました（3秒）
  - 職歴: 追加・編集 → ✓ 保存しました（800ms）→ カード表示
  - スキル: 追加・削除 → Toast のみ（変身なし、これが正しい）
  - 資格 / 実績・受賞: 追加・編集 → ✓ 保存しました（800ms）→ カード表示
  - SNS / アカウント設定: 保存 → ✓ 保存しました（3秒）
- [ ] TypeScript エラーゼロ確認: `npx tsc --noEmit`
- [ ] git status 確認（未コミット変更なし）

---

## 次のステップ候補

### 段階6-3-2（短期）
- 「未来」セクション（`future_aspirations` を視覚的に昇格）
- experience-stories UI（職歴に紐づくメディア/実績カード表示）

### 中期
- Phase 5 Stage 2: 認証フロー強化（メール認証後 onboarding）
- /biz/members チーム管理画面
