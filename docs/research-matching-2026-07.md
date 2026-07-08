# matching.ts 調査レポート（2026-07）

> 変更なし・調査のみ

---

## 1. ファイル構造と責務

### `src/lib/matching.ts`（159行）

**宣言している関数:** `generateMatchReasons(profile, job): MatchReason[]`

**入力:**
```ts
profile: { tools?, skills?, desired_work_style?, desired_salary_min?, desired_salary_max?, desired_phase?, job_type? }
job:     { salary_min?, salary_max?, work_style?, matching_tags?, company_phase? }
```

**出力:** `MatchReason[]`（`{ text: string; score: number }` 最大4件、score降順）

**マッチング軸（5つ）:**
| # | 軸 | ロジック | スコア |
|---|---|---------|-------|
| 1 | ツール/スキル | `profile.tools + skills` ∩ `job.matching_tags.tag_value` 部分一致 | 0.9 |
| 2 | 勤務形態 | `profile.desired_work_style` → `WORK_STYLE_MAP` → `job.work_style` 包含チェック | 0.85 |
| 3 | 希望年収 | `profile.desired_salary_min <= job.salary_max` | 0.8 |
| 4 | フェーズ | `profile.desired_phase[]` → `PHASE_MAP` → `job.matching_tags` 包含チェック | 0.75 |
| 5 | 職種 | `profile.job_type.toLowerCase().includes(key)` → `JOB_TYPE_REASONS[key]` → `job.matching_tags` | 0.7 |

---

## 2. 空振りの実態

### ■ 発見1: `generateMatchReasons` は呼び出し元がゼロ（dead code）

```
grep -rn "generateMatchReasons" src/  → 定義のみ1件、呼び出し0件
```

**`matching.ts` の関数は本番コードのどこからも呼ばれていない。**
JOB_TYPE_REASONS の不一致問題は、ユーザーに一切影響を与えていない。

---

### ■ 発見2: 本番で使われているマッチング理由ロジックは別ファイル

| ファイル | 関数 | 用途 |
|---------|------|------|
| `src/lib/utils/matchReason.ts` | `getMatchReason(job, score)` | 求人タイトル/カテゴリ→固定テキスト生成 |
| `src/app/api/cron/weekly-match/route.ts` | `getDefaultReason(job)` | メール送信時の最終フォールバック |

`getMatchReason` も **呼び出し元0件**（定義だけ存在、インポートなし）。

---

### ■ 実際のマッチング理由フロー（本番）

```
weekly-match cron 実行
  ├─ ow_match_scores テーブルから match_reasons[] を取得
  │    └─ 現在0件（テーブルは存在するが空）
  └─ match_reasons がなければ getDefaultReason(job) を使用
       └─ job_category に "営業" / "カスタマーサクセス" / "マーケ" が含まれるかで
          固定テキストを返す（含まれなければ "あなたのスキルセットにマッチする求人です"）
```

`ow_match_scores` テーブルは0件。つまり**常にフォールバックの固定テキストが使われる**。

---

### ■ JOB_TYPE_REASONS の空振り分析（参考: dead codeの分析）

`matching.ts` の軸5（職種マッチ）のロジック:
```js
const typeKey = profile.job_type.toLowerCase();
// typeKey例: "フィールドセールス", "カスタマーサクセス", "エンジニア"

for (const [key, mappings] of Object.entries(JOB_TYPE_REASONS)) {
  if (typeKey.includes(key)) { ... }
}
// JOB_TYPE_REASONS のキー: "cs", "sales", "marketing", "bizdev"
```

| 職種（profile.job_type） | toLowerCase後 | "cs"を含む | "sales"を含む | "marketing"を含む | "bizdev"を含む |
|------------------------|-------------|-----------|------------|----------------|-------------|
| カスタマーサクセス | カスタマーサクセス | ❌ | ❌ | ❌ | ❌ |
| フィールドセールス | フィールドセールス | ❌ | ❌ | ❌ | ❌ |
| マーケティング | マーケティング | ❌ | ❌ | ❌ | ❌ |
| 事業開発・BizDev | 事業開発・bizdev | ❌ | ❌ | ❌ | ✅（"bizdev"を含む） |
| 事業開発 | 事業開発 | ❌ | ❌ | ❌ | ❌ |
| エンジニア | エンジニア | ❌ | ❌ | ❌ | ❌ |

**結論: "事業開発・BizDev" でのみ偶然ヒットする。他17職種すべて空振り。**
ただし dead code なので実害なし。

---

## 3. ユーザーへの影響

| 影響箇所 | 深刻度 | 実態 |
|---------|-------|------|
| マッチング推奨理由テキスト | **影響なし** | `generateMatchReasons` は呼ばれていない |
| マッチングスコア本体 | **影響なし** | スコア計算は `ow_match_scores` テーブル依存（現在0件） |
| 週次メール（weekly-match） | **軽微** | 常に `getDefaultReason` の固定文言が表示される（パーソナライズなし） |
| /biz/candidates のマッチ表示 | **影響なし** | `MatchCandidates` コンポーネントはモックデータ参照中 |

**現時点でマッチング機能は「スコア計算なし・固定テキスト返し」の状態。**
ユーザー影響が出るのは `ow_match_scores` に実データが入り始めてから。

---

## 4. コードの整理状況（現状）

```
src/lib/matching.ts            ← 完全dead code（呼び出し元なし）
src/lib/utils/matchReason.ts   ← dead code（呼び出し元なし）
src/app/api/cron/weekly-match  ← 唯一の本番使用箇所（getDefaultReason をローカル定義）
```

3つのマッチング理由ロジックが分散しており、どれが「正」か不明な状態。

---

## 5. 修正方針の提案（実装しない）

### 方針A: dead codeを削除してシンプルに（推奨・低リスク）

`matching.ts` と `matchReason.ts` を削除。weekly-match cron の `getDefaultReason` を
`src/lib/utils/matchReason.ts` に移してインポートする形に整理。

**影響範囲:** 2ファイル削除、1ファイル修正。既存動作に変化なし。  
**リスク:** 低（dead codeの削除のみ）

---

### 方針B: JOB_TYPE_REASONS を日本語キーに修正して `generateMatchReasons` を活性化

英字キー（"cs", "sales"）→ 日本語値（"カスタマーサクセス", "フィールドセールス"）に変更:

```js
const JOB_TYPE_REASONS: Record<string, Record<string, string>> = {
  "カスタマーサクセス": { CS経験: "カスタマーサクセス経験が活かせる" },
  "フィールドセールス": { SaaS営業経験: "SaaS営業経験が活かせる" },
  "インサイドセールス": { SaaS営業経験: "SaaS営業経験が活かせる" },
  "マーケティング":    { マーケティング経験: "マーケティング経験が活かせる" },
  "事業開発":         { SaaS営業経験: "事業開発の経験が活かせる" },
};
```

さらに `generateMatchReasons` を実際に呼び出す箇所（求人詳細ページ等）を実装する必要がある。

**影響範囲:** `matching.ts` + 呼び出し箇所の追加実装  
**リスク:** 中（新規機能の追加。`ow_match_scores` の設計とも整合が必要）

---

### 推奨順序

1. **今すぐ:** 方針A（dead code削除）でコードをクリーンに
2. **実ユーザーが増えてから:** `ow_match_scores` の入力パイプラインを設計→方針Bのマッチングロジックを活性化

---

## 付録: 関連ファイルマップ

| ファイル | 行数 | 状態 |
|---------|------|------|
| `src/lib/matching.ts` | 159 | dead code（削除候補） |
| `src/lib/utils/matchReason.ts` | 131 | dead code（削除候補） |
| `src/app/api/cron/weekly-match/route.ts` | ~160 | 唯一稼働中（getDefaultReason をローカル定義） |
| `src/components/business/MatchCandidates.tsx` | — | モックデータ参照中 |
| `ow_match_scores`（DB） | 0件 | テーブル存在・データなし |
