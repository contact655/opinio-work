# フェーズ0 調査：遷移テーブルと生年月日（2026-08-19）

**調査のみ。DB への書き込みは一切していない（SELECT のみ）。**
数値はすべて 2026-08-19 の実測値。Supabase ref: `xtutnecqeamftygufxco`。

⚠️ **`@seed.internal` のユーザーは 0件だった**ので、「seed 除外」は今回の集計に影響していない。
   実ユーザーの定義は **`is_test = false` かつ `is_system = false`** とした（この2つが実際の除外軸）。

| 母集団 | 件数 |
|---|---|
| `ow_users` 全体 | 35 |
| うち `is_test` | 20 |
| うち `is_system` | 1 |
| **実ユーザー** | **14** |

---

## 調査A：生年月日・年齢データの現状

### A-1 / A-2　列の有無と充填

`ow_users`（32列）と `ow_profiles`（26列）の全列は本ファイル末尾の付録に載せず、
**年齢に関わる列だけ**を抜き出す（他は `information_schema` で再現可能）。

| 項目 | 実測値 | 備考 |
|---|---|---|
| `ow_users.birth_date` | **date / NULL可 / デフォルト無し** | 生年月日はここ1本 |
| 　実ユーザーで値あり | **4 / 14 人**（29%） | 残り10人は NULL |
| `ow_profiles.experience_years` | **text / NULL可** | 「年齢」ではなく経験年数。**入力欄は 2026-08-07 に廃止済み** |
| 　値あり | **6 / 49 行**（distinct 3種） | 読み手はコード上0件（死蔵） |
| 生年（`birth_year`）に相当する列 | **存在しない** | `ow_career_profiles.birth_year` は現在のスキーマに無い |
| `ow_profiles` の行数 | 49 | ⚠️ `ow_users` 35 より多い |
| 　うち `ow_users.auth_id` に対応が無い行 | **20** | 孤児。auth ユーザー削除の残骸と思われる（断定はしない） |

⚠️ `ow_users` は `ordinal_position` の **8 と 19 が欠番**（過去に DROP された列がある）。

### A-3　権限とRLS（**ここが今回いちばん重要**）

| 対象 | 実測 |
|---|---|
| `ow_users` テーブルレベル SELECT | **anon にあり** / authenticated には**無い** |
| `ow_users` 列単位 SELECT（authenticated） | **30列に付与。`birth_date` は含まれない** |
| RLS | 有効（forced ではない） |
| SELECT ポリシー | `public`（=全ロール）に3本：`visibility='public'` / `visibility='login_only' AND auth.uid() IS NOT NULL` / `auth_id = auth.uid()` |

実際のレスポンス（PostgREST を直接叩いた）：

| 経路 | クエリ | 結果 |
|---|---|---|
| **anon** | `ow_users?select=id,birth_date` | **200 / `[]`** |
| **anon** | `ow_users?select=*` | **200 / `[]`** |
| **authenticated** | `ow_users?select=id,birth_date` | **403**（`permission denied for table ow_users`） |
| **authenticated** | `ow_users?select=id,name,visibility` | 200（行が返る） |

⚠️ **anon が空なのは GRANT のおかげではない。** anon はテーブルレベル SELECT を持っており、
   **列は全部読める状態**にある。空になっているのは RLS が `visibility='public'` に絞っており、
   **実ユーザー14人が全員 `login_only`（public は0人）**だから。
   誰か1人でも `public` にした瞬間、**anon に `birth_date` が返る。**

### A-4　入力UI

| 項目 | 場所 |
|---|---|
| 生年月日の入力（年・月・日の3つの `<select>`） | `src/components/profile/editor/ProfileTab.tsx:619-621`（state）／ヘッダー編集モーダル内 |
| 保存 | `PUT /api/jobseeker/profile`。`src/app/api/jobseeker/profile/route.ts:72-76` で `YYYY-MM-DD` を検証、不正なら 400 |
| 送信の組み立て | `ProfileTab.tsx:851-852`（3つが揃ったときだけ日付にする） |

### A-5　一覧系での参照

| 画面 | ファイル | 出し方 |
|---|---|---|
| `/people` | `src/lib/people/directory.ts:379`（`getUserAge`） | ⚠️ **2026-08-18 にカードから年齢表示を削除済み。** 値は「年齢」フィルタが今も使う |
| `/u/[id]` | `src/app/(jobseeker)/u/[id]/page.tsx:166-192` | admin クライアントで取り直して年齢を表示 |
| `/biz/candidates` | `page.tsx:123,240` → `CandidatesClient.tsx:172-173,286` | `birthYear` を渡し、**年齢レンジで絞り込み** |
| `/biz/meetings` | `page.tsx:26-27` | admin 経由で年齢表示 |
| `/admin/candidates` | `page.tsx:10` / `CandidatesClient.tsx:218` | 「N歳」を表示 |
| `/mypage` 系 | `mypage/page.tsx:48`、`details/[section]/page.tsx:60` | 年表の年マーカーの年齢に使う |

**この節から言えること**
- 生年月日はフル日付で既に持っており、入力・検証・保存の経路も揃っている。足りないのは**充填率（4/14）**だけ。
- authenticated からは列単位 GRANT で守れているが、**anon はテーブルレベル SELECT を持ったまま**で、守っているのは実質 RLS と「public が0人」という現状だけ。
- 企業側の年齢絞り込みは `/biz/candidates` に**既に存在する**（「社会人年数」へ変えるなら、ここが改修対象）。

---

## 調査B：職歴データ（遷移の素材）

### B-1　主要な列（全36列のうち遷移に関わるもの）

| 列 | 型 | NULL | 備考 |
|---|---|---|---|
| `user_id` | uuid | NO | |
| `company_id` | uuid | YES | マスタ企業 |
| `company_text` | text | YES | 自由入力 |
| `company_anonymized` | text | YES | 匿名表記 |
| `role_category_id` | uuid | **NO** | 職種は必ず入る |
| `started_at` | date | **NO** | |
| `ended_at` | date | YES | |
| `is_current` | boolean | NO（既定 false） | |
| `prefecture` | text | YES | **勤務地はある** |
| `remote_work_status` | text | YES | |
| `employment_type` | text | YES | |
| `join_reasons` / `leave_reasons` | ARRAY | YES | 決め手の受け皿 |

⚠️ `ordinal_position` 15 は欠番（DROP 済みの列がある）。

### B-2 / B-3　件数と分布（実ユーザー14人）

| 項目 | 実測値 |
|---|---|
| `ow_experiences` 全体 | **19** |
| うち実ユーザー分 | **18** |
| 職歴を持つ実ユーザー | **9 人**（14人中） |
| `company_id` あり | **13 / 18**（72%） |
| `company_text` のみ | **5 / 18**（28%） |
| `company_anonymized` のみ | **0** |
| `started_at` が NULL | **0**（NOT NULL 制約） |
| `ended_at` が NULL | **9 / 18** |
| `is_current = true` | **9 / 18** |
| `role_category_id` あり | **18 / 18**（100%・NOT NULL） |
| `prefecture` あり | **5 / 18** |
| `employment_type` あり | **5 / 18** |

1人あたりの職歴件数：

| 職歴件数 | 人数 |
|---|---|
| 1社のみ | **6 人** |
| 3社 | 1 人 |
| 4社 | 1 人 |
| 5社 | 1 人 |
| （2社の人は 0 人） |

隣接ペア（`started_at` 昇順で隣り合う2件）：

| 項目 | 実測値 |
|---|---|
| 隣接ペア総数 | **9** |
| うち**会社が変わる**ペア | **5** |
| うち from/to **両方が `company_id`** | **8** |
| うち両方 `company_id` で**会社も変わる** | **4** |
| 職種（`role_category_id`）が変わるペア | **8** |

### B-4　保存経路

| 何 | 場所 |
|---|---|
| API（唯一の書き込み口） | `src/app/api/jobseeker/experiences/route.ts`（POST）／`[id]/route.ts`（PUT・DELETE） |
| 入力画面 | `src/components/profile/CareerHistoryEditor.tsx`（モーダル） |
| 呼び出し元 | `/mypage`（`ProfileTab.tsx`）、`/mypage/details/experience`（`CareerDetails.tsx`）、`/onboarding`（`OnboardingClient.tsx`） |

**この節から言えること**
- 遷移の素材は**揃っているが量が極端に少ない**。作れる遷移行は最大**9**、「会社が変わった」に絞ると**5**、両側がマスタ企業に解決できるものは**4**。
- 職種は NOT NULL なので `is_role_change` は全ペアで判定できる。会社側は 28% が自由入力で、`from_company_id` が NULL になる。
- 勤務地（`prefecture`）は列としては存在する（充填 5/18）。**追加不要。**

---

## 調査C：職種マスタ

| 項目 | 実測値 |
|---|---|
| `ow_roles` 全件 | **154** |
| 大分類（`parent_id is null`） | **18** |
| 子 | **136** |
| 孫（3階層目） | **0**（＝**2階層**） |
| `is_active = true` | 148 |
| `is_it_saas = true` | 103 |
| `merged_into_id` あり | 6 |

大分類ごとの子の件数（非IT系は下8つ）：

| 大分類 | IT/SaaS | 子 | うち有効 |
|---|---|---|---|
| 経営・CxO | ✓ | 10 | 10 |
| 事業開発 | ✓ | 6 | 6 |
| 営業 | ✓ | 18 | 12 |
| カスタマーサクセス | ✓ | 7 | 7 |
| マーケティング | ✓ | 8 | 8 |
| プロダクト | ✓ | 8 | 8 |
| デザイナー | ✓ | 6 | 6 |
| データ・AI | ✓ | 8 | 8 |
| エンジニア | ✓ | 14 | 14 |
| コーポレート | ✓ | 13 | 13 |
| **医療・介護・福祉** | − | 6 | 6 |
| **建設・不動産** | − | 5 | 5 |
| **製造・技術** | − | 5 | 5 |
| **教育・研究** | − | 4 | 4 |
| **販売・サービス** | − | 11 | 11 |
| **金融・保険** | − | 4 | 4 |
| **物流・運輸** | − | 3 | 3 |
| **公務・その他** | − | **0** | 0 |

**非IT系（8大分類）の配下は合計 38件。**

指定4語の存在：

| 探した語 | マスタの職種 | 親 | 有効 |
|---|---|---|---|
| 美容師 | **美容師**（＋理容師） | 販売・サービス | ✓ |
| 調理・飲食 | **調理・製菓** / **ホール・接客（飲食）** | 販売・サービス | ✓ |
| ドライバー・配送 | **ドライバー・配送** | 物流・運輸 | ✓ |
| 警備・清掃 | **警備** / **清掃・ビルメンテナンス** | 販売・サービス | ✓ |

関連語（`美容|理容|調理|飲食|ドライバー|配送|運転|警備|清掃|接客|販売|介護|保育`）の部分一致：**13件**（うち大分類2件）。

**この節から言えること**
- 非IT系の職種マスタは**既に入っている**。「美容師から IT 営業へ」は職種IDだけで表現できる。
- 階層は2段しかないので、`from_role_category_id` の親を辿れば大分類での比較もできる。
- 「公務・その他」だけ子が0件。非IT側で唯一の穴。

---

## 調査D：企業属性

`ow_companies` は **151列**（全列は `information_schema` で再現可能）。判定に使える列だけ挙げる。

| 項目 | 実測値 | 備考 |
|---|---|---|
| 全社数 | **87**（うち `is_test` 1） | |
| `listing_status='listed'` | **79** | 一覧に出る社数 |
| `industry`（text）に値あり | **87 / 87**（100%） | 値は16種類 |
| `industry_id`（uuid）に値あり | **82 / 87** | マスタ参照側は5社欠け |
| **`is_foreign`（boolean）** | **NULL 0件・true 65社** | **外資判定はこの列で可能** |
| `capital_type` | 65 / 87 | 資本区分 |
| `parent_company_country` | 61 / 87 | 親会社の国 |
| `headquarters_address` | **10 / 87** | 本社所在地はほぼ空 |

`is_published` × `is_approved` の組み合わせ：

| is_published | is_approved | 社数 |
|---|---|---|
| true | true | **81** |
| true | false | **3** |
| false | true | 0 |
| false | false | **3** |

業種（`industry`）の分布（上位）：AI・データ13 / クラウドインフラ12 / CRM・営業支援10 /
コラボレーション8 / セキュリティ8 / ハードウェア・半導体7 / HR・人材7 / 経理・財務7 /
マーケティング4 / IT / SaaS 3 / ほか各1〜2。

**この節から言えること**
- **外資判定は `is_foreign` で可能**（NULL 0件）。「未経験から外資ITへ」は追加列なしで引ける。
- 業種は `industry`（text）が100%埋まっている。`industry_id` は5社欠けるので、**遷移テーブルに業種を持つなら text 側を正にするか、先に5社を埋める**。
- 本社所在地は10/87しか無く、地域での遷移分析には**まだ使えない**。

---

## 調査E：既存の検索経路

### E-1　`src/lib/search/` の中身

| ファイル | 行数 | 何を検索するか |
|---|---|---|
| `companies.ts` | 411 | **企業のみ**。`searchCompanies()` 1本 |
| `industryGroups.ts` | 116 | 業種キーの解決（検索そのものはしない） |

`searchCompanies` が触るテーブル：`ow_companies`（本体）/ `ow_jobs`（求人有無）/ `ow_articles` /
`ow_experiences`（**在籍者数の集計のみ**）。

⚠️ 人物側の一覧は `src/lib/people/directory.ts` にあり、**`src/lib/search/` の外**。

### E-2　フリーワード検索

| 項目 | 実測 |
|---|---|
| 方式 | **`ilike` の部分一致のみ**（全文検索は無い） |
| 企業（`companies.ts:81`） | `name` / `description` / `industry` / `tagline` を OR、スペース区切りで AND |
| サジェスト（`api/search/suggest`） | `ow_companies.name` / `ow_jobs.title` |
| 横断検索（`/search`） | `name` / `brand_name` / `slug` |
| 人物 | **フリーワード検索はクライアント側**（`PeopleListClient`）で、サーバー検索は無い |

### E-3　インデックス・拡張

| 項目 | 実測 |
|---|---|
| `pg_trgm` / `pg_bigm` / `pgroonga` / `unaccent` | **いずれも未インストール**（0件） |
| GIN / GiST / tsvector / trgm を使うインデックス | **0本** |

### E-4　企業属性 × 在籍者の経歴 を同時に条件にできるか

**存在しない。** 実測した現状は次のとおり。

| 経路 | 実際にやっていること |
|---|---|
| `searchCompanies` | 企業を先に絞り、そのあと `ow_experiences` を**集計**して在籍者数を出すだけ。経歴の中身は WHERE に入らない |
| `directory.ts`（`/people`） | 人物を先に取り、`ow_companies where is_foreign=true` の **id 集合をアプリ側（JS の Set）で突き合わせ**て「外資経験あり」を作る。SQL の結合ではない |

**この節から言えること**
- 「企業の属性」と「その人の経歴」を**1本のクエリで条件にする仕組みは無い**。今はどちらもアプリ側の後処理。
- 全文検索の基盤（拡張・インデックス）は**一切入っていない**。`ilike` の部分一致だけ。
- 遷移を WHERE で引きたいなら、**結合済みの1テーブル（ow_transitions）を作るのは理にかなっている**。

---

## 調査F：決め手データの受け皿

`reason|motiv|why|factor|decid|turning` に一致する列（public スキーマ全体）：**21列**。
このうち求職者の経歴に紐づくもの：

| テーブル | 列 | 型 | 実ユーザーでの充填 |
|---|---|---|---|
| `ow_experiences` | `join_reasons` | ARRAY | **0** |
| `ow_experiences` | `leave_reasons` | ARRAY | **0** |
| `ow_experiences` | `join_reason_primary` | text | **0** |
| `ow_experiences` | `join_reason` | text | （旧・自由記述） |
| `ow_experiences` | `exit_reason` | text | **0** |
| `ow_experiences` | `turning_point` | text | **0** |
| `ow_experience_gaps` | （入社前後のギャップ） | — | **0 行** |

そのほか（求職者の遷移とは別用途）：`ow_companies.why_join` / `ow_jobs.why_hire` /
`ow_casual_meetings.interest_reason` / `applications.motivation` /
`ow_match_scores.match_reasons` ほか。

**この節から言えること**
- **受け皿は既にある**（`join_reasons` / `leave_reasons` / `join_reason_primary` / `ow_experience_gaps`）。新規テーブルは要らない。
- ただし**実データは全部 0件**。入力UI（`CareerHistoryEditor` のチップ）はあるが、誰も入れていない。
- 「決め手」を遷移の軸に使うなら、まず**入れてもらう設計**が先。列を足す話ではない。

---

## CLAUDE.md との差分

| CLAUDE.md の記述 | 実測（2026-08-19） | 差分の扱い |
|---|---|---|
| 「`ow_users` の SELECT は列単位で 30 / 32」 | **authenticated は30列で一致。ただし `anon` はテーブルレベル SELECT を持つ**（＝全列） | **記述が不足**。anon 側の記載が無い。要追記 |
| 「`ow_jobs`: 20件（published 18 / draft 2）」（2026-07-24 時点） | 本セッションの別調査で **published 5 / 求人を持つ企業1社** | 既に CLAUDE.md 内で「その後 20件」と補足済み。published の内訳は古い |
| 「オンボーディングのトップレベル職種は17件」 | **大分類は 18件**（`公務・その他` を含む） | 実測が正。ただし子0件なので選択肢としては17に見える可能性あり（要確認） |
| 「`ow_experiences` 14件 / 実人数5人」（2026-08-10 時点） | **19件 / 実ユーザー分18件 / 9人** | 増えている。日付付きの記述なので誤りではない |
| 「`ow_companies` 85社」（RLS の節） | **87社** | 増えている |
| 「`ow_career_profiles.birth_year` を見ていた」 | `ow_career_profiles` は**現在のスキーマに無い** | 過去形の記述なので矛盾ではない |
| 「`ow_profiles` 39件」（週次メールの節・2026-08-10） | **49件**（うち `ow_users` に対応が無い孤児 20件） | 増えている。**孤児20件は CLAUDE.md に記載が無い** |

---

## 設計についてのコメント（実装はしない）

### ow_transitions の生成方式

**バッチ（または必要時に洗い替え）を推す。** 理由は3つ。

1. **元データが動く単位が「行」ではなく「人」。** 遷移は隣接ペアから作るので、
   1行 INSERT すると**前後の行の遷移が作り直しになる**。トリガーだと
   「自分の行」だけを見ても正しい遷移が作れず、結局その人の全行を読み直すことになる。
2. **量が小さい。** 実ユーザーの職歴は18行・遷移は9件。全件洗い替えでも一瞬で終わる。
   凝った差分更新を作る理由が無い。
3. **`age_at_move` は `birth_date` に依存する。** 生年月日は後から入る（今 4/14）ので、
   職歴を触っていない人の遷移も**後から作り直す必要がある**。トリガーでは拾えない。

⚠️ **ビューは推さない。** WHERE で引けるようにするのが目的なので、
   毎回 `row_number()` のウィンドウ関数を通すビューだと、
   「30歳超で異業界」のような条件のたびに全行を並べ替えることになる。
   ただし**マテリアライズドビュー**なら「洗い替えバッチ」とほぼ同義で、選択肢に入る。

### 想定カラムへのコメント

| カラム | コメント |
|---|---|
| `from_company_id` / `to_company_id` | ⚠️ **28% は `company_id` が無い**（自由入力）。NULL 許容にしたうえで、`from_company_text` も持たないと「美容室 → IT」のような遷移が丸ごと落ちる |
| `from_industry` / `to_industry` | `ow_companies.industry`（text・100%充填）を正にする。`industry_id` は5社欠け |
| `age_at_move` | ⚠️ **生年月日が 4/14 人しか無い**ので、当面ほぼ NULL。**この列で絞る機能を先に作らないこと** |
| `years_of_experience_at_move` | 最初の `started_at` から計算できる（`started_at` は NOT NULL なので全員算出可）。**年齢よりこちらが実用的**で、「社会人年数で絞る」方針とも一致する |
| `is_industry_change` | `from_industry` が NULL（自由入力企業）だと判定不能。**3値（変わった／変わらない／不明）**にしないと、不明を「変わらない」に潰すことになる |

### `ow_experiences` に足りない列

| 観点 | 判定 |
|---|---|
| 勤務地 | **既にある**（`prefecture` / `remote_work_status`）。充填は 5/18 |
| 雇用形態 | **既にある**（`employment_type`）。充填 5/18 |
| 決め手 | **既にある**（`join_reasons` ほか）。充填 **0** |
| 会社の業種 | 経歴側には無いが、`company_id` から辿れる。**自由入力企業（28%）は辿れない** |
| **足りないもの** | 自由入力企業の**業種**。「美容室」と書かれた行を「美容・サービス業」と結びつける列が無い。遷移の `from_industry` を埋めたいなら、ここが最大の穴 |
