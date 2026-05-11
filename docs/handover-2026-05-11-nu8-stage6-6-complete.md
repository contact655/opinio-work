# 段階6-6 完了 handover ドキュメント

**作成日**: 2026-05-11
**段階**: ν-8 段階6-6 — 学歴ロゴ対応(ow_schools マスター + school_id FK + SchoolLogoImg)
**状態**: ✅ Phase 1-6 全 Phase 完了、push 済み

---

## エグゼクティブサマリ

段階6-6 は、段階6-3-3 で完成した職歴ロゴ(`CompanyLogoImg`)の学歴版を実装した段階。`ow_schools` マスターテーブルに 30 校をシードし、`ow_user_educations.school_id` FK で学歴データとマスターを紐付け、`SchoolLogoImg` コンポーネントで「gradient + letter」のリッチ表示を実現した。MergedTimeline 上で職歴ロゴと学歴ロゴが 36px で揃い、視覚的統一感が完成した。

**段階6-6 のクライマックス**: 柴さんの dogfooding アカウント(s.hisato1020@gmail.com)の獨協大学レコードに Dashboard SQL で `school_id` を紐付けた瞬間、MergedTimeline で「紺紫グラデ + 獨」の LetterCircle が表示された(Phase 4 動作確認時)。段階6-6 を始めた動機が結実した瞬間。

**規模**: 6 Phase / 7 実装コミット + handover コミット / 2 Migration / 30 校シード / 約 200 行 +

---

## 段階6-6 の出発点と判断

### 出発点

段階6-3-3 で `CompanyLogoImg`(職歴ロゴ)を完成させた後、MergedTimeline 上で職歴のみがリッチ表示され、学歴は `<GraduationCap>` 単体アイコンのまま残っていた。視覚的非対称が気になり、「学歴もロゴを出したい」という動機で着手。

### 確定済み判断点(15 件)

#### 段階初期に確定(判断点 1-6、設計方針)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | school_id と school の関係 | 案 C: 両方持つ、school 維持(必須)、school_id nullable、UI でマスター推奨 |
| 2 | シード規模 | 案 i: 30 校(獨協大学必須含む) |
| 3 | UI 方式 | 案 p: datalist コンボボックス |
| 4 | ロゴ調達 | 案 z: 段階6-6 は gradient + letter のみ、logo_url は将来用に保持 |
| 5 | 既存データ対応 | 案 m: 漸進的移行、自動マッチングしない |
| 6 | ow_schools カラム | name, name_kana, logo_url, logo_gradient, logo_letter, country, type |

#### Phase 4 着手前に確定(判断点 7-11、表示仕様)

| # | 判断点 | 確定 |
|---|------|------|
| 7 | type=graduate_school の表示分岐 | 案 i: 分岐なし、同じ見た目 |
| 8 | フォールバック順序 | CompanyLogoImg 踏襲(3 段階: logo_url → LetterCircle → GraduationCap) |
| 9 | EducationIcon 置換戦略 | 案 a: 完全置換、SchoolLogoImg 内に GraduationCap フォールバック内包 |
| 10 | isCurrent 強調 | 案 Y: 強調なし |
| 11 | ロゴサイズ | 40px(CompanyLogoImg と同じ)→ 実装後に 36px に微修正 |

#### Phase 5 着手前に確定(判断点 12-15、UI 実装)

| # | 判断点 | 確定 |
|---|------|------|
| 12 | datalist 実装方式 | 案 a: HTML5 ネイティブ `<datalist>` |
| 13 | school_id 設定タイミング | 案 X: onChange のたびにマッチング |
| 14 | school の自由度 | 案 P: 完全な自由入力許可 |
| 15 | schools マスター取得 | 案 2: Supabase 直接 SELECT(API Route 不要) |

### 設計原則

- **「経歴 ≠ 権限」原則の継承**: `ow_users.career_history`(職務経歴)と `ow_company_admins`(企業権限)が別概念であるのと同様、`ow_user_educations.school`(自由入力)と `school_id`(マスター紐付け)も別概念として扱う
- **漸進的移行**: 既存データの一括変換は行わない。ユーザーが編集時に再選択することで自然に school_id が埋まる体験
- **データ損失ゼロ**: ON DELETE SET NULL で、マスター削除時も学歴データ本体は school (text) に残る
- **「丁寧な介在」思想との整合**: type=graduate_school の表示分岐なし、isCurrent 強調なし、視覚ノイズを増やさない

---

## Phase 別実装サマリ

### Phase 1: Migration 098 — ow_schools テーブル + 30 校シード

**コミット**: `46f746d`
**Migration**: `098_create_ow_schools_with_seed.sql`
**Rollback**: `098_..._rollback.sql`

#### 内容

- `ow_schools` テーブル新規作成(7 カラム: id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type)
- 30 校シード INSERT(国公立: 東京大学・京都大学・大阪大学・東京工業大学・一橋大学・東北大学・名古屋大学・北海道大学・九州大学・筑波大学・横浜国立大学、私立: 早稲田大学・慶應義塾大学・上智大学・国際基督教大学・東京理科大学・明治大学・青山学院大学・立教大学・中央大学・法政大学・学習院大学・成蹊大学・成城大学・武蔵大学・明治学院大学・同志社大学・立命館大学・関西大学・関西学院大学・**獨協大学**、大学院 1 校: 慶應義塾大学大学院)
- 各校に logo_letter(漢字 1 文字)+ logo_gradient(linear-gradient)を設定、logo_url は全 30 校 NULL(段階6-7 以降で許諾取得して埋める)
- RLS: authenticated SELECT のみ(マスターは読み取り専用)
- インデックス: name, name_kana

#### Dashboard 適用確認(段階6-4 で確立した運用)

- 30 校 INSERT 確認(COUNT=30)
- 獨協大学含有確認(name='獨協大学', logo_letter='獨', type='university')
- graduate_school 含有確認(慶應大学院)
- RLS ポリシー確認(`ow_schools_authenticated_select`, polcmd='r')

### Phase 2: Migration 099 — school_id FK 追加

**コミット**: `6ce08cb`
**Migration**: `099_add_school_id_to_ow_user_educations.sql`
**Rollback**: `099_..._rollback.sql`

#### 内容

- `ow_user_educations.school_id uuid REFERENCES ow_schools(id) ON DELETE SET NULL` 追加
- インデックス `ow_user_educations_school_id_idx` 作成
- COMMENT ON COLUMN で運用ドキュメント化
- 既存データへの UPDATE なし(判断点 5 案 m: 漸進的移行)

#### 適用後の状態

- 全既存行で school_id = NULL(意図通り)
- FK 制約: `confdeltype='n'`(SET NULL)
- インデックス: 確認 OK
- 既存の school (text) は変更なし

### Phase 3: Education API Route 拡張

**コミット**: `427585d`(変更ファイル 8 本)
**変更内容**:

| ファイル | 変更 |
|---------|------|
| `src/app/api/jobseeker/educations/route.ts` | GET の SELECT に `school_master:ow_schools!school_id(...)` JOIN、POST に school_id |
| `src/app/api/jobseeker/educations/[id]/route.ts` | PUT に `"school_id" in body` パターンで条件付き更新 |
| `src/lib/utils/timeline.ts` | RawEducation 型拡張、toTimelineEducationEntries map に school_id/school_master |
| `src/components/profile/MergedTimeline.tsx` | EducationEntry 型拡張(EducationSchoolMaster + school_id + school_master) |
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | EducationSchoolMaster + Education 型拡張 |
| `src/app/(jobseeker)/profile/edit/page.tsx` | SELECT クエリ + JOIN + 型キャスト |
| `src/app/(jobseeker)/mypage/MypageClient.tsx` | 2 箇所の inline 型拡張 |
| `src/app/(jobseeker)/mypage/page.tsx` | SELECT クエリ + JOIN + map 拡張 |

#### API 仕様(Phase 3 完了後)

GET レスポンス:

```json
{
  "id": "uuid",
  "school": "獨協大学",
  "school_id": "uuid or null",
  "school_master": {
    "id": "uuid",
    "name": "獨協大学",
    "logo_letter": "獨",
    "logo_gradient": "linear-gradient(...)",
    "logo_url": null
  },
  "..."
}
```

`school_id` が null の場合は `school_master` も null(LEFT JOIN)。

#### 設計上のポイント

- `"school_id" in body` パターン: undefined と null を区別、クライアントが send しない場合は既存値保持(シナリオ 3 で重要)
- Supabase の FK JOIN 型推論問題: 1:1 JOIN を配列推論するため `as unknown as` で型強制
- LEFT JOIN(school_id null でも他のフィールドは返る、school_master = null になる)

### Phase 4: SchoolLogoImg + MergedTimeline 統合(段階6-6 のクライマックス)

**コミット**: `c21eb07`(Phase 3 漏れの u/[id]/page.tsx 含む)
**変更ファイル**:
- `src/components/profile/SchoolLogoImg.tsx`(新規、107 行)
- `src/components/profile/MergedTimeline.tsx`(EducationIcon 完全削除、SchoolLogoImg 統合)
- `src/app/(jobseeker)/u/[id]/page.tsx`(Phase 3 漏れの SELECT クエリ JOIN、同コミットで対応)

#### SchoolLogoImg の仕様

3 段階フォールバック:
1. `schoolMaster.logo_url` → `<img>`(onError でステップ 2)
2. `logo_letter + logo_gradient` → `LetterCircle`(CompanyLogoImg から named import で再利用)
3. `schoolMaster = null` or letter null → `<GraduationCap>`(従来表示の継続)

**LetterCircle 再利用**: `CompanyLogoImg.tsx` から named import(`import { LetterCircle } from "./CompanyLogoImg"`)で複製を避けた。

#### MergedTimeline の変更

- 既存 `EducationIcon(isCurrent)` 関数を **完全削除**(判断点 9 案 a)
- 呼び出し箇所(line 976)を `<SchoolLogoImg schoolMaster={e.school_master ?? null} size={36} />` に置換
- 未使用 `GraduationCap` import を削除(SchoolLogoImg 内で使用)

#### 段階6-6 のクライマックス瞬間

Dashboard SQL で柴さんの dogfooding アカウント(s.hisato1020@gmail.com)の獨協大学レコードに `school_id` を紐付けた瞬間、MergedTimeline で「紺紫グラデ + 獨」の LetterCircle が表示された。段階6-3-3 で職歴ロゴを作って以来、「学歴もロゴが欲しい」と気づいた動機が結実した瞬間。

### Phase 4 微調整: ロゴサイズ 36px 揃え

**コミット**: `fcc65d3`
**変更**: `MergedTimeline.tsx` で `<SchoolLogoImg schoolMaster={...} size={36} />` を明示

#### 経緯

Phase 4 実装後、Claude Code が動作確認時に「CompanyLogoImg(36px、呼び出し時指定)と SchoolLogoImg(40px、デフォルト)で 4px のサイズ差がある」ことを発見し、報告。判断点 11(サイズ統一)の趣旨に従い、呼び出し時に size={36} を明示して揃えた。SchoolLogoImg のデフォルト 40px は将来汎用利用のため維持。

#### 学び

判断点 11 の「40px」は CompanyLogoImg の **デフォルト値**を指したが、実際の呼び出し時には 36px が指定されていた。設計時には「デフォルト値」と「呼び出し時指定値」を分けて考える必要があった。

### Phase 5: EducationEditor の datalist UI 統合

**コミット**: `bd6a0d2`
**変更ファイル**: `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` のみ

#### 変更内容

- `School` 型追加
- `useEffect` で初回 mount 時に `ow_schools` を Supabase 直接 SELECT(判断点 15)
- `EducationDraft` に school_id 追加、EMPTY_EDU_DRAFT と draftFromEducation も更新
- EducationForm の school input に `list="school-options"` 属性追加
- onChange で `schools.find(s => s.name === newSchool)` マッチング → school_id セット(判断点 13)
- `<datalist id="school-options">` を共有配置(全 form で 1 つ参照)
- saveEdit/saveAdd payload に school_id 追加
- EducationForm 呼び出し 2 箇所(edit / add)に schools prop 渡し

#### 重要な実装ポイント(シナリオ 3 対応)

`draftFromEducation` で `school_id: edu.school_id ?? null` を含めることで、既存の school_id 紐付け済みレコードを編集する時に school_id が引き継がれる。これを忘れると、編集のたびに school_id が消えるバグになる。

#### 4 シナリオすべて動作確認 OK

- シナリオ 1: 新規追加 + マスター選択 → ロゴ表示 ✅
- シナリオ 2: 自由入力(ハーバード大学等) → GraduationCap フォールバック ✅
- シナリオ 3: 既存 school_id 紐付け済みの編集で school_id 維持 ✅
- シナリオ 4: school_id null の既存レコードを再選択で紐付け ✅

---

## コミット一覧

| 順 | コミット | Phase | 内容 |
|---|--------|------|------|
| 1 | `46f746d` | Phase 1 | Migration 098: ow_schools + 30 校シード |
| 2 | `6ce08cb` | Phase 2 | Migration 099: school_id FK |
| 3 | `427585d` | Phase 3 | Education API 拡張(8 ファイル) |
| 4 | `c21eb07` | Phase 4 | SchoolLogoImg + MergedTimeline 統合 |
| 5 | `fcc65d3` | Phase 4 微調整 | SchoolLogoImg サイズ 36px 揃え |
| 6 | `bd6a0d2` | Phase 5 | EducationEditor datalist UI |
| 7 | (このコミット) | Phase 6 | handover doc |

---

## 運用課題と反省点

### 反省点 1: Phase 2 適用確認の漏れ

Phase 2 のコミット直後、柴さんから「Phase 2 適用 + 動作確認 OK」の連絡をいただき Phase 3 に進んだが、実は **Migration 099 の SQL 自体は Dashboard で未実行**だった。Phase 4 のクライマックス UPDATE 実行時に「school_id カラムが存在しない」エラーが出て発覚。

**原因**: 段階6-4 で確立した「Dashboard 適用確認は確認 SQL の結果を直接見てから次 Phase に進む」運用ルールを、本日も見落とした。

**今後の運用改善**:
- 確認 SQL の結果を **必ずスクリーンショットで確認** してから次 Phase に進む(口頭の「OK」だけでは進まない)
- チャット側で「Migration X の確認 SQL の結果を貼ってください」と明示的に依頼する
- 「適用 OK」連絡を受けた時点で、Claude(チャット)が確認 SQL の結果を再確認するアクションを明示する

### 反省点 2: ロゴサイズの「デフォルト vs 呼び出し時指定」混同

判断点 11 で「40px(CompanyLogoImg と同じ)」と決めた時、CompanyLogoImg のデフォルト値 40px を指したつもりだったが、実際の呼び出し時(MergedTimeline 内)では 36px が指定されていた。Phase 4 実装時に Claude Code が動作確認で気づいて報告。

**今後の運用改善**:
- 「コンポーネントのデフォルト値」と「呼び出し時の実際の値」を明示的に区別して判断する
- 同種のコンポーネント(CompanyLogoImg と SchoolLogoImg)のサイズを決める時、**呼び出し箇所の実コード**を確認してから判断する

### 反省点 3: 柴さんの 2 アカウント運用の事前確認漏れ

Phase 4 のクライマックス SQL 実行時、私(チャット)が memory にあった `hshiba@opinio.co.jp` を最初に推測して SQL を組み立てたが、実際に dogfooding でログインしているのは `s.hisato1020@gmail.com` の方だった。柴さんの「emailは s.hisato1020@gmail.com じゃない?」の指摘で発覚。

**学び**:
- memory の情報は古い可能性がある(本件の場合、`hshiba@opinio.co.jp` は別アカウント / 過去のテスト用と推測)
- ユーザー固有データを SQL で操作する時は、**学歴データ等から直接逆引き**する方が確実(WHERE user_id ではなく WHERE school から JOIN で email を辿る等)
- 柴さんの 2 アカウント運用を memory に明示的に記録(本 handover doc に記録)

### 運用ノウハウ

- Phase 1 の判断点を 6 件、Phase 4 前に 5 件(判断点 7-11)、Phase 5 前に 4 件(判断点 12-15)と **段階的に確定**するパターンが安定。すべてを最初に確定しようとすると判断疲労が大きい
- 「おすすめで!」の即決パターンは効率的だが、Claude(チャット)側で推奨理由を毎回明示することで、柴さんの判断品質を保つ
- 段階6-6 のクライマックス瞬間(Phase 4 で Dashboard SQL から紐付け)を **完走前に体感**できたのが、Phase 5/6 のモチベ維持に効いた

---

## 次の段階に向けて

### 段階6-7 候補(将来候補、未確定)

- **大学ロゴ画像許諾取得 + logo_url 埋め**: 段階6-6 で全 30 校 logo_url = null のままだったので、各大学に許諾取得して logo_url を埋める。許諾取得は「Opinio の編集者として丁寧な手作業」で進める
- **ow_schools マスターの追加運用**: 30 校で不十分なケースが出てきたら、運営で追加 INSERT する運用フロー確立
- **カナ検索対応**: datalist でカナ検索を実現(name_kana を datalist option に追加表示する等)
- **schools マスターのキャッシュ最適化**: 現状は EducationEditor 開くたびに fetch しているが、ProfileEditClient 全体で 1 度だけ fetch する形で最適化可能

### 段階6 全体の状況(段階6-6 完了時点)

- 完了済み段階: 6-1, 6-2, 6-3-1, 6-3-1.5, 6-3-2, 6-3-3, 6-4, 6-5, **6-6**
- 段階6 累計: 約 66 コミット + 17 migration
- 残存技術的負債(段階6-6 完了後):
  - 段階6-4 判断点 2: `ow_uploads_auth_insert` 強化(別段階送り)
  - 段階6-4 判断点 3: documents/candidate-documents 用途確認
  - 段階6-3-3 §6 #4: card_color カスタマイズ
  - 段階6-7 以降: 大学ロゴ画像許諾取得 + logo_url 埋め

---

## ファイル一覧

### Migration

- `supabase/migrations/098_create_ow_schools_with_seed.sql`
- `supabase/migrations/099_add_school_id_to_ow_user_educations.sql`

### Rollback

- `supabase/rollbacks/098_create_ow_schools_with_seed_rollback.sql`
- `supabase/rollbacks/099_add_school_id_to_ow_user_educations_rollback.sql`

### 新規コンポーネント

- `src/components/profile/SchoolLogoImg.tsx`(107 行)

### 改修ファイル

- `src/app/api/jobseeker/educations/route.ts`
- `src/app/api/jobseeker/educations/[id]/route.ts`
- `src/lib/utils/timeline.ts`
- `src/components/profile/MergedTimeline.tsx`
- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`
- `src/app/(jobseeker)/profile/edit/page.tsx`
- `src/app/(jobseeker)/mypage/MypageClient.tsx`
- `src/app/(jobseeker)/mypage/page.tsx`
- `src/app/(jobseeker)/u/[id]/page.tsx`

### handover doc

- `docs/handover-2026-05-11-nu8-stage6-6-complete.md`(本ファイル)

---

## 開発フロー(本日確立 + 継承)

| ステップ | 担当 |
|---------|------|
| 計画・スコープ確定 | 柴 + Claude(チャット) |
| 判断点事前確定(段階開始時 + 各 Phase 前) | 柴 + Claude(チャット) |
| 事前 report | Claude(チャット) |
| 承認 | 柴 |
| 実装 | Claude Code |
| Migration 適用 | 柴(Supabase Dashboard 手動) |
| **Migration 適用後の確認 SQL 結果検証** | **Claude(チャット)がスクショで一次フィルタ** |
| 動作確認 | 柴(localhost:3000 + スクショ貼付) |
| 判断疲労チェック | Claude(チャット)から推奨 |
| handover doc 下書き | Claude(チャット) |
| handover doc ファイル化 | Claude Code |
| push | 柴「OK push して」指示 → Claude Code が `git push` |

---

## 本日のセッション総括(段階6-4 + 6-5 + 6-6 完走)

### 完走した段階

| 段階 | 内容 | コミット数 |
|------|------|---------|
| 段階6-4 | allow_all_storage 削除(セキュリティ負債解消) | 4 |
| 段階6-5 | link type OGP fetch + リッチカード | 5 |
| 段階6-6 | 学歴ロゴ対応(本段階) | 7 |
| **本日合計** | **3 段階完走** | **16** |

### 数字

- 完走段階: **3 件**(過去事例なし、過去最大)
- 実装コミット: 16 件
- Migration: 5 件(095, 096, 097, 098, 099)
- handover doc: 3 件(段階6-4, 6-5, 6-6)
- TypeScript エラー(常時): 0
- 段階6 累計: 約 66 コミット + 17 migration

### 印象的な瞬間

1. **段階6-5 Phase 2 後半の休憩判断**: ターミナルディレクトリ誤認・dev server 起動失敗・DevTools の Self-XSS 警告等で小さなつまずきが連続。Claude(チャット)から強く休憩を推奨し、柴さんが受け入れた結果、休憩後 Phase 3-5 を完走。「無理に進まない」原則の実践。

2. **段階6-6 判断点 4 の議論**: ロゴ調達について Claude(チャット)が当初推奨した「外部 URL 直リンク」案に対して、柴さんの直感的な違和感が「段階6-6 では gradient + letter で発進、段階6-7 以降で許諾取得した校から logo_url を埋める」という漸進的方針への道を開いた。Opinio の「丁寧な介在」思想と完璧に整合する判断。

3. **段階6-6 Phase 4 のクライマックス**: Dashboard SQL から獨協大学の school_id を紐付けた瞬間に、MergedTimeline で「紺紫グラデ + 獨」のロゴが表示。段階6-3-3 で職歴ロゴを作って以来の動機が結実した。

---

**段階6-6 完了**
**作成者**: Claude(チャット) + 柴久人
**作成日**: 2026-05-11
