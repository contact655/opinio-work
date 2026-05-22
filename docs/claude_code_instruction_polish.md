src/components/profile/CareerHistoryEditor.tsx の UI 微調整。
前回 a0f3b6d のグループUI実装の上に、視覚バランスを整える3点の微変更を加える。

## 改修目的

スクショで確認した結果、3点のスペーシング・サイズ調整で全体の重心が改善する：

1. アバター 36px → 32px（会社名とのバランス改善、目立ちすぎを抑える）
2. グループヘッダー下の余白 14px → 10px（親子関係の視覚的近接性を強化）
3. ポジションカード間隔 6px → 8px（カードの独立性を明確化）

データモデル変更なし、API 変更なし。CSS数値変更のみ。

## 変更内容

### 1. アバターサイズを 36px → 32px に変更

グループレンダリング内のアバター div：

```tsx
// 変更前
<div
  style={{
    width: 36,
    height: 36,
    borderRadius: 8,
    ...
    fontSize: 14,
    ...
  }}
>
  {avatarInitial}
</div>
```

を以下に変更：

```tsx
<div
  style={{
    width: 32,
    height: 32,
    borderRadius: 6,
    background: avatarColor,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    flexShrink: 0,
  }}
>
  {avatarInitial}
</div>
```

変更点：
- width / height: 36 → 32
- borderRadius: 8 → 6（アバターサイズ縮小に合わせて角丸も小さく）
- fontSize: 14 → 13

### 2. グループヘッダー下の余白を縮小

グループヘッダー div：

```tsx
// 変更前
<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
```

を以下に変更：

```tsx
<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
```

marginBottom: 14 → 10 のみ変更。

### 3. ポジションカード間隔を広げる

group.positions.map 内の各ポジション wrapper：

```tsx
// 変更前
<div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 6 : 0 }}>
```

を以下に変更：

```tsx
<div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 8 : 0 }}>
```

marginBottom 三項演算子の真値部分のみ 6 → 8 に変更。

## 注意事項

- 他の箇所は一切触らない
- 型エラーが出ることはないはずだが、出たら報告
- 念のため build で確認

## 完了後

1. npm run build を実行してビルド成功を確認
2. ビルド通ったら git add -A && git commit -m "style(profile/edit): 職歴UI微調整（アバターサイズ・グループ内余白・カード間隔）" && git push origin main
3. git log origin/main --oneline -3 で push 確認、最新コミットハッシュを報告
