# ν-8 段階6-3-2 事前調査: タイムライン UI 設計

作成日: 2026-05-10  
調査担当: Claude（コード変更なし、調査のみ）

---

## 1. 既存テーブル構造の確認

### 1-1. キャリアテーブル: `ow_experiences`

> **⚠️ 重要**: 当初想定していた `ow_user_career_histories` は存在しない。実際のテーブル名は `ow_experiences`。

| カラム | 型 | Nullable | 備考 |
|--------|-----|----------|------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | FK → ow_users |
| company_id | uuid | YES | ow_companies 参照（master タイプ） |
| company_text | text | YES | カスタム企業名 |
| company_anonymized | text | YES | 非公開時の表示名 |
| role_category_id | uuid | NO | FK → ow_roles |
| role_title | text | YES | 自由記述役職名 |
| **started_at** | **date** | **NO** | ソートキー候補 |
| **ended_at** | **date** | YES | null = 現職 |
| **is_current** | **boolean** | **NO** | default: false |
| description | text | YES | 業務内容（500字） |
| why | text | YES | 入社理由・退職理由（500字） |
| display_order | integer | NO | default: 0（現在は unused、API が started_at ソートで返す） |
| created_at, updated_at | timestamptz | NO | |

**ソート実態**: `/u/[id]/page.tsx` で `order("is_current", ascending: false).order("started_at", ascending: false)` — つまり `is_current DESC, started_at DESC`。

---

### 1-2. 学歴テーブル: `ow_user_educations`

| カラム | 型 | Nullable | 備考 |
|--------|-----|----------|------|
| id | uuid | NO | |
| user_id | uuid | NO | FK → ow_users |
| school | text | NO | 学校名（必須） |
| faculty | text | YES | 学部・学科 |
| degree | text | YES | 学位（学士/修士 etc.） |
| **enrolled_at** | **date** | YES | 入学年月 |
| **graduated_at** | **date** | YES | 卒業年月 |
| **is_current** | **boolean** | **NO** | default: false（在学中フラグ）|
| sort_order | integer | NO | ユーザー定義並び順 |
| created_at | timestamptz | NO | |

**`is_current` カラムは存在する**（boolean, NOT NULL, default false）。

---

### 1-3. `ow_users` 関連カラム

| カラム | 型 | Nullable | 実態 |
|--------|-----|----------|------|
| future_aspirations | text | YES | 単一テキスト（案A 確認済み）|
| avatar_color | text | YES | gradient CSS 文字列 |
| cover_color | text | YES | gradient CSS 文字列 |
| **avatar_url** | — | — | **⚠️ 列は存在しない** |

**avatar_url は存在しない**: 252行中 250行が avatar_color を持つが、avatar_url カラム自体がスキーマに定義されていない。

→ **「未来」アイコンは `avatar_color` グラデーション円 + イニシャル文字で実装する**（設計前提の修正必要）。

---

### 1-4. `ow_experience_stories` の参照先

Migration 089（未実行）の定義より:

```
experience_id → ow_experiences(id) ON DELETE CASCADE
```

**`ow_user_educations` は参照しない**。Stories は職歴エントリ（`ow_experiences`）専用。

> **現在の状態**: Migration 089〜092 が未実行のため FK 制約は DB に存在しない。実行後に有効化。

---

## 2. 既存 UI コンポーネントの構造把握

### 2-1. `/u/[id]/page.tsx` — 現在の表示構造

```
[カバー + アバター ヘッダー]
[About Me セクション]
[スキル タグ一覧]
[キャリア セクション] → <CareerTimeline careers={experiences} />  ← カードベース
[学歴 セクション]    → inline map() で学校アイコン + テキスト    ← 別セクション
[資格・認定 セクション] → タグ一覧
[SNS リンク]
```

**現在は職歴と学歴が別々のセクション**（時系列マージなし）。  
future_aspirations はこのページに表示されていない。

---

### 2-2. CareerTimeline（現在の実装: `src/components/profile/CareerTimeline.tsx`）

**現在のレイアウト**: Wantedly スタイルの縦線ではなく、**カードグリッド型**。

```
[CareerCard(bg-tint, border)] ← 単独
[CareerCard | CareerCard]     ← 並行勤務2社: flex-row
[CareerCard]                  ← 過去職歴
```

- `groupOverlappingCareers()` で期間が重なる職歴を同グループに（`src/lib/utils/career.ts`）
- 重なる場合は横並び（2〜3社: flex-row, 4社以上: 縦スタック）
- `CareerCard` は bg-tint 背景 + 現職は `border-left: 3px solid var(--success)` の強調スタイル
- `description`（業務内容）と `why`（入社理由）を -webkit-line-clamp で省略表示

---

### 2-3. CareerHistoryEditor（編集: `src/components/profile/CareerHistoryEditor.tsx`）

- 800行のクライアントコンポーネント
- `StintCard`（表示）+ `StintForm`（編集フォーム）パターン（EducationEditor と同じ）
- `useEffect` でマウント時に `/api/jobseeker/experiences` をフェッチ
- `StintDraft` フィールド: `companyName, isAnon, roleCategoryId, roleTitle, startedAt(YYYY-MM), endedAt(YYYY-MM), isCurrent, why, description`
- **ソート**: `sortStints()` で `isCurrent DESC, startedAt DESC`（表示側と同一ロジック）

**StintCard 現在の表示要素**:
- 会社名（「マスタ登録」バッジ or イタリック非公開）
- 役職名
- 期間（YYYY.MM 〜 YYYY.MM）
- description（2行クランプ、左ボーダー）
- why（2行クランプ、左ボーダー、italic）
- ホバーで ✎ × ボタン

---

### 2-4. マイページ（`/mypage`）における職歴・学歴の現在表示

- `DashboardView` → `<UserProfileCard>` に `userFutureAspirations`, `userEducations` を渡す
- `UserProfileCard` (`src/components/profile/UserProfileCard.tsx`) で表示（詳細未読だが future_aspirations は受け取る）
- キャリア（`ow_experiences`）はマイページには**表示されていない**（`profile/edit` の `CareerHistoryEditor` でのみ編集）
- 職歴タイムラインをマイページに追加することが段階6-3-2 のスコープ

---

## 3. データマージのロジック設計案

### 統合タイムラインエントリ型

```typescript
type TimelineEntry =
  | { kind: "career";    data: CareerEntry;    sortKey: string; isCurrent: boolean }
  | { kind: "education"; data: EducationEntry; sortKey: string; isCurrent: boolean }
  | { kind: "future";    data: { text: string; userColor: string; initial: string } };
```

`sortKey`: `started_at` / `enrolled_at` の YYYY-MM 部分 (なければ "0000-00")

---

### 案A: `start_date DESC` 単一キー（end_date は二次キー）

```
sort: sortKey DESC, (endedAt ?? "9999-99") DESC
```

- メリット: シンプル、直感的
- デメリット: `is_current` な職歴と学歴が混在したとき、「現在進行中」エントリが開始年が古ければ埋もれる

---

### 案B: `is_current = true` 固定 → startKey DESC（**推奨**）

```typescript
function mergeTimeline(careers: CareerEntry[], educations: EducationEntry[]): TimelineEntry[] {
  const items: TimelineEntry[] = [
    ...careers.map(c => ({ kind: "career" as const, data: c, sortKey: c.startedAt.slice(0,7), isCurrent: c.isCurrent })),
    ...educations.map(e => ({ kind: "education" as const, data: e, sortKey: e.enrolled_at?.slice(0,7) ?? "0000-00", isCurrent: e.is_current })),
  ];
  return items.sort((a, b) => {
    // 1. is_current 先頭
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    // 2. sortKey DESC
    if (b.sortKey !== a.sortKey) return b.sortKey.localeCompare(a.sortKey);
    // 3. 同月タイブレーク: career 優先
    return a.kind === "career" ? -1 : 1;
  });
}
```

- メリット: 「現在進行中の職/学」が常に上に来る。Wantedly と同じ体験
- 同月タイブレーク: career 優先（キャリアが主軸なため）

---

### 案C: end_date(null = 現在) を主キーに使う

- デメリット: 「在学中」の大学院 + 現職が同列になる。日本語的に不自然

---

### 「未来」セクションの扱い

- **常に最上部**（`is_current` よりさらに上）に固定
- `future_aspirations` が `null` または空文字の場合
  - 本人（認証ユーザーが自分のページを見ている）→ 「未来を入力する →」の CTA プレースホルダーを表示
  - 他人が閲覧 → セクション丸ごと非表示

---

### 同月開始の複数エントリのタイブレーク

| 順 | 判定 |
|---|---|
| 1 | `is_current DESC` |
| 2 | `sortKey DESC`（YYYY-MM） |
| 3 | `kind === "career"` を先（職歴優先） |
| 4 | DB 取得順（既存 display_order / sort_order は無視してOK） |

---

## 4. タイムライン UI レイアウト設計案

### 概要: Wantedly スタイルとは

縦軸: `[日付ラベル] | [縦線+丸アイコン] | [コンテンツ]`

縦線はアイコン間を貫通し、「時間の流れ」を可視化する。

---

### デスクトップ 案A（推奨）: `grid-cols [64px 44px 1fr]`

```
64px   |  44px  |  1fr
-------|--------|---------------------------
2024.04|  [●]   |  LayerX — プロダクトマネージャー
       |   |    |  2024.04 〜 現在（1年1ヶ月）
       |   |    |  業務内容…
-------|--------|---------------------------
2022.07|  [■]   |  ○○大学大学院
       |   |    |  情報工学専攻 修士
       |   |    |  2022.07 〜 2024.03
-------|--------|---------------------------
```

- `●` = 職歴アイコン（Briefcase inline SVG、48px 円、`--royal-50` 背景）
- `■` = 学歴アイコン（GraduationCap SVG、48px 円、`--purple-soft` 背景）
- `★` = 未来アイコン（avatar_color 円 + イニシャル）

**縦線実装**: 各行の中央カラムに `position: relative` div を置き、その中に:
- 上端〜下端を貫く `position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--line)` の div
- アイコン円を `position: relative; z-index: 1` で縦線の上に重ねる

---

### デスクトップ 案B: `grid-cols [80px 2px 1fr]`（縦線を中央カラムにする）

```
80px       | 2px |  1fr
-----------|-----|---------------------------
           |  │  |
  2024.04  |  ○  |  LayerX ...
           |  │  |
  2022.07  |  ○  |  ○○大学 ...
           |  │  |
```

- メリット: 縦線の実装が最もシンプル（2px カラム = 縦線そのもの）
- デメリット: アイコン円が縦線カラムからはみ出るため z-index 管理必要。セルのはみ出しが起きやすい

---

### **推奨: 案A**

理由:
- 44px の中央カラムはアイコン円（40px）を収めるのに十分で、縦線を絶対配置で重ねやすい
- 日付ラベルの 64px は「YYYY.MM」（7文字）を Inter 12px で表示するのに十分

---

### モバイル（`max-width: 600px`）

日付ラベルを左カラムから削除し、コンテンツ内にインライン表示:

```
[アイコン] | [コンテンツ（日付 + 企業名 + 役職…）]
```

```
grid-template-columns: 44px 1fr
```

コンテンツ先頭行: `fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter"` で日付を inline 表示。

---

### アイコン円 UI

```tsx
// 職歴: royal-50 背景
<div style={{
  width: 40, height: 40, borderRadius: "50%",
  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
  display: "flex", alignItems: "center", justifyContent: "center",
  position: "relative", zIndex: 1, flexShrink: 0,
}}>
  {/* Briefcase SVG: 16x16, stroke: var(--royal), strokeWidth: 1.8 */}
</div>

// 学歴: purple-soft 背景
<div style={{
  width: 40, height: 40, borderRadius: "50%",
  background: "var(--purple-soft)", border: "1px solid rgba(124,58,237,0.2)",
  ...
}}>
  {/* GraduationCap SVG: stroke: var(--purple) */}
</div>

// 未来: avatar_color グラデーション + イニシャル
<div style={{
  width: 40, height: 40, borderRadius: "50%",
  background: userAvatarColor, // "linear-gradient(135deg, #002366, #3B5FD9)"
  border: "2px solid #fff", boxShadow: "0 0 0 1px var(--royal-100)",
  color: "#fff", fontSize: 16, fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
}}>
  {initial}
</div>
```

---

### 現職バッジ

既存の `CURRENT` バッジ（`CareerTimeline` より流用）:

```tsx
<span style={{
  background: "var(--success-soft)", color: "var(--success)",
  padding: "1px 6px", borderRadius: 4, fontWeight: 700,
  fontSize: 9, letterSpacing: "0.05em",
}}>CURRENT</span>
```

在学中バッジ（`u/[id]` より流用）:

```tsx
<span style={{
  background: "var(--success-soft)", color: "var(--success)",
  padding: "3px 8px", borderRadius: 100, fontWeight: 600, fontSize: 11,
  border: "1px solid #A7F3D0",
}}>在学中</span>
```

---

### 並行勤務のハンドリング

現在の `CareerTimeline` は `groupOverlappingCareers` で横並びにするが、縦線タイムラインでは**縦スタック + バッジ**が適切:

```
[アイコン] LayerX — PdM  [並行]
           Freelance — コンサルタント  [並行]
```

実装: 「並行勤務グループ」を検出した場合、同一の縦線上に2つのコンテンツブロックを縦に並べ、それぞれに `[並行]` ピルを付与。

**stage 6-3-2 では `groupOverlappingCareers` を流用せず、単純縦スタックで並行勤務を表示する**（横並びは段階6-3-3 送り）。

---

## 5. `ow_experience_stories` 編集 UI の配置案

### 前提

- `ow_experience_stories.experience_id` → `ow_experiences` 専用（学歴には stories なし）
- `CareerHistoryEditor` の `StintCard`（表示モード）を起点にする
- 段階6-3-2 はフラット表示のみ（サブセクション/画像実レンダリングは 6-3-3 送り）

---

### 案A: StintCard 下部アコーディオン（**推奨**）

```
┌─────────────────────────────────────┐
│ [StintCard: 会社名 + 役職 + 期間]   │  ← 既存 StintCard（変更なし）
│ description / why                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ストーリー（2件）  ▼                 │  ← 折りたたみヘッダー
│  [card] タイトルA                   │
│  [card] タイトルB                   │
│  [+ ストーリーを追加]               │
└─────────────────────────────────────┘
```

- デフォルト: 折りたたみ（件数のみ表示）
- クリックで展開
- 各ストーリーは `AchieveIconBtn` 系の ✎ × パターン（段階6-3-1 と同じスタイル）
- StintCard と連動して `experience_id` を取得

**メリット**:
- StintCard の視覚的まとまりを保ちつつ、ストーリーを「その職歴に紐づく補足情報」として自然に配置
- StintCard を保存してから stories を追加、という 2 フェーズの流れが直感的

**デメリット**:
- Stories のロード（GET `/api/jobseeker/experience-stories?experience_id=xxx`）が StintCard のマウント時に走る → N+1 リスクあり（後述）

---

### 案B: StintForm 最下部フィールド

StintForm 内に「ストーリーを追加」セクションを追加する案。

- デメリット: StintForm はすでに「会社名/役職/期間/業務内容/入社理由」フィールドがあり、さらに stories 管理を追加するとフォームが肥大化する
- `StintDraft` の型が stories 配列を持つことになり、複雑化
- **不採用**

---

### 案C: StintCard 保存後、別モーダルでストーリー編集

- デメリット: 「モーダルを開く」操作が追加され、操作ステップが増える
- 段階6-3-2 のスコープ（フラット表示）と合わない
- **不採用**

---

### ストーリーの追加・並べ替え UI（段階6-3-2 範囲）

- 追加・編集・削除のみ実装（sort_order は MAX+1 パターン、既存 API と同様）
- **並べ替え機能は段階6-3-3 送り**（ドラッグ&ドロップ実装コストが高い）
- 編集フォームは段階6-3-1 の `AchievementForm` スタイル踏襲（royal ボーダー + bg-tint）

---

### ストーリーカードのフラット表示（段階6-3-2 の実レンダリング）

段階6-3-2 では画像/動画/リンクのプレビューは実装しない。代わりに type に応じたラベルを付けてテキストのみ表示:

```
[image] タイトルA  (URL省略表示)
[video] タイトルB  (URL省略表示)
[card]  タイトルC  説明文...
[link]  タイトルD  (URL クリック可)
```

type バッジのカラー:
- `image`: warm-soft 背景
- `video`: purple-soft 背景
- `card`: royal-50 背景
- `link`: line-soft 背景

---

## 6. 既知の制約・リスクの洗い出し

### 6-1. `avatar_url` が存在しない問題

**重要度: 高**

設計前提の修正が必要:
- 「未来」アイコン = `ow_users.avatar_url` → **`ow_users.avatar_color`（gradient CSS）+ イニシャル**
- 現在の `/u/[id]` アバター表示も同様（`avatar_color` + イニシャル文字）
- avatar_url カラムを新設する必要はない（段階6-3-2 で上記フォールバックで十分）

---

### 6-2. 既存 CareerTimeline との共存問題

**重要度: 中**

現在の `/u/[id]` では `<CareerTimeline>` が使われている。段階6-3-2 ではこれを新しい `<MergedTimeline>` に置き換える想定。

- `CareerTimeline` 自体は削除しない（他で使われている可能性・ロールバック用）
- `/u/[id]/page.tsx` の「キャリア」セクションと「学歴」セクションを丸ごと新コンポーネントに置換

---

### 6-3. パフォーマンス / N+1 リスク

**重要度: 中**

`ow_experience_stories` のロード戦略:

- `/u/[id]`（Server Component）: `experiences` を取得後、`experience-stories` を一括 SELECT（`experience_id IN (...)` で N+1 回避）
- `CareerHistoryEditor`（Client Component）: 案A の Stories アコーディオンを展開したとき初めて GET する遅延ロード方式（最初から全件取得しない）

---

### 6-4. ow_experience_stories の FK 未確立

**重要度: 高**

Migration 089〜092 が未実行のため `ow_experience_stories` テーブル自体が DB に存在しない。段階6-3-2 の実装前に必ず実行が必要。

実行順序: 089 → 090 → 091 → 092（依存関係: 089 は `ow_experiences` を参照）

---

### 6-5. D-3 リテイク後のフラットスタイルとの整合性

**重要度: 低**

タイムライン UI は縦線を持つため、「白カードなし/フラット」の EducationEditor スタイルとは異なる新スタイルを導入する。

これは **矛盾しない**:
- `profile/edit` の編集 UI（EducationEditor, CareerHistoryEditor）はフラットスタイルを維持
- `/u/[id]` と `/mypage` の**表示 UI**（新 MergedTimeline）は縦線タイムラインスタイル
- 両者は役割が異なる（編集 vs 表示）

---

### 6-6. future_aspirations の移行

**重要度: 中**

現在の状態:
- `profile/edit` → 「基本情報」タブの `patchBasicInfo()` で自動保存
- `BASIC_FIELD_TO_DB` で `futureAspirations → future_aspirations`
- `/u/[id]` には現在表示なし
- Mypage `DashboardView` → `UserProfileCard` には渡されているが表示箇所要確認

段階6-3-2 の作業:
1. `profile/edit` の「基本情報」タブから `future_aspirations` フィールドを削除
2. 新設する「未来」セクション（タイムライン最上部）から直接編集できるようにする
3. 保存 API は既存の `/api/jobseeker/profile` PUT（`future_aspirations` が `allowed` に含まれる）をそのまま流用

**編集 UI のポイント**: 認証済みユーザーが自分の `/u/[id]` を見ると「未来」セクションがインライン編集可能（ホバーで ✎ が表示）。

---

### 6-7. 表示順の同期問題

**重要度: 低〜中**

- タイムライン表示は `started_at / enrolled_at` の日付ソート
- CareerHistoryEditor の編集画面も同一ソートロジック（`isCurrent DESC, startedAt DESC`）
- 整合している → 問題なし

ただし教育の `sort_order`（ユーザー定義）はタイムラインでは**無視**し、日付ソートに切り替える必要がある。

---

## まとめ・次セッションへの申し送り

### 確認済み前提修正

| 設計前提 | 修正後 |
|---------|-------|
| キャリアテーブル = `ow_user_career_histories` | `ow_experiences` |
| 未来アイコン = `avatar_url` | `avatar_color` グラデーション円 + イニシャル |
| experience_stories が教育にも紐づく | 職歴（ow_experiences）専用 |

### 推奨設計

| 項目 | 推奨案 | 理由 |
|------|-------|------|
| タイムラインソート | 案B（is_current 先頭 → start_date DESC） | 現職が常に上に来る |
| グリッドレイアウト | `64px 44px 1fr`（案A） | アイコン・縦線・コンテンツのバランスが良い |
| 並行勤務 | 縦スタック + `[並行]` バッジ | 横並びは縦線と相性が悪い |
| stories UI | 案A（StintCard 下部アコーディオン） | 職歴との紐づきが直感的 |
| stories 遅延ロード | 展開時に GET | 初期ロードの N+1 回避 |
| 並べ替え | 段階6-3-3 送り | ドラッグ&ドロップのコストが高い |

### 段階6-3-2 実装ファイル（予測）

**新規作成**:
- `src/components/profile/MergedTimeline.tsx` — 職歴+学歴マージ表示コンポーネント（Server/Client 境界要検討）
- `src/components/profile/FutureSection.tsx` — 「未来」セクション（本人のみ編集可）
- `src/components/profile/StoryAccordion.tsx` — StintCard 下のストーリーアコーディオン

**変更**:
- `src/app/(jobseeker)/u/[id]/page.tsx` — キャリア+学歴セクションを MergedTimeline に置換、future_aspirations を FutureSection に
- `src/components/profile/CareerHistoryEditor.tsx` — StintCard に StoryAccordion を追加（+150〜200行推定）
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` — 基本情報タブから future_aspirations フィールド削除

**考慮点**:
- `MergedTimeline` は `/u/[id]` (Server Component) と Mypage (Client Component) 両方から使う → `"use client"` なしで書くか、純粋な表示コンポーネントとして実装する
- Mypage への組み込みは DashboardView 内の UserProfileCard 下に追加するか、別ビューとして追加するかを次セッション冒頭に確認

---

*調査完了: 2026-05-10*
