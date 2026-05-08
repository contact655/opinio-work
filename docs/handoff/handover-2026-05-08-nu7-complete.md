# Phase ν-7 完全クロージング - v20 引き継ぎ書

**作成日**: 2026-05-08
**作成元セッション**: v19 → v20
**Phase**: ν-7 /mypage 世界観統一
**前バージョン**: docs/handoff/handover-2026-05-08-nu6-complete.md (v19)

---

## §1. Phase ν-7 概要

### テーマ
「/mypage 世界観統一 — レイアウトの分裂を癒す」

### 達成内容
（ν-7 クロージング時に記入）

### 6 段階構成
- 段階 0: hotfix（設定リンク接続 + プロフィールリンク修正）✅
- 段階 1: MypageLayout コンポーネント抽出（Context 案C）✅
- 段階 1.5: サイドバー整理 + activeKey 型整理 ✅
- 段階 2: /mypage/conversations を MypageLayout に移行（未着手）
- 段階 3: /mypage/conversations/[id] を MypageLayout に移行（未着手）
- 段階 4: /mypage/applications を MypageLayout に移行（未着手）
- 段階 5: ブックマーク概念統一（未着手）
- 段階 6: 宙ぶらりんページ整理（未着手）

---

## §2. 主要コミット一覧

### 段階 0
- `4dbaf94`: fix(mypage): 設定サイドバー onClick 接続 + プロフィールリンク修正（3ファイル）
- `831b1af`: fix(mypage): サブページの旧サイドバー「プロフィール」href を /onboarding → /profile/edit に修正

### 段階 1
- `0e43dd4`: feat(mypage): MypageMockContext 新規作成（isMentor 状態を Context で管理）
- `258cf7f`: feat(mypage): layout.tsx 新規作成（MypageMockProvider でサブツリーをラップ）
- `c1aaa7c`: feat(mypage): MypageLayout コンポーネント新規作成（サイドバー + MOCK バナー + グリッド）

### 段階 1.5
- `5715091`: fix(mypage): MypageLayout から「プロフィールを編集」削除・Icons.user 削除
- `1e00e86`: refactor(mypage): MypageActiveKey 型を厳密化・| string 除去
- `ef66849`: fix(mypage): MypageClient に MypageActiveKey 型 import 追加・onNavigate 型注釈追加

### 段階 2〜6
（実装後に記入）

---

## §3. 新規追加されたコンポーネント・ファイル

### Context / Provider
- `src/app/(jobseeker)/mypage/_components/MypageMockContext.tsx`
  - `isMentor` / `setIsMentor` を Context で提供
  - 本番では Supabase の `ow_users.is_mentor` に差し替え予定
  - `MypageMockProvider` / `useMypageMock` を export

- `src/app/(jobseeker)/mypage/layout.tsx`
  - `/mypage` 配下全体を `MypageMockProvider` でラップ
  - Context を全サブページで共有するための sub-layout

### レイアウト
- `src/app/(jobseeker)/mypage/_components/MypageLayout.tsx`
  - `SidebarItem` コンポーネント
  - `Icons` オブジェクト（6 種 SVG）
  - `MypageActiveKey` 型 export
  - MOCK バナー（メンター切替）
  - 左サイドバー（260px）+ メインコンテンツ（1fr）グリッド
  - `onIsMentorChange` prop でビューリセットを MypageClient に委譲

---

## §4. 型定義・設計上の決定

### MypageActiveKey
```typescript
export type MypageActiveKey =
  // SPA ビュー (/mypage)
  | "dashboard"
  | "casual"
  | "mentor-reserve"
  | "bookmarks"
  | "mentor-requests"
  | "mentor-schedule"
  // サブページ (/mypage/conversations, /mypage/applications など)
  | "conversations"
  | "applications";
```

### isMentor 状態管理（案C: Context 採用の理由）
- 案A（prop drilling）: MypageClient → MypageLayout で動くが、サブページには届かない
- 案B（URL params）: `/mypage?isMentor=true` はプロダクションで不自然
- 案C（React Context）: layout.tsx に Provider を置くことでサブツリー全体に共有。
  サブページでも同一のメンターフラグを参照できる ✅

### ActiveView と MypageActiveKey の関係
- `ActiveView`（MypageClient 内部型）⊂ `MypageActiveKey`（共有型）
- `onNavigate={(key: MypageActiveKey) => navigate(key as ActiveView)}` でナローイング

---

## §5. 段階別の主要決定事項

### 段階 0
- 旧サイドバーのプロフィールリンクが `/onboarding`（新規ユーザー向けウィザード）に
  なっていた問題を発見・修正
- `/profile/edit` が正しい遷移先

### 段階 1
- MOCK バナーを MypageClient から MypageLayout に移動
  → `/mypage/conversations` 等のサブページでも MOCK バナーが表示されるようになる（意図した動作）
- `onIsMentorChange` prop: メンター→通常ユーザー切替時に
  mentor-requests / mentor-schedule ビューにいた場合は dashboard にリセット
- MypageClient: `const [isMentor, setIsMentor] = useState()` → `const { isMentor } = useMypageMock()` に置換

### 段階 1.5
- 「プロフィールを編集」サイドバー項目を削除
  → /profile/edit は設定ページに再定義済み（ν-6 段階5）なので、役割が重複していた
- `| string` をMypageActiveKey から除去してコンパイル時型チェックを有効化

### 段階 2〜6
（実装後に記入）

---

## §6. 申し送り

### Context は本番化への布石
`MypageMockContext` の `isMentor` は現在 useState(false) のモック値。
本番化時は `/mypage/layout.tsx` を Server Component + Client Provider 構成に変更し、
Supabase から `ow_users.is_mentor` を取得して初期値として渡す。
MOCK バナー自体も本番では非表示にする。

### conversations/[id] のサイドバー有無は段階 3 で判断
チャット詳細画面は全画面をチャットエリアに使う UX が良い可能性がある。
マスタープランの「検討事項」参照。

### 動作確認スキップ禁止の継続
各段階の動作確認は Hisato に依頼してから次に進む（ν-6 の教訓継続）。

---

## §7. ν-8 候補（次フェーズへの引き継ぎ）

### ν-8 候補1: 職歴の立体化 — Wantedly 風タイムライン

**動機**: ν-7 段階1.5 完了後の dogfooding 中、Hisato さんが Wantedly のプロフィール
画面を比較対象として確認し、Opinio の職歴表示が「平面的」「立体感が薄い」と感じた。

**やりたいこと**:
- 会社ロゴ表示（運営側が手動登録）
- 縦の年表ライン
- 在籍年数の表示
- 視覚的階層の強化（役職、期間、現職バッジ）

**検討事項**:
- データモデル: ow_companies に logo_url を追加するか？
- 運営フロー: ロゴはどう登録するか？（管理画面 / 直接 DB / Storage）
- デザイン: Wantedly 風 vs Opinio 独自の表現
- 想いフィールドとの統合: ν-6 で追加した「想い」をどう立体表示に組み込むか

**スコープ**: フロント + バックエンド（ロゴ管理）+ デザイン

---

## §8. 関連ドキュメント

- マスタープラン: `docs/planning/phase-nu-7-master-plan.md`
- 調査レポート: `docs/handoff/nu7-investigation-mypage-layout.md`
- v19 引き継ぎ書: `docs/handoff/handover-2026-05-08-nu6-complete.md`
- v20 引き継ぎ書（このファイル）: `docs/handoff/handover-2026-05-08-nu7-complete.md`

---

## §9. 完了サマリ

（ν-7 クロージング時に記入）

| 段階 | コミット数 | 主要成果 |
|---|---|---|
| 0 | 2 | リンク切れ hotfix |
| 1 | 3 | MypageLayout 抽出 + Context |
| 1.5 | 3 | サイドバー整理 + 型整理 |
| 2 | — | （未着手） |
| 3 | — | （未着手） |
| 4 | — | （未着手） |
| 5 | — | （未着手） |
| 6 | — | （未着手） |
| **合計** | **8+** | **ν-7 完全クロージング** |
