# ν-8 段階6-3-1.5 保存方式統一 — 調査メモ（2026-05-10）

## 目的

全タブを「明示保存」に統一するための設計判断資料。  
コードは一切変更しない。段階6-3-1.5 コミット B 以降の実装指針として使用する。

---

## 1. 全タブの現状保存方式

### タブ別マトリクス

| # | タブ | 保存方式 | トリガー | API エンドポイント | 楽観的UI |
|---|------|---------|---------|-------------------|---------|
| 1 | **基本情報** | 自動保存（debounce 700ms） | `onChange` → `patchBasicInfo` → `useDebouncedPatch` | `PUT /api/jobseeker/profile` | なし |
| 2 | **職歴・学歴** | 明示保存 | 保存ボタン押下 | `/api/jobseeker/educations`, CareerHistoryEditor 内 | なし |
| 3 | **スキル** | 特殊（Enter/カンマ即時確定） | キーダウン or 「+タグを追加」ボタン | `POST /api/jobseeker/skill-tags`, `DELETE /api/jobseeker/skill-tags/[id]` | あり（tempId チップ → 確定後置換） |
| 4 | **資格** | 特殊（2段階） | 新規: 「+追加」ボタン押下で即POST / 既存: `onBlur` | `POST/PUT/DELETE /api/jobseeker/certifications/[id]` | なし |
| 5 | **実績・受賞** | 明示保存 | 保存ボタン押下 | `POST/PUT/DELETE /api/jobseeker/achievements`, `/awards`, `/media-appearances` | なし |
| 6 | **SNS** | 自動保存（debounce 700ms） | `onChange` → `patchSocialLinks` → `useDebouncedPatch` | `PUT /api/jobseeker/profile`（`social_links` フィールド） | なし |
| 7 | **アカウント設定** | 自動保存（独自 debounce 700ms） | `onChange` → `patchSettings` → `triggerSave` | `PUT /api/jobseeker/profile`（`visibility` フィールド） | なし |

### 詳細: 自動保存の発火箇所

#### 基本情報タブ（最も複雑）

```typescript
// useDebouncedPatch フック（src/lib/hooks/useDebouncedPatch.ts）
// 複数フィールドの変更を pendingRef に蓄積 → 700ms で PUT
const { patch: patchBasic, status: basicSaveStatus } = useDebouncedPatch({
  endpoint: "/api/jobseeker/profile",
});

// patchBasicInfo: onChange から呼ばれる
const patchBasicInfo = useCallback((fieldPatch: Partial<BasicInfo>) => {
  setBasicInfo(...);          // state 更新
  patchBasic(dbPatch);        // debounce 開始/リセット
}, [patchBasic]);
```

発火フィールド:
- `name` → `onChange`
- `location` → `onChange`（select）
- `birth_date` → 年/月/日の各 `onChange`
- `about_me` → TextareaField の `onChange`
- `future_aspirations` → TextareaField の `onChange`

#### SNS タブ

```typescript
const patchSocialLinks = useCallback((fieldPatch: Partial<SocialLinks>) => {
  socialRef.current = { ...socialRef.current, ...fieldPatch };
  setSocialLinks({ ...socialRef.current });
  patchSocial({ social_links: socialRef.current });  // debounce
}, [patchSocial]);
```

全 SNS フィールドの `onChange` が `patchSocialLinks` を呼ぶ。  
`social_links` オブジェクト全体を毎回送信（partial patch ではなく全置換）。

#### アカウント設定タブ（独自実装）

```typescript
const triggerSave = useCallback(() => {
  setSaveStatus("saving");
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async () => {
    await fetch("/api/jobseeker/profile", {
      method: "PUT",
      body: JSON.stringify({ visibility: settingsRef.current.visibility }),
    }).catch(() => {});
    setSaveStatus("saved");
  }, 700);
}, []);
```

発火フィールド: `visibility`（select の onChange）  
※ `avatar_color`・`cover_color` は `patchSettings` 経由だが、現状 PUT body に送るのは `visibility` のみ。

#### 資格タブ（特殊な2段階）

```typescript
// 新規追加: 「+追加」ボタンで即座に "資格名を入力" という仮名で POST
const handleAdd = async () => {
  await fetch("/api/jobseeker/certifications", {
    method: "POST",
    body: JSON.stringify({ name: "資格名を入力" }),  // 即時POST
  });
};

// 既存編集: input の onBlur で PUT
function CertificationCardEditor({ cert, ... }) {
  const [localName, setLocalName] = useState(cert.name);
  const saveName = useCallback(async (name: string) => {
    await fetch(`/api/jobseeker/certifications/${cert.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: trimmed }),
    });
  }, [cert.id, onUpdate]);

  return <input onChange={setLocalName} onBlur={() => saveName(localName)} />;
}
```

---

## 2. 自動保存撤去の影響範囲

### 影響を受けるタブと変更量の見積もり

| タブ | 撤去対象 | 変更量 | 難易度 |
|------|---------|--------|--------|
| 基本情報 | `useDebouncedPatch` × 1、`patchBasicInfo`、`handleBirthDateChange`、`basicInfoRef` | 大（フォーム全体の state 設計変更） | ★★★ |
| SNS | `useDebouncedPatch` × 1、`patchSocialLinks`、`socialRef` | 中（SocialLinksEditor に保存/キャンセルを追加） | ★★ |
| アカウント設定 | `triggerSave`、`patchSettings`、`settingsRef`、`saveTimer` | 中（visibility のみなので比較的シンプル） | ★★ |
| 資格 | `onBlur` 保存 → 明示保存へ変更、新規追加の2段階フロー → AchievementEditor 方式へ | 大（カード設計の全面見直し） | ★★★ |
| スキル | Enter/カンマキーは「確定」として維持可能（実績とは性質が異なる） | 小〜中（要議論） | ★ |

### `/api/jobseeker/profile` の影響範囲

現在3箇所から同一エンドポイントを叩いている:
1. 基本情報: `name`, `location`, `birth_date`, `about_me`, `future_aspirations`
2. SNS: `social_links`
3. アカウント設定: `visibility`, (avatar/cover color)

明示保存後も API ルートは変更不要。`PUT /api/jobseeker/profile` はホワイトリスト方式で許可フィールドのみ更新する設計になっているため、タブごとに別々に送信しても安全。

### 「タブ移動時の未保存警告」の現状

**現状: なし。** どのタブも未保存状態でタブ移動しても警告は出ない。  
自動保存タブは移動後も debounce タイマーが走り続けて保存される（React コンポーネントがアンマウントされても `setTimeout` は生きている）。

明示保存統一後はタブ移動時の警告 or ドラフト保持が必要になる（後述 §5 参照）。

---

## 3. 明示保存パターン（参考実装: 実績・受賞タブ）

AchievementEditor / AwardEditor / MediaAppearanceEditor の共通パターン:

### 3-1. 状態構造

```typescript
// 表示 state（DB 確定値）
const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);

// 編集モード state
const [editingId, setEditingId]  = useState<string | null>(null);  // null = 非編集モード
const [editDraft, setEditDraft]  = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
const [editSaving, setEditSaving] = useState(false);

// 新規追加 state
const [adding, setAdding]      = useState(false);
const [addDraft, setAddDraft]  = useState<AchievementDraft>(EMPTY_ACH_DRAFT);
const [addSaving, setAddSaving] = useState(false);
```

### 3-2. 保存ボタンの disabled 制御

```typescript
// AchievementForm の canSave 条件
const canSave = !!draft.title.trim() && !isSaving;

// ボタン
<button onClick={canSave ? onSave : undefined} disabled={!canSave}>
  {isSaving ? "保存中…" : "保存"}
</button>
```

現状は「タイトルが空でない」かつ「保存中でない」の2条件のみ。  
「変更がない場合は disabled」には**対応していない**（初期値との比較なし）。

### 3-3. キャンセルボタン

```typescript
// キャンセル: draft を EMPTY にリセット + 追加モードを閉じる
onCancel={() => { setAdding(false); setAddDraft(EMPTY_ACH_DRAFT); }}
// または編集モード終了
onCancel={() => { setEditingId(null); setEditDraft(EMPTY_ACH_DRAFT); }}
```

### 3-4. 保存成功時のトースト

```typescript
// コンポーネント内ローカル toast state
const [toastMsg,     setToastMsg]     = useState<string | null>(null);
const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

const showToast = useCallback((msg: string, variant = "default") => {
  setToastVariant(variant); setToastMsg(msg);
}, []);

// 保存成功後
showToast("実績を追加しました");

// 失敗後
showToast("追加に失敗しました。もう一度お試しください。", "error");

// JSX
{toastMsg && <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />}
```

---

## 4. 基本情報タブの新 UX 設計案

### 案 A: 全フィールドまとめて1つの「保存」ボタン

```
┌─────────────────────────────────┐
│ 基本情報                         │
│ 名前: [___________________]     │
│ 所在地: [___________________]   │
│ 生年月日: [年] [月] [日]         │
├─────────────────────────────────┤
│ 自己紹介                         │
│ [textarea]                      │
├─────────────────────────────────┤
│ やってみたいこと                   │
│ [textarea]                      │
└─────────────────────────────────┘

          [キャンセル] [保存]  ← ページ最下部に固定
```

**メリット:** 実装が最もシンプル。1回の PUT で全フィールドを送信。  
**デメリット:** 画面が長い場合、保存ボタンが遠い（スクロールが必要）。フィールドを1つ変更しただけでも「全フィールドを保存」という体験になる。

---

### 案 B: セクションごとに保存ボタン（現行 FormSection 単位）

```
┌─────────────────────────────────┐
│ 基本情報                         │
│ 名前: [___________________]     │
│ 所在地: [___________________]   │
│ 生年月日: [年] [月] [日]         │
│                  [キャンセル][保存]│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 自己紹介                         │
│ [textarea]                      │
│                  [キャンセル][保存]│
└─────────────────────────────────┘
```

**メリット:** 実装・受賞タブとの一貫性が高い。変更範囲が明確。  
**デメリット:** 3セクション × 2ボタン = 6ボタンが並ぶ。「名前だけ変えたら名前だけ保存」の粒度感がやや細かすぎる。セクションをまたぐデータの一貫性が保たれにくい（例：名前と生年月日をセットで変えたいのに別保存になる）。

---

### 案 C: 編集モード切り替え式（Wantedly 型）

```
┌─────────────────────────────────┐
│ 基本情報                   [編集]│  ← 表示モード
│ 名前: 田中 翔太                  │
│ 所在地: 東京都                   │
│ 生年月日: 1993年5月              │
└─────────────────────────────────┘

              ↓ [編集] クリック

┌─────────────────────────────────┐
│ 基本情報                         │  ← 編集モード（royal border）
│ 名前: [田中 翔太_____________]  │
│ 所在地: [東京都 ▼]              │
│ 生年月日: [1993] [5] [15 ▼]    │
│                  [キャンセル][保存]│
└─────────────────────────────────┘
```

**メリット:** Wantedly など主要プロダクトと同じ UX。「表示」「編集」の状態が明確で誤操作が少ない。保存ボタンが常に視界内に収まる。  
**デメリット:** 実装量が最大（表示用コンポーネント + 編集フォーム、state切り替え）。名前を1文字直すだけでも「編集モードに入る」という手間がある。

---

### ★ 推奨: 案 A（全フィールドまとめ保存）+ スティッキーボタン

**理由:**

1. **基本情報はフィールド間の関連が高い**（名前と生年月日は同じプロフィールの一部。セクション分離より一体感が自然）
2. **実装コストが最小**（案 C に比べて表示/編集モードの二重実装が不要）
3. **「変更あり」検知で disabled 制御**すれば「保存ボタンが点灯する=何か変更した」と伝わり、案 C と同等のフィードバックが得られる
4. **スティッキーフッターボタン**（`position: sticky; bottom: 0`）で長い画面でも保存ボタンを常時表示できる

#### 案 A 改 イメージ:

```
┌─────────────────────────────────┐
│ 基本情報                         │
│ 名前: [___________________]     │
│ 所在地: [___________________]   │
│ 生年月日: [年] [月] [日]         │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 自己紹介                         │
│ [textarea]                      │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ やってみたいこと                   │
│ [textarea]                      │
└─────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ← sticky footer
        [キャンセル]  [保存]  ← 変更なし時は disabled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

SNS タブ、アカウント設定タブも同様に案 A 改（全フィールドまとめ保存 + sticky footer）を採用。

---

## 5. 変更検知の実装パターン

### 案 A: JSON.stringify 比較

```typescript
const [draft, setDraft] = useState<BasicInfo>(initial);
const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
```

**メリット:** 実装が最もシンプル。ネスト構造にも対応。  
**デメリット:** キーの順序が変わると誤検知する（ただし基本情報は固定スキーマなので問題なし）。

---

### 案 B: react-hook-form の `formState.isDirty`

```typescript
const { register, formState: { isDirty }, handleSubmit, reset } = useForm({
  defaultValues: initial,
});
```

**メリット:** フィールドレベルの dirty 管理、バリデーション統合、`reset()` でキャンセル実装が容易。  
**デメリット:** react-hook-form の導入が必要（現状のプロジェクトでは未使用）。ProfileEditClient.tsx は手書き state で統一されており、ライブラリ混在は保守コストを上げる。

---

### 案 C: フィールドごとに dirty フラグ

```typescript
const [dirty, setDirty] = useState<Partial<Record<keyof BasicInfo, boolean>>>({});
const isDirty = Object.values(dirty).some(Boolean);

// onChange 時
onChange={(e) => { setDraft({...draft, name: e.target.value}); setDirty({...dirty, name: true}); }}
```

**メリット:** 変更されたフィールドのみ PUT できる（partial patch に自然に対応）。  
**デメリット:** state が増えて管理が煩雑。フィールド数が多い基本情報では特に冗長。

---

### ★ 推奨: 案 A（JSON.stringify 比較）

**理由:**

1. プロジェクトで react-hook-form を未使用（案 B は過剰）
2. 基本情報は固定スキーマ（キー順変化なし）なので JSON.stringify 比較で十分信頼できる
3. 実装コストが最小（1行の `isDirty` 計算）

#### キャンセル処理

```typescript
// キャンセル: draft を initial に戻す
const handleCancel = () => setDraft(initial);
```

`initial` は `page.tsx` から渡された server-fetched 値をコンポーネント初期化時に保持しておく。

---

## 6. 既知の制約・リスク

### 6-1. スキルタグの扱い

スキルタグは「Enter/カンマキーで即時確定」という UX が本質的価値（タグUIの標準パターン）。  
これを「保存ボタン押下」に変えると、`入力してEnter` → `保存ボタン押下` という二重操作になりUXが悪化する。

**判断: スキルタブは現状維持（Enter 即時確定）を推奨。**  
「明示保存統一」の例外として扱い、代わりに楽観的UIの精度を上げる（現状すでに実装済み）。

### 6-2. 資格タブの特殊パターン

現状: 「+追加」ボタンで即座に "資格名を入力" というプレースホルダーテキストで DB に INSERT → その後 `onBlur` で PUT。

明示保存に変える場合: AchievementEditor 方式に全面移行が必要（入力フォームを展開 → 「保存」ボタン押下時に POST）。資格はフィールドが `name` 1つだけなので実装は軽い。

### 6-3. 段階6-3-2 との整合

段階6-3-2 では `future_aspirations`（やってみたいこと）を基本情報タブから独立したセクションに昇格させる可能性がある。

明示保存統一後は `future_aspirations` のみ独立した保存ボタンを持つことになるため、**段階6-3-2 着手前に基本情報タブの保存方式を決定しておくことが重要**。

### 6-4. 本番環境への影響

自動保存を撤去すると、既存ユーザーが「タブ移動すると自動保存される」という体験を期待していた場合に混乱が生じる。

ただし現時点では本番ユーザー数が限定的（クローズドベータ相当）と想定されるため、UX 変更のリスクは低い。

### 6-5. localStorage 下書き保持

「ブラウザをリロードしたら入力が消えた」という体験を防ぐため、localStorage への下書き保存を入れるかどうか。

**判断: 今回は含めない。**  
理由: 実装コストが高い割に、保存ボタンが常時表示されていれば「保存を忘れる」リスクは低い。将来的に「自動保存 + 変更ありインジケーター」のハイブリッドに戻す可能性もある。

### 6-6. タブ移動時の未保存警告

明示保存に統一後、未保存状態でタブを切り替えた場合の挙動が問題になる。

**最小限の実装案:**  
`isDirty` が `true` の状態でタブクリックされたとき、`window.confirm("変更が保存されていません。移動しますか？")` を挟む。  
Tabs コンポーネントの `onTabChange` に `onBeforeChange` フックを追加する。

---

## 7. 実装順序の推奨

コミット B 以降の作業順序として、リスクの低い順に実施することを推奨:

| コミット | 内容 | 難易度 | 影響 |
|---------|------|--------|------|
| B | アカウント設定タブ（`triggerSave` → 明示保存） | ★ | `visibility` 1フィールドのみ |
| C | SNS タブ（`useDebouncedPatch` → 明示保存） | ★★ | `social_links` 全フィールド一括保存 |
| D | 資格タブ（`onBlur` + 即時POST → AchievementEditor 方式） | ★★ | カード設計変更、API 変更なし |
| E | 基本情報タブ（`useDebouncedPatch` → 明示保存 + sticky footer） | ★★★ | 最大変更量、SaveStatusPill 撤去 |
| F | `useDebouncedPatch` フックの削除（全参照消滅後） | ★ | ファイル削除のみ |
| G | スキルタブ（現状維持のため作業なし） | — | — |

---

## 付録: API ルート一覧（明示保存統一後も変更なし）

| エンドポイント | 用途 | HTTP |
|--------------|------|------|
| `/api/jobseeker/profile` | 基本情報・SNS・アカウント設定 | PUT |
| `/api/jobseeker/skill-tags` | スキルタグ追加 | POST |
| `/api/jobseeker/skill-tags/[id]` | スキルタグ削除 | DELETE |
| `/api/jobseeker/educations` | 学歴追加 | POST |
| `/api/jobseeker/educations/[id]` | 学歴更新・削除 | PUT / DELETE |
| `/api/jobseeker/certifications` | 資格追加 | POST |
| `/api/jobseeker/certifications/[id]` | 資格更新・削除 | PUT / DELETE |
| `/api/jobseeker/achievements` | 数値実績追加 | POST |
| `/api/jobseeker/achievements/[id]` | 数値実績更新・削除 | PUT / DELETE |
| `/api/jobseeker/awards` | 受賞歴追加 | POST |
| `/api/jobseeker/awards/[id]` | 受賞歴更新・削除 | PUT / DELETE |
| `/api/jobseeker/media-appearances` | メディア掲載追加 | POST |
| `/api/jobseeker/media-appearances/[id]` | メディア掲載更新・削除 | PUT / DELETE |

API ルート側は変更なし。変更は **ProfileEditClient.tsx** のみに集中する。
