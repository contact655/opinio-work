src/components/profile/CareerHistoryEditor.tsx のグループヘッダーを会社色で染める。

## 改修目的

Wantedly 風のブランド感を出すため、グループヘッダー部分のみを会社カラーで塗る。
本文（ポジションカード群）は読みやすさ維持のため白カードのまま。

## 変更内容

グループレンダリングのコンテナと内部構造を変更する。
他の部分（StintCard, StintForm, 追加ボタン, アクションメニュー）は触らない。

### 変更箇所

`groups.map((group, gIdx) => { ... })` の return 文を以下に置き換える：

```tsx
return (
  <div
    key={group.key}
    style={{
      background: "var(--bg-tint)",
      borderRadius: 10,
      marginBottom: gIdx < groups.length - 1 ? 12 : 16,
      overflow: "hidden",
    }}
  >
    {/* グループヘッダー: 会社色背景 + 白文字 */}
    <div
      style={{
        background: avatarColor,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "rgba(255,255,255,0.18)",
          border: "1.5px solid rgba(255,255,255,0.3)",
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
          {group.displayCompanyName}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
          {formatGroupPeriod(group)}
        </div>
      </div>
    </div>

    {/* ポジション群（白カード） */}
    <div style={{ padding: "14px 16px" }}>
      {group.positions.map((s, pIdx) => (
        <div key={s.id} style={{ marginBottom: pIdx < group.positions.length - 1 ? 8 : 0 }}>
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
```

## 変更のポイント

1. **コンテナ**：従来の `padding: 16` を削除、`overflow: hidden` を追加（ヘッダーの角丸切り取りのため）
2. **ヘッダー**：新規追加された色付き div。背景に `avatarColor`、padding は 14px 16px
3. **アバター**：背景を `rgba(255,255,255,0.18)`、ボーダー `1.5px solid rgba(255,255,255,0.3)` に変更（色付き背景の中で浮き上がる）
4. **会社名**：色を `var(--ink)` → `#fff` に変更
5. **在籍期間**：色を `var(--ink-mute)` → `rgba(255,255,255,0.8)` に変更
6. **ポジション群**：新規 `padding: "14px 16px"` の wrapper div で囲む

## 注意事項

- showBadgeId, avatarColor, avatarInitial の計算ロジック（map 関数内の冒頭）は変更不要
- StintCard, StintForm, IconButton, CompanySearch, formatGroupPeriod 等は触らない
- 「+ 経歴を追加」ボタン（ファイル下部）は触らない
- 型エラーが出たら報告すること、勝手に解決しない

## 完了後

1. npm run build を実行してビルド成功を確認
2. ビルド通ったら git add -A && git commit -m "feat(profile/edit): グループヘッダーを会社色で染色（Wantedly風）" && git push origin main
3. git log origin/main --oneline -3 で push 確認、最新コミットハッシュを報告
