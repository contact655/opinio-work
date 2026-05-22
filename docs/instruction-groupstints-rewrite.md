# Claude Code 指示書：groupStints() 連続走査書き直し（出戻りパターン対応）

## 0. プロジェクト前提（必ず確認）

- プロジェクトパス: `/Users/hisato/opinio-work/`
- Supabase project ref: `xtutnecqeamftygufxco`
- デプロイ: `git push origin main` → Vercel auto-deploy
- 安全ルール:
  - **Phase 1（事前調査）が完了するまでコード変更しない**
  - 想定外動作が出たら停止して報告
  - 「〜のはず」禁止、事実確認してから進める
  - `npm run build` を push 前に必ず実行
- 完了後の handover は `docs/handover-2026-05-24.md` に記載

---

## 1. 背景と目的

`/profile/edit` の `CareerHistoryEditor.tsx` の `groupStints()` が **Map 全件集約方式**のため、出戻りパターン（A社 → B社 → A社）で同社の全エントリを誤って 1 つのグループに統合してしまうバグが発生している。

### 詳細

参照: `docs/bug_investigation_revisit_pattern.md`

- バグ場所: `CareerHistoryEditor.tsx` 行 62〜68 の `groupStints()`
- 原因: `Map<string, Stint[]>` で会社名キー集約 → 位置情報が消える
- 影響: `/profile/edit` のみ（`/mypage`・`/u/[id]` は正常）
- 修正方針: **連続走査（consecutive scan）方式に書き直す**
- 参考実装: `MergedTimeline.tsx` の `groupSameCompanyEntries()`（既に正しく動作している）

### UI 仕様の確定事項（柴さん決定済み）

連続走査にすると同社グループが複数できる（例: 003 グループ① と 003 グループ②）ため、
**「同社へのポジション追加」ボタンは各グループのヘッダーに表示する**（A 案確定）。

これにより:
- ユーザーが「どのグループに position を追加するか」を明示的に選べる
- 出戻りパターンを UI で正しく表現できる
- draftFromGroup のプリフィルは「そのグループの earliestStart / latestEnd」を使う

---

## 2. 作業フェーズ

このタスクは **2 段階**に分割する。Phase 1 完了後、柴さんに報告して GO を待つこと。

---

### Phase 1: 事前調査（実装前に必ず）

**Phase 1 では一切のコード変更・修正をしない。view のみ。**

以下の 4 タスクを並行実行し、報告フォーマットに従って柴さんに報告する。

#### タスク 1: 現状の `CareerHistoryEditor.tsx` の構造を把握

確認項目:

1. **`groupStints()` の全コード**（バグのある現状コードを全文コピペ）
2. **`groupStints()` の戻り値の型**（Group / GroupedStint 等の型定義含む）
3. **`groupStints()` を呼び出している箇所**（行番号 + 周辺コンテキスト）
4. **ソート処理の現状**（`groupStints()` 呼び出し前のソートロジック）
5. **「ポジション追加」ボタンの実装箇所**:
   - 現在のボタン配置（行番号）
   - クリック時の挙動（onClick ハンドラー、関数名）
   - `draftFromGroup` の使用箇所と渡している引数
6. **グループヘッダーの実装箇所**（earliestStart / latestEnd / 在籍期間表示の行番号）
7. **現職バッジの表示ロジック**（`is_current` を見ているか、グループ単位か行単位か）

#### タスク 2: 参考実装 `groupSameCompanyEntries()` の把握

確認項目:

1. **`groupSameCompanyEntries()` の全コード**（`MergedTimeline.tsx` 内、全文コピペ）
2. **関数の export 状況**（export されているか、内部関数か）
3. **入力の型 / 出力の型**
4. **使用前提のソート順**（コメント or 呼び出し元の事前処理から推測）

#### タスク 3: 共通化可否の判断材料

確認項目:

1. **`groupSameCompanyEntries()` を `CareerHistoryEditor.tsx` からそのまま import できるか**
   - 型の互換性（Stint と MergedTimeline の入力型は同じか？ 違うなら差分を明示）
   - import パスの実現可能性
2. **共通ユーティリティ化する場合の置き場所候補**（`src/lib/` 配下の既存ファイル提案）
3. **型差分があった場合の解消方針**（型変換アダプタが必要か、ジェネリック化で対応できるか）

#### タスク 4: 影響範囲の確認

確認項目:

1. **`groupStints()` の戻り値を使っている全箇所**（行番号 + 用途）
2. **連続走査に変えた時に挙動が変わる可能性のある UI 要素**:
   - グループヘッダーの earliestStart / latestEnd 表示
   - 現職バッジ位置
   - draftFromGroup プリフィル
   - その他懸念点
3. **テストデータの想定**: 現在 `/profile/edit` で出戻りパターンを再現できるユーザーが存在するか、別途投入が必要か

### Phase 1 報告フォーマット（厳格）

```
===== タスク 1: CareerHistoryEditor.tsx の現状 =====

【groupStints() 全コード】
<行番号付きで全文コピペ>

【戻り値の型】
<型定義>

【呼び出し箇所】
<行番号 + 周辺コード>

【ソート処理の現状】
<該当コード>

【ポジション追加ボタン】
- 現在の配置: <行番号 + 説明>
- onClick: <関数名 + コード>
- draftFromGroup 使用箇所: <行番号 + 渡している引数>

【グループヘッダーの実装】
<行番号 + 関連コード>

【現職バッジの表示ロジック】
<行番号 + コード>

===== タスク 2: groupSameCompanyEntries() の把握 =====

【全コード】
<行番号付きで全文コピペ>

【export 状況】
<内部関数 or export>

【入出力の型】
<型情報>

【使用前提のソート順】
<コメント or 推測根拠>

===== タスク 3: 共通化可否 =====

【import できるか】
- 型互換性: YES / NO（NO の場合は差分を明示）
- import パス: <提案>

【共通化先の候補】
<src/lib/ 配下のファイル提案>

【型差分の解消方針】
<必要なら>

===== タスク 4: 影響範囲 =====

【groupStints() 戻り値の使用箇所】
<行番号 + 用途を一覧>

【挙動が変わる可能性のある UI 要素】
- earliestStart / latestEnd: <該当箇所と懸念>
- 現職バッジ: <該当箇所と懸念>
- draftFromGroup: <該当箇所と懸念>
- その他: <あれば>

【テストデータ】
- 既存ユーザーで出戻り再現可能: YES / NO
- 投入が必要な場合: <提案>

===== Claude Code 自身の実装方針提案 =====

【方式 X（共通化）と方式 Y（重複実装）の判断】
- 推奨: X / Y
- 理由: <2-3 行>

【実装ステップ（提案）】
1. <ステップ 1>
2. <ステップ 2>
...

【想定リスク】
<あれば>
```

**Phase 1 完了後、柴さんに報告。コード変更は禁止。GO 確認後に Phase 2 へ。**

---

### Phase 2: 実装（柴さんの GO 後）

Phase 1 の調査結果と柴さんの判断に基づき、以下を実施:

1. **連続走査ロジックの実装**（X か Y の方針で）
2. **「ポジション追加」ボタンを各グループヘッダーに配置**
3. **draftFromGroup の引数調整**（各グループの earliestStart / latestEnd を渡す）
4. **earliestStart / latestEnd の再計算**（各グループ内で算出）
5. **現職バッジの整合性確認**（出戻り後の現職グループにだけ「在籍中」が出るか）
6. ローカルで `/profile/edit` を動かして実機確認（出戻りパターンが正しく表示される）
7. `npm run build` 確認
8. コミット → push（柴さんから GO を取ってから push）
9. Vercel デプロイ後、本番 `/profile/edit` で目視確認

---

## 3. 完了条件

- [ ] Phase 1 報告が柴さんに提示済み
- [ ] Phase 2 実装完了、ビルド成功
- [ ] 本番 `/profile/edit` で出戻りパターンが正しく 2 グループに分かれて表示
- [ ] グループヘッダーの「ポジション追加」ボタンが各グループに表示
- [ ] draftFromGroup のプリフィルが各グループの値で機能
- [ ] 現職バッジが最新グループにのみ表示
- [ ] commit hash が Vercel ダッシュボードに反映
- [ ] `docs/handover-2026-05-24.md` に記録

---

## 4. やらないこと（スコープ外）

- メンター Phase 4（相談リクエストフォーム）
- `/profile/edit` の他の UI 改修
- MergedTimeline コンポーネント自体の機能追加
- 経歴データのマイグレーション
- `groupSameCompanyEntries()` のロジック変更（バグなく動いているため触らない）

---

## 5. 想定リスクと対処

| リスク | 対処 |
|---|---|
| 型差分で共通化困難 | Phase 1 で判断、ジェネリック化 or 型変換アダプタを提案 |
| draftFromGroup の挙動が予想外 | Phase 1 タスク 1 で実装を把握 → Phase 2 で対応 |
| 出戻り再現データが本番に無く検証困難 | Phase 1 タスク 4 で確認 → 必要なら別途データ投入 |
| グループヘッダー UI のレイアウト崩れ | ローカル確認で発見 → Phase 2 で対応 |

---

## 6. 注意事項

- このバグは **本番で実データで顕在化中**。慎重に進めること
- `MergedTimeline` の `groupSameCompanyEntries` は正常動作中なので**絶対に壊さない**
- 「想定どおり」「〜のはず」は禁止。Phase 1 でファクトを揃えてから Phase 2 に進む
- Phase 1 の調査だけでセッションが終わっても問題ない（むしろ慎重さが正解）
