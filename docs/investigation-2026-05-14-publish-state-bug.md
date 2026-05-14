# publish 後 UI ステートバグ 原因調査レポート

調査日: 2026-05-14

---

## 結論（3行）

- **根本原因（主因）**: 「変更を公開する」ボタンの `disabled` 条件が `isPublishing` のみで、`hasDraftChanges` を見ていない。公開成功後も常にグリーン活性のまま。
- **根本原因（副因・Race Condition）**: publish PATCH より後に autosave PUT のレスポンスが返ってくると、PUT コールバックが `setHasDraftChanges(true)` を呼んで公開直後の `false` を上書きする可能性がある。
- **修正規模**: 小さい。主因は 1 行（`disabled` 条件）＋数行（見た目調整）。副因は autosave コールバック内に `isPublishing` ガードを 1 行追加。

---

## 1. publish ハンドラのコード

**ファイル**: `src/app/biz/company/CompanyEditClient.tsx` L350-381

```typescript
async function handlePublish() {
  if (isPublishing) return;
  setIsPublishing(true);                         // (A) ← ボタン "公開中..." になる
  try {
    const res = await fetch("/api/biz/company", {
      method: "PATCH",
      ...
    });
    if (!res.ok) { alert(...); return; }

    const { publishedAt } = await res.json();
    // ... lastPublishedAt 計算 ...

    hasInteracted.current = false;               // (B) ← autosave 再発火防止
    setForm((prev) => ({
      ...prev,
      isPublished: true,
      lastPublishedAt,
      lastPublishedAgo: "今",
    }));
    setHasDraftChanges(false);                   // (C) ← バッジ・バナーはここで正しく変わる
    setLastSavedAt(null);
  } catch { ... }
  finally {
    setIsPublishing(false);                      // (D) ← ここでボタンが "変更を公開する" に戻る
  }
}
```

**state 遷移まとめ**:

| タイミング | isPublishing | hasDraftChanges | ボタン表示 |
|-----------|-------------|----------------|-----------|
| 押下直後 (A) | true | true | 「公開中...」disabled |
| PATCH 成功後 (C,D) | false | **false** | 「変更を公開する」**活性** ← バグ |

---

## 2. 発見した問題箇所

### 問題1（主因）: ボタンの `disabled` 条件が `isPublishing` のみ

**ファイル**: `src/app/biz/company/CompanyEditClient.tsx` L899-927

```tsx
<button
  type="button"
  onClick={handlePublish}
  disabled={isPublishing}           // ← hasDraftChanges を見ていない
  style={{
    ...
    cursor: isPublishing ? "wait" : "pointer",     // ← 同様
    opacity: isPublishing ? 0.7 : 1,               // ← 同様
  }}
>
  {isPublishing ? "公開中..." : "変更を公開する"}   // ← hasDraftChanges で分岐していない
</button>
```

`isPublishing` は API コール中にのみ `true` になる。コールが終わると即座に `false` になるため、`hasDraftChanges` が `false` であっても（=公開完了・下書きなし）ボタンは常にグリーンで活性のまま。

**「しばらくすると戻る」の正体**: `isPublishing` が `true`（ボタン: "公開中..."）→ PATCH 完了 → `false`（ボタン: "変更を公開する" 活性）の遷移が「しばらく後に戻る」に見える。

---

### 問題2（副因・Race Condition）: autosave PUT と PATCH が concurrent になるケース

**ファイル**: `src/app/biz/company/CompanyEditClient.tsx` L280-304

```typescript
useEffect(() => {
  if (!hasInteracted.current) return;
  setSaveState("saving");
  const timer = setTimeout(async () => {
    // ↑ この時点では hasInteracted.current を再チェックしていない
    const res = await fetch("/api/biz/company", { method: "PUT", ... });
    if (!res.ok) throw ...;
    setSaveState("saved");
    setHasDraftChanges(true);    // ← PATCH 完了後に PUT が遅れて返ってくるとここで true に戻る
    setLastSavedAt(new Date());
  }, 700);
  return () => clearTimeout(timer);
}, [form]);
```

**問題のある race condition タイムライン**:

```
t=0     : ユーザー編集 → useEffect 発火 → setTimeout(callback, 700ms) スケジュール
t=700ms : タイマー発火 → PUT リクエスト開始（in-flight、キャンセル不能）
t=750ms : ユーザーが「変更を公開する」をクリック
t=750ms : hasInteracted.current = false、setForm() → cleanup が clearTimeout → ノーオペ（既に発火済み）
t=900ms : PATCH レスポンス → setHasDraftChanges(false) ✓
t=1100ms: PUT レスポンス  → setHasDraftChanges(true) ← false を上書き！
```

PATCH の方が PUT より先に解決するのが通常ケース（PATCH: SELECT→UPDATE 2クエリ vs PUT: UPDATE 1クエリ）。ただし Serverless Function のコールドスタート差・DB 負荷・ネットワーク揺らぎで逆転する可能性があり、その場合「下書きあり」バッジが再出現する。

ユーザー報告では「バッジは消えている」とのことで、今回の症状は主因（問題1）が本体。問題2 は潜在バグとして別途修正が望ましい。

---

## 3. なぜステートが（ボタンだけ）戻ってしまうか

1. PATCH 開始 → `isPublishing = true` → ボタン「公開中...」(disabled)
2. PATCH 成功 → `hasDraftChanges = false`（バッジ・バナーは正常）
3. finally: `isPublishing = false` → **ボタンの disabled が解除** → 「変更を公開する」(緑、活性)

バッジとバナーは `hasDraftChanges` を見ているので正しく更新される。  
ボタンだけ `hasDraftChanges` を見ていないので常に活性になる。

---

## 4. 推奨される修正

### 修正1（主因・3行変更）

`src/app/biz/company/CompanyEditClient.tsx` L902-911 のボタンの disabled 条件に `!hasDraftChanges` を追加する。

```tsx
// 変更前
<button
  type="button"
  onClick={handlePublish}
  disabled={isPublishing}
  style={{
    ...
    cursor: isPublishing ? "wait" : "pointer",
    background: "var(--success)", color: "#fff",
    border: "1px solid var(--success)",
    opacity: isPublishing ? 0.7 : 1,
  }}
>
  {isPublishing ? "公開中..." : "変更を公開する"}

// 変更後
<button
  type="button"
  onClick={handlePublish}
  disabled={isPublishing || !hasDraftChanges}
  style={{
    ...
    cursor: (isPublishing || !hasDraftChanges) ? "not-allowed" : "pointer",
    background: hasDraftChanges ? "var(--success)" : "var(--line)",
    color: hasDraftChanges ? "#fff" : "var(--ink-mute)",
    border: `1px solid ${hasDraftChanges ? "var(--success)" : "var(--line)"}`,
    opacity: isPublishing ? 0.7 : 1,
  }}
>
  {isPublishing ? "公開中..." : hasDraftChanges ? "変更を公開する" : "公開済み"}
```

### 修正2（副因・Race Condition・1行追加）

autosave PUT コールバック内の `setHasDraftChanges(true)` を、`isPublishing` が true（= PATCH 実行中）の間は呼ばないようにガードする。

```typescript
// 変更前
setSaveState("saved");
setHasDraftChanges(true);
setLastSavedAt(new Date());

// 変更後
setSaveState("saved");
// PATCH (publish) が in-flight の間は hasDraftChanges を true に戻さない
if (!isPublishing) {
  setHasDraftChanges(true);
  setLastSavedAt(new Date());
}
```

ただし、この修正は useEffect クロージャが `isPublishing` を capture するため、`isPublishingRef = useRef(false)` を使う必要がある（state ではなく ref を使わないと stale closure になる）。

```typescript
const isPublishingRef = useRef(false);

// setIsPublishing と同期させる
// isPublishing state を変更するたびに ref も更新:
// setIsPublishing(true) の直後に isPublishingRef.current = true
// setIsPublishing(false) の直後に isPublishingRef.current = false
// または setIsPublishing を wrap した helper 関数を作る

// autosave コールバック内:
if (!isPublishingRef.current) {
  setHasDraftChanges(true);
  setLastSavedAt(new Date());
}
```

---

## 5. 修正の影響範囲

### 修正1の影響

- `disabled={isPublishing || !hasDraftChanges}` にすることで、初期ロード時（`initialCompany.hasDraftChanges` が false のとき）もボタンがグレーになる
- **重要**: 初めてページを開いた is_published=true の企業で、まだ編集していない状態では `hasDraftChanges=false` → ボタングレー。これは意図通りの挙動（変更がないのに公開ボタンを押せてしまうのは誤り）
- ラベル変更（「変更を公開する」→「公開済み」）は任意。グレーにするだけでも UX として十分

### 修正2の影響

- `isPublishingRef` の導入が必要。ref と state の二重管理が増えるが、race condition を完全に封じるには必要
- 修正1のみでも UX 上の問題（ボタンが戻る）は解消できるため、修正2 は「潜在バグの予防」として優先度は下げてもよい

---

## 付録: バナーとボタンの条件分岐対応表

| 状態 | `hasDraftChanges` | バナー | バッジ | ボタン（修正前） | ボタン（修正後）|
|------|------------------|--------|--------|-----------------|---------------|
| 未編集（is_published=true） | false | 「最新の情報が公開されています」✓ | 非表示 ✓ | **緑・活性 ← バグ** | グレー・disabled ✓ |
| 自動保存後（未公開変更あり） | true | 「未公開の変更があります」✓ | 表示 ✓ | 緑・活性 ✓ | 緑・活性 ✓ |
| 公開完了直後 | false | 「最新の情報が公開されています」✓ | 非表示 ✓ | **緑・活性 ← バグ** | グレー・disabled ✓ |
