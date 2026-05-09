# ν-8 段階3 — Claude Code 指示文 v1

**作成日**: 2026-05-09(段階2 完了直後)
**Phase**: ν-8 人のプロフィール充実化
**段階**: 段階3(自己紹介と想い + 基本情報タブ全項目移植)
**前段階**: 段階2 完了(コミット A〜F-2 + G、最終 af987ed)
**関連ドキュメント**:
- `docs/handoff/handover-2026-05-09-v22.md`(本セッション引き継ぎ書 v22)
- `docs/handoff/handover-2026-05-09-nu8-stage2-complete.md`(段階2 完了報告)
- `docs/planning/phase-nu-8-master-plan.md`(マスタープラン v1、v2 反復対象)
- `docs/instructions/nu8-stage2-claude-code-instructions.md`(段階2 指示文、参考)

---

## §1. このタスクの目的

ν-8 段階3 は **自己紹介(about_me) と「やってみたいこと」 + 基本情報タブ全項目の編集 UI を /profile/edit に並行マウント** する段階。

ν-7 までの編集 UI は `/mypage` の UserProfileCard に集約されていた。段階1 で `/profile/edit` に5タブ構造を作ったが、職歴以外のタブは全部「実装中」プレースホルダー。段階3 では基本情報タブを完成させる(プレースホルダー卒業)。

### 段階3 完了時の達成像

- `/profile/edit` の「基本情報」タブで、以下を編集できる:
  - 名前(ow_users.name)
  - 所在地(ow_users.location 等の既存カラム)
  - 年齢層(ow_users.age_range 等の既存カラム)
  - **自己紹介(about_me)** — テーマ核心
  - **「この先やってみたいこと」(future_aspiration 等の既存カラム)** — テーマ核心
- 編集 → 保存 → リロードで永続化
- `/u/[id]` 公開ページに反映される(自己紹介セクションは段階2 で表示済み、その他は要確認)
- `/mypage` の UserProfileCard 側は触らず並行状態を維持(段階6 で集約)

### 段階3 のゴールではないこと(段階4 以降に持ち越す)

- スキルタグ編集 UI(段階4)
- SNS リンク編集 UI(段階5)
- /mypage と /profile/edit の編集 UI 重複の最終整理(段階6)
- /opengraph-image エラー対処(段階6 or ν-9)

---

## §2. 前提と制約(必読)

### 2.1 段階1〜2 で発覚した重要事項(全て厳守)

#### 2.1.1 RLS 標準パターン(再掲)

opinio-work の RLS 標準パターン:

```sql
CREATE POLICY "policy_name" ON table_name FOR <ACTION>
  USING (user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid()));
```

ow_users.auth_id が Supabase Auth の uid を保持。新たに RLS を書く必要があれば、必ず既存パターンを確認してから書く。

#### 2.1.2 migration 連番

固定の連番を仮置きしない。実行直前に最大連番を確認:

```bash
ls -1 supabase/migrations/ | sort | tail -5
```

段階2 までで 081 が最大。段階3 で新 migration が必要なら 082 から(ただし時点で連番が進んでいる可能性があるためディレクトリ確認必須)。

#### 2.1.3 migration はべき等に書く

段階1 のドリフト(Studio から手動 SQL を流したものが migration に残らなかった)対策:

- `ADD COLUMN IF NOT EXISTS`
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `DROP POLICY IF EXISTS` → `CREATE POLICY` セット(PostgreSQL は CREATE POLICY IF NOT EXISTS 未サポート)
- `DROP COLUMN IF EXISTS`

#### 2.1.4 完了報告 ≠ 適用完了

migration ファイル作成は適用完了を意味しない。各コミット完了報告で「DB 適用確認まで実施したか」を明記する。Hisato さんが `supabase db push` を手動実行する流れ。

#### 2.1.5 DROP/RENAME 前は grep で全参照確認

`grep -rn "カラム名" src/` で全参照箇所を洗い出してから DROP/RENAME を実施する。

#### 2.1.6 コミット分割の哲学

「機械的に N 分割」ではなく「**意味のある単位で分ける**」。本指示文の暫定分割は絶対ではない。統合・細分化した場合は完了報告で理由を明記。

### 2.2 ν-7 規律の継承(段階2 違反事例の反省)

| 規律 | 内容 |
|---|---|
| 動作確認スキップ厳禁 | 各コミット後に Hisato さんの実機確認を待つ |
| **次コミット不着手** | **Hisato さんが「OK」と明示するまで、次コミットの調査・実装には一切着手しない** |
| コミット分割厳守 | ただし「意味のある単位」 |
| キャッシュ崩れ予防 | 怪しい挙動が出たら `rm -rf .next && npm run dev` |
| ポート確認 | http://localhost:3000 |
| Compiled ログ待ち | dev server が `Compiled /profile/edit` を出してから動作確認 |

**段階2 では B' → C, D で「Hisato さんの確認待ちをスキップして次コミットに進んだ」事例が連続発生した。段階3 では各コミットの完了報告の最後に「Hisato さんの OK を待ちます。OK が出るまで次の調査・実装には着手しません」と明記し、必ず待つこと。**

### 2.3 並行マウント方針(§3·2)

`/profile/edit` の基本情報タブに新規実装する。`/mypage` の UserProfileCard は触らない(編集機能を残す)。一時的に編集 UI が2箇所に存在するが、これは段階6 仕上げで集約する前提。

理由: 段階2 で CareerHistoryEditor を並行マウントした実証済みパターン、段階3 のスコープを抑える、段階6 に整理タスクを集約。

### 2.4 dogfooding 用アカウント

**Account B(s.hisato1020@gmail.com、`e826e0bd-f96b-42ec-acda-d8f482e1417d`)を正として使う**。

Account A(hshiba@opinio.co.jp、`fe7dfe9b-...`)はデータ空のため放置。動作確認時の URL は `/u/e826e0bd-f96b-42ec-acda-d8f482e1417d` を使う。

### 2.5 既存データの破壊回避

`/mypage` で柴さん本人が既に以下を入力済み(Account B):

- name: 柴 久人
- 所在地: 東京都
- 年齢層: 30代前半
- about_me: 「リクルートで4年間営業を経験後、Salesforce Japan で6年間...」(長文)
- 「やってみたいこと」: 「テスト」(短文、後で本物に置換予定)

段階3 の実装で、これらの **既存データを誤って null 化したり上書きしないこと**。新規実装した編集フォームは、初期値として既存値を読み込んで表示する。

---

## §3. 実装内容(コミット分割案 — 統合・細分化の余地あり)

### 事前調査コミット A: 基本情報タブの現状と /mypage の実装パターン確認

**実装ファイル不要**。以下を調査して完了報告に記載:

1. **/profile/edit の基本情報タブの現状**
   - `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` で `activeTab === "basic"` 系の分岐がどうなっているか
   - 段階1 で作った PlaceholderTabContent がどこにあるか(段階2 で職歴タブに使われていたもの)

2. **/mypage の UserProfileCard で基本情報を編集している箇所**
   - `src/components/profile/UserProfileCard.tsx` の name / 所在地 / 年齢層 / about_me / やってみたいこと の編集 UI 構造
   - 各フィールドの保存先(自動保存ロジックがあるか、明示的な保存ボタンがあるか)
   - 使われている API ルート(/api/jobseeker/users 等)

3. **DB スキーマの確認(MCP で読み取り専用 SELECT)**
   - ow_users テーブルの全カラムのうち、基本情報タブで触る必要があるもの
   - name / location 系 / age_range 系 / about_me / 「やってみたいこと」の正確なカラム名
   - それぞれの NOT NULL / NULLABLE / デフォルト値
   - 「やってみたいこと」が `future_aspiration` か `to_do_next` か、実際のカラム名を確認

4. **既存 RLS の確認**
   - ow_users の UPDATE policy が「本人のみ可」になっているか
   - もし問題があれば、新 migration が必要かどうかの判断材料を提供

5. **段階3 で migration が必要かの判断**
   - 全カラムが既存 → migration 不要
   - 必要なカラムが欠けている → 082 から連番で migration 追加

報告フォーマット:

```markdown
## 基本情報タブの現状
(該当ファイルの該当部分を引用、「実装中」プレースホルダーがどこにあるか)

## /mypage UserProfileCard の基本情報編集 UI
(各フィールドの編集 UI 構造、保存ロジック、API 経路)

## ow_users スキーマ(関連カラムのみ)
| カラム名 | 型 | NULLABLE | 用途 |
|---|---|---|---|

## 既存 RLS の状態
(UPDATE policy が正しく動くか)

## 段階3 で migration が必要か
(必要 / 不要、理由付き)

## 私(Hisato)への提案
(コミット B 以降の分割と進め方の提案、想定外があれば代替案)
```

**着手前注意**: §5.2 中断ルール準用 — もし想定外の構造(`about_me` や「やってみたいこと」が JSONB に格納されている等)が判明したら、段階3 を中断して Hisato さんに報告。

完了報告 → Hisato さんの OK を待つ → コミット B 着手。OK が出るまで B の調査・実装には一切着手しない。

### コミット B: 名前・所在地・年齢層の編集 UI 移植

`/profile/edit` の基本情報タブに、ow_users.name / location 系 / age_range 系の編集 UI を実装。

- /mypage UserProfileCard の編集 UI を **参考にして再実装**(コピペではなく、構造を読んで /profile/edit のスタイルに合わせる)
- 保存先の API は既存(/mypage 側で動いているもの)を流用
- 初期値として既存データを読み込み、空 null 化を避ける

完了報告 → Hisato さんの OK を待つ → C 着手。OK が出るまで C の調査・実装には一切着手しない。

### コミット C: about_me 編集 UI 追加(テーマ核心)

`/profile/edit` の基本情報タブに about_me 編集を追加。

- テキストエリア、200字推奨ソフトリミット(警告のみ、ハードカットしない)
- 既存の長文 about_me を初期値として表示
- 保存 → リロードで永続化
- /u/[id] 公開ページの「About Me」セクションに反映されること(段階2 で表示は完成済み)

完了報告 → Hisato さんの OK を待つ → D 着手。OK が出るまで D の調査・実装には一切着手しない。

### コミット D: 「やってみたいこと」編集 UI 追加(テーマ核心)

`/profile/edit` の基本情報タブに「この先やってみたいこと」編集を追加。

- about_me と同じ形式のテキストエリア(文字数上限は調査で柔軟に判断)
- /mypage で既に存在する「この先やってみたいこと」フィールドを `/profile/edit` に並行マウント
- 保存 → リロードで永続化

完了報告 → Hisato さんの OK を待つ → E(プレースホルダー卒業確認)着手。OK が出るまで着手しない。

### コミット E: 基本情報タブのプレースホルダー卒業最終確認

実装ファイル変更は最小(タブ表示の最終調整、PlaceholderTabContent 呼び出しの除去等)。

- 「実装中」プレースホルダーがすべての項目で消えていることを確認
- B/C/D で実装した5項目が一画面に収まり、編集 UI として違和感がないこと
- /mypage 側の UserProfileCard が並行で動き続けていること

完了報告 → Hisato さんの OK を待つ → F(完了報告ファイル作成)着手。OK が出るまで着手しない。

### コミット F: 段階3 完了報告ファイル作成

`docs/handoff/handover-YYYY-MM-DD-nu8-stage3-complete.md` として作成(指示文 §4 のフォーマット)。

---

## §4. 完了報告のフォーマット

段階2 の完了報告 `docs/handoff/handover-2026-05-09-nu8-stage2-complete.md` と同じ構造で:

```markdown
# ν-8 段階3 完了報告

**作成日**: YYYY-MM-DD
**Phase**: ν-8 段階3(自己紹介と想い + 基本情報タブ全項目移植)

## §1. 完了コミット一覧
(各コミットの hash と1行サマリ。当初分割を統合・細分化した場合は理由併記)

## §2. 動作確認結果
- /profile/edit 基本情報タブのプレースホルダー卒業
- 名前・所在地・年齢層・about_me・「やってみたいこと」の編集 → 保存 → リロード永続化
- /u/[id] 公開ページへの反映(About Me 等)
- /mypage UserProfileCard が並行で動き続ける

## §3. 段階3 で発見した重要情報(マスタープラン v2 反映候補)

## §4. 当初分割からの変更点

## §5. 段階4 着手前のチェック項目
- スキルタブ実装の前提確認(ow_user_skill_tags の現状データ、API ルート)

## §6. 既知の課題 / 持ち越し
- /mypage と /profile/edit の編集 UI 重複(段階6 で集約)
- スキル・SNS タブのプレースホルダー(段階4・段階5)
```

---

## §5. 起こりうる問題と対処

### 5.1 想定外の DB スキーマ

`about_me` や「やってみたいこと」が単純なカラムではなく、JSONB の入れ子や別テーブルだった場合、本指示文の前提が崩れる。

**対処**: 事前調査コミット A で発覚したら **段階3 を中断して Hisato さんに報告**(段階2 §5.2 と同じ規律)。

### 5.2 /mypage 側の自動保存ロジックとの競合

/mypage UserProfileCard が自動保存(編集中即保存)で動いている場合、/profile/edit 側で同時に開くと最後の保存が勝つ(後勝ち)。dogfooding 中に予期せぬ上書きが起きる可能性がある。

**対処**: 段階3 では同時開きを想定しない(現実的にユーザーは一方しか開かない)。コミット B〜D の動作確認で異常があれば対処を検討。最終的な集約は段階6 で行う。

### 5.3 「やってみたいこと」のカラム名が不明確

ν-6 以前の実装で `future_aspiration` `to_do_next` `aspirations` 等、複数の候補がある可能性。

**対処**: 事前調査コミット A で正確なカラム名を MCP で確認してから B 以降に進む。

### 5.4 文字数上限の判断

about_me は ν-8 マスタープランで「200字推奨ソフトリミット」と仮置きされているが、既存の柴さんの自己紹介は 200字を超えている可能性がある。

**対処**: 事前調査で実データの文字数を確認 → ソフトリミットは柔軟に(警告だけで保存は可能、ハードカットしない)。「やってみたいこと」も同様。

### 5.5 RLS の問題で UPDATE が通らない

ow_users の UPDATE policy が `auth_id = auth.uid()` ベースで書かれているはずだが、もし不整合があれば実機テストで「保存できない」状態になる。

**対処**: 事前調査コミット A で RLS を確認しておく。問題があれば migration で修正(コミット A2 として独立)。

---

## §6. 実行順序チェックリスト

```
[ ] 1. cd /Users/hisato/opinio-work
[ ] 2. git status で uncommitted な変更がないか確認
[ ] 3. git log --oneline -10 で段階2 の最終コミット G(af987ed)が見えるか確認
[ ] 4. ls -1 supabase/migrations/ | sort | tail -5 で最大連番(081 のはず)確認
[ ] 5. rm -rf .next && npm run dev で dev server 起動
[ ] 6. http://localhost:3000 アクセス確認
[ ] 7. Compiled ログ確認後、コミット A(事前調査)着手
[ ] 8. コミット A 完了報告 → Hisato さんの OK 待ち
[ ] 9. OK 後、コミット B 着手
[ ] 10. ... 各コミットごとに Hisato さんの OK 待ち
[ ] 11. 全コミット完了後、§4 のフォーマットで完了報告ファイル作成
[ ] 12. 完了報告コミット
```

---

## §7. Hisato さんへの最終確認事項

実装に着手する前に、以下を Hisato さんに確認:

1. ✅ 段階3 のスコープ(基本情報タブ全項目移植 = 名前・所在地・年齢層・about_me・「やってみたいこと」の5項目)で進めて OK か
2. ✅ §2.3 の「並行マウント」方針(/mypage 側を触らない)で OK か
3. ✅ §2.4 の「Account B(Gmail)を正として使う」で OK か
4. ✅ 文字数上限はソフトリミット(警告のみ、ハードカットしない)で OK か
5. ✅ コミット A の事前調査で想定外の構造(JSONB 等)が判明した場合の中断ルール(§5.1)で OK か

これらが OK であれば、§6 のチェックリストに従って着手する。

---

**指示文 v1 終了**

段階3 完了後は、§4 フォーマットの完了報告 + マスタープラン v2 反映を経て、段階4(スキルタグ)へ進む。

なお、本指示文は v1。マスタープラン v2 反復後に新たな前提変更が判明した場合、必要に応じて v2 に更新する。
