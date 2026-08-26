# スキル項目の再導入 事前調査（フェーズ0）

- 調査日: **2026-08-27**（実測は本番 Supabase / `origin/main` = `47b708dc` 時点）
- **この調査でコード・migration・DB への書き込みは一切していない。** SQL は SELECT のみ。
  `/search` を実測で叩いたぶんの検索ログ3行は、確認後に範囲指定の DELETE で消して 0行に戻した。
- 数値はすべて実測。確認していないものは「未検証」と明記した。

> ## ⚠️ 先に1つ
> 調査の途中で、**スキルとは無関係に `/search` が既に壊れている**のが見つかった。
> `Miro` と打つと職種 **IR** に、`Microsoft Teams` と打つと **CRO とアカウントマネージャー**に
> 解決される（**本番で再現**）。私がフェーズ1で入れた `interpretQuery` の
> 部分一致が、辞書にある2〜3文字の英字略語を踏んでいる。
> **スキル（＝プロダクト名）を語彙に足すと確実に悪化する。** 詳細は §3。

---

## 1. 前回の削除がどこまで実行されたか

### 1-1. `ow_skill_tags` は存在しない（名前が違う）

正しい名前は **`ow_user_skill_tags`**。**2026-08-03 に DROP 済み**で、現在の DB に無い
（`to_regclass('public.ow_user_skill_tags')` が NULL）。
したがって列構成・RLS・GRANT・被参照 FK は**いずれも「テーブルが無いので該当なし」**。

### 1-2. 削除の migration

[`supabase/migrations/20260803183534_drop_skill_tags_certifications_talk_themes.sql`](supabase/migrations/20260803183534_drop_skill_tags_certifications_talk_themes.sql)

**落としたもの**（migration 本文に記載された適用時の行数）:

| 対象 | 行数 |
|---|---|
| `DROP TABLE ow_user_skill_tags` | **32行** |
| `DROP TABLE ow_user_certifications` | 10行 |
| `DROP COLUMN ow_company_members.talk_themes` | 5行中 非空2 |
| `DROP COLUMN ow_company_admins.talk_themes` | 10行中 非空0 |

`CASCADE` は使わず RESTRICT のまま落としている（依存があればエラーで止まる作り）。

### 1-3. ★落とされずに残った「死列」が2つある

| 列 | 型 | 現在の行数 | src からの参照 |
|---|---|---|---|
| **`ow_profiles.skills`** | `text[]` | **0 / 52** | **0件** |
| **`ow_users.mentor_themes`** | `text[]` | **0** | **`types.ts` のみ**（自動生成） |

⚠️ **`ow_profiles.skills` は再導入で流用できる位置にあるが、そのまま使うのは勧めない。**
   `authenticated` の SELECT/UPDATE に加えて **`anon` の SELECT も通っている**（実測）。
   3層（標準/自由入力/昇格）を持たせるなら、正規化した別テーブルが要る。

### 1-4. src の参照（UI / API / 型定義を区別）

| 種別 | 結果 |
|---|---|
| UI | `skill_tags` / `SkillTag` の参照 **0件** |
| API | `src/app/api/jobseeker/` に **`skill-tags` は無い**（現存24ルートを実見） |
| 型定義 | `types.ts` に `ow_user_skill_tags` **0件**（`gen:types` 済み） |

`skills` という語での grep は4件当たるが、**すべて無関係**
（`.claude/skills/…` のドキュメントパス2件、`careerReasons.ts` の選択肢値2件）。

### 1-5. ★talk_themes と certifications の現状 — **「止まっている」のではない**

| | 現状 |
|---|---|
| **話せるテーマ（`talk_themes`）** | **完全に削除済み。** 列ごと落ちており、src に残るのは**コメント2行だけ**（`admin/candidates/actions.ts:38` と `admin/biz-accounts/page.tsx:261`）。判定は `ow_users.can_casual_meeting` に移り、さらに 2026-08-23 に `ow_company_members` ベースへ移った |
| **資格（`ow_user_certifications`）** | **削除されたあと、2026-08-24 に作り直された。** [`20260824090000_create_ow_user_certifications.sql`](supabase/migrations/20260824090000_create_ow_user_certifications.sql)。LinkedIn に合わせた5項目（名称/発行団体/発行日/認定番号/認証URL）で、**柴さんの指示で項目を確定**と本文にある |
| **言語（`ow_user_languages`）** | **同じ日に新設**。[`20260824120000`](supabase/migrations/20260824120000_create_ow_user_languages.sql)。言語名＋習熟度の2項目 |

⚠️ **「削除が部分的に止まっている」ではなく「別の設計で意図的に再導入された」。**
   `/mypage` に資格セクションが残っているのはその結果で、取り残しではない。

⚠️ **これはスキル再導入にとって前例になる。** 同じ「2026-08-04 に消したものを戻す」で、
   **戻し方（LinkedIn に合わせた正規化テーブル・RLS/GRANT は `ow_user_awards` を写す）が既にある。**
   スキルも同じ形に揃えるのが自然。

---

## 2. 実データが残っているか

### 2-1. 現在の DB — **全部0件**

| テーブル / 列 | 行数 |
|---|---|
| `ow_profiles.skills` が非空 | **0** / 52 |
| `ow_users.mentor_themes` が非空 | **0** |
| `ow_user_certifications` | **0** |
| `ow_user_languages` | **0** |
| `ow_user_achievements` | **0** |
| `ow_user_awards` | **0** |
| `ow_user_media_appearances` | **0** |
| `ow_user_content_links` | **0** |

⚠️ **`@seed.internal` のユーザーは0件。** その規約はこの DB では使われていない。
   テスト由来の印は **`is_test`（38人中32人）** と、
   archive の migration が使った **`@placeholder.opinio.jp`**。

### 2-2. ★消える前の32行のラベルは復元できる

投入元の archive migration に残っている。**21種**（重複を除く）:

| 由来（migration） | ラベル |
|---|---|
| `154_add_users_narifuji_komatsu` ⚠️**placeholder 2名** | エンタープライズ営業 / インサイドセールス / フィールドセールス / 新規開拓 / Salesforce / 仮説型提案 / アウトバウンド営業 / MEDDIC / チームセリング / Pipeline創出 |
| `248_kimura_masaki_profile`（実ユーザー・木村） | Salesforce / エンタープライズ営業 / インサイドセールス / Slack / Tableau / Microsoft 365 / 英語（ビジネス読解・米国本社対応） |
| `249` `251`（実ユーザー・福永） | Word / Excel / PowerPoint / 法人営業 |
| `250` `251`（実ユーザー・大塚） | 法人営業 / 技術営業 / ソリューション営業 / 新規開拓 / KPI設計・進捗管理 |
| `170` `171`（柴さん） | ⚠️ 該当行に文字列リテラルが無く**ラベルを抽出できなかった**（未確認） |

**実ユーザー由来 vs テスト由来**: `154` の2名（成藤・小松）は `@placeholder.opinio.jp` で
**実在しない検証用**。残り（木村・福永・大塚）は `/people` に出ている実ユーザー。

### 2-3. 所見 — **前回の語の4割弱は標準スキルに使えない**

21種を現在の職種辞書に当てた実測:

| | 件数 |
|---|---|
| **職種そのもの**（辞書に完全一致） | **4 / 21**（アウトバウンド営業・インサイドセールス・フィールドセールス・法人営業） |
| **職種語を含む**（`/search` で職種条件が立つ） | **8 / 21**（上の4 ＋ エンタープライズ営業・ソリューション営業・技術営業・Microsoft 365） |

**方針（職種と重複させない）に照らすと、使えるのは残り13種。**
そのうち初期値の候補になりそうなのは:

- 扱ったプロダクト … `Salesforce` `Slack` `Tableau`
- 手法・型 … `MEDDIC` `仮説型提案` `チームセリング` `Pipeline創出` `KPI設計・進捗管理` `新規開拓`
- ⚠️ `Word` `Excel` `PowerPoint` は**汎用すぎて検索の語彙にならない**（全員が持つ）
- ⚠️ `英語（ビジネス読解・米国本社対応）` は **`ow_user_languages` と重複**（§6）

**結論: 32行のうち初期値として実用になるのは10種前後。初期の標準スキルはほぼ新規に作ることになる。**

---

## 3. ★職種辞書との衝突（最重要）

### 3-1. 辞書の総数

| | 件数 |
|---|---|
| `ow_roles` （`is_active`） | **148** |
| `ow_role_aliases` | **260** |
| **重複を除いた辞書語** | **384** |

これは `getRoleAliases()` が `/search` に渡している語彙そのもの。

### 3-2. 候補50語を作って突き合わせた

4区分から実在するものだけを50語（プロダクト15 / 手法・型15 / 売り先ドメイン12 / 語学8）。

| 判定 | 件数 |
|---|---|
| **完全一致** | **1 / 50（2%）** |
| **正規化後（小文字化＋記号除去）に一致** | **1 / 50（2%）** |
| **`interpretQuery` と同じ規則で職種条件が立つ**（部分一致） | **4 / 50（8%）** |

衝突した4件と、ぶつかった相手:

| 候補語 | ぶつかる辞書語 | 相手の正体 |
|---|---|---|
| `物流` | `物流` | **「倉庫・物流管理」の別名**（完全一致） |
| `SPIN営業` | `営業` | 大分類の職種名 |
| `ソリューション営業` | `営業` | 同上 |
| `オンボーディング設計` | `オンボーディング` | 「オンボーディングスペシャリスト」の別名 |

### 3-3. 結論: **「職種と重複させない」方針は成立する**

**50語のうち46語（92%）は衝突しない。** 残る4語も言い換えで避けられる
（`物流` → `物流・運輸業界` / `SPIN営業` → `SPIN` / `ソリューション営業` → `ソリューション提案` /
`オンボーディング設計` → `導入設計`）。

**方針を撤回する必要は無い。**

### 3-4. ⚠️★ただし別の衝突が見つかった。**こちらのほうが深刻で、しかも既に起きている**

辞書には **2〜4文字の英字の語が25件**ある:

```
2文字(4)  AE  AM  EM  IR
3文字(16) BDR CFO COO CPO CRO CSM CTO DBA M&A PdM PjM PMI PMM SDR TAM TPM
4文字(5)  CHRO HRBP SDET VPoE VPoP
```

`interpretQuery` は辞書語を**クエリの部分文字列として**当てる（`normalized.indexOf(alias)`、
2文字以上）。**プロダクト名は英字なので、これを高い確率で踏む。**

実在プロダクト30件で測った結果 — **7件（23%）が誤爆**:

| 入力 | 立ってしまう職種条件 |
|---|---|
| `Airtable` | **IR** |
| `Amplitude` | **AM** |
| `Dynamics 365` | **AM** |
| `Jira` | **IR** |
| `Microsoft 365` | **CRO** |
| `Microsoft Teams` | **CRO / AM** |
| `Miro` | **IR** |

**本番で実測して再現した**（`https://opinio.jp/search`）:

```
Miro             → 解決=[IR]                       未解決=[]
Microsoft Teams  → 解決=[CRO, アカウントマネージャー]  未解決=[Mi, soft, Te]
Salesforce       → 解決=[Salesforce]               未解決=[]
```

⚠️ **これはスキルを入れる前から起きている。** 私がフェーズ1で入れた `/search` の不具合で、
   いま `Miro` と検索した人は IR 職の結果を見せられている。

⚠️ **スキルを入れると悪化する。** 標準スキルにプロダクト名を入れると、
   **その語が語彙にあるのに職種として解決される**状態になる（スキル条件が立つ前に
   職種条件が立つ）。**スキルより先にここを直す必要がある。**

→ 直し方は既にある。社名の照合で使った**境界チェック**（一致部分の前後に同じ字種が
   続いていたら採らない）を職種側にも当てれば、`Miro` の中の `IR` は
   前が `M`（英字）なので弾ける。§4 と最後の論点に書いた。

---

## 4. `/search` への接続可能性

### 4-1. `Condition` 型に5つ目（6つ目）を足すのは容易

現在の形（[`src/lib/search/interpretQuery.ts:64`](src/lib/search/interpretQuery.ts)）:

```ts
export type Condition =
  | { kind: "company";   label: string; appliesTo: SearchKind[]; companyId: string }
  | { kind: "role";      label: string; appliesTo: SearchKind[]; roleIds: string[] }
  | { kind: "domain";    label: string; appliesTo: SearchKind[]; domainId: string; slug: string }
  | { kind: "foreign";   label: string; appliesTo: SearchKind[]; isForeign: boolean }
  | { kind: "salaryMin"; label: string; appliesTo: SearchKind[]; man: number };
```

判別可能ユニオンなので `{ kind: "skill"; label; appliesTo; skillId }` を1行足すだけ。

**変える必要がある箇所**（実測で数えた）:

| ファイル | 箇所 |
|---|---|
| `interpretQuery.ts` | 型に1行 / `Vocabulary` に標準スキルの索引 / `loadVocabulary` に取得1本 / 解決ブロック1つ |
| `runSearch.ts` | **3箇所**（`searchCompanyHits` :154 付近 / `searchJobHits` :309 付近 / `experienceMatches` :521 付近） |
| `search/page.tsx` | **変更不要**。チップの色は `chipStyle(c.kind === "salaryMin" ? "money" : "neutral")` で、既定が neutral |

⚠️ 解決の実装は**社名と同じ形にできる**（マスタを全件メモリに載せて完全一致）。
   `ilike` を使わない原則を崩さずに済む。

### 4-2. ★人検索は、いまのままではスキル条件を受け取れない

`runSearch.ts` の人検索はこうなっている:

```ts
for (const c of cond) {
  const matched = exps.filter((e) => experienceMatches(e, c, …));  // ← 職歴1行に当てる
  if (matched.length === 0) { ok = false; break; }                  // ← AND
}
```

**`experienceMatches` は「職歴の行」に条件を当てる関数**で、`role` / `foreign` /
`domain` / `company` の4つはすべて職歴の列から判定できる。

**スキルは人に紐づくので、どの職歴にも当たらない。**
そのまま足すと `matched.length === 0` になり、**スキル条件を書いた人が必ず0件になる。**

必要な改修:

1. AND ループを「**職歴に当てる条件**」と「**人に当てる条件**」に分ける
2. `matchReason` の作り直し。`buildMatchReason` は**職歴の職種名から**
   「◯◯ → フィールドセールス」を作っているので、スキルだけで当たった人には理由が出せない
   （`earliestMatch` が null になり `matchReason` は null）。
   スキル用の理由（例:「Salesforce・MEDDIC」）を別に作る必要がある

⚠️ **ここが今回いちばん手が要る。** 型を足すのは1行だが、人検索の構造は変わる。

### 4-3. `appliesTo` をどうするか（判断は柴さん）

現在の4種の内訳:

| 条件 | appliesTo |
|---|---|
| `company` / `role` / `domain` / `foreign` | `["company","job","person"]` |
| `salaryMin` | **`["job"]` だけ** |

**いまの作りからは `["person"]` だけが自然。** 根拠3つ:

1. **求人側に受け皿が無い。** `ow_jobs.required_skills` / `preferred_skills` は
   **`text[]` の自由記述**で、標準スキルの ID と突き合わせられない。
   しかも**公開5件を含む20件すべてで空**（実データは旧列 `requirements` 側に18件）。
   効かせるには求人フォームを標準スキル選択に変える改修が要る。
2. **企業にスキルを持たせるテーブルが無い。**
3. 企業に効かせるとしたら「その企業に在籍する人のスキル」になるが、
   **それは職種で既にやっている**（`companyIdsByRole` が「その職種の人がいる企業」を返す）。
   同じ形の絞り込みが2つになる。

⚠️ ただし `salaryMin` の前例があるので、`["person"]` に絞っても
   **チップには出て「人にのみ効きます」と表示される**（`ResolvedChip` が `appliesTo` を見る）。
   黙って捨てる形にはならない。

---

## 5. 置き場所と画面

### 5-1. `/mypage` のセクション構成（上から）

描画は [`src/components/profile/editor/ProfileTab.tsx`](src/components/profile/editor/ProfileTab.tsx)。
⚠️ **このファイルは現在べつのセッションが編集中**（`git status` が `M`）。以下は作業ツリーの現状。

| # | セクション | 空のときの表示 |
|---|---|---|
| 1 | 自己紹介 | （本文なし。編集導線のみ） |
| 2 | **職歴**（`MergedTimeline`） | 年表。空なら追加導線 |
| 3 | **学歴**（`MergedTimeline`） | 同上 |
| 4 | 数値実績 | 「まだ数値実績を登録していません。」 |
| 5 | 受賞・表彰 | 「まだ受賞・表彰を登録していません。」 |
| 6 | 資格 | 「まだ資格を登録していません。」 |
| 7 | 言語 | 「まだ言語を登録していません。」 |
| 8 | メディア掲載 | 「まだメディア掲載を登録していません。」 |
| 9 | 発信コンテンツ | （空でも消さない方針。`ActivitySection` は「まだ投稿していません」） |

**4〜9の6つが「まだ〜登録していません」で並ぶ**という指摘は、コード上そのとおり。

本体に出す行数は [`src/lib/constants/profileSections.ts`](src/lib/constants/profileSections.ts) の
`ROWS_ON_PROFILE`（職歴・学歴は4、他は3）。超えると `/mypage/details/[section]` へ送る。

⚠️ **「本文の高さが1280pxで約2,950px」は柴さんの計測値をそのまま使っており、私は測り直していない（未検証）。**
   理由: `ProfileTab.tsx` / `ProfileEditor.tsx` が別セッションの編集中で、
   いま測っても不安定な状態の値になる。

### 5-2. 差し込み位置の候補

| 案 | 位置 | 根拠 |
|---|---|---|
| **A（推す）** | **学歴の直後＝数値実績の前**（#4 の位置） | 職歴・学歴は「事実の年表」、4〜9は「付帯情報」。**スキルは `/search` の語彙になる＝主要情報**なので付帯情報より前。ただし年表ではないので年表の後 |
| B | 自己紹介の直後（#2 の位置） | いちばん目に付くが、**職歴より前に来ると「経歴で語る」という既存の構成とぶつかる** |
| C | 資格・言語の隣（#6〜7 のあたり） | 「本人の属性」としてまとまるが、**検索の語彙であることが埋もれる** |

⚠️ **どの案でも「まだ登録していません」の空セクションが6→7に増える。**
   スキルは登録率が高い項目なので他より埋まりやすいが、
   **導入直後は7つ並ぶ**ことを承知のうえで決める必要がある。

### 5-3. 既存の入力UIの流用

| 部品 | 流用できるか |
|---|---|
| **`RoleSearchSelect`**（`src/components/ui/RoleSearchSelect.tsx`） | **かなり近い。** `{ roles, aliases, value, onSelect, selectableParent, clearOnSelect }`。**`clearOnSelect: true` が「選んだら一覧に足して入力を空に戻す」＝複数選択のスキル追加そのもの**（求人の職種・希望職種が既にこの使い方）。別名で当てて「どの別名で当たったか」を候補行に出す作りもスキルに要る |
| ⚠️ その制約 | **2階層前提**（`parent_id`、大分類→小分類の2段セレクト）。スキルを階層にしないなら2段セレクト部分は使わない。**区分（プロダクト/手法/ドメイン）を親にすれば構造ごと流用できる** |
| **`CompanySearch`**（`CareerHistoryEditor.tsx:503` のローカル関数） | **「マスタ＋自由入力」の3層パターンの手本。** `companyId: string \| null`（候補選択時のみ非 null、自由入力時は null）＋「＋ 自由入力で確定」行＋「未掲載であることを明記する行」。**標準スキル/自由入力の出し分けはこれをなぞれる** |
| ⚠️ その制約 | **`export` されていない**（`CareerHistoryEditor.tsx` の中のローカル関数）。流用するなら切り出しが要る |

---

## 6. 参考にした画面との差分（YOUTRUST）

⚠️ **挙げられた2点（人に紐づく／年数を自己申告／約50個のプリセット＋自由入力）は、
   柴さんの観察としてそのまま前提に置いた。私は独自に確認していない（未検証）。**
   確認にはアカウントが要り、外部サービスへのログインは行わないため。

同じ形にした場合に、**OPINIO の既存データ構造とぶつかる点**:

| # | ぶつかる点 |
|---|---|
| 1 | **年数の自己申告**。「v1 では年数を持たない」方針と直接ぶつかる。OPINIO は社会人年数を `ow_experiences` から `calcTotalExperience` で**都度計算**する設計で、`ow_profiles.experience_years` を自動計算に置き換えた（2026-08-07）経緯がある。**スキル年数を列で持つと、保存した瞬間に古くなる同じ問題が戻る** |
| 2 | **語学**。YOUTRUST 型では語学もスキルチップに混ざるが、OPINIO には **`ow_user_languages`（2026-08-24 新設・言語名＋習熟度）** が既にあり `/mypage` にセクションもある。標準スキルに語学を入れると**入力欄が2つになる** → **4区分から語学を外すのが自然** |
| 3 | **プリセット約50個**。OPINIO も同規模から始められるが、**職種辞書384語との衝突検査を通す必要がある**（§3）。YOUTRUST には職種マスタが無いのでこの制約が無い |
| 4 | ⚠️★**プロダクト名は社名と重なる。** 実測: 候補プロダクト30件のうち **13件（43%）が掲載企業と同名**（Salesforce / Marketo / HubSpot / Snowflake / AWS / Zendesk / SAP / Workday / Datadog / Notion / Slack / Braze / Asana）。`/search` では**既に社名として解決される**（実測: `Salesforce` → 企業条件）。**同じ語が「会社」と「スキル」の両方に解決しうる** |
| 5 | 「人に紐づく」点は一致。OPINIO も職歴モーダルに入れない方針なので、この点はぶつからない |

---

## 実装フェーズで最初に決めるべき論点（3つ）

### ① 短い英字エイリアスの誤爆を、スキルより先に直すか

**`Miro` → IR、`Microsoft Teams` → CRO＋AM が本番で再現する。**
辞書の2〜4文字の英字略語25件が部分一致で当たっている。
**スキルを入れなくても今すでに壊れているが、プロダクト名を語彙に入れると確実に悪化する。**

直し方は既にある — 社名の照合で使った**境界チェック**（一致部分の前後に同じ字種が
続いていたら採らない）を職種側にも当てる。`Miro` の中の `IR` は前が英字なので弾ける。
⚠️ ただし**職種の当たり方が変わる**ので、`/jobs` と `/people` の検索にも影響が及ぶ
（辞書は共有している）。単独で1本、実測付きでやる価値がある。

### ② スキルは人だけに効かせるか、求人にも広げるか

`["person"]` だけなら**今の構造にそのまま乗る**。
求人に広げるなら `ow_jobs.required_skills`（**text[] の自由記述・20件すべて空**）を
標準スキルの ID に載せ替える必要があり、**求人フォーム側の改修が伴う**。
⚠️ 人だけにしても、チップには「人にのみ効きます」と出るので黙って捨てる形にはならない。

### ③ 同じ語が社名とスキルの両方に解決するときの優先順位

**候補プロダクトの43%が掲載企業と同名。**
`Salesforce` は「扱ったプロダクト」でもあり「株式会社セールスフォース・ジャパン」でもある。

- 社名を優先 … 「Salesforce を使っていた人」を探せなくなる
- スキルを優先 … 「Salesforce という会社」を探せなくなる
- 両方立てる … AND なので「Salesforce 社に在籍し、かつ Salesforce スキルを持つ人」になり、**ほぼ0件になる**

⚠️ **決めずに実装すると③は必ず踏む。** `/search` は条件を AND で積むため、
   「両方立てる」が既定の挙動になる。
