src/components/profile/CareerHistoryEditor.tsx のグループヘッダーを案②（左ボーダー＋淡色背景）に変更する。

## 改修目的

前回 7beca17 で案①（ヘッダー全面色）を実装したが、複数社並んだ際に色のチカチカ感が出るため、
案②（細い左ボーダー4px ＋ 会社色の淡色背景）に変更する。
1社あたりのブランド感は控えめになるが、複数社並ぶ実用シーンで視覚的に落ち着く。

## 変更内容

groups.map 内の return 文の最外コンテナと、ヘッダー部分を変更する。
ポジション群 wrapper（背景 #F1F5F9 + 白カード枠線）と StintCard 内は触らない。

### 変更箇所

`groups.map((group, gIdx) => { ... })` の return 文を以下に置き換える：

```tsx
return (
  <div
    key={group.key}
    style={{
      background: `${avatarColor}0F`,  // hex に opacity=0x0F (約6%) を後置
      borderLeft: `4px solid ${avatarColor}`,
      borderRadius: 10,
      marginBottom: gIdx < groups.length - 1 ? 12 : 16,
      overflow: "hidden",
    }}
  >
    {/* グループヘッダー: アバター + 会社名 + 期間（通常の黒文字） */}
    <div
      style={{
        padding: "14px 16px 10px",
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
    <div style={{ padding: "0 16px 14px" }}>
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

1. **コンテナ**：
   - background を `var(--bg-tint)` → `${avatarColor}0F` （会社色を 6% 透過）に変更
   - 新規 `borderLeft: 4px solid ${avatarColor}` を追加（会社色の縦アクセント）
   - overflow: hidden は維持

2. **ヘッダー部分**：
   - 色付き背景の独立 div を**削除**（ヘッダーとポジション群を同じコンテナ内の連続したパディングで扱う）
   - アバターは元の会社色に戻す（`background: avatarColor`、半透明白ではなく）
   - 会社名は `color: "var(--ink)"`（黒）に戻す
   - 在籍期間は `color: "var(--ink-mute)"` に戻す
   - パディング: `14px 16px 10px`（下を 10px に詰めてポジション群との距離を近づける）

3. **ポジション群 wrapper**：
   - 背景色 `#F1F5F9` を**削除**（コンテナ側の薄会社色背景が見える）
   - パディングを `0 16px 14px` に変更（上は 0、ヘッダー側の padding-bottom と合わせるため）

## 注意事項

- StintCard 内の `border: "1px solid var(--line-soft)"` は維持（白カードの境界は維持）
- ${avatarColor}0F の構文は 8桁hex（#RRGGBBAA）で alpha=0x0F=15/255=約6%。avatarColor が `#0891B2` のような6桁hexであることを前提とする
- もし avatarColor が rgba() 形式だったら `${avatarColor}0F` は機能しないので、その場合は事前に hex→rgba変換ロジックを入れる必要がある。AVATAR_COLORS は確認した限り全て `#RRGGBB` の6桁hex
- 他のコンポーネント・関数は触らない
- 型エラーが出たら報告すること、勝手に解決しない

## 完了後

1. npm run build を実行してビルド成功を確認
2. ビルド通ったら git add -A && git commit -m "feat(profile/edit): 案②に変更（左ボーダー＋淡色背景、複数社対応優先）" && git push origin main
3. git log origin/main --oneline -3 で push 確認、最新コミットハッシュを報告
