# 原因調査：出戻りパターンで同社グループ化が誤統合される問題

## 症状

`/profile/edit` で、以下の経歴データを持つユーザーが出戻りパターンを正しく表現できていない。

### 実データ（推定）

```
1. テスト株式会社_003 / フィールドセールス  2024.04 〜 現在        (is_current=true)
2. テスト株式会社_003 / インサイドセールス  2022.04 〜 2024.03    (is_current=false)
3. テスト株式会社_001 / PMM                 2020.04 〜 2022.03    (is_current=false)
4. テスト株式会社_003 / フィールドセールス  2018.04 〜 2020.03    (is_current=false)
```

これは典型的な出戻りパターン：**003 → 001（転職）→ 003（出戻り）**

### 期待される表示（YES / C案で確定済みの設計）

```
003 グループ① ─ FS(2024.04-現在) + IS(2022.04-2024.03)、在籍期間 約3年8ヶ月
001 グループ  ─ PMM(2020.04-2022.03)、在籍期間 2年
003 グループ② ─ FS(2018.04-2020.03)、在籍期間 2年（単独カードでも可）
```

出戻りは「PMM を挟んで上下に分かれる」ことが正しい挙動。

### 実際の表示（バグ）

`/profile/edit` のスクショ確認:

```
003 グループ ─ FS(2024.04-現在) + IS(2022.04-2024.03) + FS(2018.04-2020.03)、
              在籍期間「2018.04 〜 現在 · 8年2ヶ月」（3件全部統合・PMM の期間も含まれてしまっている）
001 グループ ─ PMM(2020.04-2022.03)
```

003 が **3件全部1グループに統合** されており、しかも在籍期間が最古〜最新の 8年2ヶ月になっている。
これは事実と異なる（実際には PMM の期間中は 003 にいない）。

---

## 調査の本丸

`/u/[id]` と `/mypage`（MergedTimeline 経由）でも同じ症状が出るかを確認すること。

- **3画面とも同じ症状** → 今日の MergedTimeline 実装（`groupSameCompanyEntries`）にバグ
- **`/profile/edit` だけ症状あり** → CareerHistoryEditor の `groupStints()` の既知問題（昨日の handover に
  「実データで発生したら対応」と記載済み）であり、今日の実装は無傷

この切り分けが調査の最重要ゴール。

---

## 調査タスク

**実装は一切不要、読み取りと出力のみ**。

### タスク1: 上記のユーザーで `/u/[id]` と `/mypage` を実機確認

ローカル dev か本番のどちらでも構わない。スクショは不要、目視確認の結果を YES/NO で回答してください。

質問：
- `/u/[id]` で、003 が **1グループに統合** されているか？
- `/u/[id]` で、003 の在籍期間表示が **8年2ヶ月** など PMM 期間を含む値になっているか？
- `/mypage` で、上記2点と同じ症状が出ているか？

### タスク2: `groupSameCompanyEntries` のソート前後を console.log で確認

`src/components/profile/MergedTimeline.tsx` の `groupSameCompanyEntries` 関数の **冒頭** に、
以下のデバッグ出力を**一時的に**追加してください（後で必ず削除）：

```typescript
function groupSameCompanyEntries(entries: RenderEntry[]): RenderEntry[] {
  // ─── DEBUG（出戻りバグ調査用、調査後削除）─────────────────────────
  if (typeof window !== "undefined") {
    console.log("[groupSameCompanyEntries] input entries:");
    entries.forEach((e, i) => {
      if (e.kind === "career") {
        console.log(`  [${i}] career: ${e.data.company_name} / ${e.data.role_label} / started=${e.data.started_at} / is_current=${e.data.is_current} / key=${
          e.data.company_id ? `m:${e.data.company_id}` :
          e.data.company_name === "非公開企業" ? `a:${e.data.id}` :
          `c:${e.data.company_name}`
        }`);
      } else if (e.kind === "career-group") {
        console.log(`  [${i}] career-group: ${e.items.length} items`);
      } else {
        console.log(`  [${i}] ${e.kind}`);
      }
    });
  }
  // ─── /DEBUG ──────────────────────────────────────────────────────

  const result: RenderEntry[] = [];
  // 以下既存ロジック...
```

`npm run build` でエラーなしを確認した上で、ローカル dev を起動して `/u/[id]/<該当ユーザーID>` を開く。
Chrome DevTools の Console タブに出力される配列の中身（順序と company_id / company_name）を
**全文コピーして報告してください**。

### タスク3: 上記の結果を踏まえて、3パターンに分類

タスク2の console.log 結果を見て、以下のどれに該当するかを判定：

**パターンA：ソートが期待通り**
```
[0] career: 003 / FS / started=2024-04-01 / is_current=true / key=m:xxx
[1] career: 003 / IS / started=2022-04-01 / is_current=false / key=m:xxx
[2] career: 001 / PMM / started=2020-04-01 / is_current=false / key=m:yyy
[3] career: 003 / FS / started=2018-04-01 / is_current=false / key=m:xxx
```
→ 連続走査ロジックは 003 を [0][1] / [3] に分断する**はず**。それでも統合されているなら
`groupSameCompanyEntries` 関数本体にバグがある。

**パターンB：ソートが想定と違い、003 が全部先頭に集約されている**
```
[0] career: 003 / FS / started=2024-04-01 / is_current=true
[1] career: 003 / IS / started=2022-04-01 / is_current=false
[2] career: 003 / FS / started=2018-04-01 / is_current=false
[3] career: 001 / PMM / started=2020-04-01 / is_current=false
```
→ `buildTimeline` のソート設計の問題。`is_current DESC → started_at DESC` の解釈に
何らかの不整合がある。

**パターンC：MergedTimeline が呼ばれていない、または PMM がそもそも入っていない**
→ データ取得側の問題。

---

## 出力フォーマット

```
# 出戻りバグ原因調査結果

## タスク1: /u/[id] と /mypage の実機確認

- /u/[id] で 003 が1グループに統合されているか: YES / NO
- /u/[id] で在籍期間が8年2ヶ月など PMM 期間を含む値になっているか: YES / NO
- /mypage で同じ症状: YES / NO

## タスク2: console.log 出力

<DevTools Console から全文コピー>

## タスク3: パターン判定

該当するパターン: A / B / C
判定の根拠: <タスク2の出力から読み取れる事実>

## 推測される根本原因

<タスク1〜3を総合した原因の見立て>

## 次の対応案（実装はしない、提案のみ）

<パターンに応じた修正方針>
```

---

## 注意事項

- **タスク2のデバッグコードは、調査後に必ず削除すること**（push してはいけない）
- 本番に影響しないよう、ローカル dev でのみ確認
- 実装・修正は一切しない、調査結果のみ報告
- もしタスク1の時点で「/u/[id] では問題が出ない」が確定したら、タスク2・3はスキップして報告
  （その場合は `/profile/edit` の `groupStints()` 側のバグであり、今日の実装とは無関係）
