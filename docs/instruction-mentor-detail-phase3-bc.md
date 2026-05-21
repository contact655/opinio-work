# Claude Code 指示書：/mentors/[id] 詳細ページ改修（Phase 3-B + 3-C）

## 0. プロジェクト前提（必ず確認）

- プロジェクトパス: `/Users/hisato/opinio-work/`
- Supabase project ref: `xtutnecqeamftygufxco`
- デプロイ: `git push origin main` → Vercel auto-deploy
- 安全ルール:
  - **Phase 単位で都度報告・GO 確認すること**
  - 想定外動作が出たら停止して報告
  - 「〜のはず」禁止、事実確認してから進める
  - `npm run build` を push 前に必ず実行
- 完了後の handover は `docs/handover-2026-05-23.md` に記載

---

## 1. 前提状況（事前確認済み）

- **Phase 1**: マイグレーション 108〜111 適用済み（`ow_consultation_categories`, `ow_mentor_categories`, `ow_consultation_requests`, `ow_mentors.user_id` NOT NULL 化）
- **Phase 2**: `/mentors` 一覧ページ実装済み（悩みカテゴリカルーセル + 全メンター一覧）
- **Phase 3-A**: テストメンター 10 名分の `ow_experiences` データ投入済み（柴さんが Supabase 経由で実行）
  - 全メンターに前職 + 現職の経歴 2-3 件が紐付いている
  - `role_category_id` は `ow_roles` から解決済み

---

## 2. 戦略的位置付け

メンター詳細ページは「キャリア意思決定インフラ」のコア体験。

- ユーザーは「この先輩に相談したい」と思える具体的根拠が欲しい
- スペックではなく、**経歴のストーリー**で人柄を伝える
- 数字（実績数、評価）を出さず、運営仲介で安心して相談できる

memory にある「数字を出さない」「運営仲介」「経歴 ≠ 権限」「ユーザーとメンターは同じ `ow_users` ベース」の原則を守る。

---

## 3. 仕様（確定）

### 3-B: 既存 UI 要素の削除と CTA 改修

**削除する要素**:
- `success_count`（成功実績数）の表示
- `total_sessions`（累計セッション数）の表示
- `calendly_url` を使った直接予約 CTA
- 評価指標・スコアっぽい数値表示すべて

**追加する要素**:
- **「Opinio に相談する」CTA**: 既存の calendly_url リンクを置き換える
  - クリック動作: 一旦 `alert("相談リクエスト機能は実装中です（Phase 4）")` でプレースホルダー対応、または `/mentors/[id]/request` への遷移（Phase 4 で本実装）
  - スタイルは既存の CTA ボタンに準拠

**残す要素**:
- 顔写真（avatar_initial + avatar_color）
- 名前
- 現職: 会社名 + ポジション
- catchphrase
- bio
- question_tags（相談テーマ）
- concerns（相談できる悩み）
- 「相談受付中」バッジ（is_available ベース）

**注意点**:
- DB のカラム自体は削除しない（success_count, total_sessions, calendly_url は残す）
- UI レベルでの表示削除のみ
- 戦略的に「将来表示する可能性がない」と判断したわけではなく、「今は出さない」だけ

### 3-C: MergedTimeline 統合（経歴タイムライン表示）

**目的**: `/u/[id]` で使われている MergedTimeline コンポーネントを `/mentors/[id]` にも導入し、経歴タイムラインを表示する。

**実装方針**:
1. `/u/[id]/page.tsx` で MergedTimeline がどう使われているかを確認
2. 同じ取得ロジック（`ow_experiences` JOIN）を `/mentors/[id]/page.tsx` に適用
3. MergedTimeline コンポーネントを `/mentors/[id]` でも再利用（コンポーネント自体を改修する必要はないはず）

**取得対象**:
- `ow_experiences` テーブルから当該メンターの全経歴を取得
- `user_id = ow_mentors.user_id`（Phase 1 で NOT NULL 化済み）でリンク
- 既存の MergedTimeline が期待するデータ構造に整形

**表示位置**:
- メンター詳細ページの「プロフィール」ブロック内、または独立した「経歴」ブロックとして
- `/u/[id]` のレイアウトを参考に、メンター詳細の文脈に合うように配置

**スコープ外**:
- MergedTimeline コンポーネント自体の改修（既存のまま使う）
- 経歴データの編集機能（Phase 4 以降）

---

## 4. 作業フェーズ（このタスク内）

### Phase 3-B-0: 事前調査（実装前に必ず）

以下を確認してから 3-B 実装に進む:

1. **`/mentors/[id]/page.tsx` の現状実装を読む**
   - 表示している全フィールドを特定
   - `success_count` / `total_sessions` / `calendly_url` の使用箇所を特定
   - CTA ボタンの実装箇所を特定

2. **`/u/[id]/page.tsx` で MergedTimeline がどう使われているかを読む**
   - MergedTimeline のインポートパス
   - 経歴データの取得関数・取得カラム
   - MergedTimeline に渡している props 構造

3. **取得関数の有無を確認**
   - `getUserExperiences()` or 類似の関数が `src/lib/supabase/queries.ts` などにあるか
   - あれば再利用可能か、ow_mentors.user_id ベースで取得できるか

#### 報告フォーマット

```
===== /mentors/[id]/page.tsx の現状 =====
- ファイルパス: <path>
- 表示フィールド一覧: <list>
- success_count 使用箇所: <line>
- total_sessions 使用箇所: <line>
- calendly_url 使用箇所: <line>
- CTA ボタン実装箇所: <line>

===== /u/[id]/page.tsx で MergedTimeline =====
- ファイルパス: <path>
- MergedTimeline インポート: <path>
- 経歴取得関数: <function name + path>
- MergedTimeline props 構造: <type definition>

===== 共通取得関数の有無 =====
- 関数名: <name or "なし">
- 再利用可能性: YES / NO + 理由
```

**Phase 3-B-0 完了後、柴さんに報告して GO を待つこと**

### Phase 3-B-1: UI 要素削除と CTA 改修

1. `src/app/(jobseeker)/mentors/[id]/page.tsx` を編集
   - success_count / total_sessions の表示ブロック削除
   - calendly_url を使う CTA を「Opinio に相談する」プレースホルダーに置き換え
   - 既存 UI のレイアウトが崩れないことを確認

2. `npm run build` で型エラー 0 件確認

3. 中間コミット（push はまだしない）

### Phase 3-C-1: MergedTimeline 統合

1. `/mentors/[id]/page.tsx` に経歴データ取得ロジックを追加
   - `ow_mentors.user_id` から `ow_experiences` を取得
   - `/u/[id]` で使われている関数を再利用 or 同等の関数を実装

2. MergedTimeline コンポーネントを表示エリアに配置
   - プロフィールブロック内 or 独立ブロックとして
   - `/u/[id]` のレイアウトを参考にする

3. `npm run build` 確認

4. テストメンター 10 名の詳細ページで経歴タイムラインが表示されることを確認（ローカルで `npm run dev`）

### Phase 3-D: コミット・プッシュ

1. 全変更をコミット
2. `git push origin main`
3. Vercel デプロイ完了確認（commit hash で目視）
4. 本番 `/mentors/[id]` で確認:
   - success_count / total_sessions / calendly_url が消えている
   - 「Opinio に相談する」CTA が表示されている
   - 経歴タイムライン（MergedTimeline）が表示されている
   - レイアウト崩れなし

---

## 5. 完了条件

- [ ] success_count / total_sessions / calendly_url の UI 表示削除
- [ ] 「Opinio に相談する」CTA 追加（プレースホルダー実装）
- [ ] MergedTimeline 統合済み、テストメンター経歴が表示される
- [ ] `npm run build` 成功
- [ ] commit hash が Vercel ダッシュボードに反映済み
- [ ] 本番 `/mentors/[id]` で目視確認済み
- [ ] handover-2026-05-23.md に記録

---

## 6. 想定リスクと対処

| リスク | 対処 |
|---|---|
| /u/[id] の MergedTimeline 実装が複雑で再利用困難 | Phase 3-B-0 で読んで判断、難しければ独自取得ロジックを書く |
| `ow_experiences` の取得関数が `/u/[id]` 専用で再利用不可 | 共通関数として切り出すか、新規関数を作成 |
| MergedTimeline がメンター用 props を期待する場合 | コンポーネント側の小さな改修を許容、ただし `/u/[id]` の動作を壊さないこと |
| calendly_url を消すと既存のリンクが死ぬ | UI から消すだけで DB データは残るので問題なし |

---

## 7. やらないこと（スコープ外）

- 相談リクエストフォームの本実装（Phase 4 で実施）
- MergedTimeline コンポーネント自体のメジャー改修
- success_count / total_sessions / calendly_url の DB カラム削除
- メンター本人によるプロフィール編集機能
- 評価・レビュー機能の追加
- `groupStints()` の修正（5/22 handover の別タスク）

---

## 8. セッション分割

1 セッションで Phase 3-B-0 → 3-B-1 → 3-C-1 → 3-D まで完遂を想定。
ただし、Phase 3-B-0 の調査結果次第で複雑度が判明したら、分割を検討すること。

**Phase 3-B-0 の報告 → 柴さんの GO → 残り実装**、という流れを厳守。
