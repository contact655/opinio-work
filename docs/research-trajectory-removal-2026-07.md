# キャリア軌跡機能 削除範囲調査レポート
作成: 2026-07-08

---

## 1. 全参照箇所リスト

### 専用ページ・ディレクトリ（丸ごと削除対象）

| パス | 種別 | 説明 |
|-----|------|------|
| `src/app/(jobseeker)/career-trajectories/page.tsx` | 専用ページ | 一覧ページ（Server Component） |
| `src/app/(jobseeker)/career-trajectories/loading.tsx` | ローディング | 一覧ページのスケルトン |
| `src/app/(jobseeker)/career-trajectories/TrajectoryPageClient.tsx` | Client | 一覧ページのクライアント描画 |
| `src/app/(jobseeker)/career-trajectories/TrajectoryCardClient.tsx` | Client | カードコンポーネント（`CardData` 型 export あり） |
| `src/app/(jobseeker)/career-trajectories/[userId]/page.tsx` | 専用ページ | 個人詳細ページ |
| `src/app/(jobseeker)/career-trajectories/[userId]/loading.tsx` | ローディング | 詳細ページスケルトン |
| `src/app/(jobseeker)/career-trajectories/[userId]/opengraph-image.tsx` | OGP | 動的 OG 画像生成 |
| `src/app/admin/career/page.tsx` | Admin | キャリア軌跡管理一覧 |
| `src/app/admin/career/[userId]/page.tsx` | Admin | キャリア軌跡編集（個人） |
| `src/app/admin/career/[userId]/CareerEditorClient.tsx` | Admin Client | 編集フォーム（`/api/admin/career/profile`, `/api/admin/career/experience/[id]` を呼ぶ） |

### 専用 API Routes（フロント削除後に孤立するもの）

| パス | 呼び出し元 | 説明 |
|-----|-----------|------|
| `src/app/api/admin/career/profile/route.ts` | CareerEditorClient のみ | `ow_career_profiles` UPSERT |
| `src/app/api/admin/career/experience/` | CareerEditorClient のみ | `ow_experiences` の visibility 更新 |
| `src/app/api/jobseeker/career-profile/route.ts` | ProfileEditClient のみ | `ow_career_profiles` GET/PATCH |

### 専用ライブラリ・型ファイル（依存元がなくなれば削除可能）

| パス | 使用元 | 説明 |
|-----|--------|------|
| `src/types/career.ts` | `src/lib/career/resolve.ts` のみ | `CareerProfile`, `CareerStep`, `PublicCareerStep`, `CompanyVisibility` 型定義 |
| `src/lib/career/resolve.ts` | career-trajectories ページ（RPC `get_public_career_steps` 経由）のみ | `resolvePublicStep()`, `resolvePublicSteps()`, `maskCompany()` |
| `src/components/ui/CareerSalarySparkline.tsx` | **どこからも import されていない**（自分自身の定義のみ） | 年収スパークラインコンポーネント — 既に dead code |

### ★削除しない（生きているコンポーネント）

| パス | 理由 |
|-----|------|
| `src/components/profile/MergedTimeline.tsx` | `/u/[id]` と `/mypage` の**職歴タイムライン表示**に使用。キャリア軌跡専用ではない |
| `src/lib/utils/timeline.ts` | `MergedTimeline` が使う型・ユーティリティ。`/u/[id]` と `/mypage` から import |
| `src/lib/utils/career.ts` | 呼び出し元が見つからない（`lib/utils/career.ts` を import しているファイルはゼロ）が、`MergedTimeline.tsx` のコメントに言及があるため念のため残す |
| `src/components/profile/CareerHistoryEditor.tsx` | `/profile/edit` の職歴入力コンポーネント。キャリア軌跡とは独立 |

---

## 2. ナビリンクの場所

### PC グローバルナビ（JobseekerHeader）
- **ファイル**: `src/components/jobseeker/JobseekerHeader.tsx:14`
- **定義**: `{ href: "/career-trajectories", label: "キャリア軌跡", highlight: false }`
- **削除**: NAV_LINKS 配列からこの1エントリを削除するだけ

### モバイルボトムナビ（MobileBottomNav）
- **結果**: `/career-trajectories` リンクは**含まれていない**。対応不要。

---

## 3. 既存ページ内の参照（セクション除去が必要なもの）

### `src/app/(jobseeker)/HomePageClient.tsx`

| 行 | 内容 | 削除範囲 |
|---|------|---------|
| 183-185 | InfraSection 内の「転職者の年収・軌跡を確認」カード | カード1枚（3枚のうち1枚） |
| 535-538 | HowItWorks の STEP 02「先輩の軌跡・年収を確認」 | ステップ1つ（3ステップのうち1つ） → 残りのステップ番号を振り直し |
| 563 | テキスト中「・キャリア軌跡・年収データを集約」 | 該当テキスト部分のみ削除 |
| 784-930 | `CareerTrajectoriesTeaser` コンポーネント定義（147行） | 関数ごと削除 |
| 1297 | `<CareerTrajectoriesTeaser />` 呼び出し | 1行削除 |
| 839, 847, 855, 920, 927 | 上記関数内の軌跡・年収テキスト | CareerTrajectoriesTeaser 削除で連鎖削除 |

### `src/app/(jobseeker)/mypage/MypageClient.tsx`

| 行 | 内容 | 削除範囲 |
|---|------|---------|
| 1110 | プロフィール完成度ステップ3「キャリア軌跡を見てみる」 | step 配列の1エントリを削除 |
| ※ MergedTimeline 使用（行 8, 484-487, 1163-1196） | mypage の職歴タイムライン | **削除しない**（プロフィール表示として生きている） |

### `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`

| 行 | 内容 | 削除範囲 |
|---|------|---------|
| 2816〜2858 | `careerIsPublished` / `careerHeadline` / `careerYears` state + `saveCareerProfile` 関数 | state 変数・useCallback 関数を削除 |
| 3651〜3791 | `<FormSection title="キャリア軌跡の公開設定">` セクション全体（140行） | セクション丸ごと削除 |
| `/api/jobseeker/career-profile` fetch（2825行, 2841行） | API 呼び出し | 上記削除で連鎖削除 |

### `src/app/admin/candidates/page.tsx` / `CandidatesClient.tsx`

| ファイル | 行 | 内容 | 削除範囲 |
|---------|---|------|---------|
| `page.tsx:23` | `ow_career_profiles` クエリ + `hasCareerProfile` 算出 | クエリ1本 + map 内の1フィールド |
| `CandidatesClient.tsx:19` | `hasCareerProfile: boolean` 型フィールド | 型定義から削除 |
| `CandidatesClient.tsx:145` | テーブルヘッダー「軌跡」 | ヘッダー1セル削除 |
| `CandidatesClient.tsx:229-248` | `{/* 軌跡 */}` セル（`/admin/career/${u.id}` リンク） | `<td>` 1セル削除 |

### `src/app/sitemap.ts`

| 行 | 内容 | 削除範囲 |
|---|------|---------|
| 22-26 | `ow_career_profiles` fetch | クエリ削除 |
| 104-111 | `/career-trajectories` URL + 個人ページ URL 生成 | 2ブロック削除 |

### `src/app/globals.css`

| 行 | クラス名 | 削除範囲 |
|---|---------|---------|
| 722-736 | `.trajectory-grid`, `.trajectory-list`（レスポンシブ含む） | 約15行 |
| 763-782, 821 | `.traj-search-input`, `.traj-sort-select`（レスポンシブ含む） | 約20行 |
| 833-899 | `.trajectory-card-interactive`, `.trajectory-list-card`, `.traj-person-block`, `.traj-role-block`, `.traj-block-divider`（レスポンシブ含む） | 約70行 |

### `src/app/api/newsletter/subscribe/route.ts`

| 行 | 内容 | 対応 |
|---|------|------|
| 40 | `VALID_SOURCES` セットに `"career_trajectories"` を含む | セットから1文字列を削除（機能には無害だが文字列として残骸） |

---

## 4. DB テーブル・API・CSS への関与

### フロント削除後に孤立するDBテーブル（削除は今回やらない）

| テーブル | 状態 | 削除可否 |
|---------|------|---------|
| `ow_career_profiles` | Migration 175 で作成。フロント削除後は参照ゼロ | 後日 Migration で削除可 |
| `ow_career_follows` | Migration 175 で作成。フロント・API どこからも使われていない | 後日 Migration で削除可 |
| `ow_experiences.salary_man` カラム | Migration 175 で追加。CareerEditorClient でのみ使用 | フロント削除後は参照ゼロ → 後日削除可 |
| `ow_experiences.visibility_company` カラム | Migration 175 で追加。CareerEditorClient + career-trajectories/[userId] でのみ使用 | フロント削除後は参照ゼロ → 後日削除可 |
| `ow_experiences.visibility_salary` カラム | Migration 175 で追加。同上 | フロント削除後は参照ゼロ → 後日削除可 |
| `ow_experiences.visibility_reason` カラム | Migration 175 で追加。同上 | フロント削除後は参照ゼロ → 後日削除可 |

**注意**: `ow_experiences` の visibility_* カラムは `/u/[id]` ページ（`page.tsx:252`）でコメントに言及されているが、実際のフィルタには使われていない（`MergedTimeline` への受け渡しは `buildTimelineCareerEntriesFromRaw()` 経由で `join_reason` 非表示のみ）。フロント削除後もカラム自体は無害で残存する。

### DB RPC 関数（フロント削除後に孤立）

| 関数名 | 参照元 | 削除可否 |
|-------|--------|---------|
| `get_public_career_steps(p_user_id)` | `career-trajectories/[userId]/page.tsx` のみ | フロント削除後に後日 DROP FUNCTION 可 |

### フロント削除後に孤立する API Routes

| Route | 削除タイミング |
|-------|--------------|
| `src/app/api/admin/career/profile/route.ts` | フロント（admin/career/[userId]/page.tsx）と同コミットで削除 |
| `src/app/api/admin/career/experience/[id]/route.ts` | 同上 |
| `src/app/api/jobseeker/career-profile/route.ts` | ProfileEditClient のセクション削除と同コミットで削除 |

### globals.css の軌跡専用クラス

`.trajectory-*` / `.traj-*` プレフィックスのクラスは、`TrajectoryPageClient.tsx` と `TrajectoryCardClient.tsx` のみが使用。専用ページ削除で自動的に死んだCSSになるため、同コミットで削除する。

---

## 5. 削除の分割案（コミット単位）と推奨順序

**原則**: 末端（参照しているもの）を先に、本体（参照されているもの）を後に。

### Commit 1: ナビリンク削除（最初・最安全）
- `JobseekerHeader.tsx` の `{ href: "/career-trajectories", label: "キャリア軌跡" }` を NAV_LINKS から削除
- **影響**: ページが消えてもリンクだけは先に除去。ユーザーからの誤アクセスを防ぐ
- **リスク**: ゼロ

### Commit 2: HomePageClient の軌跡テキスト・セクション削除
- `CareerTrajectoriesTeaser` 関数（784-930行）とその呼び出し（1297行）を削除
- HowItWorks の STEP 02 を削除（残り2ステップの番号を振り直し）
- InfraSection の「転職者の年収・軌跡を確認」カードを削除
- 「取材記事・求人票・キャリア軌跡・年収データ」テキストを整理
- **影響**: LP の一部セクションが消える。独立した削除でリスク小
- **注意**: STEP 番号の振り直し（01 企業・02 先輩・03 決める → 01 企業・02 先輩）

### Commit 3: admin/candidates の軌跡列削除
- `admin/candidates/page.tsx` の `ow_career_profiles` クエリ + `hasCareerProfile` 算出を削除
- `CandidatesClient.tsx` の「軌跡」ヘッダー列・セルを削除
- **影響**: admin テーブルから列が1つ消えるだけ

### Commit 4: Profile Edit の「キャリア軌跡公開設定」セクション削除
- `ProfileEditClient.tsx` の careerIsPublished 関連 state・関数・JSXセクション（3651-3791行）を削除
- `src/app/api/jobseeker/career-profile/route.ts` を削除
- **影響**: プロフィール編集から「キャリア軌跡」タブの公開設定セクションが消える
- **注意**: カードのタブ補完ドット計算が careerIsPublished を参照している場合は合わせて削除

### Commit 5: mypage のプロフィール完成度ステップ削除
- `MypageClient.tsx:1110` のステップ3エントリを削除
- **影響**: 完成度ガイドの項目が1つ減るだけ

### Commit 6: sitemap 削除 + newsletter VALID_SOURCES 整理
- `sitemap.ts` の `ow_career_profiles` クエリとURL生成を削除
- `newsletter/subscribe/route.ts` の `"career_trajectories"` を VALID_SOURCES から削除
- **影響**: サイトマップからキャリア軌跡 URL が消える

### Commit 7: 専用ページ・Admin ページ・専用 API の一括削除（メイン削除）
以下を一括削除:
- `src/app/(jobseeker)/career-trajectories/` ディレクトリ全体（5ファイル）
- `src/app/admin/career/` ディレクトリ全体（4ファイル）
- `src/app/api/admin/career/` ディレクトリ全体（profile + experience routes）
- **注意**: Commit 3-5 で参照元を先に削除済みなので、このコミット時点でビルドエラーなし

### Commit 8: 専用ライブラリ・型・CSS の削除
- `src/types/career.ts` 削除（resolve.ts を削除するとここへの参照もゼロになる）
- `src/lib/career/resolve.ts` 削除
- `src/components/ui/CareerSalarySparkline.tsx` 削除（既に dead code）
- `src/app/globals.css` の `.trajectory-*` / `.traj-*` クラス群を削除
- **注意**: `lib/utils/career.ts` は呼び出し元ゼロだが、コメントに言及があるため **今回は残す（要確認）**

---

## 6. 想定リスク

### リスク A: MergedTimeline / timeline.ts を誤削除
- **状況**: これらは「キャリア軌跡専用ページ」ではなく `/u/[id]` プロフィールの職歴タイムライン表示に使われている
- **防止**: grep で `MergedTimeline` の import 元が `career-trajectories/` 以外にあることを必ず確認してから削除判断

### リスク B: `career-profile` API を先に削除すると ProfileEditClient が壊れる
- **状況**: ProfileEditClient は useEffect でマウント時に `/api/jobseeker/career-profile` を fetch している
- **防止**: Commit 4（ProfileEditClient セクション削除）と同コミットで API も削除する。順序を逆にしない

### リスク C: admin/candidates の `hasCareerProfile` Props 不整合
- **状況**: `page.tsx` が `hasCareerProfile` を計算して `CandidatesClient` に渡している
- **防止**: Commit 3 で page.tsx の計算と CandidatesClient の型・表示を同コミットで削除

### リスク D: sitemap.ts の `ow_career_profiles` クエリがビルド時に参照エラーになる可能性
- **状況**: sitemap.ts はビルド時に静的生成される
- **防止**: ページ削除（Commit 7）と sitemap 削除（Commit 6）を同時にするか、Commit 6 を先に実施

### リスク E: `/career-trajectories` へのハードコードリンクが他箇所に残る
- **状況**: HomePageClient 以外にもハードコードリンクがある可能性
- **防止**: Commit 7 の前に再度 grep で `career-trajectories` の残存参照をゼロ確認

---

## まとめ

| 分類 | ファイル数 | 行数概算 |
|------|---------|---------|
| 専用ページ削除（career-trajectories + admin/career） | 9ファイル | 約1800行 |
| 専用 API 削除 | 3ファイル | 約150行 |
| 専用ライブラリ・型削除 | 3ファイル | 約250行 |
| globals.css 軌跡 CSS 削除 | 1ファイル | 約105行 |
| 既存ページ内セクション削除 | 5ファイル（Header / HomePageClient / ProfileEditClient / admin/candidates / sitemap） | 約320行 |
| **合計** | **21ファイル影響** | **約2625行削除** |

DB テーブル（`ow_career_profiles`, `ow_career_follows`, visibility_* カラム, `get_public_career_steps` RPC）はフロント削除後に孤立するが、今回は削除しない。後日 Migration で別途削除する。
