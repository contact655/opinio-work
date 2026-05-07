# Sub-step 4A-7 段階 1.5: 候補者プロフィールリンク調査

調査日: 2026-05-08  
調査者: Claude  
結論: **案 C（準備中維持）**

---

## 調査結果

### 候補者表示ページの存在確認

| パス | 状態 | HR アクセス可否 |
|------|------|--------------|
| `/admin/candidates/page.tsx` | 存在する（一覧のみ）| ❌ admin ロール専用 |
| `/admin/candidates/[id]/page.tsx` | **存在しない** | — |
| `/biz/candidates/[id]/page.tsx` | **存在しない** | — |
| `/biz/applications/page.tsx` | 存在する（一覧のみ）| ✅ だが詳細ページなし |
| `/biz/applications/[id]/page.tsx` | **存在しない** | — |
| `/users/[id]/page.tsx` | **存在しない** | — |

### 結論

候補者の詳細プロフィールを企業 HR が閲覧できるページが存在しない。

- `admin/candidates` は管理者専用かつ `[id]` 詳細ページも未実装
- `biz/applications/[id]` も未実装

### 対応方針

`src/app/biz/conversations/[id]/page.tsx` の「プロフィール詳細（準備中）」表示はそのまま維持。

---

## Phase ν-5 候補スコープ

以下のいずれかを Phase ν-5 で実装する際に合わせてリンクを有効化する:

| 案 | 実装内容 | リンク先 |
|---|---------|---------|
| **A（推奨）** | `/biz/candidates/[id]` — 企業 HR 向け候補者プロフィール表示ページ | `/biz/candidates/{candidate.id}` |
| B | `/biz/applications/[id]` — 応募詳細ページ（対話と応募のリンク） | `/biz/applications/{application_id}` |

案 A のリンク実装時のコード変更箇所:
```tsx
// src/app/biz/conversations/[id]/page.tsx の右サイドバー末尾
// 現在:
<span style={{ fontSize: 12, color: "var(--ink-mute)", ... }}>
  プロフィール詳細（準備中）
</span>

// 案 A 実装後:
<Link href={`/biz/candidates/${candidate?.id}`} style={{ ... }}>
  プロフィール詳細を見る →
</Link>
```

---

*（調査完了: 2026-05-08）*
