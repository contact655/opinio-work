# StatusPill 系バッジ統合 調査レポート（2026-07）

> 調査日: 2026-07-08（追記: 2026-07-08）  
> 変更なし・調査・設計提案のみ

---

## 1. 3ファイルの props 仕様とマッピング表

### 1-1. `src/components/common/StatusPill.tsx`（統合先・残す）

**Props**
```typescript
interface StatusPillProps {
  variant: StatusVariant;  // 下記の型ユニオン
  size?: "sm" | "md";     // デフォルト "md"
  children?: React.ReactNode;  // 省略時は label を表示
  className?: string;
}
```

**ステータスマッピング表**

| variant | bg | color | label（デフォルト表示） |
|---------|-----|-------|---------------------|
| `pending` | `#FEFCE8` | `#B45309` | 新規受信 |
| `confirming` | `var(--royal-50)` | `var(--royal)` | 確認中 |
| `scheduling` | `#F5F3FF` | `var(--purple)` | 日程調整中 |
| `scheduled` | `#FDF2F8` | `var(--pink)` | 予定確定 |
| `completed` | `var(--line-soft)` | `var(--ink-soft)` | 完了 |
| `declined` | `var(--error-soft)` | `var(--error)` | 辞退 |
| `published` | `var(--success-soft)` | `var(--success)` | 公開中 |
| `draft` | `var(--bg-tint)` | `var(--ink-mute)` | 下書き |
| `reviewing` | `#FEFCE8` | `#B45309` | 審査中 |

**実装方法**: CSS 変数 + ハードコード混在。`sm` サイズのみ `borderRadius: 3`（角あり）、`md` は `borderRadius: 100`（全丸）。

---

### 1-2. `src/components/business/MeetingStatusBadge.tsx`（削除候補）

**Props**
```typescript
type Props = {
  status: MeetingStatus;  // 型定義: lib/business/mockMeetings.ts
  size?: "sm" | "md";    // デフォルト "md"
};
// children・className・label override なし
```

**型定義元** (`lib/business/mockMeetings.ts`)
```typescript
type MeetingStatus = "pending" | "company_contacted" | "scheduled" | "completed" | "declined"
```

**ステータスマッピング表**

| status | bg | color | label |
|--------|-----|-------|-------|
| `pending` | `var(--warm-soft)` | `#B45309` | 新規受信 |
| `company_contacted` | `var(--royal-50)` | `var(--royal)` | 確認中 |
| `scheduled` | `var(--purple-soft)` | `var(--purple)` | 面談予定 |
| `completed` | `var(--line-soft)` | `var(--ink-soft)` | 完了 |
| `declined` | `var(--error-soft)` | `var(--error)` | 見送り |

**実装方法**: CSS 変数中心。`sm`/`md` 両方 `borderRadius: 100`（常に全丸）。`fontFamily: "'Inter', sans-serif"` を明示。`whiteSpace: "nowrap"` あり。

---

### 1-3. `src/components/business/JobStatusBadge.tsx`（削除候補）

**Props**
```typescript
type Props = {
  status: JobStatus;    // 型定義: lib/business/mockJobs.ts
  size?: "sm" | "md";  // デフォルト "md"
};
// children・className・label override なし
```

**型定義元** (`lib/business/mockJobs.ts`)
```typescript
type JobStatus = "draft" | "pending_review" | "published" | "active" | "rejected" | "private"
```

**ステータスマッピング表**

| status | bg | color | label |
|--------|-----|-------|-------|
| `published` | `var(--success-soft)` | `var(--success)` | 公開中 |
| `active` | `var(--success-soft)` | `var(--success)` | 公開中（旧ステータス） |
| `pending_review` | `var(--purple-soft)` | `var(--purple)` | 運営審査中 |
| `draft` | `var(--line-soft)` | `var(--ink-soft)` | 下書き |
| `rejected` | `var(--error-soft)` | `var(--error)` | 差し戻し |
| `private` | `#F1F5F9` | `#6b7280` | 非公開 |

**実装方法**: CSS 変数中心（`private` のみハードコード）。`sm`/`md` 両方 `borderRadius: 100`。`fontFamily: "'Inter', sans-serif"` を明示。`whiteSpace: "nowrap"` あり。

---

## 2. 利用箇所の一覧

### 2-1. `MeetingStatusBadge` — 2箇所

| ファイル | 行 | 渡し方 |
|---------|-----|--------|
| `src/components/business/MeetingCard.tsx` | L116 | `<MeetingStatusBadge status={m.status} size="sm" />` |
| `src/components/business/MeetingDetailPanel.tsx` | L236 | `<MeetingStatusBadge status={m.status} />` |

### 2-2. `JobStatusBadge` — 1箇所

| ファイル | 行 | 渡し方 |
|---------|-----|--------|
| `src/components/business/JobListCard.tsx` | L247 | `<JobStatusBadge status={job.status} />` |

### 2-3. `StatusPill`（共通コンポーネント）— import ゼロ ⚠️

`src/components/common/StatusPill.tsx` を **import して使っているファイルは存在しない**。  
`src/components/common/index.ts` が re-export しているだけで、実際に利用されていない。

### 2-4. ローカル `StatusPill`（同名の別実装）— 各ページ内に2つ存在

| ファイル | 実装の特徴 | 使用ステータス |
|---------|-----------|--------------|
| `src/app/biz/applications/ApplicationsClient.tsx` | `status: ApplicationStatus` を受け取るローカル関数 | `pending / reviewing / interview / accepted / rejected / hired` |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | `statusKey: string` + `label?: string` を受け取るローカル関数。`mockMypageData.ts` の `PILL_STYLES / STATUS_VARIANT / STATUS_LABEL` を参照 | `pending / company_contacted / scheduled / completed / declined / pending_review / approved / cancelled` |

---

## 3. マッピングの重複・衝突チェック

### 同じステータス値なのに色・ラベルが違うケース

| ステータス値 | ファイル | label | bg | color |
|------------|---------|-------|-----|-------|
| `pending` | `StatusPill.tsx` | **新規受信** | `#FEFCE8` | `#B45309` |
| `pending` | `MeetingStatusBadge.tsx` | **新規受信** | `var(--warm-soft)` | `#B45309` |
| `pending` | `MypageClient.tsx`（ローカル） | **企業確認中** | `var(--warm-soft)` | `#B45309` |
| `pending` | `ApplicationsClient.tsx`（ローカル） | — | `#FEF3C7` | `#D97706` |

→ **`pending` は4通りの bg・labelが混在**。視覚的には近似しているが厳密には異なる。

| ステータス値 | ファイル | label | color |
|------------|---------|-------|-------|
| `declined` | `StatusPill.tsx` | **辞退** | `var(--error)` |
| `declined` | `MeetingStatusBadge.tsx` | **見送り** | `var(--error)` |

→ **同じ色だがラベルが違う**（辞退 vs 見送り）。文脈は正しいが統一基準がない。

| ステータス値 | ファイル | label | bg |
|------------|---------|-------|-----|
| `scheduled` | `StatusPill.tsx` | **予定確定** | `#FDF2F8`（pink系） |
| `scheduled` | `MeetingStatusBadge.tsx` | **面談予定** | `var(--purple-soft)` |

→ **同じ値なのに色が違う**（pink vs purple）。

### 別の値だが意味が同じケース

| 意味 | ステータス値 | ファイル |
|------|------------|---------|
| 公開中 | `published` | `JobStatusBadge`, `StatusPill` |
| 公開中（旧） | `active` | `JobStatusBadge`（コメントに「旧ステータス」と明記） |
| 確認中 | `confirming` | `StatusPill`（Meeting系で使うつもりで定義？） |
| 確認中 | `company_contacted` | `MeetingStatusBadge`（実際に使われている） |
| 審査中 | `reviewing` | `StatusPill`（amber）, `ApplicationsClient`（royal） |
| 審査中 | `pending_review` | `JobStatusBadge`（purple）, `MypageClient`（royal） |

→ **`reviewing` と `pending_review` が並立**しており、色も文脈もバラバラ。

---

## 4. 統合方針の提案

### 案A: StatusPill に吸収 + 業務側バッジは薄いラッパーとして残す

**方針**: `StatusPill` の `StatusVariant` に業務ステータスをすべて追加。  
`MeetingStatusBadge` / `JobStatusBadge` は内部で `StatusPill` を呼ぶ薄いラッパーに書き換える。  
呼び出し側（`MeetingCard`, `MeetingDetailPanel`, `JobListCard`）は変更不要。

**変更ファイル数**: 3ファイル（StatusPill, MeetingStatusBadge, JobStatusBadge）

**追加する variant**

| 追加 variant | 意味 | bg | color |
|-------------|------|-----|-------|
| `meeting_contacted` | カジュアル面談：確認中 | `var(--royal-50)` | `var(--royal)` |
| `meeting_scheduled` | カジュアル面談：面談予定 | `var(--purple-soft)` | `var(--purple)` |
| `pending_review` | 求人：運営審査中 | `var(--purple-soft)` | `var(--purple)` |
| `rejected` | 求人：差し戻し | `var(--error-soft)` | `var(--error)` |
| `private` | 求人：非公開 | `#F1F5F9` | `#6b7280` |
| `active` | 求人：公開中（旧・alias for published） | `var(--success-soft)` | `var(--success)` |

**ラッパー実装イメージ（MeetingStatusBadge の場合）**:
```tsx
import { StatusPill } from "@/components/common/StatusPill";

const MEETING_STATUS_TO_VARIANT: Record<MeetingStatus, StatusVariant> = {
  pending:           "pending",
  company_contacted: "meeting_contacted",
  scheduled:         "meeting_scheduled",
  completed:         "completed",
  declined:          "declined",
};

export function MeetingStatusBadge({ status, size = "md" }: Props) {
  return <StatusPill variant={MEETING_STATUS_TO_VARIANT[status]} size={size} />;
}
```

**リスク**: 低  
- 呼び出し側を一切変更しないため、回帰リスクがほぼない  
- variant 名が `company_contacted` → `meeting_contacted` のように意味が変わるが、呼び出し側には影響しない  
- ローカル実装（`ApplicationsClient`, `MypageClient`）は別途対応が必要（今回スコープ外）  

**工数感**: 1〜2時間

---

### 案B: 完全一本化して業務側バッジを削除・呼び出し側も全書き換え

**方針**: `MeetingStatusBadge` / `JobStatusBadge` を削除。  
呼び出し側3箇所を直接 `StatusPill` へ書き換え。  
ついでにローカル実装（`ApplicationsClient`, `MypageClient`）も共通 `StatusPill` に統合。

**変更ファイル数**: 7ファイル  
`StatusPill.tsx` / `MeetingStatusBadge.tsx`（削除）/ `JobStatusBadge.tsx`（削除）  
`MeetingCard.tsx` / `MeetingDetailPanel.tsx` / `JobListCard.tsx` / `ApplicationsClient.tsx` / `MypageClient.tsx`

**呼び出し側変更イメージ（MeetingCard の場合）**:
```tsx
// 変更前
<MeetingStatusBadge status={m.status} size="sm" />

// 変更後（variant マッピングが呼び出し側に必要）
const MEETING_TO_VARIANT: Record<MeetingStatus, StatusVariant> = { ... };
<StatusPill variant={MEETING_TO_VARIANT[m.status]} size="sm" />
```

**リスク**: 中  
- 呼び出し側3〜5ファイルを同時に変更するため、型エラーや表示崩れのリスクが増す  
- `MypageClient.tsx`（2,200行超）や `ApplicationsClient.tsx` 内のローカル実装を同時に変更する場合は影響範囲が大きい  
- `mockMypageData.ts` の `PILL_STYLES / STATUS_VARIANT / STATUS_LABEL` が不要になるが、他で使われている可能性を要確認  

**工数感**: 半日〜1日

---

## 5. 推奨案

**→ 案A（ラッパー方式）を推奨**

理由:
1. **呼び出し側を変えない**: `MeetingCard`, `MeetingDetailPanel`, `JobListCard` の3ファイルに触れずに済む
2. **段階移行が可能**: まず業務バッジを薄いラッパーに書き換え → 後のリファクタで呼び出し側も移行できる
3. **リスクが最小**: 変更ファイルが3つのみで回帰テストが容易
4. **ローカル実装の問題は分離できる**: `ApplicationsClient` と `MypageClient` のローカル `StatusPill` は別のタスクとして扱える（今回の3ファイル統合とは独立している）

**将来的に案B へ移行するタイミング**: ローカル実装も含めた全面統合は、`MypageClient.tsx` や `ApplicationsClient.tsx` のコンポーネント分割リファクタ時に合わせて行うのが自然。

---

---

## 6. 追加調査①: `declined` の意味は1つか2つか

### 結論: **企業アクション専用。候補者アクションには使われていない。**

`declined` は `MeetingStatus`（カジュアル面談）のみに存在するステータス値で、  
**企業が申込を「見送る」アクション** を指す。候補者側の辞退には使われていない。

#### 根拠

| ファイル | 記述 | 文脈 |
|---------|------|------|
| `lib/business/mockMeetings.ts` | `// pending / company_contacted / scheduled / completed / declined`・`{ status: "declined", label: "見送り" }` | **MeetingStatus の一値（企業ドメイン）** |
| `components/business/MeetingDetailPanel.tsx` | `「本当に見送りますか？」→「見送る」ボタン` → `onStatusChange?.("declined")` | **企業担当者が操作するボタン** |
| `api/biz/meetings/[id]/route.ts` | `NOTIFY_STATUSES = ["company_contacted", "scheduled", "declined"]` → 候補者へ通知 | **企業→候補者 への通知トリガー**（企業側の操作であることが明確） |
| `biz/analytics/page.tsx` | `{ label: "辞退", count: meetings.declined }` | 企業の分析ダッシュボード |
| `admin/meetings/page.tsx` | `declined: { label: "辞退/不採択" }` | 管理者視点（企業アクションを表示） |

#### ラベルのブレ（表示名の揺れがあるが意味は同じ）

| ファイル | `declined` のラベル表示 |
|---------|----------------------|
| `MeetingStatusBadge.tsx` | **見送り** |
| `StatusPill.tsx` | **辞退** |
| `PendingMeetings.tsx` | **辞退** |
| `MypageClient.tsx`（求職者マイページ） | **お断りの連絡**（ステータスメタ） / **見送り**（ステップ表示） |
| `biz/analytics/page.tsx` | **辞退** |
| `admin/meetings/page.tsx` | **辞退/不採択** |
| `mockMypageData.ts` | **見送り** |

**→ 「見送り」（企業目線）と「辞退」（候補者目線）で表示名が混在しているが、**  
**コードの操作主体は一貫して「企業」。意味は1つ。**

#### `rejected` との使い分け

`rejected` は **求人掲載（JobStatus）** と **求人応募（ApplicationStatus）** の2ドメインで使われる別のステータス値。

| ドメイン | ステータス値 | 意味 |
|---------|------------|------|
| カジュアル面談 | `declined` | 企業が面談申込を見送り |
| 求人掲載 | `rejected` | 編集部が求人を差し戻し |
| 求人応募 | `rejected` | 企業が候補者を不採用 |

**→ `declined` と `rejected` は完全に別ドメインで使い分けられており、混在・衝突はない。**

#### ラベル統一の推奨

`declined` の表示名は「**見送り**」に統一することを推奨（企業が主語 = 企業が見送る、が自然。  
「辞退」は候補者が主語の言葉であり、企業担当者の操作画面には不適切）。

---

## 7. 追加調査②: `scheduled` を purple にした場合の色の衝突チェック

### 全ステータス → 現状の色マッピング（統合前）

以下は `StatusPill`・`MeetingStatusBadge`・`JobStatusBadge` を統合した際に  
必要になるすべてのステータス値と、現在各コンポーネントで使っている色をまとめたもの。

| ステータス値 | ドメイン | 現状の bg | 現状の color | 色相 |
|------------|---------|-----------|------------|------|
| `pending` | 面談・応募共通 | `#FEFCE8` / `var(--warm-soft)` | `#B45309` | **amber** |
| `company_contacted` | 面談 | `var(--royal-50)` | `var(--royal)` | **royal blue** |
| `scheduled` | 面談 | `var(--purple-soft)` ← MeetingStatusBadge | `var(--purple)` | **purple** |
| `scheduled`（StatusPill） | 旧定義 | `#FDF2F8` | `var(--pink)` | **pink** ⚠️ 衝突 |
| `completed` | 面談・求人共通 | `var(--line-soft)` | `var(--ink-soft)` | gray |
| `declined` | 面談 | `var(--error-soft)` | `var(--error)` | red |
| `published` / `active` | 求人 | `var(--success-soft)` | `var(--success)` | green |
| `pending_review` | 求人 | `var(--purple-soft)` | `var(--purple)` | **purple** |
| `draft` | 求人 | `var(--line-soft)` / `var(--bg-tint)` | `var(--ink-soft)` / `var(--ink-mute)` | gray |
| `rejected` | 求人・応募 | `var(--error-soft)` | `var(--error)` | red |
| `private` | 求人 | `#F1F5F9` | `#6b7280` | gray |
| `reviewing` | 応募 | `var(--royal-50)` | `var(--royal)` | royal blue |
| `interview` | 応募 | `var(--purple-soft)` | `var(--purple)` | **purple** ⚠️ |
| `accepted` | 応募 | `var(--success-soft)` | `var(--success)` | green |
| `hired` | 応募 | `#D1FAE5` | `var(--success)` | green（濃い） |
| `cancelled` | メンター予約 | `var(--line-soft)` | `var(--ink-soft)` | gray |
| `approved` | メンター予約 | `var(--success-soft)` | `var(--success)` | green |
| `confirming` | StatusPill のみ | `var(--royal-50)` | `var(--royal)` | royal blue（`company_contacted` と同色） |
| `scheduling` | StatusPill のみ | `#F5F3FF` | `var(--purple)` | purple（未使用定義） |

### purple 系のステータス値（統合後に並ぶ数）

**purple 色相に該当するステータスが4つ存在する:**

| ステータス値 | ラベル | 使用ドメイン |
|------------|-------|------------|
| `scheduled`（面談） | 面談予定 | カジュアル面談（企業・求職者） |
| `pending_review`（求人） | 運営審査中 | 求人掲載 |
| `interview`（応募） | 面接中 | 求人応募 |
| `scheduling`（未使用定義） | 日程調整中 | 未使用 |

### `scheduled = purple` にして問題があるか

**同一画面に purple バッジが複数並ぶケースを確認:**

- **`/biz/meetings`（面談管理）**: `scheduled`（面談予定）のみ → 問題なし
- **`/biz/jobs`（求人管理）**: `pending_review`（運営審査中）のみ → 問題なし
- **`/biz/applications`（応募管理）**: `interview`（面接中）のみ → 問題なし
- **`/mypage`（求職者マイページ）**: 面談・予約が混在するが、同一リスト内で `scheduled` + `pending_review` が同時表示されるケースは稀

**→ 3つのドメインがそれぞれ別のページに分離されているため、同画面に purple が複数並ぶことはほぼない。衝突リスクは低い。**

### 推奨カラーパレット（統合後・確定案）

| 色相 | CSS変数 | 割り当てるステータス | ラベル（統一案） |
|-----|---------|-------------------|----------------|
| **amber** | `--warm-soft` / `#B45309` | `pending` | 保留中 / 新規受信 |
| **royal blue** | `--royal-50` / `--royal` | `company_contacted`, `confirming`, `reviewing` | 確認中 |
| **purple** | `--purple-soft` / `--purple` | `scheduled`, `pending_review`, `interview` | 各ドメインのラベルを使用 |
| **green** | `--success-soft` / `--success` | `published`, `active`, `accepted`, `approved`, `hired` | 公開中 / 採用 / 承認 |
| **gray（muted）** | `--line-soft` / `--ink-soft` | `completed`, `draft`, `cancelled`, `private` | 完了 / 下書き |
| **red** | `--error-soft` / `--error` | `declined`, `rejected` | 見送り / 差し戻し / 不採用 |
| **gray（lighter）** | `--bg-tint` / `--ink-mute` | `draft`（draft はこちらでも可） | 下書き |

**`scheduled = purple` で問題なし。** pink への変更は不要。  
（StatusPill.tsx の旧定義 `scheduled = pink` が誤りで、MeetingStatusBadge の `scheduled = purple` が正しい。  
統合時に pink を廃止して purple に揃える。）

### `pink` (`--pink: #DB2777`) について

現状 StatusPill の `scheduled` 定義のみで使用されており、他のステータスには使われていない。  
統合後は `scheduled` を purple に変更することで `pink` は **バッジ用途から完全に除外** できる。  
（globals.css の `--pink` 変数自体は別用途（`/u/[id]` のプロフィールバッジ等）があれば残存で問題なし）

---

## 補足: ローカル実装の全体像

grep では表に出なかったが、実態として StatusPill の実装は **5つ**存在する:

| 実装 | 場所 | 使用ステータス値 | 共通化状態 |
|------|------|----------------|-----------|
| `StatusPill`（共通） | `components/common/StatusPill.tsx` | pending, confirming, scheduling... | **実際には未使用** |
| `MeetingStatusBadge` | `components/business/` | pending, company_contacted, scheduled... | import 2件 |
| `JobStatusBadge` | `components/business/` | draft, pending_review, published... | import 1件 |
| ローカル `StatusPill` | `biz/applications/ApplicationsClient.tsx` | pending, reviewing, interview... | 同ファイル内のみ |
| ローカル `StatusPill` | `mypage/MypageClient.tsx` | mockMypageData 参照 | 同ファイル内のみ |
