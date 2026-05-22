src/components/profile/CareerHistoryEditor.tsx の UI/UX を改善してください。
前回の commit 47e301e でグループ化機能は実装済み。今回はその上に視覚的な階層感を加える作業です。

## 改修目的

現状はグループ化が機能していても、視覚的にフラットで「会社単位のまとまり」が伝わりにくい。
以下の4点を改善する：

1. グループ全体を灰背景（`var(--bg-tint)`）で囲い、領域を明示
2. 各ポジションを白カードにして、グループ内の階層を作る
3. 会社ごとにイニシャルアバター（色付き）を表示し、視覚アンカーを作る
4. 「現職」バッジを同社グループ内の最新ポジション1つだけに表示

データモデル変更なし、API 変更なし、page.tsx 変更なし。本ファイルのみで完結。

## 変更内容（番号順に実施）

### 1. アバター色生成関数を CompanySearch から関数外に切り出す（再利用のため）

現在 CompanySearch コンポーネント内に：

```typescript
const AVATAR_COLORS = ["#4F46E5", "#059669", "#DC2626", "#D97706", "#0891B2", "#7C3AED"];

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
```

がある。これは既にファイル先頭近くにあるはずなので位置はそのままで OK。
関数を再エクスポートする必要なし、同一ファイル内で使えれば良い。

### 2. StintCard を白カード型に変更

現在の StintCard の return 全体を以下に置き換え：

```tsx
return (
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
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Role + 現在 badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {stint.roleTitle || stint.roleLabel}
          </span>
          {stint.showCurrentBadge && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", flexShrink: 0 }}>
              現在
            </span>
          )}
        </div>
        {/* Period */}
        <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
          {formatPeriod(stint.startedAt, stint.endedAt, stint.isCurrent)}
        </div>
        {/* Description snippet */}
        {stint.description && (
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-soft)",
              marginTop: 6,
              paddingLeft: 8,
              borderLeft: "2px solid var(--line)",
              lineHeight: 1.65,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {stint.description}
          </div>
        )}
      </div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
        <IconButton onClick={onEdit} title="編集">✎</IconButton>
        <IconButton onClick={onDelete} title="削除" danger>×</IconButton>
      </div>
    </div>
    {/* ストーリーアコーディオン */}
    <StoryAccordion experienceId={stint.id} />
  </div>
);
```

注意点：
- 「現在」バッジを `stint.showCurrentBadge` という新プロパティに依存させる（既存の `isCurrent` ではなく）
- このプロパティは Stint 型には**追加しない**。レンダリング時に props として渡すパターンに変える（次のステップ参照）

### 3. StintCard の Props 定義に showCurrentBadge を追加

```typescript
function StintCard({
  stint,
  onEdit,
  onDelete,
}: {
  stint: Stint & { showCurrentBadge?: boolean };
  onEdit: () => void;
  onDelete: () => void;
}) {
```

`Stint & { showCurrentBadge?: boolean }` の交差型で渡す。Stint 型本体は変更しない。

### 4. グループのレンダリングを白カード型 + 灰背景型に変更

現在の `groups.map((group, gIdx) => (...))` 内の JSX を以下に置き換える：

```tsx
{groups.map((group, gIdx) => {
  // グループ内で最新のポジション（先頭の sortedPositions[0]）かつ isCurrent: true のもののみ「現在」バッジ表示
  const showBadgeId = group.positions[0]?.isCurrent ? group.positions[0].id : null;
  const avatarColor = getAvatarColor(group.displayCompanyName);
  const avatarInitial = group.displayCompanyName.charAt(0);

  return (
    <div
      key={group.key}
      style={{
        background: "var(--bg-tint)",
        borderRadius: 10,
        padding: 16,
        marginBottom: gIdx < groups.length - 1 ? 12 : 16,
      }}
    >
      {/* グループヘッダー: アバター + 会社名 + 期間 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: avatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            flexShrink: 0,
          }}
        >
          {avatarInitial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
            {group.displayCompanyName}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
            {formatGroupPeriod(group)}
          </div>
        </div>
      </div>

      {/* ポジション群（白カード） */}
      <div>
        {group.positions.map((s, pIdx) => (
          <div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 6 : 0 }}>
            {editingId === s.id ? (
              <StintForm
                draft={editDraft}
                onDraftChange={setEditDraft}
                isSaving={editSaving}
                justSaved={editJustSaved}
                onSave={() => { void saveEdit(); }}
                onCancel={cancelEdit}
                roles={roles}
              />
            ) : (
              <StintCard
                stint={{ ...s, showCurrentBadge: s.id === showBadgeId }}
                onEdit={() => startEdit(s)}
                onDelete={() => setDeleteTarget(s)}
              />
            )}
          </div>
        ))}

        {/* グループ内追加フォーム */}
        {addingForCompanyKey === group.key && (
          <div style={{ marginTop: 10 }}>
            <StintForm
              draft={addDraft}
              onDraftChange={setAddDraft}
              isSaving={addSaving}
              justSaved={addJustSaved}
              onSave={() => { void saveAdd(); }}
              onCancel={cancelAdd}
              roles={roles}
              companyLocked={true}
            />
          </div>
        )}

        {/* 「+ このポジションに役割を追加」テキストリンク */}
        {addingForCompanyKey !== group.key && (
          <button
            type="button"
            onClick={() => {
              setAddDraft(draftFromGroup(group));
              setAddingForCompanyKey(group.key);
            }}
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 0",
              background: "transparent",
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-mute)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
            このポジションに役割を追加
          </button>
        )}
      </div>
    </div>
  );
})}
```

### 5. 「+ 経歴を追加」ボタン周りは現状維持

ファイル末尾の「+ 経歴を追加」ボタンは現状の見た目を維持。
ただし groups.length 等の参照箇所がもしあれば、`stints.length` で OK（既存通り）。

### 6. 削除すべきコード

- StintCard 内の「会社名 + 現在バッジ」div（前回 47e301e で「役職行に統合」と書いた変更を取り消し、純粋に「役職 + showCurrentBadge」にする）

## 注意事項

- `Stint` 型自体は触らない。`showCurrentBadge` は StintCard の props 側の型でのみ使う交差型
- `sortStints()` 関数は残す
- `getAvatarColor()` と `AVATAR_COLORS` の位置は移動不要、ただしファイル内のどこからでも参照できることを確認
- 既存の Toast / ConfirmDialog / StoryAccordion / CompanySearch は触らない
- `formatPeriod`, `formatGroupPeriod`, `groupStints`, `diffInMonths`, `formatDuration`, `groupKey` も触らない
- 編集フォーム（StintForm）展開時のレイアウトが灰背景の中に収まることを確認。`var(--bg-tint)` の中に StintForm が入ると StintForm 自身も `--bg-tint` 背景なので見えにくい → StintForm 展開時は白背景の代わりに白カード内で表示する。具体的には、上記コードの editingId === s.id 分岐の StintForm はそのまま、白カード扱いではなく既存の StintForm スタイルがそのまま出る。これは見栄え確認後に必要なら調整するが、まず実装してみる。
- 型エラーが出たら報告すること、勝手に解決しない

## 完了後

1. npm run build を実行してビルド成功を確認
2. ビルド通ったら git add -A && git commit -m "feat(profile/edit): 職歴UI改善（会社カード化・アバター・現職バッジ最適化）" && git push origin main
3. git log origin/main --oneline -3 で push 確認、最新コミットハッシュを報告
