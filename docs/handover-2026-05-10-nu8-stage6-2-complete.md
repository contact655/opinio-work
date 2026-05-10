# ν-8 段階6-2 完了引き継ぎ書

**完了日**: 2026-05-10  
**コミット範囲**: B-1〜B-3, C-1, D-1〜D-3（計8コミット）  
**直前コミット**: `6d78e97`

---

## ✅ 段階6-2 で実装したこと

### 要件 C — birth_date 年齢計算（age_range 完全廃止）

| コミット | 内容 | 状態 |
|---------|------|------|
| B-1 `1cb6059` | `src/lib/age.ts` 追加 + migration 084 + API allowlist に birth_date 追加 | ✅ 完了 |
| B-2 `8e2a5d5` | /profile/edit に年/月/日3ドロップダウン + /mypage・/u/[id] で年齢表示 | ✅ 完了 |
| B-3 `fedc263` | age_range 全28箇所削除 + migration 085（DROP COLUMN）手動実行済み | ✅ 完了 |

**重要実装詳細:**
- `getUserAge(birthDate: string | null | undefined): number | null` — サーバ側計算（`src/lib/age.ts`）
- birth_date は公開ページに直接渡さない。計算済み年齢整数のみ渡す（プライバシー保護）
- NULL birth_date = 年齢非公開（`ageDisplay = null` → 非表示）

### 要件 A2 — ow_user_educations 学歴セクション

| コミット | 内容 | 状態 |
|---------|------|------|
| C-1 `2df9e19` | 学歴テーブル + API + 職歴・学歴タブ UI + 公開ページ表示 | ✅ 完了 |

**ファイル一覧:**
- `supabase/migrations/086_create_ow_user_educations.sql` — **手動実行待ち**
- `src/app/api/jobseeker/educations/route.ts` — GET/POST
- `src/app/api/jobseeker/educations/[id]/route.ts` — PUT/DELETE
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` — Education型 + EducationCardEditor + EducationEditor
- `src/app/(jobseeker)/profile/edit/page.tsx` — educations parallel fetch + initialEducations prop
- `src/app/(jobseeker)/u/[id]/page.tsx` — educations fetch + 学歴セクション表示
- `src/components/profile/UserProfileCard.tsx` — userEducations prop + 表示
- `src/app/(jobseeker)/mypage/page.tsx` + `MypageClient.tsx` — certifications貫通

**スキーマ:**
```sql
school text NOT NULL CHECK (char_length(school) BETWEEN 1 AND 100)
faculty text CHECK (char_length(faculty) <= 100)
degree text CHECK (degree IN ('高校卒', '専門卒', '短大卒', '学士', '修士', '博士', 'その他'))
enrolled_at date, graduated_at date
is_current boolean NOT NULL DEFAULT false
sort_order integer NOT NULL
```

### 要件 A5 — ow_user_certifications 資格セクション

| コミット | 内容 | 状態 |
|---------|------|------|
| D-1 `40ea522` | 資格テーブル + API + 資格タブ UI + 公開ページ表示 | ✅ 完了 |
| D-2 `6afea17` | 資格セクション簡素化（資格名のみ、issuer/日付フィールド廃止） | ✅ 完了 |
| D-3 `6d78e97` | 学歴 UI を職歴スタイルに統一（表示/編集モード切替） | ✅ 完了 |

**ファイル一覧（D-2 後の状態）:**
- `supabase/migrations/087_create_ow_user_certifications.sql` — **手動実行待ち**
- `supabase/migrations/088_simplify_ow_user_certifications.sql` — **手動実行待ち**（D-2: issuer/issued_at/expires_at/no_expiry をDROP）
- `src/app/api/jobseeker/certifications/route.ts` — GET/POST（name + sort_order のみ）
- `src/app/api/jobseeker/certifications/[id]/route.ts` — PUT/DELETE
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` — Certification型 + CertificationCardEditor + CertificationEditor

**スキーマ（D-2 簡素化後）:**
```sql
name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100)
sort_order integer NOT NULL
-- issuer / issued_at / expires_at / no_expiry は migration 088 で DROP
```

**D-3 変更内容 — 学歴 UI を職歴スタイルに統一:**
- `EducationCardEditor`（常時展開フォーム）を廃止
- `EducationCard`（コンパクト表示、ホバーで編集/削除アイコン）を新設
- `EducationForm`（青枠インライン編集フォーム）を新設
- `EducationEditor`: `editingId` / `adding` / `deleteTarget` 状態管理、`ConfirmDialog` + `Toast`
- 「学歴を追加」: 破線 dashed border ボタン（職歴と同スタイル）
- 保存は「保存」ボタン押下のみ（onBlur 自動保存を廃止）
- `educSaveStatus` 廃止（ヘッダーの SaveStatusPill から除去）

---

## 🔧 手動実行待ち Migration（柴さん作業）

```bash
# Supabase SQL Editor または CLI で順番に実行
\i supabase/migrations/086_create_ow_user_educations.sql
\i supabase/migrations/087_create_ow_user_certifications.sql
\i supabase/migrations/088_simplify_ow_user_certifications.sql
```

**実行確認方法:**
```sql
SELECT COUNT(*) FROM ow_user_educations;    -- 0 が返れば OK
SELECT COUNT(*) FROM ow_user_certifications; -- 0 が返れば OK
-- 088 の確認: issuer カラムが存在しないこと
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ow_user_certifications'; -- id, user_id, name, sort_order, created_at の5列
```

---

## 🎨 /profile/edit タブ構成（段階6-2 完成時点）

| # | キー | ラベル | 状態 |
|---|------|--------|------|
| 1 | basic | 基本情報 | ✅ 名前・所在地・生年月日・自己紹介・将来の展望 |
| 2 | career | 職歴・学歴 | ✅ CareerHistoryEditor + EducationEditor |
| 3 | skills | スキル | ✅ SkillTagsEditor（15個まで） |
| 4 | certs | 資格 | ✅ CertificationEditor |
| 5 | socials | SNS | ✅ 7種 SocialLinksEditor |
| 6 | account | アカウント設定 | ✅ アバター・カバー色・公開設定 |

---

## 📋 UI パターン

### 学歴（D-3 以降）— 職歴スタイルに統一
- **表示モード**: `EducationCard` — コンパクト1行表示、ホバーで ✎ / × アイコン
- **編集モード**: クリック → `EducationForm`（青枠 + bg-tint インライン展開）
- **保存**: 「保存」ボタン押下のみ（`onBlur` 廃止）
- **追加**: 「学歴を追加」（破線ボタン）→ `EducationForm` 展開 → POST
- **削除**: × クリック → `ConfirmDialog` → DELETE
- **通知**: `Toast`（保存/追加/削除の成否）
- **state**: `editingId: string | null`（1つの編集中ID）— 職歴・学歴の state は独立

### 資格（D-2 以降）— シンプル維持
- **常時展開フォーム**: `CertificationCardEditor`（onBlur 保存）
- **保存**: `onBlur`（テキスト）/ onChange なし（チェックボックス/日付フィールドなし）
- **追加**: 「+ 資格を追加」→ POST → リスト末尾に追加
- **削除**: ✕ボタン → DELETE（confirm なし）

---

## 🌐 公開ページ（/u/[id]）セクション表示順

1. ヘッダー（アバター・名前・年齢・所在地）
2. About Me
3. スキル
4. キャリア（CareerTimeline）
5. **学歴**（NEW）
6. **資格・認定**（NEW）
7. SNS リンク

---

## 🚀 次にやること（優先順位順）

### 高優先
1. **migration 086/087/088 の手動実行**（柴さん）
2. **動作確認** — Hisato さんが確認すべきページ:
   - `/profile/edit` → 「職歴・学歴」タブ:
     - 学歴の **表示モード**（獨協大学のカード表示）
     - クリック / ✎ で **編集モード** に切替 → 「保存」で表示モードに戻る
     - 編集中に他の学歴は表示モードのまま（干渉なし）
     - 「学歴を追加」（破線ボタン）→ フォーム展開 → 保存
     - × → ConfirmDialog → 削除 → Toast 表示
   - `/profile/edit` → 「資格」タブ: 資格名のみのシンプル表示確認
   - `/mypage`: 学歴・資格表示の保持確認
   - `/u/[id]`: 公開ページの学歴・資格表示の保持確認

### 中優先
3. Phase 5 Stage 2 — 認証フロー強化（メール認証後の onboarding）
4. `/biz/members` チーム管理画面

### 低優先（いつでも）
5. 学歴/資格の drag-and-drop 並び替え（sort_order の UI 操作）
6. 資格有効期限アラート（期限切れ表示）

---

## 技術知見（段階6-2 で確認）

1. **並列 Promise.all パターン**: `profile/edit/page.tsx` で skillTags + educations + certifications を3並列 fetch → 増えても fetch 順序は変わらない
2. **useCallback の依存配列**: `buildAndSave` が `save` に依存し `save` が `cert.id` と `onUpdate` に依存する。`cert` オブジェクト自体を依存に入れると参照比較で毎回再生成されるため `cert.id` のみ依存にする
3. **onBlur 保存**: input の `onBlur` でのみ API call（`onChange` では state のみ更新）→ キー入力のたびに API を叩かない設計
4. **select/checkbox は onChange 即時保存**: ドロップダウンやチェックボックスは変更即時 API call（ユーザーが離れる操作が不要なため）
