# Phase ν-7 完全クロージング - v20 引き継ぎ書

**作成日**: 2026-05-08
**作成元セッション**: v19 → v20
**Phase**: ν-7 /mypage 世界観統一
**前バージョン**: docs/handoff/handover-2026-05-08-nu6-complete.md (v19)

---

## ν-7 完全クロージング達成 🎉

**達成日**: 2026-05-08（金）
**所要時間**: 1 セッション（朝〜夜）
**完了段階数**: 9 段階（段階0/1/1.5/2/3/4/5/6/7）
**Hisato さん動作確認**: 全ページ OK 確定

### 達成事項

1. /mypage 配下の全ページ世界観統一
   - /mypage（ダッシュボード、各ビュー）
   - /mypage/conversations（対話一覧）
   - /mypage/conversations/[id]（チャット詳細）
   - /mypage/applications（応募管理）

2. /profile/edit（設定ページ）の世界観統一

3. 旧構造の完全削除（合計 1,712 行削除）
   - /dashboard 配下（ν-6 以前の旧マイページ遺物）
   - /api/save-job（参照元 0 件の旧 API）
   - /mypage/work-history/new（CareerHistoryEditor に統合済み）
   - /mypage/company-membership/new（同上）

4. 隠れバグ修正
   - Header.tsx の「マイページ」リンクが /dashboard を指していた
     誤指定を発見・修正（`dd695e5`）

5. 設計資産の確立
   - MypageLayout コンポーネント（再利用可能なレイアウトシェル）
   - MypageMockContext（本番化への移行パスが clean）
   - MypageActiveKey 型（段階2〜7 で型安全に活用）

---

## §1. Phase ν-7 概要

### テーマ
「/mypage 世界観統一 — レイアウトの分裂を癒す」

### 達成内容
/mypage（SPA）、/mypage/conversations、/mypage/conversations/[id]、
/mypage/applications、/profile/edit — **すべてのページが MypageLayout で統一**。
宙ぶらりん旧ページ 4件（1,712行）削除 + Header マイページリンク修正。

### 9 段階構成（全完了）
- 段階 0: hotfix（設定リンク接続 + プロフィールリンク修正）✅
- 段階 1: MypageLayout コンポーネント抽出（Context 案C）✅
- 段階 1.5: サイドバー整理 + activeKey 型整理 ✅
- 段階 2: /mypage/conversations を MypageLayout に移行 ✅
- 段階 3: /mypage/conversations/[id] を MypageLayout に移行 ✅
- 段階 4: /mypage/applications を MypageLayout に移行 ✅
- 段階 5: ブックマーク概念統一 ✅
- 段階 6: 宙ぶらりんページ整理 ✅
- 段階 7: /profile/edit を MypageLayout に移行 ✅

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

### 段階 2
- `1351a53`: refactor(mypage): ν-7 段階2 — conversations 旧サイドバー・旧レイアウトシェルを削除
- `154028d`: feat(mypage): ν-7 段階2 — conversations を MypageLayout でラップ（activeKey="conversations"）

### 段階 3
- `146ef52`: refactor(mypage): ν-7 段階3 — conversations/[id] 旧サイドバー・旧レイアウトシェルを削除
- `3e2b9cc`: feat(mypage): ν-7 段階3 — conversations/[id] を MypageLayout でラップ（activeKey="conversations"）

### 段階 4
- `32868ff`: feat(mypage): ν-7 段階4 — サイドバーに「応募管理」項目追加（Icons.application + SidebarItem）
- `df90671`: refactor(mypage): ν-7 段階4 — applications 旧サイドバー・旧レイアウトシェルを削除
- `4d234b2`: feat(mypage): ν-7 段階4 — applications を MypageLayout でラップ（activeKey="applications"）

### 段階 5
- `150b863`: docs: ν-7 段階5 — ブックマーク概念統一（残骸0件確認 + ν-8 候補2 記録）

### 段階 6
- `a3cc48d`: chore(mypage): ν-7 段階6 — /mypage/work-history/ 削除（321行）
- `7b094b5`: chore(mypage): ν-7 段階6 — /mypage/company-membership/ 削除（387行）
- `dd695e5`: chore: ν-7 段階6 — /dashboard/ 削除（972行）+ Header マイページリンクを /mypage に修正
- `d81e61a`: chore: ν-7 段階6 — /api/save-job/ 削除（32行）

### 段階 7
- `fd763e0`: feat(mypage): ν-7 段階7 — MypageActiveKey に "settings" を追加・「設定」アクティブ表示を有効化
- `5416263`: feat(profile/edit): ν-7 段階7 — /profile/edit を MypageLayout でラップ
- `f198c9b`: docs(nu7): ν-7 完全クロージング — 段階7完了 + サマリ記入

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
  - `Icons` オブジェクト（7 種 SVG: dashboard / briefcase / application / message / bookmark / check / calendar / settings）
  - `MypageActiveKey` 型 export（9値の discriminated union）
  - MOCK バナー（メンター切替）
  - 左サイドバー（260px）+ メインコンテンツ（1fr）グリッド
  - `onIsMentorChange` prop でビューリセットを MypageClient に委譲

---

## §4. 型定義・設計上の決定

### MypageActiveKey（最終版）
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
  | "applications"
  // 設定ページ (/profile/edit)
  | "settings";
```

### isMentor 状態管理（案C: Context 採用の理由）
- 案A（prop drilling）: MypageClient → MypageLayout で動くが、サブページには届かない
- 案B（URL params）: `/mypage?isMentor=true` はプロダクションで不自然
- 案C（React Context）: layout.tsx に Provider を置くことでサブツリー全体に共有。
  サブページでも同一のメンターフラグを参照できる ✅

### ActiveView と MypageActiveKey の関係
- `ActiveView`（MypageClient 内部型）⊂ `MypageActiveKey`（共有型）
- `onNavigate={(key: MypageActiveKey) => navigate(key as ActiveView)}` でナローイング

### /profile/edit の MypageMockProvider 問題
- `/profile/edit` は `/mypage/layout.tsx` の外にあるため、MypageMockContext が自動提供されない
- 解決策: `ProfileEditClient.tsx` の return 内で直接 `<MypageMockProvider>` でラップ
- これにより /profile/edit は独立した isMentor 状態（デフォルト false）を持つ
  → 設定ページではメンター管理セクションが非表示（適切な挙動）

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
- `| string` を MypageActiveKey から除去してコンパイル時型チェックを有効化

### 段階 2
- Tailwind クラス → CSS カスタムプロパティに統一（`var(--ink)` 等）
- ページタイトルを Noto Serif JP + inline style に統一
- 旧 `usePathname` + `SIDEBAR_ITEMS` パターンを完全削除

### 段階 3
- チャット詳細画面は「サイドバーあり」を採用（UIの一貫性を優先）
- チャットエリアの高さ計算:
  `calc(100vh - 205px)` = header(65) + MOCK banner(~44) + main padding-top(36) + main padding-bottom(60)
- 旧 `height: calc(100vh - 120px)` から変更（MypageLayout の余白分を追加計算）

### 段階 4
- 「応募管理」を SidebarItem に追加（カジュアル面談の下、メンター相談の上）
- `Icons.application`（ファイルアイコン）を新規追加

### 段階 5
- 旧サイドバーの「保存した求人」概念は段階2/3/4 で SIDEBAR_ITEMS 削除と
  共に既に消滅していたことを確認（grep: 0件）
- 「ブックマーク」概念に統一（記事・企業・メンターの3カテゴリー）
- 求人ブックマーク機能は ν-8 候補2 として記録（段階5 では実装しない）

### 段階 6
- `/dashboard` は ν-6 以前の旧マイページであることを Hisato さんが確認
- `/api/save-job/route.ts`: 参照元 0件（grep 確認）のため安全に削除
- Header.tsx の「マイページ」リンクが `/dashboard`（旧）だったバグを同時修正
- `src/lib/supabase/types.ts` は自動生成ファイルのため変更なし

### 段階 7
- `MypageActiveKey` に `"settings"` を追加（`fd763e0`）
- 設定ページ旧レイアウト（settings-layout grid + aside + main ラッパー）を削除
- 「← マイページ」右上ボタンは維持（戻るボタンとしての一般的UX）
- 左カラムの「マイページから行えます」ガイダンスは削除
  （MypageLayout の新サイドバーに物理的に置き換わるため）
- /profile/edit は `/mypage/layout.tsx` の外にあるため MypageMockProvider を直接 wrap

---

## §6. 申し送り（次セッションへ）

### Context は本番化への布石
`MypageMockContext` の `isMentor` は現在 useState(false) のモック値。
本番化時は `/mypage/layout.tsx` を Server Component + Client Provider 構成に変更し、
Supabase から `ow_users.is_mentor` を取得して初期値として渡す。
MOCK バナー自体も本番では非表示にする。

### キャッシュ崩れの予防（再確認）
大規模変更後は必ず `rm -rf .next && npm run dev` をワンセットで実行。
`Ready in xxxxms` だけでなく `Compiled /[ページ名]` ログを待ってからブラウザアクセス。
ポート 3000 が使用中の場合 3001 にフォールバックするので起動ログでポート番号を確認。

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

### ν-8 候補2: 求人ブックマーク機能の実装

**動機**: ν-7 段階5 でブックマーク概念を整理した結果、現状のブックマークは
記事・企業・メンターの3カテゴリーのみで、求人ブックマーク機能は未実装と確定。
ユーザーが「気になる求人」を保存する手段がない状態。

**やりたいこと**:
- ブックマークビューに「求人」セクション追加
- 求人詳細ページから「ブックマークに保存」ボタンの追加
- Supabase テーブル設計（ow_user_bookmarks に job_id を追加 or 別テーブル）
- ブックマークビューでの求人カードデザイン

**検討事項**:
- 既存のブックマーク UI に求人をどう統合するか（タブ式 / 縦並び / セクション分け）
- 求人ブックマークから求人詳細への遷移
- 応募管理（/mypage/applications）との関係性
  （応募 = ブックマーク+α なのか、別概念なのか）
- 旧 `/api/save-job` は段階6で削除済み。ν-8 で新規設計する

**スコープ**: フロント + バックエンド（Supabase テーブル）+ デザイン

---

## §8. 関連ドキュメント

- マスタープラン: `docs/planning/phase-nu-7-master-plan.md`
- 調査レポート: `docs/handoff/nu7-investigation-mypage-layout.md`
- v19 引き継ぎ書: `docs/handoff/handover-2026-05-08-nu6-complete.md`
- v20 引き継ぎ書（このファイル）: `docs/handoff/handover-2026-05-08-nu7-complete.md`

---

## §9. 完了サマリー（最終版）

| 段階 | テーマ | 主要コミット | 行数変化 |
|---|---|---|---|
| 0 | hotfix（リンク切れ修正） | `4dbaf94` / `831b1af` | +数行 |
| 1 | MypageLayout 抽出 + Context | `0e43dd4` / `258cf7f` / `c1aaa7c` | +新規3ファイル |
| 1.5 | サイドバー整理 + activeKey 型 | `5715091` / `1e00e86` / `ef66849` | 整理のみ |
| 2 | /mypage/conversations 移行 | `1351a53` / `154028d` | −49 |
| 3 | /mypage/conversations/[id] 移行 | `146ef52` / `3e2b9cc` | −46 |
| 4 | /mypage/applications 移行 + 応募管理追加 | `32868ff` / `df90671` / `4d234b2` | −33 |
| 5 | ブックマーク概念統一 | `150b863` | 0（記録のみ） |
| 6 | 宙ぶらりんページ整理 + Header 修正 | `a3cc48d` / `7b094b5` / `dd695e5` / `d81e61a` | −1,712 |
| 7 | /profile/edit 移行 | `fd763e0` / `5416263` / `f198c9b` | −50 |
| **合計** | | **21 コミット** | **−1,890 行超** |

---

## §10. ν-8 への正式引き継ぎ

### ν-8 候補の優先度（Hisato さんと次セッション冒頭で決定する）

候補1（職歴の立体化）と候補2（求人ブックマーク）を別フェーズに分けるか、
「Opinio らしいキャリアの可視化」というテーマで統合するか、
あるいは dogfooding から新テーマが浮かび上がるか —
これは新鮮な頭で判断すべき。

### 次セッション開始時の推奨アプローチ

明日の Claude へ:

1. 朝の挨拶は軽めに。Hisato さんの希望を聞く
2. dogfooding（自分のキャリアを書く）から始める意向があれば、それを推奨
3. dogfooding の体験から ν-8 のテーマが浮かび上がる可能性が高い
4. ν-7 で確立した規律を引き続き守る:
   - 動作確認スキップ厳禁
   - コミット分割厳守（旧 sidebar 削除 → Layout wrap の2コミット構成）
   - 大規模変更後は `rm -rf .next` 必須
   - ポート番号確認（3000 or 3001）
   - `Compiled /[ページ名]` ログを待ってからブラウザアクセス
