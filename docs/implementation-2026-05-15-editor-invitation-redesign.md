# 実装レポート: EditorInvitation CTA リデザイン（Task 2-R2）

**実装日**: 2026-05-15  
**コミット**: `98d39a0` — feat(biz/dashboard): redesign EditorInvitation CTA to vertical layout  
**対象ファイル**: `src/components/business/EditorInvitation.tsx`

---

## 背景・経緯

### 当初の誤実装（Task 2: コミット `7142a21`）

当初、「CTA バナー追加」タスクとして `/biz/company/CompanyEditClient.tsx` に新規バナーを追加した。  
しかし調査により、すでに `/biz/dashboard` のサイドバーに `EditorInvitation.tsx` コンポーネントが存在し、  
これが Hisato さんのスクリーンショットに写っていた「紫グラデーション・横並びレイアウト」の正体だったことが判明。

**誤実装の revert**: コミット `3355edb` — `revert: undo wrong-page CTA addition to CompanyEditClient`

### 正しいターゲット

`src/components/business/EditorInvitation.tsx`（`/biz/dashboard` のサイドバーで使用）

---

## 変更内容

### Before（旧レイアウト）

```
┌─────────────────────────────────────────────────────┐
│ 🎨 [icon]  Opinio編集部が取材に伺います   [申し込む]│
│            会社の雰囲気・文化・働き方を…            │
└─────────────────────────────────────────────────────┘
```

- **背景**: `linear-gradient(135deg, var(--purple) 0%, #5B21B6 100%)` （暗い紫グラデーション）
- **レイアウト**: `gridTemplateColumns: "48px 1fr auto"` — 3列横並び
- **テキスト色**: 白（`#fff`）
- **ボタン**: 白背景・紫テキスト

### After（新レイアウト）

```
┌──────────────────────────────────────────────────────┐
│  [✍️]  Opinio編集部が取材に伺います                  │  ← Row 1
│                                                      │
│  会社の雰囲気・文化・働き方を記事にしませんか？       │  ← Row 2
│  求職者が「ここで働きたい」と感じるストーリーを…     │
│                                                      │
│  3.2× ↑ 取材記事掲載後の閲覧数増加  [申し込む →]  │  ← Row 3
└──────────────────────────────────────────────────────┘
```

- **背景**: `var(--purple-soft)` = `#F3E8FF`（ソフトな紫）
- **ボーダー**: `1px solid #DDD6FE`
- **レイアウト**: vertical flex（3行構造）
- **Row 1**: アイコン（32×32, `#EDE9FE` 背景）+ Noto Serif 15px bold `#4C1D95`
- **Row 2**: 13px `#5B21B6`, line-height 1.75
- **Row 3**: メトリクス（Inter 22px bold `#7C3AED` + 上矢印 SVG）+ CTA ボタン（`#7C3AED` 背景、白テキスト）

---

## デザイントークン

| 要素 | 旧値 | 新値 | 根拠 |
|------|------|------|------|
| 背景 | グラデーション（濃い紫） | `var(--purple-soft)` (#F3E8FF) | 既存デザインシステム活用、柔らかい印象 |
| テキスト色 | `#fff` | `#4C1D95` / `#5B21B6` | 可読性とデザインシステム整合 |
| ボーダー | なし | `1px solid #DDD6FE` | カード感を出す |
| レイアウト | 3列グリッド（横） | vertical flex（縦3行） | 情報の優先順位を明確化 |
| メトリクス | なし | `3.2×` (Inter 700, 22px) | 効果を数値で訴求 |
| CTA ボタン | 白背景・紫テキスト | `#7C3AED` 背景・白テキスト | 視認性・CTA 強調 |

---

## CTA リンク先

`href="/biz/editor-request"` — 旧実装から変更なし

> **補足**: 実際の申し込みフォーム URL が決まった時点で、`href` を変更するだけで対応可能。

---

## コミット履歴（Task 2 全体）

| コミット | 内容 |
|---------|------|
| `7142a21` | feat(biz/company): add editorial team CTA banner（誤実装・後に revert） |
| `3355edb` | revert: undo wrong-page CTA addition to CompanyEditClient |
| `98d39a0` | feat(biz/dashboard): redesign EditorInvitation CTA to vertical layout ✅ |

---

## ビルド確認

```
✓ Compiled successfully
✓ Generating static pages (76/76)
```

---

## 既知の制約・未対応項目

- CTA バナーは `/biz/dashboard` サイドバーに固定表示（全テナント共通）
- 「申し込む」リンクは `/biz/editor-request`（専用フォームに変更が必要になった際は href のみ修正）
- モバイル幅では Row 3 の横並びが折り返す場合あり（`/biz/` はデスクトップ前提のため現状対応なし）
