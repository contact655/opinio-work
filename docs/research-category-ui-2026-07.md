# /profile/edit と /biz/candidates の職種選択 カテゴリUI化 調査レポート（2026-07）

> 変更なし・調査のみ

---

## 1. /profile/edit の職種選択 — 現状

### UIパターン

`<select>` 単体（フラットリスト）。`JOB_TYPES.map()` で全25値を option として並べている。

```typescript
// ProfileEditClient.tsx:3804
<select
  id="pe-job-type"
  value={prefJobType}
  onChange={async (e) => {
    setPrefJobType(e.target.value);
    await savePreferences({ job_type: e.target.value || null });
  }}
  style={selectStyle()}
>
  <option value="">未設定</option>
  {JOB_TYPES.map((jt) => (
    <option key={jt} value={jt}>{jt}</option>
  ))}
</select>
```

### 選択形式

**単一選択**。`prefJobType: string`（空文字＝未設定）。

### 保存フロー

```
onChange → setPrefJobType(value) → savePreferences({ job_type: value || null })
         → PUT /api/jobseeker/career-preferences
         → ow_profiles.job_type TEXT（日本語文字列のまま保存）
```

`savePreferences` は ProfileEditClient 内のコールバック。変更即時 PUT（debounce なし）。
値は DB に日本語文字列そのまま入る（"フィールドセールス"等）。

### SDR/BDR の現状表示

`JOB_TYPES.map()` で `{jt}` をそのままラベルにしているため、補足なしの素の `"SDR"`, `"BDR"` が表示される。
`JOB_TYPE_DISPLAY_LABELS` は参照されていない。

### UIを変えても保存ロジックを変えずに済むか

**Yes**。`onChange` で `savePreferences({ job_type: e.target.value || null })` を呼んでいるだけ。
UI（`<select>` vs カスタムコンポーネント）を変えても、最終的に `savePreferences` に渡す値が
`JOB_TYPES` 内の文字列である限り、保存ロジックは一切変更不要。

### SDR/BDR の補足ラベルへの対応

`JOB_TYPE_DISPLAY_LABELS[jt] ?? jt` のパターンをオプションのラベルに使うだけ。
`value` 属性は `jt`（DB保存値）のまま変えない。DB保存値には影響ゼロ。

---

## 2. /biz/candidates の職種フィルタ — 現状

### UIパターン

`<select>` 単体（フラットリスト）。`JOB_TYPE_OPTIONS = [...JOB_TYPES]` でコピーして全値を option に並べている。

```typescript
// CandidatesClient.tsx:141
<select
  id="candidates-job-type"
  value={jobType}
  aria-label="職種で絞り込み"
  onChange={(e) => setJobType(e.target.value)}
>
  <option value="">職種（全て）</option>
  {JOB_TYPE_OPTIONS.map((v) => (
    <option key={v} value={v}>{v}</option>
  ))}
</select>
```

### 選択形式

**単一選択のみ**。`jobType: string`（空文字＝フィルタなし）。複数選択の仕組みは現状ない。

### フィルタロジック

```typescript
// CandidatesClient.tsx:76
if (jobType) list = list.filter((c) => c.jobType === jobType);
```

- **完全一致（===）** のみ。`"SDR"` を選ぶと `c.jobType === "SDR"` のユーザーだけ表示。
- カテゴリ単位（「セールス系すべて」）の絞り込みは現状不可。
- フィルタリングは**クライアントサイド**。全候補者をサーバーから受け取り、state で絞る設計。

### active フィルタカウント

```typescript
const activeFilterCount = [workStyle, jobType, phase, transferTiming].filter(Boolean).length;
```

`jobType` は1つの string フィールドとして他フィルタと並置されている。

### SDR/BDR の現状

`{v}` がそのままラベルになるため補足なし。保存値と表示値が一致（"SDR" → "SDR"）。

---

## 3. 各画面に最適なUIパターンの提案

### 3-1. /profile/edit（単一選択）— 2案比較

#### 案A: `<optgroup>` でカテゴリ見出し付きセレクト（軽量案）

```tsx
<select value={prefJobType} onChange={...}>
  <option value="">未設定</option>
  {JOB_TYPE_CATEGORIES.map((cat) => (
    <optgroup key={cat.key} label={`${cat.emoji} ${cat.label}`}>
      {cat.types.map((jt) => (
        <option key={jt} value={jt}>
          {JOB_TYPE_DISPLAY_LABELS[jt] ?? jt}
        </option>
      ))}
    </optgroup>
  ))}
</select>
```

**変更量**: 10行程度（`<select>` の内容だけ変更）。  
**メリット**: 既存の `onChange` / `savePreferences` 呼び出しを一切変えない。ブラウザネイティブのセレクトがそのまま使える。  
**デメリット**: optgroup のスタイルはブラウザ依存で見た目をコントロールしにくい。
モバイルではネイティブピッカーが開く（OS依存のUI）。

**legacy 値の扱い**: `JOB_TYPE_CATEGORIES.types` に含まれない3値（エンジニア・インサイドセールス・事業開発・BizDev）を既存 DB 値として持つユーザーの表示が問題になる。
→ select の初期値が categories に存在しない値の場合、`<optgroup>` に含まれないため選択中と表示されても選択リストに見えない（`<option>` が存在しない）。
→ 対処: 末尾に非表示 `<optgroup label="旧職種">` を入れるか、`prefJobType` が `categories` に含まれない場合だけフォールバック option を出す。

#### 案B: オンボーディングと同じ2段階インラインUI（フル案）

カテゴリ7ボタン → 職種N ボタンのカード選択を `/profile/edit` の希望条件タブにインライン埋め込み。

**変更量**: 
- オンボーディングの実装コード（約80行）をコンポーネントとして切り出し（`JobTypePicker.tsx` 等）
- `prefJobType` state との連携（選んだ値を `savePreferences` に渡す）
- 「未設定に戻す」クリアボタンの追加

**メリット**: 全画面でUIが統一される（オンボ・profile 同じ操作感）。SDR/BDRの補足ラベルも自然に入る。  
**デメリット**: 実装コスト大。現在の画面はコンパクトな `<select>` が占めるだけのスペースに、9〜14個のボタングリッドが展開される（スクロールが増える）。プロフィール編集はページが長く既にスクロール多い。

#### 推奨

**案A（optgroup）を推奨**。

- `/profile/edit` は入力フィールドが多く、職種だけをフルピッカー化する必要性が低い
- ユーザーは「変更したい」時に使うセクションであり、オンボーディングほど「初めて選ぶ」インパクトは不要
- `<optgroup>` でカテゴリ構造を視認でき、SDR/BDR の補足ラベルも option の中で表示できる
- 実装コスト: 1ファイル・10行前後

legacy 値対処は以下で十分:

```tsx
<option value="">未設定</option>
{/* カテゴリには含まれないが DB に存在しうる legacy 値 */}
{!JOB_TYPE_CATEGORIES.flatMap(c => c.types).includes(prefJobType as never) && prefJobType && (
  <option value={prefJobType}>{prefJobType}</option>
)}
{JOB_TYPE_CATEGORIES.map((cat) => (
  <optgroup key={cat.key} label={`${cat.emoji} ${cat.label}`}>
    ...
  </optgroup>
))}
```

---

### 3-2. /biz/candidates（絞り込みフィルタ）— 3案比較

#### 案A: `<optgroup>` 付き `<select>`（現状の最小変更）

```tsx
<select value={jobType} onChange={(e) => setJobType(e.target.value)}>
  <option value="">職種（全て）</option>
  {JOB_TYPE_CATEGORIES.map((cat) => (
    <optgroup label={`${cat.emoji} ${cat.label}`}>
      {cat.types.map((jt) => (
        <option key={jt} value={jt}>{JOB_TYPE_DISPLAY_LABELS[jt] ?? jt}</option>
      ))}
    </optgroup>
  ))}
</select>
```

フィルタロジックは `c.jobType === jobType`（完全一致）のまま変えない。  
**デメリット**: カテゴリ単位での絞り込みができない。「セールス・CS の候補者を全員見たい」という使い方は引き続き不可。

#### 案B: カテゴリ chip → 配下職種 chip（2段構成）

カテゴリを横並びの chip で選択 → 選択中カテゴリの配下職種が展開表示される。

```
[セールス・CS ✓] [エンジニア] [プロダクト] ...
  ↓ カテゴリ選択後に展開
  [フィールドセールス] [SDR（新規開拓）] [BDR（戦略的開拓）] ...
```

**状態**: `selectedCategory: string | null` + `selectedJobType: string | null`  
フィルタロジック:
- カテゴリのみ選択 → `categories.find(c => c.key === cat).types` にカバーされる職種すべてにマッチ
- 職種まで選択 → 現状同様の完全一致

**メリット**: カテゴリ単位の広い絞り込みと職種単位の精密な絞り込みを使い分けられる。SDR/BDR の補足ラベルを chip 上で表示できる。  
**デメリット**: 実装コスト中。UI のスペースを縦に使う。フィルタロジックが2分岐になる（カテゴリマッチ vs 職種完全一致）。

#### 案C: チェックボックス付きドロップダウン（複数選択）

jobType を配列で持ち `c.jobType === いずれかの値` で OR フィルタ。  
カテゴリ見出し下にチェックボックスを並べる。

**状態**: `jobTypes: string[]`（現在の `jobType: string` を変更）  
フィルタロジック変更: `c.jobType === jobType` → `jobTypes.length === 0 || jobTypes.includes(c.jobType ?? "")`

**デメリット**: 最も実装コストが高い。`activeFilterCount` の計算も変わる。現在の UIバーの幅も変わる。

#### 推奨

**案B（カテゴリ chip → 職種 chip の2段構成）を推奨**。

- 候補者数が少ない（数百人規模）ためクライアントサイドで問題なし
- カテゴリ単位での絞り込みが実際のユースケースに合う（「エンジニア系の候補者を見たい」）
- 既存の `workStyle`・`phase`・`transferTiming` フィルタとの並置で一貫した UX
- SDR/BDR の補足ラベルを chip ラベルに使える

フィルタロジックの変更範囲:

```typescript
// 現状
if (jobType) list = list.filter((c) => c.jobType === jobType);

// 案B（カテゴリ選択 or 職種選択）
const selectedCategory = JOB_TYPE_CATEGORIES.find(cat => cat.key === jobCategoryKey);
if (selectedJobType) {
  // 職種まで絞り込み済み: 完全一致（現状と同じ）
  list = list.filter((c) => c.jobType === selectedJobType);
} else if (selectedCategory) {
  // カテゴリのみ選択: カテゴリに属する全職種にマッチ
  const typesInCategory = selectedCategory.types as readonly string[];
  list = list.filter((c) => c.jobType && typesInCategory.includes(c.jobType));
}
```

---

## 4. 保存値・フィルタ値への影響

### /profile/edit の保存値

- `savePreferences({ job_type: value || null })` の `value` は `JOB_TYPES` 内の文字列または空文字（→ null）
- UIを `<optgroup>` に変えても `<option value={jt}>` の value は変わらない
- **DBへの影響: ゼロ**

### /biz/candidates のフィルタ値

- 案Bでは `jobCategoryKey` と `selectedJobType` の2つの state を管理
- 最終的にフィルタするのは `c.jobType`（`ow_profiles.job_type` = 日本語文字列）に対する includes または ===
- DB クエリへの変更はなし（全件クライアントフェッチのまま）
- **legacy 値（インサイドセールス・エンジニア・事業開発・BizDev）はカテゴリに含まれない**
  → カテゴリ選択では legacy 値ユーザーがフィルタから漏れる
  → 対処: 「その他」カテゴリに legacy 値を含めるか、カテゴリ未分類ユーザーを別セクションで表示するか
  → 最も簡単: legacy 3値を「その他」カテゴリの `types` に追加する（`JOB_TYPE_CATEGORIES` の `other` を拡張）

```typescript
// 現状
{ key: "other", label: "その他", emoji: "🔖", types: ["その他"] },

// legacy 込み（案）
{ key: "other", label: "その他", emoji: "🔖",
  types: ["その他", "エンジニア", "インサイドセールス", "事業開発・BizDev"] },
```

これにより legacy 値ユーザーも「その他」カテゴリ選択時にヒットする。

---

## 5. 実装の分割案

### 2画面を別々のコミットにする（推奨）

| コミット | 内容 | 変更ファイル | 難易度 |
|---------|------|------------|-------|
| ① | `/profile/edit` の `<select>` を `<optgroup>` 化 | `ProfileEditClient.tsx` のみ | ⭐ 低 |
| ② | `/biz/candidates` の職種フィルタを2段構成（案B）に変更 | `CandidatesClient.tsx` のみ | ⭐⭐ 中 |

**理由でまとめない**: 2画面は用途が異なる（単一選択 vs 絞り込み）。
独立して動作確認できる方が安全。片方を先に出してフィードバックを得てから次に進める柔軟性が生まれる。

### コミット順序の推奨

1. ① を先に（ProfileEditClient はファイルが大きいが変更行が少なく低リスク）
2. ② は案Bの state 設計を固めてから（カテゴリ→職種の2段状態は少し設計が必要）

---

## 6. 想定リスク

| リスク | 内容 | 影響 | 対処 |
|-------|------|------|------|
| **legacy 値が optgroup に未収録** | ProfileEditClient で既存ユーザーが "インサイドセールス" 等を持つと選択肢に表示されない | 低（DB値は残る。次回保存で上書きされる危険があるが自発的操作が必要） | フォールバック `<option>` を出す |
| **カテゴリフィルタが legacy 値をヒットしない** | CandidatesClient でカテゴリ選択時に "インサイドセールス" ユーザーが漏れる | 低（現実ユーザーが少ない。DB調査で "バックエンド" "フィールドセールス" "インサイドセールス" のみ確認済み）| `JOB_TYPE_CATEGORIES.other.types` に追加 |
| **SDR/BDR 補足ラベルと検索バーの不一致** | CandidatesClient の自由検索テキスト `q` は candidate の `jobType` フィールド（"SDR"）とマッチするが、チップ表示は "SDR（新規開拓）" | 軽微 | 自由検索の対象は変えない（`c.jobType` を検索対象にしている現状のまま） |
| **`activeFilterCount` の計算** | 案Bでカテゴリ+職種の2 state になると既存の `[workStyle, jobType, ...]` に変更が必要 | 軽微 | 新 state を適切にカウントに含める |
| **`as const` 型エラー** | `JOB_TYPE_CATEGORIES[n].types.includes()` が `readonly string[]` 型で `string` パラメータに型エラーが出る可能性 | ビルドエラー | `typesInCategory.includes(c.jobType)` → `(typesInCategory as readonly string[]).includes(c.jobType)` |

---

## 付録: 関連ファイル一覧

| ファイル | 関連箇所 | 行数規模 |
|---------|---------|---------|
| `src/lib/constants/jobTypes.ts` | 定数定義（JOB_TYPE_CATEGORIES, JOB_TYPE_DISPLAY_LABELS） | 97行 |
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | L3803-3817（希望職種 `<select>`）| 4500行超 |
| `src/app/biz/candidates/CandidatesClient.tsx` | L59（jobType state）L76（filter logic）L141-157（select UI） | 350行 |
| `src/app/onboarding/OnboardingClient.tsx` | 2段階UI実装の参考（コンポーネント切り出し時） | 350行 |
