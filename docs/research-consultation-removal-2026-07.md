# キャリア相談機能（/career-consultation）削除前調査レポート
作成: 2026-07-08

---

## ❗ 結論を先に

**`/career-consultation` は完全に独立した機能。DB テーブルを一切使っていない。**

- `ow_casual_meetings`（企業へのカジュアル面談）とは**別物**
- `ow_mentor_reservations`（話せる人 /people のメンター予約）とも**別物**
- 削除しても `/people` や `/companies/[id]/casual-meeting` は一切壊れない

削除のブロッカーはゼロ。ただし `HeroSection.tsx`（現在どこにも import されていない孤立ファイル）が `/career-consultation` と `/consultation-cases` の両方にリンクしているため、このファイルの扱いを確認する必要がある。

---

## 1. 相談関連ファイル一覧

### 専用ディレクトリ（削除対象）

```
src/app/(jobseeker)/career-consultation/
├── page.tsx                           ← カード型 Static Server Component（アドバイザー一覧 + Spir外部リンク）
├── apply/
│   ├── page.tsx                       ← Suspense ラッパー（ApplyClient を囲む）
│   ├── layout.tsx                     ← apply/ 専用レイアウト
│   └── ApplyClient.tsx                ← フォーム UI（名前・メール・希望時間帯）
│   └── _actions/
│       └── submitConsultation.ts      ← Server Action（Resend メール送信のみ、DB 書込なし）
```

**計 5 ファイル、1 ディレクトリ**

### submitConsultation.ts の動作

```typescript
// DB 操作: 一切なし
// 処理: Resend でメール 2 通送信（管理者宛 + 申込者への自動返信）
// テーブル: ow_casual_meetings / ow_mentor_reservations / ow_consultations — 一切不使用
await notify({ to: ADMIN_EMAIL, ... });  // 管理者通知
await notify({ to: email, ... });        // 申込者自動返信
```

---

## 2. ナビリンクの場所

### PC ナビ（JobseekerHeader.tsx）

```typescript
// src/components/jobseeker/JobseekerHeader.tsx:15
{ href: "/career-consultation", label: "相談", highlight: false },
```

現在の NAV_LINKS（6 リンク）:
```
企業 / 求人 / 話せる人 / フィード / 相談 / 記事
```
削除後は 5 リンクになる。

### モバイルナビ（MobileBottomNav.tsx）

```
/career-consultation の参照: なし
```

MobileBottomNav は `/people` へのリンクのみ（「話せる人」タブ）。相談は含まれていない。

---

## 3. 他ページからの参照（href="/career-consultation" のリンク）

| ファイル | 行 | 内容 |
|--------|-----|------|
| `src/components/jobseeker/JobseekerHeader.tsx` | 15 | NAV_LINKS のエントリ |
| `src/app/(jobseeker)/HomePageClient.tsx` | 822–829 | PainPoints セクションのカード（「キャリアの相談がしたい」）|
| `src/app/(jobseeker)/career-consultation/apply/ApplyClient.tsx` | 80, 97 | apply 内の「戻る」リンク（内部参照、ディレクトリ削除で消える）|
| `src/app/(jobseeker)/career-consultation/page.tsx` | 6 | canonical URL（ページ自体、削除で消える）|
| `src/app/HeroSection.tsx` | 266 | 「現役SaaS実務家に無料で相談する →」ボタン ⚠️ |
| `src/app/sitemap.ts` | 99 | `url: \`${baseUrl}/career-consultation\`` |

### ⚠️ HeroSection.tsx について

`src/app/HeroSection.tsx` は `/career-consultation` と `/consultation-cases` の両方にリンクしているが、**現在どこにも import されていない**（grep で参照元ゼロ）。

孤立ファイル（dead code）と判断してよい。`/career-consultation` 削除と同時に HeroSection.tsx も削除するか、または単独でそのまま残してもビルドに影響しない。

---

## 4. ★ 相談専用 DB / API と共有 DB / API の切り分け（最重要）

### /career-consultation が使うもの

| 種別 | 名前 | 内容 |
|------|------|------|
| Server Action | `submitConsultation.ts` | Resend メール送信のみ。DB 操作なし |
| 外部リンク | Spir（spirinc.com）| アドバイザーの日程調整ツール |
| DB テーブル | **なし** | テーブル操作ゼロ |

### ow_casual_meetings（企業カジュアル面談）— 削除対象外・完全別物

| 機能 | ファイル |
|------|---------|
| 申込フォーム | `/companies/[id]/casual-meeting/CasualMeetingForm.tsx` |
| 申込 API | `/api/casual-meetings/route.ts` |
| 企業側管理 | `/biz/meetings/[id]/route.ts` |
| Admin 管理 | `/admin/meetings/page.tsx` |
| マイページ | `/mypage/page.tsx`（応募一覧） |
| 企業詳細バッジ | `accepting_casual_meetings` フラグ（各所） |

**`/career-consultation` とは完全に無関係。削除しても一切影響しない。**

### ow_mentor_reservations（話せる人 /people）— 削除対象外・完全別物

| 機能 | ファイル |
|------|---------|
| 予約フォーム | `/mentors/[id]/reserve/` |
| 予約 API | `/api/mentor-reservations/route.ts` |

**こちらも `/career-consultation` とは完全に無関係。**

### 参考: consultation_cases / ow_consultations テーブル（types.ts に定義あり）

`src/lib/supabase/types.ts` に `consultation_cases` と `ow_consultations` テーブルの型定義が存在するが、**実際にクエリしているコードは存在しない**（grep ではヒットなし）。

これらは DB に実テーブルが存在する可能性があるが、フロントから参照されていない孤立テーブル。`/career-consultation` 削除とは無関係。

---

## 5. 削除で壊れうる共有物（残すべきもの）

**なし。**

`/career-consultation` は完全に独立したリーフ機能。削除で他が壊れる共有コンポーネント・API・テーブルはない。

参照元として残るのは以下の 3 箇所（ディレクトリ削除後に個別修正が必要）:

1. `JobseekerHeader.tsx` — NAV_LINKS のエントリを削除
2. `HomePageClient.tsx` — PainPoints セクションのカード 1 枚を削除（または href 変更）
3. `sitemap.ts` — `/career-consultation` エントリを削除

HeroSection.tsx は孤立ファイルのため、同時削除またはそのまま放置、どちらでも安全。

---

## 6. 削除の推奨分割（コミット単位）

キャリア軌跡削除と同じ原則（参照 → 本体の順）で 2 コミット。

### Commit 1: 外側の参照を削除

対象ファイル（変更）:

| ファイル | 変更内容 |
|---------|---------|
| `src/components/jobseeker/JobseekerHeader.tsx` | NAV_LINKS から `{ href: "/career-consultation", label: "相談" }` を削除 |
| `src/app/(jobseeker)/HomePageClient.tsx` | PainPoints セクションの「キャリアの相談がしたい」カードを削除（`href: "/career-consultation"` のオブジェクト 1 件） |
| `src/app/sitemap.ts` | `/career-consultation` の URL エントリを削除 |

対象ファイル（削除）:

| ファイル | 理由 |
|---------|------|
| `src/app/HeroSection.tsx` | どこにも import されていない孤立ファイル。`/career-consultation` と `/consultation-cases` にリンクしており、今後参照される予定もない |

### Commit 2: 本体ディレクトリを削除

対象:
```
src/app/(jobseeker)/career-consultation/  （ディレクトリごと削除）
└── page.tsx
└── apply/
    ├── page.tsx
    ├── layout.tsx
    ├── ApplyClient.tsx
    └── _actions/submitConsultation.ts
```

**計 5 ファイル削除**

---

## 7. migration ファイルと seeds（今回は触らない）

### migration ファイル（相談専用）

| ファイル | 内容 |
|---------|------|
| `supabase/migrations/029_consultation_phase1.sql` | consultation_cases / ow_consultations の初期スキーマ |
| `supabase/migrations/108_consultation_categories.sql` | カテゴリ追加 |
| `supabase/migrations/110_consultation_requests.sql` | 相談リクエスト系 |

**今回は削除しない。** DB テーブル削除は別 migration で後日実施。

### seed スクリプト

- `scripts/seed-consultation-cases.ts` が存在。テストデータ投入用。フロント削除後に別途削除可。

---

## 8. フロント削除後に孤立する DB（今回は消さない）

| テーブル | 状況 | 備考 |
|---------|------|------|
| `consultation_cases` | types.ts に型定義あり、コードから未参照 | HeroSection.tsx のリンク先だったが HeroSection も孤立 |
| `ow_consultations` | types.ts に型定義あり、コードから未参照 | フロント削除前から既に孤立 |

これらは DB 上に実テーブルが存在する可能性があるが、フロントからは既に（削除前から）参照されていない。`/career-consultation` 削除後も DB テーブル自体の影響はなし。後日別途 migration で DROP しても安全。

---

## まとめ表

| 確認事項 | 結論 |
|---------|------|
| `/career-consultation` の DB 使用 | **なし**（メール送信のみ） |
| `ow_casual_meetings` との関係 | **完全別物**（企業カジュアル面談、共有なし） |
| `ow_mentor_reservations` との関係 | **完全別物**（話せる人 /people の予約、共有なし） |
| `/people` 面談フローへの影響 | **なし** |
| MobileBottomNav への影響 | **なし**（相談リンクはモバイルナビに存在しない） |
| 削除で壊れる共有コンポーネント | **なし** |
| 削除の安全性 | **高**（ブロッカーゼロ） |
| コミット分割 | **2 コミット**（参照 → 本体） |
| 孤立 DB テーブル（後日削除候補） | `consultation_cases` / `ow_consultations` |
