# /people ページへの「候補者同士で話せる人」追加 調査レポート
作成: 2026-07-08

---

## 1. /people の現状実装

### データ取得（page.tsx）

```typescript
// ow_company_admins から is_ambassador=true かつ is_active=true を取得
adminSupabase
  .from("ow_company_admins")
  .select(`
    id, user_id, company_id, role_title, department, talk_themes,
    user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
    company:ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase, industry)
  `)
  .eq("is_ambassador", true)
  .eq("is_active", true)
  .not("user_id", "is", null)
  .order("company_id")
```

その後 `r.user?.visibility === "public"` で RLS 相当のフィルタリングを行い、
`AmbassadorCard[]` に正規化して `PeopleListClient` に渡す。

### PeopleListClient の状態・フィルタ構造

| state | 型 | 役割 |
|-------|---|------|
| `viewMode` | `"grid" \| "list"` | リスト/グリッド切替 |
| `roleCategory` | `RoleCategoryKey` | 行1: 職種カテゴリフィルタ |
| `companyType` | `CompanyTypeKey` | 行2: 企業タイプフィルタ |
| `keyword` | `string` | フリーワード検索 |

**行1: 職種カテゴリ chip**（`ROLE_CATEGORIES`）:
- `all`（すべて）/ `hr`（人事・採用）/ `sales`（営業・セールス）/ `mktcs`（マーケ・CS）/ `eng`（エンジニア）/ `exec`（経営・役員）
- 各 chip にヒット件数バッジ
- `roleTitle` + `department` を正規表現でマッチング
- 0件のカテゴリは chip が非表示（`.filter()` で除去）

**行2: 企業タイプ chip**（`COMPANY_TYPE_FILTERS`）:
- `all` / `startup` / `listed` / `unicorn` / `enterprise`
- `companyPhase` フィールドを正規表現でマッチング

**フリーワード検索**: 名前・会社名・役職・部署でインクリメンタル検索

**アクティブフィルター表示行**: keyword or roleCategory != "all" or companyType != "all" のとき「N名が見つかりました + フィルターをリセット」を表示

---

## 2. ambassador カードの構成要素と全データ元

### `AmbassadorCard` 型

```typescript
type AmbassadorCard = {
  adminId: string;           // ow_company_admins.id
  userId: string;            // ow_users.id
  name: string;              // ow_users.name
  initial: string;           // name.charAt(0)
  gradient: string;          // ow_users.avatar_color（linear-gradient）
  avatarUrl: string | null;  // ow_users.avatar_url
  roleTitle: string | null;  // ow_company_admins.role_title
  department: string | null; // ow_company_admins.department
  talkThemes: string[];      // ow_company_admins.talk_themes（TEXT[]）
  companyId: string;         // ow_companies.id
  companyName: string;       // ow_companies.brand_name ?? ow_companies.name
  companyPhase: string | null;     // ow_companies.phase
  companyIndustry: string | null;  // ow_companies.industry
  companyLogoUrl: string | null;   // ow_companies.logo_url
  companyLogoGradient: string | null; // ow_companies.logo_gradient
  companyLogoLetter: string | null;   // ow_companies.logo_letter
};
```

### グリッドカード（`AmbassadorGridCard`）の表示要素

| 要素 | データ元 | 実装 |
|------|---------|------|
| アバター画像 / gradient + initial | `avatarUrl` / `gradient` + `initial` | `<Avatar>` コンポーネント（64px） |
| 名前 | `name` | 15px bold |
| 「話せます」バッジ | ハードコード | `<TalkBadge>` orange pill |
| 役職 | `roleTitle ?? department ?? "採用担当"` | 12px ink-soft |
| 部署 | `department`（roleTitle と異なる場合のみ表示） | 12px ink-mute |
| 会社名 + ロゴ | `companyName` / `companyLogoUrl` / `companyLogoGradient` | `<CompanyBadge>` |
| 話せるテーマタグ | `talkThemes`（DB設定値優先）→ roleTitle から自動推定 | `<TopicTags>` royal-50 pill |
| 「話を聞く →」ボタン | `companyId` → `/companies/{companyId}/casual-meeting` | warm orange グラデーション |
| サブテキスト | ハードコード | 「カジュアル面談を申し込む（無料）」 |
| 「プロフィールを見る」ボタン | `userId` → `/u/{userId}` | royal-50 背景 |

### リストロー（`AmbassadorListRow`）の差異

- 3カラム grid（アバター 64px / 名前+役職+タグ / CTAボタン群）
- CTA: 「話を聞く →」（orange）+ 「カジュアル面談（無料）」subtext + 「プロフィール」（royal border）

---

## 3. 候補者データのマッピング案

### 取得クエリ

```typescript
// page.tsx に追加するクエリ
const { data: peers } = await adminSupabase
  .from("ow_users")
  .select(`
    id, name, avatar_color, avatar_url, visibility,
    location
  `)
  .eq("can_talk_to_candidates", true)
  .eq("visibility", "public")
  .order("created_at", { ascending: false });
```

現職情報は別途 `ow_experiences` から取得:
```typescript
// peer の user_id → is_current=true の経験を JOIN
const { data: currentExps } = await adminSupabase
  .from("ow_experiences")
  .select("user_id, role_title, company_text, company_anonymized, company_id")
  .in("user_id", peerIds)
  .eq("is_current", true);
```

### カード要素の対応マッピング

| ambassador カード要素 | 候補者への対応 | 備考 |
|-------------------|-----------|----|
| アバター | `ow_users.avatar_url` / `avatar_color` + `name.charAt(0)` | 全く同じ構造 |
| 名前 | `ow_users.name` | 同 |
| 「話せます」バッジ | 色だけ変えて「話せます」のまま or「候補者」バッジ | 後述 |
| 役職 | `ow_experiences.role_title`（is_current=true）| なければ空 |
| 部署 | なし（`null` → 省略） | |
| 会社名 + ロゴ | `ow_experiences.company_text`（テキスト表示のみ） | `company_id` があれば `ow_companies` の logo も引けるが、複雑になるため初期は会社名テキストのみ |
| 話せるテーマタグ | **なし**（候補者に `talk_themes` 相当フィールドはない） | `location` や `job_type`（ow_profiles）を代わりに表示するか、タグ行を省略するか |
| 「話を聞く →」ボタン | **変更必須**。`/u/{userId}` へのリンク（プロフィールを見る）に差し替え | カジュアル面談フローは企業向けで意味がずれる |
| 「プロフィールを見る」ボタン | 同上（メインCTAがこれになる） | |

### 「話せるテーマ」の代替案

候補者には `talk_themes` 相当のデータが存在しないため、以下の代替を検討:

**案A（推奨）: job_type を「話せること」として表示**
- `ow_profiles.job_type`（例: "フィールドセールス"）を取得し、タグとして表示
- 「話せるテーマ」ラベルを「経験職種」などに変える

**案B: タグ行を省略**
- 候補者カードは役職・会社名だけでシンプルに表示
- 実装コストが最小

**案C: ow_users または ow_profiles に「話せること自由記述」フィールドを将来追加**
- フェーズ2以降の改善として検討

### 候補者の「話せます」バッジの差別化

ambassador の `TalkBadge` は orange（`#FFF7ED / #C2410C`）。
候補者は異なる文脈なので **royal blue** バッジ（`var(--royal-50) / var(--royal)`）で視覚的に区別するのが自然:
- 候補者バッジ: 「候補者」または「同業者」

---

## 4. 「候補者」フィルタ追加の実装方針

### データソースの統合方法

2つのデータソース（`ow_company_admins` と `ow_users`）を共通の型に正規化して結合する:

```typescript
// 新しい共通型（page.tsx 側で定義）
type PersonCard = {
  // 共通フィールド
  personId: string;        // userId（どちらも）
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;

  // 役職・会社
  roleTitle: string | null;
  companyName: string | null;
  companyId: string | null;         // ambassador のみ（candidates は null）
  companyLogoUrl: string | null;    // ambassador のみ
  companyLogoGradient: string | null;
  companyLogoLetter: string | null;
  companyPhase: string | null;      // ambassador のみ（企業タイプフィルタ用）
  companyIndustry: string | null;

  // テーマタグ（候補者は jobType ベース）
  talkThemes: string[];

  // 種別
  kind: "ambassador" | "candidate";
};
```

`page.tsx` で ambassador と candidates を両方 fetch → それぞれ `PersonCard` に正規化 → concat して `PeopleListClient` に渡す。

### フィルタの「候補者」選択肢追加

**推奨: 行1の ROLE_CATEGORIES に `peers`（候補者）を追加し、選択時は候補者のみ表示、他の職種カテゴリは ambassador のみ表示**

```typescript
const ROLE_CATEGORIES = [
  { key: "all",      label: "すべて",       pattern: null },
  { key: "peers",    label: "候補者",       pattern: "peers" },  // ← 追加。kind==="candidate" で絞り込む
  { key: "hr",       label: "人事・採用",   pattern: /人事|採用|hr|recruit/i },
  // ...
] as const;
```

「すべて」を選んだとき両方を表示するかは設計上の判断が必要（下記参照）。

### 「すべて」に候補者を含めるか否か

**推奨: 候補者は「候補者」選択時のみ表示。「すべて」では ambassador のみ。**

理由:
- 「すべて」に混在させると、性質が異なる2種類の人物が並んで混乱しやすい
- ambassador カードには「話を聞く（カジュアル面談）」ボタン、候補者カードには「プロフィールを見る」ボタンが入る。同一リストに並ぶとCTAが不統一に見える
- 「候補者」タブは存在を知らせるための明示的な選択肢として機能する

---

## 5. 候補者カードのアクションボタン

**フェーズ2まで: 「プロフィールを見る」1本のみ**

```
[プロフィールを見る →]   （primary, royal-50 背景）
```

フェーズ2（コンタクト導線実装後）に追加予定:
```
[話しかける →]           （primary）
[プロフィールを見る]     （secondary）
```

カジュアル面談フロー（`/companies/{id}/casual-meeting`）は企業向けのため候補者同士には**使用しない**。

---

## 6. 実装分割案とリスク

### コミット分割案

| コミット | 内容 |
|---------|------|
| **1** | `page.tsx` に candidates クエリ追加 + `PersonCard` 共通型に正規化 + 両リストを concat して Props に渡す |
| **2** | `PeopleListClient.tsx` に `kind` フィールド対応（型変更、`peers` カテゴリ chip 追加、候補者カード描画分岐、企業タイプフィルタを候補者選択時は非表示） |

または 1コミットでまとめることも可能（変更ファイルが page.tsx + PeopleListClient.tsx の2ファイルのみ）。

### 想定リスク・注意点

**① `AmbassadorCard` 型の変更リスク（中リスク）**

現在 `PeopleListClient` が受け取る型は `AmbassadorCard[]`。`PersonCard[]`（共通型）に切り替えると、`AmbassadorCard` 型の全プロパティが変わるため、`AmbassadorGridCard` / `AmbassadorListRow` / `CompanyBadge` など内部コンポーネントの型も全て更新が必要。

**対策案**: 既存の `AmbassadorCard` 型はそのまま残し、Props に `peers: PeerCard[]` を追加する。リスト結合はクライアント側 useMemo の中で行う。

```typescript
// Props を拡張する形
type Props = {
  ambassadors: AmbassadorCard[];
  peers: PeerCard[];       // ← 追加
  companies: Company[];
};
```

これなら既存コンポーネントに手を入れずに候補者を追加できる（リスク最小）。

**② 企業タイプフィルタの適用範囲**

候補者には `companyPhase` がない（ow_experiences からは取れない）。
`peers` カテゴリ選択中は企業タイプフィルタを非表示にする（または disabled）のが自然。

**③ 0件問題**

`can_talk_to_candidates=true` の候補者は現在 DB にまだいない（migration 203 は DEFAULT false）。
「候補者」タブの件数は当初 `0` になる。それで問題ないが、「0件の場合は候補者タブを非表示にする」か「0でも表示してメッセージを出す」かを決めておく必要がある（ambassador の0件カテゴリは現在 chip 非表示になっている）。

**推奨**: peers タブは `ambassadors の0件chip非表示ロジック` と同様に扱うが、`peers` は固定で常時表示するほうが「候補者として登録できる」ことをユーザーに示せて自然。

**④ ページヘッダーの「N名掲載中」バッジ**

現在 `ambassadors.length` を参照。candidates 追加後は
`ambassadors.length + peers.length` に変えるか、2つの数字を分けて表示するかを決める。

---

## まとめ

| 確認事項 | 結論 |
|---------|------|
| データ取得 | `ow_company_admins`（ambassador）に加え `ow_users`（candidates）を別クエリで取得 |
| 共通型 | `AmbassadorCard` を維持し、`PeerCard` を新型として Props に追加するのが最小リスク |
| フィルタ | 行1の ROLE_CATEGORIES に `peers` chip を追加。「すべて」は ambassador のみ |
| 企業タイプフィルタ | `peers` 選択中は非表示 or disabled |
| 候補者カード CTA | 「プロフィールを見る」1本のみ（フェーズ2までカジュアル面談フローは不使用） |
| 話せるテーマ | job_type（ow_profiles）を代替として表示（案A推奨）or タグ省略（案B） |
| 「話せます」バッジ | 候補者は royal blue（「候補者」テキスト）で ambassador の orange と区別 |
| 実装コスト | 2ファイル（page.tsx + PeopleListClient.tsx）、1コミットでも可 |
| 最大リスク | AmbassadorCard 型への影響。Props 分離で回避可能 |
