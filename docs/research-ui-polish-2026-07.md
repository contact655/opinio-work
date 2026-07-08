# UI ポリッシュ調査・改善案 — /jobs, /jobs/[id], /people

> 調査日: 2026-07-08  
> 対象ファイル:
> - `src/app/(jobseeker)/jobs/JobsClient.tsx`
> - `src/app/(jobseeker)/jobs/[id]/page.tsx`
> - `src/app/(jobseeker)/people/PeopleListClient.tsx`

---

## 現状サマリー

| ページ | 主要カードコンポーネント | クリック動作 |
|--------|------------------------|-------------|
| /jobs（グリッド） | `JobCard` — `<Link href=/jobs/${id}>` で全体クリック可 ✅ | OK |
| /jobs（リスト） | `JobListCard` — `<Link href=/jobs/${id}>` で全体クリック可 ✅ | OK |
| /jobs/[id] | Hero: 1カラム flex. Body: `grid [1fr_320px]` at lg | 右側が Hero に無い |
| /people（グリッド） | `AmbassadorGridCard`, `PeerGridCard` — div + ボタン | カード全体はクリック不可 ❌ |
| /people（リスト） | `AmbassadorListRow` — div + ボタン | カード全体はクリック不可 ❌ |

---

## 課題 #1（最優先）— 求人カードのロゴに「式会社」等の余分なテキストが表示される

### 現象

求人カード（JobListCard / JobCard）のロゴ部分に、企業名の一部（「式会社」等）がはみ出して表示される。

### 根本原因

```typescript
// JobsClient.tsx（両カード共通）
const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();
```

`company.logo_letter` が DB に `null` でなく「株式会社Salesforce」のような**フルネーム**で入っている場合、`logoLetter` にその文字列全体が入る。ロゴ div は `overflow: hidden` だが `white-space: nowrap` がないため、CJK 文字が折り返して複数行表示され「式会社」が視認される。

また `company.name.charAt(0)` でも「株」（1文字）しか返らないが、`logo_letter` フィールドが意図せず複数文字で入力されているデータが原因。

### 現在の関連コード

```tsx
// JobCard（グリッド）: logo letter container
<div style={{ color: "#fff", fontSize: 17, fontWeight: 700, overflow: "hidden" }}>
  {company.logo_url ? <Image ... /> : logoLetter}
</div>

// JobListCard（リスト）: logo letter container  
<div style={{ color: "#fff", fontSize: 18, fontWeight: 700, overflow: "hidden" }}>
  {company.logo_url ? <img ... /> : logoLetter}
</div>
```

### 改善案

`logoLetter` を最大2文字に切る（ロゴに英字が来た場合は2文字まで許容）：

```typescript
// Before
const logoLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();

// After
const rawLetter = company.logo_letter ?? company.name.charAt(0).toUpperCase();
const logoLetter = rawLetter.slice(0, 2);
```

またロゴ div に `whiteSpace: "nowrap"` と `textOverflow: "clip"` を追加して防衛的にする。

---

## 課題 #2 — 求人カード（リスト）の年収フォントが大きすぎる

### 現状

`JobListCard` の年収表示：

```tsx
<span style={{
  fontFamily: "Inter, sans-serif",
  fontSize: 15,       // ← 大きい
  fontWeight: 700,
  color: "var(--success)",
  lineHeight: 1.1,
}}>
  {formatSalary(job.salary_min, job.salary_max)}
</span>
<span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500, marginLeft: 4 }}>
  年収
</span>
```

タイトル（fontSize: 16, fontWeight: 800）とほぼ同じサイズになり、視覚的な情報階層が崩れている。

### 改善案

年収は「あると嬉しい補足情報」として、タイトルよりワンランク下げる：

```tsx
// After
<span style={{
  fontFamily: "Inter, sans-serif",
  fontSize: 12,       // 15 → 12
  fontWeight: 600,    // 700 → 600
  color: "var(--success)",
}}>
```

---

## 課題 #3 — 求人詳細（/jobs/[id]）の年収ピルが大きすぎる

### 現状

```tsx
<span style={{
  display: "inline-flex",
  padding: "7px 18px",
  borderRadius: 100,
  background: "var(--success-soft)",
  border: "1px solid #A7F3D0",
  color: "var(--success)",
  fontSize: 20,       // ← 大きい
  fontWeight: 700,
  fontFamily: "Inter, sans-serif",
}}>
  想定年収&nbsp;{...}
</span>
```

h1 タイトル（`clamp(18px,2vw,24px)`）と同等かそれ以上のサイズになっており、「年収が主役」に見える。

### 改善案

ピルのサイズを抑えつつ、存在感は green color で確保：

```tsx
// After
fontSize: 15,         // 20 → 15
padding: "5px 14px",  // 7px 18px → 5px 14px
```

---

## 課題 #4 — 求人詳細 Hero の右側が空白になっている

### 現状

Hero セクション（`.tsx` ~line 415）は単純な flex row：

```tsx
<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
  {/* ロゴ: 64x64 */}
  <div style={{ width: 64, height: 64, ... }} />
  {/* 右: タイトル・年収・タグ */}
  <div style={{ flex: 1, minWidth: 0 }}>
    ...（右カラムなし）
  </div>
</div>
```

Body 以下は `grid [1fr_320px]` で右サイドバーが存在するが、Hero 行には右カラムがない。Wide 画面（≥1024px）では右半分が白紙になる。

### 改善案 A: Hero を 2カラムにしてサマリーカードを Hero に引き上げる

```tsx
// Hero wrapper を 2カラム化（lg 以上のみ）
<div className="grid gap-8 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]">
  {/* 左: ロゴ + タイトル + 年収 + タグ */}
  <div>...</div>
  {/* 右: "応募する" / "気になる" / 選考フロー概要をコンパクトに */}
  <aside className="hidden lg:block">
    <div style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, padding: "20px 20px 24px",
      position: "sticky", top: 80,
    }}>
      {/* CTAボタン群 */}
    </div>
  </aside>
</div>
```

### 改善案 B（小さい変更）: Hero に max-width + center 寄せ

大きなリファクタを避け、Hero コンテンツに `maxWidth: 680px` を指定して「左寄りで完結している」ように見せる。右空白が目立たなくなる。

**推奨: 案 A（Hero を 2カラム化）** — Body サイドバーと揃えることで一貫したレイアウトになる。

---

## 課題 #5 — /people カード全体がクリック不可（ボタンのみリンク）

### 現状

`AmbassadorGridCard` / `AmbassadorListRow` / `PeerGridCard` はすべて `<div>` の wrapper で、カード全体を `<Link>` でラップしていない。`/u/${userId}` へのリンクは「プロフィールを見る」ボタンのみ。

```tsx
// 現在
<div onMouseEnter={...} onMouseLeave={...}>
  ...
  <Link href={`/u/${card.userId}`}>プロフィールを見る</Link>
</div>
```

カードをクリックしても遷移しないため、ユーザーが「どこがクリックできるのか」を探す必要がある。

### 改善案

`<div>` wrapper を `<Link>` に変更し、`cursor: pointer` を設定。CTAボタン（「話を聞く」）はネストした `<a>` になるため、React の event propagation で `e.stopPropagation()` か `<span>` 化が必要。

```tsx
// After (AmbassadorGridCard / PeerGridCard)
<Link href={`/u/${card.userId}`} style={{
  display: "flex", flexDirection: "column",
  background: "#fff",
  border: "1px solid var(--line)", borderRadius: 16, padding: "24px 20px 20px",
  textDecoration: "none", color: "inherit",
  transition: "box-shadow 0.15s, transform 0.15s",
  ...
}}>
  ...
  {/* 「話を聞く」ボタンは外部リンク扱いで e.stopPropagation */}
  <a href={`/companies/${card.companyId}/casual-meeting`}
    onClick={(e) => e.stopPropagation()}
    style={{ ... }}
  >
    話を聞く →
  </a>
</Link>
```

`AmbassadorListRow` も同様。

---

## 課題 #6 — /jobs カード（グリッドビュー）の年収フォントが一貫性に欠ける

### 現状

`JobCard`（グリッドビュー）の年収：

```tsx
<div style={{
  fontSize: 17,       // リストビューは 15
  fontWeight: (job.salary_min || job.salary_max) ? 800 : 400,  // リストは 700
  color: (job.salary_min || job.salary_max) ? "var(--success)" : "var(--ink-mute)",
}}>
```

グリッドビューは 17px/800、リストビューは 15px/700。同一ページ内でビュー切替するのに数値が異なる。

### 改善案

両者を統一。課題 #2 と合わせて `fontSize: 12, fontWeight: 600` に揃える。

---

## 課題 #7 — /people の PeerCard と AmbassadorCard でスタイルが微妙に不統一

### 現状

| 要素 | AmbassadorGridCard | PeerGridCard |
|------|-------------------|--------------|
| 名前 fontSize | 15px | 15px ✅ |
| 名前 fontWeight | 700 | 700 ✅ |
| 役職 fontSize | 12px | 12px ✅ |
| CTAボタン bg | amber gradient | royal-50 |
| CTAボタン fontSize | 13px | 13px ✅ |
| CTAボタンテキスト | 「話を聞く →」| 「プロフィールを見る →」|
| アバターサイズ | 64px | 64px ✅ |

Ambassador には「話を聞く（面談）」+ 「プロフィール」の 2ボタン、Peer には「プロフィール」の 1ボタンのみ。構造が異なるので完全統一は不要だが、「プロフィール」ボタンのスタイル（padding, fontSize, borderRadius）をそろえると視覚的統一感が上がる。

### 改善案

課題 #5 の対応（カード全体クリック化）と合わせて解決。カード全体を `/u/[id]` に飛ばせばボタン 1個省略でき、スタイル差異も減る。

---

## 改善効果まとめ

| # | 課題 | 難易度 | 効果 |
|---|------|--------|------|
| 1 | ロゴ「式会社」バグ | ⭐（1行） | バグ修正・必須 |
| 2 | 求人リストカード年収サイズ | ⭐ | 情報階層改善 |
| 3 | 求人詳細年収ピルサイズ | ⭐ | 視覚バランス改善 |
| 4 | 求人詳細 Hero 右側空白 | ⭐⭐⭐ | Layout 大改修 |
| 5 | /people カード全体クリック | ⭐⭐ | UX 大改善 |
| 6 | グリッド/リスト年収一貫性 | ⭐ | デザイン統一 |
| 7 | Peer/Ambassador スタイル差 | ⭐ | #5 と一緒に解決 |

---

## 実装分割案（推奨コミット順）

### Commit A: バグ修正（最優先・即時）
- `JobsClient.tsx`: `logoLetter = rawLetter.slice(0, 2)` + `whiteSpace: "nowrap"` 追加
- リスク: ほぼなし

### Commit B: フォントサイズ統一（/jobs 課題 #2/#3/#6）
- `JobsClient.tsx`: JobCard + JobListCard の年収 fontSize/fontWeight 調整
- `jobs/[id]/page.tsx`: 年収ピルの fontSize/padding 調整
- リスク: 低（数値変更のみ）

### Commit C: /people カード全体クリック化（課題 #5/#7）
- `PeopleListClient.tsx`: 4種カード（Ambassador Grid/List + Peer Grid/List）の `<div>` → `<Link>` 変更
- 「話を聞く」ボタンの `onClick={e => e.stopPropagation()}` 追加
- リスク: 中（ネストアンカー問題に注意。`<a>` 直接使用で解決）

### Commit D: 求人詳細 Hero レイアウト（課題 #4）
- `jobs/[id]/page.tsx`: Hero を 2カラムに変更
- リスク: 高（Layout 変更はモバイル崩れのリスク。要ブラウザ確認）

> **推奨**: Commit A → B → C を1セッションで完了。Commit D は別セッションで慎重に。
