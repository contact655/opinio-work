# Phase ν-6 段階 2 設計案 — インライン編集コンポーネント

**作成日**: 2026-05-08  
**ステータス**: 🔍 Hisato レビュー待ち（Sub-step 2-A）  
**確定方針**: クリックで編集モード（Notion 風）/ 明示保存ボタン / ロールバック + トースト

---

## 1. `<InlineEditableField>` コンポーネント設計

### Props 設計

```typescript
// src/components/profile/InlineEditableField.tsx

type InlineEditableFieldType = "text" | "textarea" | "select";

type InlineEditableFieldProps = {
  // ── 必須 ──────────────────────────────────────────────────
  value: string;
  onSave: (newValue: string) => Promise<void>;
  type: InlineEditableFieldType;

  // ── 任意 ──────────────────────────────────────────────────
  placeholder?: string;     // 未入力時の誘導テキスト（例: 「あなたの過去・現在・未来の...」）
  label?: string;           // フィールドのラベル（例: "About Me"）
  maxLength?: number;       // 文字数上限（textarea では残字数カウンターに使用）
  options?: string[];       // type="select" の場合の選択肢一覧
  disabled?: boolean;       // 読み取り専用にする場合
  onCancel?: () => void;    // キャンセル時の追加コールバック（任意）
};
```

**type バリエーションの扱い方:**

| type | 用途 | UI |
|------|------|-----|
| `"text"` | 名前・場所など 1 行入力 | `<input type="text">` |
| `"textarea"` | About Me・future_aspirations など複数行 | `<textarea>` |
| `"select"` | 年齢層・公開範囲など定型値 | `<select>` |

### 状態遷移図

```
                 クリック（テキスト or 鉛筆アイコン）
                         │
          ┌──────────────▼──────────────┐
          │         display             │  ← 初期状態
          │  ・値を表示（空なら placeholder）│
          │  ・hover で鉛筆アイコン表示   │
          └──────────────┬──────────────┘
                         │ click
                         ▼
          ┌──────────────────────────────┐
          │          editing             │
          │  ・input / textarea が出現   │
          │  ・[保存] [キャンセル] ボタン │
          └──────┬───────────────┬───────┘
                 │ [保存] click  │ [キャンセル] click
                 ▼               ▼
  ┌──────────────────────┐    ┌──────────────────────┐
  │        saving        │    │       display        │
  │  ・ボタンを disabled  │    │  （元の値に戻る）     │
  │  ・spinner 表示      │    └──────────────────────┘
  └───────┬──────┬───────┘
          │成功  │失敗
          ▼      ▼
  ┌──────────┐  ┌────────────────────────┐
  │ display  │  │         error          │
  │（新しい値） │  │  ・state をロールバック │
  └──────────┘  │  ・トースト表示         │
                │  ・display に遷移       │
                └────────────────────────┘
```

**遷移のまとめ:**

| 現状態 | トリガー | 遷移先 |
|--------|---------|--------|
| display | click | editing |
| editing | [キャンセル] / Escape | display（元の値） |
| editing | [保存] click | saving |
| saving | Supabase 成功 | display（新値） |
| saving | Supabase 失敗 | error → display（旧値） |

### イベントハンドラの責務

**`onSave` のシグネチャ:**

```typescript
onSave: (newValue: string) => Promise<void>
```

- `Promise<void>` を採用する（`Promise<{success: boolean}>` ではなく）
- 失敗時は **throw** することで呼び出し側に伝達
- コンポーネント内で `try/catch` して error 状態 + ロールバックを処理

採用理由: `Promise<{success: boolean}>` は成功フラグを呼び出し側が毎回チェックする必要があり冗長。throw パターンの方が Supabase の実装と相性が良い（Supabase の error オブジェクトをそのまま throw できる）。

**`onCancel` の責務:**

- コンポーネント内部では `editing state → display state` への遷移と `editValue` のリセットを行う
- 親への通知が必要な場合のオプション引数（通常は不要）

**ロールバックの責務:**

`InlineEditableField` コンポーネント内部で持つ。

```
display state での表示値:
  → 編集開始時に saveSnapshot = currentValue を保存
  → 失敗時に setDisplayValue(saveSnapshot) でロールバック
```

ロールバックを親に委譲すると親の state 管理が複雑になるため、**フィールド内部で完結**させる設計を採用。ただし保存成功時は親の state も更新が必要なため、`onSave` 完了後に親の更新関数を呼ぶ（後述の Section 経由で実施）。

---

## 2. `<InlineEditableSection>` コンポーネント設計

### Props 設計

```typescript
// src/components/profile/InlineEditableSection.tsx

type InlineEditableSectionProps = {
  // ── 必須 ──────────────────────────────────────────────────
  title: string;               // セクション見出し（例: "About Me"）
  children: React.ReactNode;   // InlineEditableField 群を受け取る

  // ── 任意 ──────────────────────────────────────────────────
  titleEn?: string;            // サブラベル（例: "Self Introduction"）
  editHref?: string;           // 鉛筆クリック時の遷移先（/profile/edit へのフォールバック用）
};
```

### Field との関係性

**Section は Field を直接 render しない。** 代わりに `children` として受け取る。

```
InlineEditableSection
  └── children
        ├── InlineEditableField (About Me)
        ├── InlineEditableField (location)   ← 段階 3 追加
        └── InlineEditableField (age_range)  ← 段階 3 追加
```

**About Me の構造:** `Section` + `Field` の二重構造を採用する（後述）。

### 編集モードのスコープ: フィールド単位を採用

**採用案: フィールド単位で独立して編集モード切り替え**

```
[About Me セクション]
  ┌─────────────────────────────────────────────────┐
  │  About Me                                        │
  │  ─────────────────────────────────────────────  │
  │  リクルートで4年間...（クリックで編集モードへ）  │  ← display
  │                                             [✏️] │
  └─────────────────────────────────────────────────┘

クリック後:
  ┌─────────────────────────────────────────────────┐
  │  About Me                                        │
  │  ─────────────────────────────────────────────  │
  │  ┌─────────────────────────────────────────┐   │
  │  │ リクルートで4年間...                    │   │  ← editing
  │  └─────────────────────────────────────────┘   │
  │  [保存] [キャンセル]                 残 320/500 │
  └─────────────────────────────────────────────────┘
```

採用理由:
- Notion 風（確定方針 A）と一致する。Notion はセクション単位ではなくブロック単位で編集
- 段階 3 で `location` / `age_range` が追加されるが、それぞれ独立して編集できる方が UX として自然
- セクション単位一括保存は API コールが 1 回で済むメリットがあるが、複数フィールドを同時に変更する必要が少ない（About Me を変更したいだけなのに name も触らないと保存できない、等の問題）

**Section の役割:** セクション見出し・罫線・鉛筆アイコン（ホバー）を提供するラッパー。Field の状態管理には関与しない。

### About Me: Section + Field の二重構造を採用する（案 B）

```tsx
// DashboardView 内での配置イメージ（疑似コード）
<InlineEditableSection title="About Me" titleEn="Self Introduction">
  <InlineEditableField
    type="textarea"
    value={userAboutMe ?? ""}
    placeholder="あなたの過去・現在・未来の物語を書いてみましょう"
    maxLength={500}
    onSave={async (newValue) => {
      await updateOwUser({ about_me: newValue });
      // 親の state 更新は onSave 呼び出し元の Section/Field から行う
    }}
  />
</InlineEditableSection>
```

採用理由:
- 段階 3 で About Me に隣接する「この先やってみたいこと」等のフィールドを兄弟として追加しやすい
- Section の見出し（"About Me" / "Self Introduction"）表示ロジックを Field に持たせると肥大化する
- 単一フィールドのセクション（About Me のような textarea 1 個）でも Section で包む設計に統一することで、段階 3 の横展開時にパターンが一致する

---

## 3. 楽観的更新と Supabase 同期の設計

### 保存フロー（疑似コード）

```
// InlineEditableField の onSave 内部処理イメージ

async function handleSave() {
  const snapshot = displayValue;      // 1. 現在値を退避（rollback 用）
  setStatus("saving");
  setDisplayValue(editValue);         // 2. 楽観的更新（クライアント即時反映）

  try {
    await props.onSave(editValue);    // 3. Supabase PATCH（親から渡された関数）
    setStatus("display");             // 4a. 成功 → display へ（楽観値をそのまま保持）
  } catch (err) {
    setDisplayValue(snapshot);        // 4b. 失敗 → rollback
    setStatus("error");               // → error state でトースト表示
    // error state は即座に display へ遷移（トーストは別レイヤーで管理）
    setStatus("display");
    triggerToast("保存に失敗しました"); // トースト（後述）
  }
}
```

**成功時の state 上書きについて:**  
楽観的更新で setDisplayValue(editValue) 済みのため、成功レスポンスのサーバー値で再上書きは行わない。ただし Supabase が値を変換する場合（trim 等）があれば `data` を使って上書きする余地は残す。

### useState / useReducer の選択

**各レイヤーの責務:**

| レイヤー | 保持する state | 理由 |
|---------|-------------|------|
| `MypageClient`（親） | `owUser`（DB から取得した初期値） | Server Component から渡された props を Client 側でキャッシュ |
| `InlineEditableSection` | なし（ラッパーのみ） | Field の状態に関与しない |
| `InlineEditableField` | `displayValue`, `editValue`, `status` | フィールド単位で独立した編集サイクルを持つため |

**useState を採用する（useReducer は不採用）:**  
状態遷移は `status` + `displayValue` + `editValue` の 3 変数で完結し、ロジックが単純なため `useReducer` の複雑さは不要。

**Supabase との連携方法:**  
`InlineEditableField` は Supabase を直接呼ばない。`onSave` prop として受け取った関数（`MypageClient` 側で `createClient()` を使って定義）を呼ぶ。これにより Field コンポーネントが Supabase に依存しない（テスタブル・再利用可能）。

```
MypageClient
  └── createClient() でクライアントを生成
       └── handleUpdateAboutMe = async (val) => {
               const supabase = createClient();
               const { error } = await supabase
                 .from("ow_users")
                 .update({ about_me: val })
                 .eq("id", owUser.id);
               if (error) throw error;
           }
            └── InlineEditableField の onSave に渡す
```

---

## 4. トースト通知の実装方針

### ライブラリ選定

**既存実装の再利用（外部ライブラリ不採用）**

grep 確認の結果:
- 外部 toast ライブラリ（react-hot-toast / sonner 等）は `package.json` に存在しない
- `src/app/biz/members/MembersClient.tsx` に自作 `Toast` コンポーネントが存在
  - `position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%)`
  - `background: var(--ink); color: #fff; border-radius: 100`
  - `useEffect` で 3 秒後 `onDone()` を呼んで消える

**方針: `MembersClient.tsx` の Toast を `src/components/ui/Toast.tsx` として切り出し共用化する**

理由:
- 既存の見た目・挙動が Opinio のデザイントークンに準拠済み（`var(--ink)` 使用）
- 外部ライブラリを追加せずに済む（バンドルサイズ影響なし）
- `InitialAvatar` を切り出したパターン（Phase ν-5）と一致する

切り出す際の型:
```typescript
// src/components/ui/Toast.tsx
type ToastProps = {
  message: string;
  variant?: "default" | "error";  // error 時は background: var(--error) に変更
  onDone: () => void;
};
```

使い方:
```typescript
// 親 component での管理
const [toast, setToast] = useState<string | null>(null);

// エラー時
setToast("保存に失敗しました");

// render
{toast && <Toast message={toast} onDone={() => setToast(null)} />}
```

### エラー時の文言案

| 状況 | トースト文言 | 文字数 |
|------|------------|-------|
| 保存失敗（一般） | `保存に失敗しました` | 9 字 |
| ネットワークエラー | `通信エラーが発生しました` | 11 字 |
| 保存成功 | `保存しました` | 6 字 |

**Sentry 連携:** `catch (err)` ブロック内で `console.error(err)` を残しておく。将来 Sentry を導入する際は `Sentry.captureException(err)` に 1 行差し替えで対応可能な設計にする。

---

## 5. About Me 実装の具体的な配置

### 採用案: B — `<InlineEditableSection>` でラップしてから内部に Field を配置

**現状の MypageClient.tsx DashboardView 内の該当箇所:**

```tsx
// 現状（段階 1 完了時点）
{aboutMePreview ? (
  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.85 }}>
    {aboutMePreview}
  </div>
) : (
  <div style={{ ... fontStyle: "italic" }}>
    自己紹介を追加すると...
    <Link href="/profile/edit">追加する →</Link>
  </div>
)}
```

**段階 2 後の形（イメージ）:**

```tsx
// 段階 2 実装後（コンパクトカード内）
<InlineEditableSection title="About Me" titleEn="Self Introduction">
  <InlineEditableField
    type="textarea"
    value={userAboutMe ?? ""}
    placeholder="あなたの過去・現在・未来の物語を書いてみましょう"
    maxLength={500}
    onSave={handleUpdateAboutMe}
  />
</InlineEditableSection>
```

案 B を採用する理由:
1. **段階 3 での拡張性**: 「この先やってみたいこと」（future_aspirations）を About Me セクションに並べて追加する際、`Section` コンポーネントを使い回せる
2. **見出し管理の分離**: "About Me" / "Self Introduction" の見出しロジックを `Section` に持たせることで `Field` が薄く保てる
3. **ν-6 設計原則の統一**: 全セクション（基本情報・スキル・SNS・職歴）で `Section + Field` パターンに統一することで、段階 3〜4 の横展開時にコードの見た目が揃う

案 A（Field だけ）では段階 3 で Section を後から被せる際に構造を変えることになり、diff が汚くなる。

---

## 6. 段階 3 への影響範囲

段階 3 で対象となるフィールドと、本設計の適用可否:

| フィールド | type | 特殊対応 |
|-----------|------|---------|
| `name` | `"text"` | なし |
| `location` | `"select"` | `options={LOCATIONS}` を渡す |
| `age_range` | `"select"` | `options={AGE_RANGES}` を渡す |
| `about_me` | `"textarea"` | 段階 2 で実装済み |
| `future_aspirations` | `"textarea"` | `maxLength={500}` |
| スキル・特徴 | 未定（タグ形式？） | **要別途検討** |
| SNS リンク（twitter / linkedin / note） | `"text" × 3` | **要別途検討（後述）** |

**SNS リンクの扱い:**  
`social_links` は `{twitter, linkedin, note}` の JSONB 1 カラムに複数値が入る。保存時は 3 フィールドをまとめて 1 回の `UPDATE` で書き込む必要がある。

この場合、以下の 2 パターンが考えられる:

- **パターン X（フィールド個別保存）**: 各 Field の `onSave` で `social_links` を部分更新する。都度 DB を読んで merge してから書き込む必要があり、race condition のリスクがある
- **パターン Y（セクション一括保存）**: SNS セクションだけは例外として、セクション内のフィールドを一括保存するモードを使う（`InlineEditableSection` に `onSectionSave` prop を追加する拡張）

**推奨: SNS セクションはパターン Y（セクション一括保存）を使い、他セクションと分けて扱う。** 段階 3 に入ったタイミングで詳細設計を行う。現段階ではパターン X / Y の選択余地を残した設計にしておく。

**スキル・特徴はタグ UI が必要な可能性があり、`type: "text" | "textarea" | "select"` の枠に収まらない。** 段階 3 の着手時に `type: "tags"` の追加か専用コンポーネントかを判断する。

---

## 7. 段階 4（職歴）への影響範囲

職歴（`ow_experiences` テーブル）は複数の stint レコードからなる配列構造であり、各 stint に 追加 / 削除 / 並び替え（順序変更）が必要になる。これは単一値の `InlineEditableField` パターンとは根本的に異なる。

**推奨: 職歴専用の `<CareerHistoryEditor>` コンポーネントを別途作成する。**

`InlineEditableField` との共通点は「クリックで編集モード」「明示保存」「エラー時ロールバック」というインタラクションパターンのみ。実装は別コンポーネントが適切だが、Toast コンポーネント・保存フロー（try/catch + rollback）・onSave シグネチャ（`Promise<void>` + throw）は本設計と共通化できる。段階 2 で確立したパターンを踏襲することで、段階 4 での実装コストを抑えられる。

---

## 8. 未解決事項（Hisato に確認してほしい点）

| # | 論点 | 選択肢 |
|---|------|-------|
| 1 | `InlineEditableField` の hover 時の鉛筆アイコン表示: モバイルでは hover がないため、常時表示 or タップ領域として確保が必要 | A: 鉛筆アイコンを常時表示（モバイル対応を優先） / B: hover のみ（PC 先行、モバイルは後で対応） |
| 2 | 保存成功時のトースト表示: 「保存しました」を毎回出すか、失敗時のみか | A: 失敗時のみトースト（成功はサイレント。保存後に画面が更新されること自体がフィードバック） / B: 成功 + 失敗両方トースト |
| 3 | `MypageClient` の `owUser` state: 現状は Server Component から渡された props のみ（Client 側で更新関数なし）。About Me を保存後に `userAboutMe` を更新する仕組みが必要 | A: `MypageClient` に `useState(owUser.about_me)` を追加してフィールドごとに管理 / B: 保存後に `router.refresh()` でサーバー側から再 fetch |

---

## バージョン履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 1.0 | 2026-05-08 | 初版（Sub-step 2-A 提出） |
