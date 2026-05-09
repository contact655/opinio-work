# ν-8 段階4 完了報告 — スキルタグ編集 UI

**完了日**: 2026-05-09  
**担当**: Claude Code  
**テーマ**: ν-8「人のプロフィール充実化」段階4 — スキルタブ TagInput UI + 公開ページ表示

---

## §1. 完了コミット一覧

| コミット | hash | 内容 | 当初分割からの変更 |
|---|---|---|---|
| A | (調査のみ、コミットなし) | 事前調査: ow_user_skill_tags スキーマ・API ルート有無・/u/[id] スキル表示有無・UserProfileCard スキル UI 確認 | — |
| B | `bdca722` | `/api/jobseeker/skill-tags` API ルート（GET/POST/DELETE） | 当初計画通り |
| C | `07edd47` | ProfileEditClient スキルタブ TagInput UI + 即時 API + プレースホルダー卒業 | 当初計画通り（C1/C2 分割不要） |
| D | `09e65dd` | `/u/[id]` 公開ページにスキルセクション追加 | 当初計画通り |
| E | 本ファイル | 段階4 完了報告 | — |

**合計**: 4コミット（A は調査のみ）  
**当初予定**: A〜E の5コミット → **実際**: 同一（分割変更なし）

---

## §2. 動作確認結果

**テスト URL**: `/u/e826e0bd-f96b-42ec-acda-d8f482e1417d`  
（Account B: s.hisato1020@gmail.com）

### コミット B — API ルート（全16ケース）

Claude Code が service role + curl で検証済み（2026-05-09）。

| 確認項目 | 結果 |
|---|---|
| GET — 空状態 | ✅ `{ tags: [] }` |
| POST — TypeScript（sort_order=1） | ✅ `{ id, label, sort_order: 1 }` |
| POST — React（sort_order=2） | ✅ `{ id, label, sort_order: 2 }` |
| GET — 2件取得（sort_order 昇順） | ✅ |
| POST — 空文字 → INVALID_LABEL_LENGTH(400) | ✅ |
| POST — 51字 → INVALID_LABEL_LENGTH(400) | ✅ |
| POST — 重複 → DUPLICATE_LABEL(409) | ✅ |
| 15件投入確認 | ✅ count=15 |
| POST — 16個目 → LIMIT_EXCEEDED(400) | ✅ |
| DELETE → 204 | ✅ |
| GET — DELETE 後の消滅確認 | ✅ |
| RLS — 未認証クライアントの DELETE → blocked | ✅ |
| クリーンアップ後 count=0 | ✅ |
| HTTP GET 未認証 → 401 | ✅ |
| HTTP POST 未認証 → 401 | ✅ |
| HTTP DELETE 未認証 → 401 | ✅ |

### コミット C — スキルタブ UI

dogfooding（Account B）で確認済み（2026-05-09）。

| 確認項目 | 結果 |
|---|---|
| Enter / カンマ確定でタグ追加 | ✅ |
| 楽観更新（仮 ID チップ → 確定値置換） | ✅ |
| ✕ クリックで即時削除 | ✅ |
| 「保存中…」→「自動保存されました」ピル | ✅ |
| カウンター `n / 15`（12個以上 amber、上限で入力欄非表示） | ✅ |
| 入力中文字数 `n / 50`（41字以降 amber） | ✅ |
| 重複入力 → inline エラー | ✅ |
| 51字入力 → inline エラー | ✅ |
| リロード後の永続化 | ✅ |

### コミット D — 公開ページスキルセクション

| 確認項目 | 結果 |
|---|---|
| `/u/[id]` About Me 直下にスキルセクション表示 | ✅ |
| 12タグが sort_order 昇順で表示 | ✅ |
| 未認証（シークレットウィンドウ）でも表示 | ✅（RLS select_all=true） |
| `/profile/edit` でタグ削除 → `/u/[id]` リロードで反映 | ✅ |
| 全削除後にセクションごと非表示 | ✅ |

---

## §3. 段階4 で発見した重要情報（マスタープラン v2 反映候補）

1. **TOCTOU 許容方針: sort_order の2ステップ採番**  
   API の POST では `MAX(sort_order)` 取得 → `INSERT` の2ステップで sort_order を採番している。同一ユーザーが2タブで同時 Enter 連打すると sort_order が重複する可能性がある（TOCTOU）。ν-8 では「一人が2タブ同時操作」は運用上ほぼ起きないため許容。ν-9 でドラッグ並び替えを実装する際、リインデックス（`UPDATE` で sort_order を振り直す API）の追加が必要になることを記録しておく。

2. **保存経路が3系統並走（段階6 集約で統一方針決定）**  
   - `/mypage` UserProfileCard: Supabase クライアント直接 UPDATE（blur 保存）
   - `/profile/edit` 基本情報タブ（name/location/age_range/about_me/future_aspirations）: 700ms デバウンス autosave（`patchBasicInfo`）
   - `/profile/edit` スキルタブ: 即時 API（POST/DELETE、楽観更新）
   段階4 でスキル固有の即時 API を採用したことで3系統目が確立した。3系統の UX 差異（保存タイミング・フィードバック）は段階6 で統一方針を決定する。

3. **上限到達 UX: disabled → 入力欄非表示に変更**  
   指示文 v1 §4 C では「上限到達で disabled」と指定していたが、実装では「入力欄ごと非表示 + `15/15（上限に達しました）` メッセージ」に変更した。disabled 状態でも入力欄が残ると「なぜ入力できないのか」が視覚的に不明確なため、非表示の方が UX として明確。マスタープラン v2 に「スキルタブ上限到達 UX = 入力欄非表示」として反映。

4. **SkillTagsEditor を別ファイルに分割しなかった**  
   指示文 v1 では「肥大化したら C1/C2 分割の余地あり」としていたが、ProfileEditClient.tsx 内の関数コンポーネントとして実装し、合計 +237 行（page.tsx +9行、ProfileEditClient.tsx +228行）で収まった。現在の ProfileEditClient.tsx は約 840 行。段階5（SNS タブ）追加後に 1,000 行を超える見込みのため、段階5 or 段階6 でのファイル分割を検討する。

5. **dogfooding データ投入運用（v8 stage4 時点）**  
   コミット B 完了直後に Hisato が手動で 12 タグを投入（技術系: TypeScript/React/Next.js/Supabase/Tailwind CSS + 職種系: 営業/インサイドセールス/人材紹介/キャリアコンサルタント/コーチング + テスト用: あああ/テスト）。コミット D 動作確認後に「あああ」「テスト」を削除し、10 タグで `/u/[id]` 公開ページが運用中。

6. **label カラム名 vs tag_name の混同リスク**  
   migration 079 のカラム名は `label`（`tag_name` ではない）。API・型定義・UI すべてで `label` を統一済み。段階5 以降でスキルタグに触る際も `label` カラム名を維持すること。

---

## §4. 当初分割からの変更点

**当初計画（指示文 v1 §3）**: A（調査）→ B（API）→ C（UI）→ D（公開ページ）→ E（完了報告）

変更なし。5コミット構成のまま完了。C1/C2 分割は不要と判断（理由: §3.4 参照）。

---

## §5. 段階5 着手前のチェック項目（SNS 編集 UI 向け）

1. **`ow_user_socials` テーブルの現状データ**  
   - migration 080 で作成済み（段階2 A3 でべき等化）  
   - カラム構造（platform/url/display_name 等）を MCP で確認  
   - Account B のレコードが存在するか

2. **`ow_users.social_links` JSONB との二重持ち状態の整理判断**  
   - 段階2 §3.5 で「重複があり段階5 で整理が必要」と記録済み  
   - 現在 `/mypage` UserProfileCard は `social_links` JSONB を使用、`/u/[id]` 公開ページも JSONB を参照  
   - 段階5 で `ow_user_socials` テーブルに移行するか、JSONB を正とするかの設計判断が必要

3. **SNS 用 API ルートの有無**  
   - `src/app/api/jobseeker/` 配下に social 系エンドポイントが存在するか  
   - 存在しない場合は新規作成（`/api/jobseeker/social-links` 等）

4. **`/u/[id]` 公開ページの SNS セクション現状**  
   - 現在 `social_links` JSONB から `twitter/linkedin/note` の3種を表示中  
   - 要望B（7種: X/LinkedIn/GitHub/Facebook/Note/YOUTRUST/その他3枠）への拡張が必要  
   - 表示 UI を「アイコン + ハンドル」→「アイコンのみ（クリックでリンク先）」に変更予定

5. **要望B の仕様反映先**  
   - SNS 種類: 4種追加（Facebook/Note/YOUTRUST/GitHub）  
   - 表示 UI 変更: アイコンのみ表示  
   - `docs/notes/nu-8-post-stage3-discussion.md` §要望B を段階5 指示文 v1 に反映

---

## §6. 既知の課題 / 持ち越し

| 課題 | 優先度 | 担当フェーズ | 補足 |
|---|---|---|---|
| `src/app/profile/edit/` 孤立ディレクトリの根本整理 | 中 | 段階6 | Fix B'（段階3）で暫定回避済み |
| /mypage と /profile/edit の編集 UI 重複 | 中 | 段階6 | 2系統並走は意図的 |
| **保存経路3系統並走の統一**（blur / デバウンス / 即時 API） | 中 | 段階6 | 段階4 で3系統目確立 |
| /mypage UserProfileCard へのスキル UI 並行マウント | 低 | 段階6 | 段階4 では非実装（集約方針） |
| sort_order TOCTOU / リインデックス API | 低 | ν-9 | ドラッグ並び替え実装時に必要 |
| ProfileEditClient.tsx のファイル分割 | 低 | 段階5 or 段階6 | 現在 ~840 行、段階5 追加で 1,000 行超見込み |
| SNSタブのプレースホルダー | 高 | 段階5 | 次の実装対象 |
| ow_user_socials vs social_links JSONB 重複 | 高 | 段階5 | 設計判断が必要 |
| /opengraph-image エラー（既存技術的負債） | 低 | 段階6 or ν-9 | 段階2 から持ち越し |
| **要望A**: Wantedly 並みのプロフィール充実化 | 要議論 | ν-8 再スコープ or ν-9 | `docs/notes/nu-8-post-stage3-discussion.md` §要望A |
| **要望B**: SNS 7種 + アイコンのみ表示 | 高 | 段階5 | 段階5 仕様に反映 |
| **要望C**: 年齢層 → 生年月日自動計算 | 要議論 | 段階6 着手前 | `docs/notes/nu-8-post-stage3-discussion.md` §要望C |

---

## §7. 実装ファイル全一覧

```
新規作成:
  src/app/api/jobseeker/skill-tags/route.ts         # B: GET/POST
  src/app/api/jobseeker/skill-tags/[id]/route.ts    # B: DELETE

変更:
  src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx
    # C: SkillTag 型, skillTags/skillSaveStatus state,
    #    SkillTagsEditor コンポーネント（楽観更新・即時 API），
    #    PlaceholderTabContent label="スキル" を卒業
  src/app/(jobseeker)/profile/edit/page.tsx
    # C: initialSkillTags prop 追加（ow_user_skill_tags を server-side SELECT）
  src/app/(jobseeker)/u/[id]/page.tsx
    # D: ow_user_skill_tags を Promise.all に追加，スキルセクション JSX 追加

Supabase migrations:
  なし（migration 079 の既存テーブルを活用）
```

---

## §8. 段階6 集約への申し送り

| 申し送り事項 | 内容 |
|---|---|
| 保存経路3系統の統一方針 | blur（/mypage）/ 700ms デバウンス（基本情報）/ 即時 API（スキル）の3系統が並走。段階6 集約時に「フィールド種別ごとの保存方式ルール」を決定する |
| SkillTagsEditor の /mypage への並行マウント | 段階4 では実装せず。段階6 で /mypage UserProfileCard にもスキル編集 UI を追加するか、または /profile/edit に一本化するかを決定する |
| sort_order TOCTOU 許容の継続判断 | ν-9 のドラッグ並び替え実装時に、sort_order の2ステップ採番を atomic な SQL（サブクエリ INSERT）or DB 関数に置き換えるかを検討する |
| ProfileEditClient.tsx の分割タイミング | 段階5（SNS タブ）追加後に 1,000 行超見込み。段階5 完了後または段階6 冒頭でファイル分割（SkillTagsEditor, SnsEditor 等を別ファイルに抽出）を推奨 |
