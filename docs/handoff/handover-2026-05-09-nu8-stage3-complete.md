# ν-8 段階3 完了報告 — 自己紹介と想い + 基本情報タブ全項目移植

**完了日**: 2026-05-09  
**担当**: Claude Code  
**テーマ**: ν-8「人のプロフィール充実化」段階3 — 基本情報タブ全5項目の編集 UI 実装

---

## §1. 完了コミット一覧

| コミット | hash | 内容 | 当初分割からの変更 |
|---|---|---|---|
| A | (調査のみ、コミットなし) | 事前調査: ow_users スキーマ・RLS・UserProfileCard 構造確認 | — |
| B | `cd74c00` | API route 拡張 + 基本情報タブ(名前・所在地・年齢層)実装 | Hisato 提案で B+C+D+E → 3分割に統合 |
| Fix B' | `52cfdb5` | webpack モジュール衝突修正(route-group import パス統一) | 当初計画外・バグ修正として追加 |
| C | `0125a3b` | 自己紹介 + やってみたいこと テキストエリア実装(ソフトリミット付) | 当初予定通り |
| D | 本ファイル | 段階3 完了報告 | — |

**合計**: 4コミット（A は調査のみ）  
**当初予定（指示文）**: A〜F の6コミット → **実際**: B/Fix B'/C/D の4コミット（プレースホルダー卒業確認 E は C と統合、F は本 D に統合）

---

## §2. 動作確認結果

**テスト URL**: `/u/e826e0bd-f96b-42ec-acda-d8f482e1417d`  
（Account B: s.hisato1020@gmail.com）

### /profile/edit 基本情報タブ

| 確認項目 | 結果 |
|---|---|
| 名前「柴 久人」初期表示 | ✅ |
| 所在地「東京都」初期表示 | ✅ |
| 年齢層「30代前半」初期表示 | ✅ |
| 自己紹介に既存の長文 about_me が初期表示（140/200） | ✅ |
| やってみたいことに「テスト」が初期表示（3/200） | ✅ |
| 文字カウンター灰色（200字以内、警告なし） | ✅ |
| 200字超えで amber カウンター + 警告テキスト | ✅ |
| 入力 → 700ms 後 → 「保存中…」→「自動保存されました」ピル | ✅ |
| リロード後の永続化 | ✅ |
| 名前変更時のアバタープレビュー連動 | ✅ |

### /u/[id] 公開ページへの反映

| 確認項目 | 結果 |
|---|---|
| About Me セクションに about_me が反映 | ✅ |

### 既存機能の継続動作

| 確認項目 | 結果 |
|---|---|
| 職歴タブ（CareerHistoryEditor）正常動作 | ✅ |
| アカウント設定タブ正常動作 | ✅ |
| /mypage UserProfileCard（並行動作） | ✅ |

---

## §3. 段階3 で発見した重要情報（マスタープラン v2 反映候補）

1. **`/api/jobseeker/profile` allowed フィールドに `future_aspirations` が欠落していた**  
   コミット B 着手時の事前調査で発覚。`allowed` 配列に `about_me`, `location`, `age_range` 等は含まれていたが `future_aspirations` が missing。Commit B で追加済み。段階3 指示文の §5.3「カラム名が不明確」の懸念は正確で、`future_aspiration`（単数）ではなく `future_aspirations`（複数）が正式カラム名であることも同時に確認。

2. **保存経路が2系統並走している（段階6 で集約）**  
   - `/mypage` UserProfileCard: Supabase クライアントで直接 `ow_users` UPDATE（`blur` イベント保存）  
   - `/profile/edit`: `/api/jobseeker/profile` API ルート経由（700ms デバウンス自動保存）  
   保存タイミング・RLS の経由経路が異なる。段階6 集約時に統一方針を決定する。

3. **★重要★ `src/app/profile/edit/` は route-group 移行時の孤立ディレクトリ**  
   `mockProfileData.ts`、`CareerModal.tsx`、`roleData.ts` が `UserProfileCard.tsx` 等から参照されているため削除できない。コミット B で route-group 側（`src/app/(jobseeker)/profile/edit/mockProfileData.ts`）に同名ファイルを持ち込んだことで webpack モジュール衝突が発生（`__webpack_modules__[moduleId] is not a function` → `useContext null` カスケード）。  
   Fix B' で route-group 内の全 `"./mockProfileData"` 参照を `"@/app/profile/edit/mockProfileData"` に統一することで回避。根本対処は段階6 で孤立ディレクトリの整理（削除 or 中立的な `src/lib/profile/` 等への移動）。

4. **`ow_users.future_aspirations`（複数形 s あり）が正式カラム名**  
   指示文の §5.3 では `future_aspiration` / `to_do_next` / `aspirations` 等の候補が挙がっていたが、MCP で確認した結果 `future_aspirations`（末尾 s あり）が正式カラム名。段階3 全コミットで統一して使用済み。

5. **autosave 700ms デバウンス vs blur 保存の UX 差異**  
   `/profile/edit` では 700ms デバウンス（タイピング中は「保存中…」ピル）を採用。`/mypage` UserProfileCard は blur（フォーカス離脱）時保存で挙動が異なる。段階6 の UI 集約時に「どちらの UX が正しいか」を議論して統一する。現時点では両並走を許容。

6. **webpack route-group 問題の一般則**  
   Next.js の route-group `(folderName)` はルーティングに対して透過だが、webpack のモジュールグラフからは独立したパスとして扱われる。`"./relativePath"` 参照で route-group 内のコピーを指すと、同名ファイルが別 webpack module ID で二重登録され、バンドル内 hook 衝突が起きる。route-group 内コンポーネントからの外部参照は常に `"@/..."` 絶対パスを使うこと。

---

## §4. 当初分割からの変更点

**当初計画（指示文 §3）**: A（調査）→ B（名前・所在地・年齢層）→ C（about_me）→ D（future_aspirations）→ E（プレースホルダー卒業確認）→ F（完了報告）

**Hisato 提案で承認された変更**: B+C+D+E → 3コミット分割

| 変更 | 理由 |
|---|---|
| C に `about_me` と `future_aspirations` を統合 | 実装構造が同一（TextareaField + patchBasicInfo）であり、意味的にも「自己紹介 + 未来志向」の対になる項目 |
| プレースホルダー卒業確認 E を省略 | C 実装時点で 2 プレースホルダーが完全消滅、追加コードなし |
| 完了報告 F → D に繰り上げ | E 省略の結果 |
| Fix B'（webpack 修正）を追加 | コミット B のバグ、計画外 |

---

## §5. 段階4 着手前のチェック項目

段階4 はスキルタグ編集 UI（`ow_user_skill_tags`）の実装。以下を段階4 開始時の事前調査コミット A で確認すること。

1. **`ow_user_skill_tags` テーブルの現状データ**  
   - migration 079 で作成済み（段階2 A3 でべき等化済み）  
   - 実際に Account B のレコードが存在するか、カラム構造（tag_name? category?）を MCP で確認

2. **スキルタグ用 API ルートの有無**  
   - `src/app/api/jobseeker/` 配下にスキルタグ用エンドポイントが存在するか  
   - 存在しない場合は新規作成が必要（`/api/jobseeker/skill-tags` 等）

3. **`/u/[id]` 公開ページのスキル表示の有無**  
   - 段階2 時点で `/u/[id]` にスキルセクションが実装されているか  
   - 存在する場合はどのデータソースから取得しているか

4. **`/mypage` UserProfileCard のスキル編集 UI の有無**  
   - ν-6〜ν-7 で実装済みか確認し、並行マウント設計に活かす

5. **スキルタグのマスター設計**  
   - 自由入力か固定マスターか、または両方か  
   - `ow_user_skill_tags.tag_name` が自由テキストなら UI は TagInput 形式が自然

---

## §6. 既知の課題 / 持ち越し

| 課題 | 優先度 | 担当フェーズ | 補足 |
|---|---|---|---|
| `src/app/profile/edit/` 孤立ディレクトリの根本整理 | 中 | 段階6 | Fix B' で暫定回避済み。削除 or `src/lib/profile/` 移動 |
| /mypage と /profile/edit の編集 UI 重複 | 中 | 段階6 | 2系統並走は意図的。集約まで維持 |
| autosave UX の統一（blur vs デバウンス） | 低 | 段階6 | 集約時に方針決定 |
| /opengraph-image エラー（既存技術的負債） | 低 | 段階6 or ν-9 | 段階2 から持ち越し |
| スキルタブのプレースホルダー | 高 | 段階4 | `PlaceholderTabContent label="スキル"` |
| SNSタブのプレースホルダー | 中 | 段階5 | `PlaceholderTabContent label="SNS"` |
| ow_user_socials vs social_links JSONB 重複 | 中 | 段階5 | 段階2 から持ち越し |
| **要望A**: Wantedly 並みのプロフィール充実化 | 要議論 | ν-8 再スコープ or ν-9 | `docs/notes/nu-8-post-stage3-discussion.md` §要望A |
| **要望B**: SNS 7種対応 + アイコンのみ表示 | 低〜中 | 段階5 仕様へ反映 | `docs/notes/nu-8-post-stage3-discussion.md` §要望B |
| **要望C**: 年齢層 → 生年月日自動計算 | 要議論 | 段階6 着手前 | `docs/notes/nu-8-post-stage3-discussion.md` §要望C |
| Account A（hshiba@opinio.co.jp）の扱い未定 | 低 | 柴さん判断 | 放置・削除・データ補完 |

---

## §7. 実装ファイル全一覧

```
変更:
  src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx
    # B: BasicInfo型 + 3フィールド(name/location/ageRange) + patchBasicInfo 追加
    # Fix B': import パスを @/app/profile/edit/mockProfileData に統一
    # C: BasicInfo型に aboutMe/futureAspirations 追加、TextareaField コンポーネント追加
    #    patchBasicInfo の PUT payload に about_me/future_aspirations 追加

  src/app/(jobseeker)/profile/edit/CareerModal.tsx
    # Fix B': import type パスを @/app/profile/edit/mockProfileData に統一

  src/app/api/jobseeker/profile/route.ts
    # B: allowed フィールドに future_aspirations を追加

  src/app/(jobseeker)/profile/edit/page.tsx
    # B: SELECT に location/age_range/about_me/future_aspirations を追加

新規作成:
  (なし)

Supabase migrations:
  (なし — 全カラムが既存、RLS 修正不要)
```
