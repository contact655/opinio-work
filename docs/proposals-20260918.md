# 根拠つき提案（②⑨④）第1弾 — 何を作ったか / 実データでどこまで出たか

**実装日: 2026-09-18**（調査は [phase0-9screens-20260918.md](phase0-9screens-20260918.md)）

---

## 0. 一行で

**「データが入った瞬間に動く器」を作った。実データでは ② も ⑨ も
「いまお出しできる提案はありません」しか描かれない。それが正しい状態。**

---

## 1. 作ったもの

| # | 何 | 実体 |
|---|---|---|
| 1 | 根拠エンジン（純粋関数） | [lib/evidence/engine.ts](../src/lib/evidence/engine.ts) |
| 2 | 取得層（DB → 事実） | [lib/evidence/fetch.ts](../src/lib/evidence/fetch.ts) |
| 3 | 提案を作る（運営） | [lib/evidence/generate.ts](../src/lib/evidence/generate.ts) ／ `/admin/proposals` |
| 4 | スキーマ | `20260918180000_proposals.sql`（`ow_proposals` / `ow_proposal_declines`） |
| 5 | ② 求職者向け | `/proposals` |
| 6 | ⑨ 企業向け | `/biz/proposals` |
| 7 | ④ 見送り理由 | [components/proposals/DeclineSheet.tsx](../src/components/proposals/DeclineSheet.tsx)（②⑨共通） |
| 8 | プレビュー | `/dev/preview/proposals`（0/1/2/3/5件・反証なし・除外） |
| 9 | ユニットテスト | `engine.test.mjs` **36件** — `npm test` |

### 根拠4種と反証3種

```
same_path        ある職種・業界から、その企業へ移った人の数     ow_transitions
shared_motive    在籍者の入社の決め手と、候補者の決め手の一致   ow_experiences.join_reasons
talkable         その企業で isTalkable() を通る人の数           ow_company_members + is_current
preference_match 希望条件と企業属性の一致                       matchCompanyPreference()

反証: short_tenure（短期離職）/ salary_gap / work_style_gap / ★unknown（確かめていない）
```

---

## 2. 決めごとをどこで守っているか

| 決めごと | 守っている場所 |
|---|---|
| スコアを出さない。根拠の件数で並べる | `sortByEvidenceCount()`。`scoreJob` は**理由文だけ**使い点数を捨てる |
| 下限は `MIN_AGGREGATE_COUNT = 3` を流用。下げない | `lib/constants/aggregate.ts` の**1箇所**。`runSearch.ts` は再エクスポート |
| 根拠2件未満は提案に出さない | `isProposable()` ＋ **DB の CHECK `evidence_min_2`** |
| 反証を必ず1件以上出す | `buildCounterEvidence()` ＋ **DB の CHECK `counter_min_1`** |
| 作成時のスナップショットを保存し、再計算しない | `evidence` / `counter_evidence` jsonb ＋ `computed_at`。再実行は `ignoreDuplicates`（上書きしない） |
| ②と⑨は同じ関数から作る | `buildEvidence()` 1本。**ラベルに人称を入れない**（下記 4-1） |

⚠️★**製品のルールをアプリと DB の両方に書いた**のは意図的。
アプリを1行変えただけで約束が消えることを防ぐ。

---

## 3. 論点の結論

### 3-1. 見送り理由の選択肢 → **コード内定数 + DB の CHECK**（`careerReasons.ts` と同じ形）

**推測ではなく実測で決めた。** `careerReasons.ts` の値は実際に CHECK に配列で直書きされており、
TS 側の定数と**集合が完全一致**している（2026-09-18 に照合）:

| 定数 | TS | CHECK | 一致 |
|---|---|---|---|
| `JOIN_REASONS` | 12 | `ow_experiences_join_reasons_check` 12値 | ✅ |
| `LEAVE_REASONS` | 13 | `ow_experiences_leave_reasons_check` 13値 | ✅ |
| `GAP_AXES` | 6 | `ow_experience_gaps_axis_check` 6値 | ✅ |

→ [lib/constants/declineReasons.ts](../src/lib/constants/declineReasons.ts)（候補者8・企業6／共通スラッグ4）。

⚠️ 「軸は DB に持たせない」という既存のコメントは **`ReasonAxis`（グルーピング）** の話で、
選択肢の値そのものとは別。**この2つを混同しないこと。**

### 3-2. 列単位 GRANT → ★**使わない。使っても解けないから**

「**求職者の見送り理由は企業に渡さない**」は、**列の権限では表現できない。**
本人も企業の管理者も同じ `authenticated` ロールで来るので、GRANT（ロール単位）では
「企業にはこの行を見せるが、この列は見せない」が書けない。

→ **`ow_proposal_declines` を別表にし、`side`（candidate / company）で行を分け、
RLS で「自分の side の行だけ」に絞った。**

⚠️★**見送り理由を `ow_proposals` の列に戻さないこと。** 戻した瞬間、
約束の担保が「画面ごとの実装」に落ちる（`visibility_company` を企業向けの画面が
見落とす不具合を1か月で3件直している）。

### 3-3. 提案を作る経路 → **`/admin/proposals` の Server Action（コミット2に同梱）**

cron は作っていない。週次メールが停止中（`vercel.json` の `crons` が空 ＋
`WEEKLY_EMAIL_ENABLED` 未設定）で、**配信の設計が別途要る**ため。

### 3-4. 年齢 → ★**使わない。型にも置いていない**

**現在の方針**: 年齢は詳細のみ・一覧に出さない／`/biz` には年齢も年代も渡さない／
`/people` の `ageBand` は絞り込み専用で表示しない（型に `age` を置かないことで担保）。

**これに沿って、年齢由来の反証は実装していない。**
① ⑨は `/biz` 配下なので候補者の年代を出すこと自体が方針違反、
② 「在籍者の年齢分布」は集計だが成立に `MIN_AGGREGATE_COUNT` が要り、**現在の最大 n は1**なので
n=1〜2 では個人の年齢そのものになる。
⚠️ `CounterEvidenceKind` に `age_gap` を置いていない。**型に無ければ書けない。**

⚠️ 「提示年収と**現年収**の差」も作れない（`salary_man` は実ユーザー0件・
`authenticated` から SELECT も剥がしてある）。**希望年収との差**に読み替えた。

---

## 4. 実装中に見つけて直したもの

### 4-1. ★⑨に「あなたと同じ職種から」と出ていた（人称とスナップショットの衝突）

当初 `buildEvidence(facts, { audience })` で「あなたと同じ…」/「この方と同じ…」を
作り分けていたが、**`ow_proposals.evidence` はスナップショットで1つしか保存できない。**
`generate.ts` は `audience: "candidate"` で作るので、**企業の画面に求職者向けの文が出る。**

→ **ラベルから人称を外した。** 事実に人称は無い
（「アカウントエグゼクティブから、A社へ 3人が移っています」）。
誰の話かは**画面側の見出しと導入文**が担う。

⚠️★`audience` を引数に戻さないこと。戻すと同じ事故に戻る。
**この不変条件はユニットテストで固定した**（人称を戻すと落ちる。変異テストで確認済み）。

### 4-2. CLAUDE.md の「既知の不具合」2件は既に直っていた

`guard_member_consent` の空間取り違えと `/api/biz/ambassador/self-register` の 500 は
**どちらも修正済み**（後者は `330f6d20`）。記述ごと削除した。

---

## 5. 実データでどこまで出たか（2026-09-18 実測）

### 5-1. 結論: **提案は1件も作られない。**

母数のとおり:

| | |
|---|---|
| 掲載企業 | 22社 |
| **根拠の材料が1つでもある企業** | **3社** |
| **根拠が2件以上そろう企業** | ★**0社** |
| 入社の決め手（実ユーザー） | **0件**（非空5行はすべて `is_test`） |
| `ow_transitions` の実ユーザー集計 | **2行・各 n=1** |

**最も条件の良い候補者（木村雅樹・職歴4件）で SQL で突き合わせた結果:**

| 企業 | same_path | 決め手 | talkable | 判定 |
|---|---|---|---|---|
| 伊藤忠テクノソリューションズ | 1 | 0 | 1 | **本人が在籍 → 除外** |
| セールスフォース・ジャパン | 1 | 1 | 0 | **本人が在籍 → 除外** |
| 日本ヒューレット・パッカード | 0 | 0 | 1 | 根拠1件 → **下限未満で除外** |

→ **② は「いまお出しできる提案はありません」**。仕様どおり。

⚠️★**これを「壊れている」と読まないこと。** 根拠が無いものを出さないのがこの機能の主旨。

### 5-2. 空のときの画面

「提案なし」で終わらせず、**なぜ無いのか / 何をすれば出るのか**を書いた:

> OPINIO は、**根拠を2件以上そろえられた会社だけ**を提案します。「近そうだから」という理由では出しません。
> 根拠になるのは、同じ職種から移った方の人数・在籍している方が挙げた入社の決め手・
> 話を聞ける方の人数・あなたの希望条件との一致です。
> **職歴と希望条件を登録していただくほど、そろいやすくなります。**

⚠️ 取得に失敗したときは**「0社」と言わない**（「0社という意味ではありません」と出す）。

---

## 6. 検証したこと

| 何を | どうやって | 結果 |
|---|---|---|
| 根拠エンジンの分岐 | `npm test`（n=0/1/2/3/5 を含む） | **36件 pass** |
| ★テストに効き目があるか | 変異を4種入れて落ちることを確認 | **4/4 検出** |
| migration の構文と挙動 | **使い捨ての PostgreSQL 17 をローカルに起動**して適用（Docker は落ちていたので `initdb`） | 10種の制約すべて期待どおり |
| ↑の内訳 | `nulls not distinct` の重複／返答と日時のセット／未知の返答値／**side をまたいだ理由の保存**／note 201文字 | **すべて弾いた** |
| 本番での GRANT / RLS | 適用後に実測 | anon `false` ／ authenticated は **SELECT のみ** ／ ポリシー各3本 |
| 保存の往復 | 本番に1往復（id を記録 → 検証 → 全削除 → 件数照合） | **作業前に戻っている（0 / 0）** |
| 列の間違い | `node scripts/check-columns.mjs`（自己テスト込み） | 0件 |
| 埋め込みの曖昧さ | `node scripts/check-embeds.mjs`（自己テスト込み） | 0件 |
| 画面の分岐 | `/dev/preview/proposals` の**配信HTMLを解析** | 6カード中 **違反0件** |
| ↑の不変条件 | n<3 で比率が出ない／n>=3 で出る／人称が入らない | すべて満たす |
| 認証（ソフト200よけ） | 未ログインで curl | `/proposals` **307** ／ `/biz/proposals` **307** |
| ⑨の匿名性 | select と型を検査 | **本人を特定できる列を1つも取っていない**（`ow_users` の join も無し） |

⚠️★**`npm run build` は回していない**（本番 Supabase の Auth が落ちるため）。
確認は `tsc --noEmit` / `next lint` / dev の配信HTML で代替した。
**prerender の実物を見るのは push 直前の1回だけ。**

### 6-1. ★通し確認（2026-09-18 / 本番データに1行だけ作って実施）

**運営アカウントは使っていない。** admin が要るのは「行を作る」ステップだけなので、
そこは service_role で直接作り、②④⑨ の確認は `contact+NN` のセッションで行った。

| 使ったもの | |
|---|---|
| 候補者 | `contact+01@opinio.co.jp`（`is_test`） |
| 企業 | **株式会社データプール**（`is_test = true`）／管理者 `contact+07@opinio.co.jp`（`is_test`） |
| 根拠の作り方 | ★**手書きJSONではなく `buildEvidence` / `buildCounterEvidence` を通した**（`generate.ts` と同じ関数） |

| # | 確かめたこと | 結果 |
|---|---|---|
| ① | 提案1行を作成（根拠4件 / 反証2件） | 作成 |
| ② | 求職者セッションで `/proposals` | **200**。企業名・根拠・**比率（5人のうち 4人）**・反証・中立の明示・「名前は渡りません」がすべて出る／**人称の混入なし** |
| ③ | ② から見送り理由を保存 | **200**。`side='candidate' / reason='known' / note` が1行 |
| ④ | ★**見送り理由を PostgREST で直接読む（RLS の実測）** | 求職者本人 **1件** ／ **企業の管理者 0件（`[]`）** |
| ⑤ | 企業セッションで `/biz/proposals` | **200**。②の返答が「この方は見送りました」として反映。**候補者の氏名・id・見送り理由はHTMLに1つも無い** |
| ⑥ | 後始末 | 作った2行を削除し、**`ow_proposals` 0 / `ow_proposal_declines` 0** に復帰 |

⚠️★**④が今回いちばん確かめたかったところ。** 「求職者の理由は企業に渡さない」を
**画面の実装ではなく RLS で担保した**ので、**本物のセッションで PostgREST を直に叩いて**
0件であることを見た。`/dev/preview` では絶対に確かめられない部分。

### 6-2. ★★通し確認で見つけた漏れ（`/admin` 全体の問題。**今回は報告のみ**）

**`/admin/proposals` を運営権限の無いセッションで開いたら、画面は「権限がありません」なのに
HTML の RSC フライトデータに実ユーザー8人の氏名が入っていた。**

機構: App Router は**レイアウトとページを並行して描画する**。`admin/layout.tsx` が
`children` を捨てても**ページ本体は実行され、その props が `<script>` に載る。**

→ **`/admin/proposals` はページ先頭で `auth_is_admin()` を見る形に直した**（8件 → **0件**）。

⚠️★**これは `/admin` 全体の問題で、今回作った画面に限らない。** 同じ方法で測った結果:

| パス | 氏名 | 非掲載社名 |
|---|---|---|
| `/admin` | 1 | 5 |
| `/admin/placements` | **9** | **40** |
| `/admin/companies` | 2 | **40** |
| `/admin/candidates` | **9** | 0 |
| `/admin/ambassador-requests` | 5 | 0 |
| `/admin/proposals`（対処済み） | **0** | **0** |
| `/admin/jobs` | 0 | 0 |

⚠️ **既存の5ページは直していない。** 今回の承認範囲（②⑨④）の外で、
`/admin/placements/PlacementsClient.tsx` は**別セッションが編集中**だったため。
**別タスクとして起票済み。**

⚠️★**status では判定できない。** `admin/layout.tsx` は意図的に redirect せず 200 を返す
（`redirect("/")` に戻すと `OnboardingGuard` に捕まって転職意向を聞かれる画面に飛ぶ。
layout.tsx に経緯がある）。**中身で判定すること。**

### 6-3. prerender（ビルドを回さずコードで確認）

| 確かめたこと | 結果 |
|---|---|
| `/proposals` `/biz/proposals` `/admin/proposals` が静的化されていないか | **3つとも `export const dynamic = "force-dynamic"`**。`generateStaticParams` なし |
| 既存の静的化経路に今回の取得が混ざっていないか | `generateStaticParams` を持つ7ファイルに `evidence` / `ow_proposals` の参照 **0件** |
| `/dev/preview/proposals` | ⚠️ 当初 `force-static` を付けていたが、**既存19ページは何も宣言していない**ので外した。本番では `devOnly()` が `notFound()` に畳む（`NODE_ENV` はビルドで静的置換） |

### ⚠️ まだ確かめていないこと

- **`/admin/proposals` の UI から作る経路**（成功側）。6-1 では行を service_role で作ったので、
  画面のボタンから `generateProposalsForCandidate` を通すところは踏んでいない。
  ⚠️ 弾く側（運営権限なし）は 6-2 で確認済み。
- **`npm run build` の prerender の実物**。6-3 でコードからは確認したが、
  **実際の出力を見るのは push 直前の1回だけ**という約束どおり見ていない。

---

## 6-4. ★出荷時の状態 —— **push しても誰の画面にも何も増えない**

**この変更で、既存の画面の見え方は1つも変わらない。**

| | |
|---|---|
| `ow_proposals` の行数 | **0**（作る経路は `/admin/proposals` だけで、まだ誰も押していない） |
| ② `/proposals` | 誰が開いても「**いまお出しできる提案はありません**」 |
| ⑨ `/biz/proposals` | どの企業が開いても「**いまお出しできる提案はありません**」 |
| 既存の画面 | 変更なし（`MIN_AGGREGATE_COUNT` は**値も使い手も変えずに移設**しただけ） |
| 導線 | ★**どこからもリンクしていない。** ヘッダー・サイドバー・`/mypage` に項目を足していない |

⚠️★**「動いていない」と「データが無い」を取り違えないこと。**
提案が0件なのは**根拠が2件以上そろう掲載企業が0社だから**であって、壊れているからではない。
確かめ方は2つ:

1. `/dev/preview/proposals` … 固定データで**描画そのもの**が動くことを見る
2. `/admin/proposals` で候補者を選んで実行 … 結果に
   **「根拠が2件に満たず提案にしなかった企業: N 社」**が出る。
   **N が 0 でなければ、突き合わせは動いている。**

## 7. 次に触る人へ

⚠️★**`ow_proposals` に行を入れる経路は `/admin/proposals` だけ。**
`INSERT` は `anon` にも `authenticated` にも配っていない（service_role のみ）。

⚠️★**`ow_transitions` の洗い替えは手動のまま**（最終 2026-08-26 / 以後13行増加 /
流し直すと 5 → 7行）。**same_path の件数は、いま実態より少なく出る。**
提案を本格的に出す前に、洗い替えの自動化を決めること。

⚠️★**「入社の決め手」が実ユーザー0件である限り、根拠2件はほぼそろわない。**
器を増やすより、**設問に答えてもらう導線**のほうが効く。

⚠️ ③（双方合意）は**状態を持つだけで UI を作っていない**。
`proposalStage()` が `candidate_response` / `company_response` から段を導出する。
**段を別の列で持たないこと**（2つの返答と食い違う余地ができる）。
