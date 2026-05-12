# 段階7-F Phase 4 完了 handover ドキュメント

**作成日**: 2026-05-12
**段階**: ν-8 段階7-F Phase 4 — 却下 API + UI 統合(承認モーダル + 却下ダイアログ)
**状態**: ✅ Phase 4 完了、push 済み、本番反映 ● Ready 確認済み、本番動作確認済み

---

## エグゼクティブサマリ

段階7-F Phase 4 では、Phase 3 で構築した承認 API に対する **却下 API** を実装し、
さらに **UI 統合** によって運営が **ブラウザだけで承認/却下できる状態** に到達した。

これにより、段階7-F の本質的なゴール = **「Dashboard SQL からの解放」** が達成。
運営作業フロー全体が以下の状態に変化:

```
Phase 1 まで:
  Dashboard SQL を運営が手で書く → ミスのリスク高 + 心理的負担大

Phase 4 以降:
  ブラウザ UI で完結
  ├── 承認: モーダル + プレビュー + ライブプレビュー
  └── 却下: 確認ダイアログ
```

**規模**: 1 Phase / 1 コミット(c1fd1f2)/ 6 ファイル / 730 行追加 / 69 行削除

---

## Phase 4 の出発点と判断

### 出発点

段階7-F Phase 3 完了時点で:
- 承認 API は完成、DevTools Console から呼び出せる状態
- 一覧ページ(/admin/school-requests)は **read-only**(Phase 2 で構築)
- 承認/却下を **UI から実行する手段が存在しない**

Phase 4 で UI 統合 + 却下 API を一括実装することで、運用フロー完成を目指す。

### 確定済み判断点(10 件)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | 却下 API エンドポイント | `/reject`(承認と対称) |
| 2 | 却下 API 処理範囲 | status を 'rejected' に UPDATE のみ |
| 3 | 却下 API 実装方式 | PostgreSQL FUNCTION(Migration 102) |
| 4 | 却下 API レスポンス | 最小(request_id + rejected_at) |
| 5 | 承認/却下ボタン UI | 一覧の各行にボタン |
| 6 | 承認入力 UI | モーダル |
| 7 | モーダルデフォルト値 | logo_letter = school_name 最初の文字、logo_gradient = 紺紫系 |
| 8 | 却下ボタン後 | 確認ダイアログ |
| 9 | 成功後 UI 挙動 | 該当行を一覧から消す |
| 10 | 成功フィードバック | トースト(既存 Toast 再利用) |

---

## 🚨 Phase 4 で発見した重要事実

### 1. 既存 UI 資産の発見と完全再利用

Phase 4 着手時、私(チャット)の指示文では「shadcn/ui Dialog 等を確認」と
仮置きしていたが、Claude Code が **既存資産を発見**:

| 既存資産 | 場所 | 用途 |
|---------|------|------|
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.tsx` | 却下確認ダイアログ |
| `Toast` | `src/components/ui/Toast.tsx` | 承認/却下成功通知 |

**含意**:
- 新規依存追加ゼロ
- 既存 inline styles パターン(`var(--royal)`、`var(--error)` 等)と完全に統一
- 将来同様の管理画面実装でも、まず `ls src/components/ui/` で確認すべき

これは段階7-F Phase 1 で確立した運用ルール「新規ルート作成前に `ls src/app/`」の **コンポーネント版**。

### 2. Server Component + Client Component ハイブリッド設計

`/admin/school-requests/page.tsx` の改修で確立したパターン:

```typescript
// page.tsx (Server Component)
async function fetchPendingRequests() { /* service_role で fetch */ }

export default async function SchoolRequestsPage() {
  const requests = await fetchPendingRequests();
  return (
    <div className="p-8">
      <h1>学校追加リクエスト</h1>
      <SchoolRequestsList initialRequests={requests} />  {/* Client へ受け渡し */}
    </div>
  );
}
```

```typescript
// SchoolRequestsList.tsx (Client Component)
"use client";

export default function SchoolRequestsList({ initialRequests }) {
  const [requests, setRequests] = useState(initialRequests);
  // ... 状態管理 + ボタン操作 + 楽観的 UI 更新
}
```

**この設計の利点**:
- Server 側: 認可 + 初期 fetch(SSR の恩恵を活用)
- Client 側: 状態管理 + インタラクティビティ(useState 等の Client 機能)
- データ受け渡しは props ベース(SSR 後の hydration 時に渡される)

**将来同様の管理画面実装の標準パターン** として採用すべき。

### 3. 楽観的 UI 更新の効果

承認/却下成功時に、API レスポンスを待たずに **該当行を一覧から消す** 設計:

```typescript
const handleApproveSuccess = useCallback(() => {
  if (!approvingId) return;
  removeRequest(approvingId);  // ← API 成功確認後、即除去
  setApprovingId(null);
  setToast({ message: "承認しました", variant: "default" });
}, [approvingId, removeRequest]);
```

**含意**:
- 体感速度が大幅向上(API レスポンス + 再 fetch を待たない)
- 失敗時は Toast で通知(本実装では成功時のみ除去なので問題なし)
- 状態を Client 側で管理することの恩恵

### 4. ApproveSchoolRequestModal の UX 配慮

Claude Code が私の指示を **超えた品質** で実装した部分:

| 機能 | 私の指示 | Claude Code の実装 |
|------|---------|-------------------|
| キャンセル方法 | キャンセルボタン | **+ Escape キー + 背景クリック** |
| プレビュー | 簡易表示 | **学校名も含めた完全プレビュー** |
| ARIA 属性 | 言及なし | **`role="dialog"`、`aria-modal`、`aria-labelledby` 完備** |
| エラー対応 | API エラー表示 | **+ ネットワークエラー fallback** |
| Submit 中の状態 | 「承認中...」 | **+ 背景クリック無効化、ボタンスタイル変更** |

これは **「既存実装に溶け込む」設計** の徹底。Claude Code が既存コンポーネントを
読み解いた上で、それを上回る配慮を加えた結果。

### 5. Phase 3 + Phase 4 の PostgreSQL FUNCTION 対称設計

Migration 101(approve)と Migration 102(reject)が完全に対称的:

| 項目 | approve(Phase 3) | reject(Phase 4) |
|------|------------------|------------------|
| SECURITY DEFINER | ✅ | ✅ |
| SET row_security = off | ✅(PG15+ 必須)| ✅ |
| FOR UPDATE 排他ロック | ✅ | ✅ |
| ERRCODE P0001 / P0002 | ✅ | ✅ |
| auth_id → ow_users.id 解決 | ✅ | ✅ |
| service_role 専用 EXECUTE | ✅ | ✅ |

**含意**:
- 同様の atomic transaction が必要な場合の **設計テンプレート** が確立
- approve 側を見れば reject 側がほぼ自動的に書ける(逆も真)
- 将来同様の FUNCTION(他の管理機能等)で再利用可能

### 6. `approved_at` カラムの rejected_at 再利用設計

却下時に専用カラム(`rejected_at`)を追加するのではなく、既存の
`approved_at` カラムを再利用:

```sql
UPDATE ow_school_requests
SET
  status      = 'rejected',
  approved_at = v_now,      -- ← rejected_at として再利用
  approved_by = v_approver_id
WHERE id = p_request_id;
```

**含意**:
- スキーマ変更を最小化(Migration 102 は FUNCTION 作成のみ)
- 「決着時刻」+「決着者」というセマンティクスで approved_at / approved_by を
  捉え直すと、approve/reject 両方で意味が通る
- 将来カラム名を `decided_at` / `decided_by` 等にリネームしたくなる可能性はあるが、
  当面は再利用で十分

---

## 実装サマリ

### コミット: `c1fd1f2`

#### 新規ファイル

1. **`supabase/migrations/102_create_reject_school_request_function.sql`**
   - `reject_school_request(p_request_id, p_approved_by)` FUNCTION
   - approve と対称的なパターン(SECURITY DEFINER + SET row_security = off + FOR UPDATE + ERRCODE)
   - approved_at を rejected_at として再利用

2. **`supabase/rollbacks/102_create_reject_school_request_function_rollback.sql`**
   - `DROP FUNCTION IF EXISTS reject_school_request(uuid, uuid);`

3. **`src/app/api/admin/school-requests/[id]/reject/route.ts`**
   - POST ハンドラ(body 不要)
   - approve と同じ二重認可パターン(auth + isAdmin)
   - ERRCODE マッピング(P0001 → 404、P0002 → 409)

4. **`src/components/admin/ApproveSchoolRequestModal.tsx`**
   - 承認モーダル Client Component
   - logo_letter / logo_gradient 入力 + ライブプレビュー
   - Escape キー + 背景クリックでキャンセル
   - ARIA 属性完備
   - 既存 inline styles + CSS 変数(`var(--royal)`、`var(--ink)`、`var(--error)` 等)を全面活用

5. **`src/components/admin/SchoolRequestsList.tsx`**
   - 一覧 + 承認/却下アクション Client Component
   - 楽観的 UI 更新(成功時に該当行除去)
   - 既存 ConfirmDialog + Toast を再利用
   - 空状態の表示(「現在 pending のリクエストはありません」)

#### 変更ファイル

1. **`src/app/admin/school-requests/page.tsx`**
   - Server Component → Server + Client ハイブリッド設計に変更
   - 初期 fetch + 認可は Server 側、UI 操作は Client 側

#### Migration 適用前後の検証

- Migration 102 Dashboard 適用: `Success. No rows returned` ✅
- 確認 1: `reject_school_request` FUNCTION 存在 + `prosecdef = true` ✅
- 確認 2: 両 FUNCTION(approve + reject)並存確認 ✅

#### 動作確認(7 シナリオ全合格)

| シナリオ | 内容 | 結果 |
|---------|------|------|
| 1 | テストリクエスト 2 件作成(/profile/edit + バナー) | ✅ |
| 2 | 一覧で承認/却下ボタン表示確認 | ✅ |
| **3** ⭐ | **承認モーダル + デフォルト値 + プレビュー + 承認成功 + Toast** | **✅** |
| 4 | /profile/edit でロゴ表示(本フェーズ 2 度目) | ✅ |
| **5** ⭐ | **却下確認ダイアログ + 却下成功 + Toast** | **✅** |
| 6 | 却下キャンセル(任意) | ✅ |
| 7 | Dashboard SQL で DB 状態確認 | ✅ |

特に **シナリオ 3 と 5** が本フェーズの 2 大クライマックス。
これらが動いたことで「Dashboard SQL からの解放」が達成された。

---

## 設計上の重要なポイント(将来参考)

### Client / Server コンポーネントの責務分担

```
Server Component (page.tsx)
├── 認可確認(layout で auth_is_admin RPC)
├── 初期データ fetch(service_role で RLS バイパス)
└── Client Component に props として受け渡し

Client Component (SchoolRequestsList)
├── useState で initialRequests を初期値として受け取る
├── ユーザー操作(承認/却下ボタンクリック)
├── 楽観的 UI 更新(API 成功時に該当行除去)
├── サブコンポーネント(モーダル、ダイアログ、Toast)の管理
└── エラーハンドリング(Toast で通知)
```

この境界を守ることで:
- Server 側のメリット(SSR、認可、初期表示の高速化)が活きる
- Client 側のメリット(状態管理、インタラクション)が活きる
- データの流れが一方向(Server → Client、Client → API)で追いやすい

### 既存実装の徹底活用

新規 UI コンポーネントを作る前に、必ず確認:

1. `ls src/components/ui/` で既存 UI コンポーネントを確認
2. `grep -rn "ConfirmDialog\|Toast\|Modal\|Dialog" src/components/` で類似実装を確認
3. 既存スタイルパターン(inline styles、CSS 変数、Tailwind クラス)を踏襲

これにより:
- UI の一貫性が保たれる(運営にとっての学習コスト減)
- 新規依存追加ゼロ(バンドルサイズ + メンテナンス負荷の抑制)
- 既存実装の改善余地を発見できる

---

## 次の段階に向けて

### 段階7-F Phase 5 候補(自然な延長、未着手)

**logo 入力 UX 改善**

Phase 4 のモーダルは最低限の logo_letter / logo_gradient 入力フォーム。
これを改善:

```
1. logo_letter 入力支援:
   - 候補表示(school_name の 1-3 文字目を自動候補)
   - 「東京大学」→ 候補「東」「東京」「東大」のチップ表示

2. logo_gradient プリセットパレット:
   - 既存 ow_schools のグラデーション一覧を表示
   - クリックで選択 → 入力欄に CSS gradient が入る
   - 「カスタム」オプションで自由入力も可能

3. プレビュー強化:
   - 現状の簡易プレビュー → SchoolLogoImg コンポーネント再利用
   - 実際の表示と完全に同じレンダリング

実装規模: 小〜中(モーダルの拡張のみ)
```

### 段階7-F Phase 6 候補(全体 handover doc)

Phase 1-5 完了後、段階7-F 全体の総括 handover doc を作成。

### 段階7-F 残作業(優先度低)

- **approved/rejected 一覧ページ**: 過去の決着履歴を確認できる画面
- **`ADMIN_EMAIL` vs `ADMIN_EMAILS` 整理**: 環境変数の重複解消
- **一括承認/却下**: 複数選択 + バッチ処理

これらは Phase 5 以降で必要に応じて。

---

## 段階6 + 段階7 の全体状況(段階7-F Phase 4 完了時点)

- **完了済み段階**: 6-1, 6-2, 6-3-1, 6-3-1.5, 6-3-2, 6-3-3, 6-4, 6-5, 6-6, 6-7, 6-8, **7-F Phase 1**, **7-F Phase 2**, **7-F Phase 3**, **7-F Phase 4**
- 段階6 累計: 約 74 コミット + 19 migration
- 段階7 累計: 7-F Phase 1-4 完了、Phase 5-6 未着手
- 残存技術的負債(変更なし):
  - 段階6-4 判断点 2: `ow_uploads_auth_insert` 強化
  - 段階6-4 判断点 3: documents/candidate-documents 用途確認
  - 段階6-3-3 §6 #4: card_color カスタマイズ
  - 段階7-F: `ADMIN_EMAIL`(単数)と `ADMIN_EMAILS`(複数)の整理

---

## ファイル一覧

### 新規ファイル(Phase 4)

- `supabase/migrations/102_create_reject_school_request_function.sql`
- `supabase/rollbacks/102_create_reject_school_request_function_rollback.sql`
- `src/app/api/admin/school-requests/[id]/reject/route.ts`
- `src/components/admin/ApproveSchoolRequestModal.tsx`
- `src/components/admin/SchoolRequestsList.tsx`

### 変更ファイル(Phase 4)

- `src/app/admin/school-requests/page.tsx`(Server + Client 分離)

### handover doc

- `docs/handover-2026-05-12-nu8-stage7-f-phase-4.md`(本ファイル)

---

## 運用課題と反省点

### 反省点なし(順調な進行)

Phase 4 は段階6-7、段階7-F Phase 1-3 で確立した運用ルールを全て遵守し、
致命的な問題なく完走できた。

### 確認できた既存運用ルールの効果

- **`npm run build` 必須**: 6 度目の実践、完全に身体化
- **Vercel deployments 目視確認**: ● Ready 確認済み
- **本番反映を完走の定義に組み込む**: 本セッションで遵守
- **`ls src/app/` で網羅確認**: Phase 4 で `ls src/components/ui/` 版に拡張

### Phase 4 で実践した新しい知見

- **既存 UI 資産の発見と再利用**(`ConfirmDialog`、`Toast`)
- **Server + Client Component ハイブリッド設計パターン**
- **楽観的 UI 更新**(成功時に該当行を即除去)
- **PostgreSQL FUNCTION 対称設計**(approve + reject の双子設計)
- **既存カラムのセマンティクス再解釈**(approved_at → rejected_at 再利用)

これらは将来同様の管理機能実装で再利用できる重要な知見。

---

## 本セッションの段階7-F Phase 4 総括

### 達成したこと

- 却下 API の本番稼働
- 一覧ページの read-only → fully functional への進化
- **「Dashboard SQL からの解放」** の達成(段階7-F の本質的なゴール)
- 運営作業フロー完成: ユーザー送信 → 運営確認 → UI で承認/却下 → ロゴ反映

### 印象的な瞬間

- **シナリオ 3 のモーダル表示**: 承認ボタンクリック → モーダル + デフォルト値 + ライブプレビューが動いた瞬間。Phase 4 の UI 統合が機能した証明。
- **シナリオ 5 の却下ダイアログ**: 既存 ConfirmDialog 再利用 + Toast 通知が動いた瞬間。既存 UI 資産の価値が証明された。
- **Claude Code の既存実装発見**: 私の指示文を超えて、既存 `ConfirmDialog` + `Toast` を発見・再利用した瞬間。「既存実装に溶け込む」設計の徹底。

### 本セッションのテーマ

**Opinio の「丁寧な介在」運用フローが両側(ユーザー側 段階6-8 + 運営側 段階7-F)で完成、Dashboard SQL からの解放達成**

これは本日構築した全段階(6-7、6-8、7-F Phase 1-4)の結実点。

---

**段階7-F Phase 4 完了**
**作成者**: Claude(チャット) + 柴久人
**作成日**: 2026-05-12
