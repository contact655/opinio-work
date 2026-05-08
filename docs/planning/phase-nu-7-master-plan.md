# Phase ν-7 マスタープラン: /mypage 世界観統一 — レイアウトの分裂を癒す

**作成日**: 2026-05-08
**前フェーズ**: Phase ν-6（自己の物語化）
**参照調査**: docs/handoff/nu7-investigation-mypage-layout.md

---

## 目的

/mypage（新レイアウト）と /mypage/conversations, applications（古いレイアウト）の
世界観の断絶を解消する。dogfooding する Hisato さん本人が違和感なく使える状態を作る。

---

## 非目的（ν-7 ではやらないこと）

- MypageClient.tsx の SPA 解体（将来の ν-X で別途）
- 求人ブックマーク機能の実装（概念統合の方針決定だけ）
- 職歴 DnD（v19 §6 の別候補）
- 年齢層を生年月日ベースに変更（同上）

---

## 段階構成

### 段階0: hotfix ✅【完了済み】
**コミット**: `4dbaf94`, `831b1af`

- 新サイドバー「設定」→ `/profile/edit` に接続
- 旧サイドバー「プロフィール」→ `/profile/edit` に修正（3ファイル）

---

### 段階1: MypageLayout コンポーネントの抽出

MypageClient.tsx (1000行) から以下を切り出す:
- 左サイドバー（マイアクティビティ / アカウント）
- MOCK バナー（メンター切替）
- グリッドレイアウト（260px + 1fr）

**新ファイル**: `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx`

**props 設計（案）**:
```typescript
type MypageLayoutProps = {
  activeKey: "dashboard" | "casual" | "mentor-reserve" | "bookmarks"
           | "conversations" | "applications" | "mentor-requests" | "mentor-schedule";
  children: React.ReactNode;
};
```

**実装方針**:
- `isMentor` 状態は MypageClient.tsx 側で保持し、MypageLayout に prop で渡す
- MOCK バナーの isMentor 切替ボタンも MypageLayout に移すか、MypageClient に残すかは
  サブページでメンター判定をどう扱うかによる
- サイドナビの `SidebarItem` コンポーネントも同ファイルに定義

---

### 段階2: /mypage/conversations を MypageLayout に移行

- 古い `SIDEBAR_ITEMS` を削除
- `MypageLayout` でラップ（`activeKey="conversations"`）
- Tailwind クラス（`className="min-h-screen bg-background"` 等）を CSS カスタムプロパティに統一
- 「対話」がアクティブ表示されるよう `activeKey` を渡す

**削除対象**:
```typescript
// conversations/page.tsx から削除
type SidebarItem = ...
const SIDEBAR_ITEMS: SidebarItem[] = [...]
<aside className="hidden lg:block w-[200px]">...</aside>
```

---

### 段階3: /mypage/conversations/[id] を MypageLayout に移行

- 段階2と同じ要領
- **検討事項**: チャット詳細画面は左サイドバー不要かもしれない
  - サイドバーあり: 3カラム構成（260px + main + チャットエリア）
  - サイドバーなし: 画面全体をチャットエリアに割り当てる
  - 今のチャット詳細画面はほぼ全画面を使っているので、サイドバーなしの方が UX が良い可能性

---

### 段階4: /mypage/applications を MypageLayout に移行

- 段階2と同じ要領（`activeKey="applications"`）
- 新サイドバーに「応募管理」項目を追加（MypageLayout.tsx に追加）
- 追加位置の案: 「対話」の上（カジュアル面談 → 応募管理 → 対話 → ブックマーク）

---

### 段階5: ブックマーク概念統一

- 旧サイドバーの「保存した求人」（`disabled: true` / `href: "#"`）項目を削除
- 新サイドバーの「ブックマーク」に統一
- 「求人ブックマーク」のプレースホルダ作成は別 ν（ブックマーク機能の完全実装）

---

### 段階6: 宙ぶらりんページの整理

以下のページがどこからもリンクされていない（調査レポート参照）:
- `/mypage/work-history/new`
- `/mypage/company-membership/new`

**作業**:
1. `grep -r "work-history/new\|company-membership/new"` で参照箇所を全確認
2. 参照がなければ page.tsx を削除
3. 参照があれば遷移元も含めて整理

---

## ファイル変更予定

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx` | 新規作成 | サイドバー + MOCK バナー + グリッドレイアウト |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | 修正 | MypageLayout を使うようにリファクタ |
| `src/app/(jobseeker)/mypage/conversations/page.tsx` | 修正 | 旧 SIDEBAR_ITEMS 削除 + MypageLayout でラップ |
| `src/app/(jobseeker)/mypage/conversations/[id]/page.tsx` | 修正 | 同上（サイドバー有無は段階3で決定） |
| `src/app/(jobseeker)/mypage/applications/page.tsx` | 修正 | 旧 SIDEBAR_ITEMS 削除 + MypageLayout でラップ |
| `src/app/(jobseeker)/mypage/work-history/new/page.tsx` | 削除候補 | 段階6で要確認 |
| `src/app/(jobseeker)/mypage/company-membership/new/page.tsx` | 削除候補 | 段階6で要確認 |

---

## 技術的留意点

### `isMentor` 状態の扱い
現在 MypageClient.tsx の useState で管理されている。
MypageLayout に切り出す際、サブページ（conversations 等）では
メンターフラグを Supabase から取得する必要が生じる可能性がある。

### MOCK バナーのサブページ表示
MOCK バナーは現在 MypageClient.tsx にハードコードされている。
MypageLayout に移動した場合、conversations/applications でも表示されるようになる。
これは意図した動作（ν-7 候補リストにある「MOCK バナーを /mypage 配下の全ページで表示」）。

### Tailwind vs CSS カスタムプロパティ
旧ページは Tailwind、新ページは CSS カスタムプロパティ（`var(--royal)` 等）。
移行後は CSS カスタムプロパティに統一する方針。

### `position: sticky` の警告
MOCK バナーの `position: sticky` で Next.js に警告が出る既知の問題（ν-6 調査済み）。
ν-7 では解消しない（ν-7 候補リストの低優先度項目）。

---

## 関連ドキュメント

- 調査レポート: `docs/handoff/nu7-investigation-mypage-layout.md`
- v19 引き継ぎ書: `docs/handoff/handover-2026-05-08-nu6-complete.md`
- ν-6 マスタープラン: `docs/planning/phase-nu-6-master-plan.md`
