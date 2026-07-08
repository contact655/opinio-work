# オンボーディング P1 — 職種 2段階UI 設計調査（2026-07）

> 変更なし・調査のみ

---

## 1. 現状の職種選択（Step 1）実装

### 状態管理

```typescript
// OnboardingClient.tsx
const [step, setStep] = useState(0);          // 0=job_type, 1=experience_years, 2=worry
const [answers, setAnswers] = useState<Record<string, string>>({});  // key=step.id, value=選択文字列

function select(value: string) {
  setAnswers((prev) => ({ ...prev, [current.id]: value }));
  if (step < STEPS.length - 1) setStep((s) => s + 1);
  else {/* save & done */}
}
```

**重要:** `select()` は「即時選択→次ステップ」。確認ボタンなし。

### Step 1 の表示構造

```typescript
const STEPS = [
  { id: "job_type", question: "あなたの職種を教えてください", options: [...JOB_TYPES] },
  { id: "experience_years", ... },
  { id: "worry", ... },
];
```

- `options: [...JOB_TYPES]` = 20件をそのまま全列挙
- `current.id === "job_type"` の時だけ `gridTemplateColumns: "1fr 1fr"` (2列)
- カードのpadding: `32px 28px`、maxWidth: 480px
- 現状の見た目: 20ボタン × 2列 = 10行。スクロールが発生しうる

### DB保存先

```
ow_profiles.job_type TEXT  ← 日本語文字列そのまま（"フィールドセールス" 等）
```

**ID変換なし。P1実装後もこの保存方式は変えない。**

---

## 2. 20職種の全リスト（現状 `JOB_TYPES` の値と並び）

| # | 値（DB保存値） | コメント内カテゴリ |
|---|--------------|----------------|
| 1 | 経営・CxO | ビジネス |
| 2 | 事業開発 | ビジネス |
| 3 | フィールドセールス | ビジネス |
| 4 | インサイドセールス | ビジネス |
| 5 | カスタマーサクセス | ビジネス |
| 6 | マーケティング | ビジネス |
| 7 | コーポレート | ビジネス |
| 8 | プロダクトマネージャー | プロダクト・デザイン |
| 9 | デザイナー | プロダクト・デザイン |
| 10 | データサイエンティスト | プロダクト・デザイン |
| 11 | エンジニア | エンジニアリング |
| 12 | バックエンド | エンジニアリング |
| 13 | フロントエンド | エンジニアリング |
| 14 | フルスタック | エンジニアリング |
| 15 | SRE/インフラ | エンジニアリング |
| 16 | iOS/Android | エンジニアリング |
| 17 | 事業開発・BizDev | legacy |
| 18 | HR・人事 | legacy |
| 19 | 財務・経理 | legacy |
| 20 | その他 | legacy |

---

## 3. 推奨カテゴリ設計（6カテゴリ案）

IT/SaaS 求職者の自己認識に合わせた区分。

| カテゴリ名 | 絵文字 | 含む職種（サブ選択肢） | 件数 |
|-----------|-------|---------------------|-----|
| エンジニアリング | 💻 | エンジニア / バックエンド / フロントエンド / フルスタック / SRE・インフラ / iOS・Android | 6 |
| プロダクト・デザイン | 🎨 | プロダクトマネージャー / デザイナー / データサイエンティスト | 3 |
| セールス・CS | 📞 | フィールドセールス / インサイドセールス / カスタマーサクセス | 3 |
| マーケ・コーポレート | 📊 | マーケティング / コーポレート / HR・人事 / 財務・経理 / 事業開発・BizDev | 5 |
| 経営・事業開発 | 🏢 | 経営・CxO / 事業開発 | 2 |
| その他 | 🔖 | その他 | 1 |

**合計: 20職種（全値をカバー）**

### カテゴリ表示順の考え方

「セールス・CS」をエンジニアより上に置かない理由:
- ターゲットユーザーの職種分布はエンジニア > セールスが多い傾向
- ただし SaaS 業界は「ビジネス職」も多いため、エンジニア → プロダクト → セールス の順が自然

---

## 4. 2段階UI の状態管理設計

### 追加する state（OnboardingClient.tsx内）

```typescript
// Step 1 専用の中間state — 他ステップには影響なし
const [jobTypeCategory, setJobTypeCategory] = useState<string | null>(null);
```

`answers` の構造・保存値・`step` のインクリメントロジックは **一切変えない**。

### フロー

```
step=0 かつ jobTypeCategory=null
  → カテゴリ選択グリッド（6ボタン、1列 or 2列）を表示
  → クリック: setJobTypeCategory(カテゴリ名)

step=0 かつ jobTypeCategory="エンジニアリング"
  → サブ職種グリッド（最大6ボタン、2列）を表示
  → 上部に「← カテゴリを変更」ボタン（setJobTypeCategory(null) で戻る）
  → クリック: select(職種値) → answers["job_type"]="バックエンド", step=1 へ

step=1, step=2 → 従来と同じ
```

### "戻る" との整合

既存の `step > 0` → 「前に戻る」ボタンで `setStep(s => s - 1)` のロジックに対して:
- step=0 かつ jobTypeCategory != null の時: 「← カテゴリを変更」= `setJobTypeCategory(null)`
- step=0 かつ jobTypeCategory == null の時: 「前に戻る」ボタンは非表示（変わらず）

`step > 0` での「前に戻る」は既存のまま。step=1 から戻った時は step=0 で
`jobTypeCategory` はリセット **しない**（前回選んだカテゴリが残り使いやすい）か、
リセット **する**（再度カテゴリから選ぶ。一貫性高い）かは実装時の判断。

**推奨: リセットする**（step が戻ったら `setJobTypeCategory(null)` も実行）

---

## 5. カテゴリ→職種マッピングの定義場所

### 案A: `jobTypes.ts` に追加（推奨）

```typescript
// src/lib/constants/jobTypes.ts に追加

export const JOB_TYPE_CATEGORIES = [
  {
    key: "engineering",
    label: "エンジニアリング",
    emoji: "💻",
    types: ["エンジニア", "バックエンド", "フロントエンド", "フルスタック", "SRE/インフラ", "iOS/Android"],
  },
  {
    key: "product",
    label: "プロダクト・デザイン",
    emoji: "🎨",
    types: ["プロダクトマネージャー", "デザイナー", "データサイエンティスト"],
  },
  {
    key: "sales",
    label: "セールス・CS",
    emoji: "📞",
    types: ["フィールドセールス", "インサイドセールス", "カスタマーサクセス"],
  },
  {
    key: "marketing",
    label: "マーケ・コーポレート",
    emoji: "📊",
    types: ["マーケティング", "コーポレート", "HR・人事", "財務・経理", "事業開発・BizDev"],
  },
  {
    key: "management",
    label: "経営・事業開発",
    emoji: "🏢",
    types: ["経営・CxO", "事業開発"],
  },
  {
    key: "other",
    label: "その他",
    emoji: "🔖",
    types: ["その他"],
  },
] as const;

export type JobTypeCategory = (typeof JOB_TYPE_CATEGORIES)[number]["key"];
```

**理由:** JOB_TYPES と同じファイルで管理する方が整合維持が容易。将来 `/biz/candidates` フィルターや `/profile/edit` でも使うため共通定数として置く価値がある。

### 案B: `OnboardingClient.tsx` 内にインライン定義

- 利点: ファイルを跨がない
- 欠点: `/profile/edit` や `/biz/candidates` で使いたくなった時に重複が発生する

→ **案A を推奨**

---

## 6. UIレイアウト案

### カテゴリ選択（stage A）

- グリッド: `1fr 1fr` 2列（現状の job_type 2列と同じ）
- ボタン内: 上段に絵文字（24px）、下段にカテゴリ名（14px bold）
- 高さ: `80px`（絵文字+テキスト分）
- 6ボタンで縦3行 → 現状20ボタン10行より大幅にスクロール減少

```
┌──────────────┬──────────────┐
│  💻           │  🎨           │
│ エンジニア    │ プロダクト    │
│ リング        │ ・デザイン   │
├──────────────┼──────────────┤
│  📞           │  📊           │
│ セールス・CS  │ マーケ・      │
│              │ コーポレート  │
├──────────────┼──────────────┤
│  🏢           │  🔖           │
│ 経営・        │ その他        │
│ 事業開発     │              │
└──────────────┴──────────────┘
```

### サブ職種選択（stage B）

- ヘッダーに「← カテゴリを変更」ボタン（小さめ、var(--ink-mute) テキスト）+ カテゴリ名
- サブ職種は既存の 1列 or 2列グリッド（`1fr 1fr`）
- 最大6ボタン（エンジニアリング）→ 3行で収まる

```
← カテゴリを変更    💻 エンジニアリング

┌──────────────┬──────────────┐
│ エンジニア   │ バックエンド  │
├──────────────┼──────────────┤
│ フロント     │ フルスタック  │
│ エンド       │              │
├──────────────┼──────────────┤
│ SRE/インフラ │ iOS/Android  │
└──────────────┴──────────────┘
```

---

## 7. Step ラベル表示

現状: `Step {step + 1} / {STEPS.length}` = "Step 1 / 3"

P1実装後の選択肢:
- **案A（推奨）**: "Step 1 / 3" のまま変えない（ユーザー体験上は1ステップが2段階になるだけ）
- 案B: カテゴリ選択を "Step 1a / 3"、サブ選択を "Step 1b / 3" と表示（複雑になるため非推奨）

---

## 8. 最初に行う変更（推奨実装順）

### Step 1: `jobTypes.ts` に `JOB_TYPE_CATEGORIES` を追加（ゼロリスク）

- ファイル変更: `src/lib/constants/jobTypes.ts` のみ
- UI変化なし、ビルド・実行に影響なし
- `JOB_TYPES` との整合確認: 20職種すべてがいずれかのカテゴリに含まれること

### Step 2: `OnboardingClient.tsx` の Step 1 を 2段階に変更

- `useState<string | null>(null)` を1つ追加
- Step 1 の JSX を条件分岐（category未選択 / 選択済み）に差し替え
- `select()` 関数の変更なし
- DB保存値の変更なし
- 他ステップへの影響なし

### Step 3: `/profile/edit` の職種セレクトも 2段階に更新（オプション・別PR）

- `ProfileEditClient.tsx` の `<select>` → 2段階 UI（または `<optgroup>` でのカテゴリ分け）
- `/biz/candidates` のフィルターも `JOB_TYPE_CATEGORIES` から生成

---

## 9. リスク評価

| 項目 | リスク | 理由 |
|------|-------|------|
| DB スキーマ変更 | **なし** | 保存値は日本語文字列のまま変わらない |
| 既存ユーザーの job_type 値 | **なし** | 20値とも引き続き有効な選択肢 |
| `select()` 関数 | **なし** | シグネチャも動作も変えない |
| `answers` 構造 | **なし** | key="job_type", value=職種文字列のまま |
| 他ステップへの影響 | **なし** | `step=0` の内部状態変化のみ |
| オンボーディングスキップ動作 | **なし** | `jobTypeCategory` は skip フロー非依存 |

**全体リスク: 低。UI の変更のみ。**

---

## 付録: 関連ファイル

| ファイル | 行数 | 用途 |
|---------|------|------|
| `src/lib/constants/jobTypes.ts` | 37 | JOB_TYPES 定数（変更候補: JOB_TYPE_CATEGORIES 追加） |
| `src/app/onboarding/OnboardingClient.tsx` | 472 | Step 1 実装（変更候補: 2段階化） |
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | 4000+ | 職種 `<select>`（後続で更新候補） |
| `src/app/biz/candidates/CandidatesClient.tsx` | — | 職種フィルター（後続で更新候補） |
