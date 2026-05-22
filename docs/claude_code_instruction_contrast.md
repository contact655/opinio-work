src/components/profile/CareerHistoryEditor.tsx のポジション群の視覚的階層を強化する。

## 改修目的

現状、--bg-tint (#F8FAFC) が薄すぎて白カードと対比が出ない。
ポジション群 wrapper の背景を濃い灰色に、白カードに枠線を追加することで、
「灰色エリアに白カードが立つ」階層構造を明確化する。

## 変更内容

2箇所のみ変更。他は触らない。

### 変更1: ポジション群 wrapper の背景色を追加

groups.map 内のポジション群 wrapper：

```tsx
// 変更前
{/* ポジション群（白カード） */}
<div style={{ padding: "14px 16px" }}>
```

を以下に変更：

```tsx
{/* ポジション群（白カード） */}
<div style={{ padding: "14px 16px", background: "#F1F5F9" }}>
```

`background: "#F1F5F9"` を追加するのみ。padding は維持。

### 変更2: StintCard に枠線を追加

StintCard コンポーネントの return 文の最外 div：

```tsx
// 変更前
<div
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  style={{
    padding: "10px 12px",
    background: "#fff",
    borderRadius: 8,
    position: "relative",
  }}
>
```

を以下に変更：

```tsx
<div
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  style={{
    padding: "10px 12px",
    background: "#fff",
    borderRadius: 8,
    border: "1px solid var(--line-soft)",
    position: "relative",
  }}
>
```

`border: "1px solid var(--line-soft)"` を追加するのみ。他は変更なし。

## 注意事項

- 他のコンポーネント・関数は触らない
- グローバル CSS の `--bg-tint` 定義は触らない（影響範囲が大きいため）
- 型エラーは出ないはず

## 完了後

1. npm run build を実行してビルド成功を確認
2. ビルド通ったら git add -A && git commit -m "style(profile/edit): ポジション群の視覚的階層を強化（背景濃色化＋カード枠線）" && git push origin main
3. git log origin/main --oneline -3 で push 確認、最新コミットハッシュを報告
