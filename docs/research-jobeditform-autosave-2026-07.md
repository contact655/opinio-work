# JobEditForm 自動保存 調査レポート（2026-07）

> 変更なし・調査のみ

---

## 0. 最重要発見（調査前の仮説との差異）

**「企業側の JobEditForm には自動保存がない」という前提は半分誤り。**

- **編集モード（`/biz/jobs/[id]/edit`）** → 自動保存は**既に実装済み**（700ms デバウンス + 状態ピル）
- **新規作成モード（`/biz/jobs/new`）** → 自動保存は**未実装**（タイトル入力後に「作成して続ける」ボタンを手動クリック必須）

今回の「実装すべきもの」は「新規作成モードへの自動保存追加」と「既存実装のエラーハンドリング修正」の2点になる。

---

## 1. ProfileEditClient の自動保存の仕組み

### 実装パターン: 明示的コールバック方式（debounce なし）

```typescript
// ProfileEditClient.tsx:2940
const savePreferences = useCallback(async (patch: Record<string, unknown>) => {
  setPrefSaving(true);
  notifyGlobalSave("saving");
  try {
    const res = await fetch("/api/jobseeker/career-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      notifyGlobalSave("saved");  // 実際の fetch 成功を確認してから "saved"
    } else {
      notifyGlobalSave("error");
    }
  } catch { notifyGlobalSave("error"); }
  finally { setPrefSaving(false); }
}, [notifyGlobalSave]);
```

**特徴:**
- 各フィールドの `onChange` / `onBlur` で直接 `savePreferences({ フィールド名: 値 })` を呼ぶ
- **デバウンスなし** — `<select>` の変更で即時保存（テキスト入力には使われていない）
- パッチ方式（変更フィールドのみ送信）
- `notifyGlobalSave("error")` でエラーを必ずUIに反映
- `globalSaveStatus` state が実際のサーバー応答に紐づいている → **信頼性が高い**

### ProfileEditClient に「700ms デバウンス自動保存」はない

「700ms デバウンス」とは `JobEditForm` の実装。ProfileEditClient は別方式。

### 再利用可能性

`savePreferences` は ProfileEditClient に密結合（`setPrefSaving`, `notifyGlobalSave`, API エンドポイント等が固有）。
部品として切り出すとすれば、`useAutoSave` フックを改良する方が現実的。

---

## 2. JobEditForm の現状保存フロー

### 2-1. `useAutoSave` フック（`src/hooks/useAutoSave.ts`）の実態

```typescript
export function useAutoSave(options: Options = {}) {
  const { delayMs = 700, savedResetMs = 2000 } = options;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const trigger = useCallback(() => {
    setSaveState("saving");
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSaveState("saved");   // ← タイマーのみ。fetch 結果を見ていない
    }, delayMs);
  }, [delayMs, savedResetMs]);

  return { saveState, trigger };
}
```

**⚠️ 重大な設計問題: フックは UI 状態のみ管理しており、実際の fetch と完全に切り離されている。**

タイマーが切れた時点で「保存済み」と表示するが、fetch が失敗しても UI は「保存済み」のまま。
ユーザーに誤った安心感を与える。

### 2-2. 実際の fetch（`JobEditForm.tsx:269-282`）

```typescript
// Autosave: edit mode のみ form 変更後 700ms で PUT
useEffect(() => {
  if (!hasInteracted.current) return;
  if (!jobId || mode !== "edit" || process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") return;
  const timer = setTimeout(() => {
    fetch(`/api/biz/jobs/${jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(console.error);  // ← エラーをコンソールに捨てるだけ
  }, 700);
  return () => clearTimeout(timer);
}, [form]);  // form のみ依存
```

**フックの `trigger()` と `useEffect` の fetch は完全に並走しており互いを知らない。**

タイムライン（現状）:
```
t=0   updateForm() → triggerAutosave() + setState(form)
t=0   saveState = "saving"（UI表示）
t=700 フックのタイマー切れ → saveState = "saved"（fetch 結果無関係）
t=700 useEffect のタイマー切れ → fetch PUT 発火
t=750 fetch 応答（成功 or 失敗）→ .catch(console.error) のみ
```

### 2-3. フォームの状態管理

```typescript
type FormState = {
  title: string; employmentType: string; jobCategory: string; department: string;
  salaryMin: string; salaryMax: string; salaryNote: string; location: string;
  remoteWorkStatus: string; probationPeriod: string;
  descriptionMarkdown: string; messageToCandidates: string;
  requiredSkills: string[]; preferredSkills: string[];
  cultureFit: string; selectionSteps: string[]; selectionDuration: string;
  startDatePreference: string; assigneeIds: string[];
  urgency: "open" | "hot"; whyHire: string; teamComposition: string; first90Days: string;
};
```

- 単一 `useState<FormState>` で全フィールドを管理
- `updateForm(key, value)` が唯一の更新関数（`hasInteracted.current = true` + `triggerAutosave()` を必ず呼ぶ）
- **すべてのフィールド変更が form 全体として PUT される**（パッチ方式ではなく全量送信）

### 2-4. 「下書き保存」ボタンの実態

「下書き保存」という独立したボタンは実際には存在しない。

- **新規モード上部ヘッダー**: 「作成して続ける」ボタン → `handleCreate()` → POST → `router.replace("/biz/jobs/{id}/edit")` → 以後は edit モードで自動保存が機能する
- **編集モード上部ヘッダー**: 「公開申請する」ボタン → `handlePublish()`
- **公開設定セクション内**: 「公開申請する」ボタン（同じ `handlePublish`）

### 2-5. 公開申請（handlePublish）フロー

```typescript
const handlePublish = async () => {
  // 1. 現在の form を PUT で保存（最終確実保存）
  const saveRes = await fetch(`/api/biz/jobs/${jobId}`, { method: "PUT", body: JSON.stringify(form) });
  // 2. ステータスを pending_review に変更
  const submitRes = await fetch(`/api/biz/jobs/${jobId}`, {
    method: "PATCH", body: JSON.stringify({ action: "status", value: "pending_review" }),
  });
  router.push("/biz/jobs");
};
```

PUT は**コンテンツのみ**更新（`status` カラムを含まない）。
PATCH で `status` を独立して変更。

---

## 3. データ構造の確認

### ow_jobs テーブルに直接 draft が入る方式

`biz/company` の `draft_data` カラムパターンとは異なる。

```sql
-- draft は ow_jobs.status = 'draft' として直接保存
-- PUT /api/biz/jobs/{id} は status を含まない → 自動保存が誤って status を変えることはない
-- PATCH /api/biz/jobs/{id} { action: "status" } でのみ status が変わる
```

| アクション | 変わるもの | 変わらないもの |
|-----------|----------|--------------|
| 自動保存 PUT | コンテンツ全フィールド | `status`（draft のまま）|
| handlePublish PUT→PATCH | コンテンツ + status | — |

**自動保存が「公開申請フローと干渉して status を変えてしまう」リスクはゼロ。**

### API の必須バリデーション

```typescript
function buildJobRecord(body, companyId) {
  return {
    title: str(body.title, 200),  // → null if empty（必須チェックなし）
    // ... 全フィールド同様
  };
}
```

PUT endpoint に必須バリデーションは存在しない。空フォームでも保存できる。
（POST endpoint も同様。タイトルなしで draft 作成が API レベルでは可能。）

---

## 4. 新規作成時のレコード発行（一番の論点）

### 現状フロー（新規モード）

```
/biz/jobs/new にアクセス
  → mode="new", jobId=null
  → ユーザーがフィールドを入力
  → 自動保存 useEffect: !jobId → スキップ
  → ユーザーが「作成して続ける」をクリック（タイトル必須）
  → handleCreate() → POST /api/biz/jobs → { id: "uuid" }
  → router.replace("/biz/jobs/uuid/edit")
  → ページリロード（Server Component で BizJob を fetch）
  → JobEditForm が mode="edit", jobId="uuid" でマウント
  → 以後は自動保存が機能する
```

**問題: ページリロードが発生するため、新規モードで入力したデータが URL 変更後の Server Component fetch で復元されるかどうかは、POST した直後の DB レコードに依存する。**
→ `handleCreate()` は POST 時に全 form state を送るため、データ損失なし（現状は正しく動いている）。

### 自動保存を新規モードに追加するとき

「最初の自動保存時にレコードを作成し、URL を書き換える」パターンが必要。

#### 実装イメージ（変更なし・設計メモのみ）

```typescript
// 新規モードの自動保存: jobId を state で管理
const [currentJobId, setCurrentJobId] = useState<string | null>(jobId);

useEffect(() => {
  if (!hasInteracted.current) return;
  if (process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true") return;
  const timer = setTimeout(async () => {
    if (!currentJobId) {
      // 新規作成: POST してレコード発行
      if (!form.title.trim()) return;  // タイトルが空なら作成しない
      const res = await fetch("/api/biz/jobs", {
        method: "POST",
        body: JSON.stringify({ ...form, companyId }),
      });
      const { id } = await res.json();
      setCurrentJobId(id);
      // URL を書き換えるが、ページリロードしない
      window.history.replaceState({}, "", `/biz/jobs/${id}/edit`);
    } else {
      // 既存レコードを PUT
      await fetch(`/api/biz/jobs/${currentJobId}`, {
        method: "PUT", body: JSON.stringify(form),
      });
    }
  }, 700);
  return () => clearTimeout(timer);
}, [form]);
```

**重要**: `router.replace()` ではなく `window.history.replaceState()` を使う。
`router.replace()` は Next.js の Server Component 再フェッチ（ページリロード相当）を引き起こすため、フォーム state が消える。
`history.replaceState()` はブラウザの URL バーだけを書き換えてリロードしない。

---

## 5. 自動保存実装の設計案

### 5-1. useAutoSave フックの修正方針

現状の「UI 状態のみ管理」から「fetch 結果を反映」に変更する。

```typescript
// 改良案
type Options = {
  delayMs?: number;
  savedResetMs?: number;
  onSave: () => Promise<void>;  // 実際の保存処理を注入
};

const trigger = useCallback(() => {
  setSaveState("saving");
  clearTimeout(debounceTimer.current);
  debounceTimer.current = setTimeout(async () => {
    try {
      await options.onSave();          // fetch 結果を待つ
      setSaveState("saved");           // 成功してから "saved"
      resetTimer.current = setTimeout(() => setSaveState("idle"), savedResetMs);
    } catch {
      setSaveState("error");           // 失敗を UI に反映
      setTimeout(() => setSaveState("idle"), 4000);
    }
  }, delayMs);
}, [...]);
```

### 5-2. デバウンス値の検討

| 値 | 特性 | 推奨ケース |
|---|------|----------|
| 700ms（現状） | 快速タイピング中に fetch 連打しにくい | テキスト入力 |
| 1000ms | ゆっくり目でもタイピング中断に反応 | 長文入力フォーム |
| 300ms（select のみ） | ドロップダウン変更は即保存に近い | select/ボタン系 |

→ 現状の 700ms で十分。変更不要。

### 5-3. 監視対象と保存 API

| 監視 | API | 現状 |
|------|-----|------|
| `form` state（全フィールド） | `PUT /api/biz/jobs/{id}` | 実装済み（edit のみ） |
| 新規モードの初回 | `POST /api/biz/jobs` | 未実装 |

PUT は status を含まないため公開フローとの干渉なし。

### 5-4. 状態表示（現状の UI は良い）

```
"編集中"          → idle（グレーピル）
"下書きに保存中..." → saving（amber ピル + 時計アイコン）
"下書きを自動保存しました" → saved（green ピル + チェックアイコン）
```

テキストと色は適切。問題は「saved になるタイミングが fetch 完了前」な点のみ。

---

## 6. 公開申請との干渉

### 干渉しない理由（現状）

1. PUT は `status` カラムを含まない → 自動保存が status を変えることは構造上不可能
2. PATCH `{ action: "status" }` でのみ status が変わる
3. `handlePublish` は PUT → PATCH を sequential に呼ぶ

### 理論上の競合（無視してよい）

タイミング: `handlePublish` の PUT が完了した直後に自動保存の PUT が飛ぶ可能性。
- 結果: content フィールドの「最後に書き込んだ方が勝つ」→ どちらも同じ form state なので問題なし
- status は PATCH でのみ変わるため、競合で status が draft に戻ることはない

---

## 7. 実装の分割案（コミットの刻み方）

### Step 1: `useAutoSave` フックを fetch 結果に紐づける（低リスク）

変更ファイル: `src/hooks/useAutoSave.ts` + `src/components/business/JobEditForm.tsx`

- `onSave` コールバックを注入する設計に変更
- edit モードの既存動作を正しく動くように修正
- エラー状態（"error"）の追加と UI 表示

**リスク: 低。edit モードの既存動作改善のみ。既存 UI テキストは変えない。**

### Step 2: 新規モードの自動保存（中リスク）

変更ファイル: `src/components/business/JobEditForm.tsx`

- `currentJobId` state 追加（`initialJob?.id ?? null` で初期化）
- 新規モードの useEffect: title が空なら保存しない、title が入力されたら POST して `currentJobId` をセット
- `window.history.replaceState()` で URL を書き換え（リロードなし）
- `handleCreate` ボタンはそのまま残す（明示的な「作成」の手段として維持）

**リスク: 中。`router.replace` vs `history.replaceState` の選択が実装の肝。**
**注意**: `handleCreate` と自動保存 POST が競合しないよう、`currentJobId` に値が入ったら POST をスキップする。

### Step 3: `/profile/edit` 側の自動保存との統一（任意・後日）

ProfileEditClient は別パターン（明示コールバック）で動いており、動作上の問題はない。
統一する必要性は低い。後日の技術的整理として検討。

---

## 8. 想定リスクと注意事項

| リスク | 内容 | 対処 |
|-------|------|------|
| 新規モード中の競合 | 自動保存 POST と「作成して続ける」ボタンが同時に走る | `currentJobId` チェックで POST の2重発行を防ぐ |
| `history.replaceState` の副作用 | ブラウザバックで `/biz/jobs/new` に戻った時の挙動 | `popstate` イベントは発火しないため影響なし |
| ネットワーク断での誤表示 | "saved" が出るが実際には保存されていない | Step 1 の fix で解消 |
| `status` の誤上書き | draft が published になる | PUT に status が含まれないため構造上不可 |
| タイトル空での POST | 空の draft レコードが作られる | 新規モード自動保存は `title.trim().length >= 1` を条件に |
| `window.history.replaceState` の TS 型 | 問題なし（標準 API） | — |

---

## 9. 付録: 関連ファイル一覧

| ファイル | 行数 | 現状 |
|---------|------|------|
| `src/hooks/useAutoSave.ts` | 38 | 存在済み。UI のみ管理、fetch と切り離されている |
| `src/components/business/JobEditForm.tsx` | 906 | 自動保存 useEffect あり（edit のみ）。新規モード未対応 |
| `src/app/api/biz/jobs/route.ts` | ~190 | POST（新規作成）実装済み。必須バリデーションなし |
| `src/app/api/biz/jobs/[id]/route.ts` | ~180 | PUT（更新）実装済み。status を変えない |
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | 4478 | 別方式（明示コールバック）。useAutoSave 不使用 |
