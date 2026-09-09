# オンボーディング画面 フェーズ0 調査（2026-09-09）

**DBへの書き込み・migration・コミットはしていない。**
唯一の例外は 0-1 の切り分けに要った保存テスト（`is_test` アカウント `contact+16@opinio.co.jp`）で、
**作業前後の件数が一致することを確認して削除済み**（§6）。

> ## ⚠️ 先に共有すべき前提
>
> **0-1 の黄色いバナーは、この調査の直前のやりとりで既に working tree から外してある（未コミット）。**
> 本番（`e2469d05`）にはまだ出ている。
> 0-1 と 0-2 の実測は、**本番と同じファイル（`git show e2469d05:...`）を dev に一時的に戻して**行った。
> 測定後、自分の版に復元し SHA-256 の一致を確認している。

---

## 0-1【最優先】黄色い注意文 — **不具合ではない。文言も条件も正しい**

### 結論

| 問い | 答え |
|---|---|
| 表示条件は？ | `hasCompany && !canSaveExperience`。**常時表示ではない** |
| 会社を選んでも出るか？ | **出る。これは設計どおり** |
| 文言は正しいか？ | **正しい。** 職種・入社年月が空なら行は1件も作られず、会社名は本当に保存されない |
| 会社を選んで保存したら `company_id` は入るか？ | **入る**（実測。§0-1-4） |

**⇒「正しく入力した人に警告色で『保存されません』と読ませている」わけではない。**
警告が出ている時点で、その人は**まだ正しく入力し終えていない。**
問題は**条件ではなく見せ方**（警告色・失敗の話から入る書き出し・対象の欄から遠い位置）。

### 0-1-1 コード上の条件

| 場所 | 内容 |
|---|---|
| `OnboardingClient.tsx:296` | `const hasCompany = !!selectedCompany \|\| query.trim().length > 0;` |
| `OnboardingClient.tsx:298-299` | `const canSaveExperience = hasCompany && roleIds.length > 0 && !!startedYear && !!startedMonth && (isCurrent \|\| hasEnded);` |
| `OnboardingClient.tsx:546` | `{hasCompany && (` … 職種以降のブロック全体がこの中 |
| `OnboardingClient.tsx:721` | `{!canSaveExperience && (` … バナー |
| `OnboardingClient.tsx:333` | `if (canSaveExperience) {` … **POST もこの条件で守られている** |

**会社未選択時の出し分けはある。** `hasCompany` が false のときはブロックごと描画されない。

### 0-1-2 3状態の実測（dev / 本番と同じファイル / DOM で判定）

| 状態 | 職種ブロック | バナー |
|---|---|---|
| **A. 何も入力していない** | 出ない | **出ない** |
| **B. 自由入力（マスタに無い会社名）** | 出る | **出る** |
| **C. マスタから選択済み** | 出る | **出る** |
| （参考）C＋職種＋入社年月 | 出る | **消える** |

バナー本文（実測）:
> 職種と入社年月を選ぶと、経歴として保存されます。このまま進めると会社名は保存されません（あとからプロフィール編集で登録できます）。

### 0-1-3 ⚠️ 自動操作の罠（誤った結論を出しかけた記録）

最初の試行で `company_id` が **null**、`company_text` が `"Salesforce"` になり、
「マスタを選んだのに紐づかない」という**誤った結論を出しかけた。**

**原因はアプリではなく計測方法。** サジェスト行は `onClick` ではなく **`onMouseDown`**
で選択する（`OnboardingClient.tsx` の
`onMouseDown={(e) => { e.preventDefault(); onSelect(c); setShowDropdown(false); }}`）。
`element.click()` では `mousedown` が発火せず、**選択されないまま自由入力として残る。**

⚠️ **2026-08-12 の点検（面倒③）でも同じ罠を踏んでいる。** 3回目を防ぐため記録する。
`new MouseEvent('mousedown', {bubbles:true, cancelable:true})` を明示的に投げれば選択される。

⚠️ 選択の成否は **`aria-label="選択を解除"` のボタンの有無**で判定する。
`input[type=text]` の有無で判定すると**部署名の入力欄を拾って誤判定する**（実際にした）。

### 0-1-4 保存の実測（`is_test` / 作業後に削除済み）

マスタから正しく選択 → 職種「営業」→ 入社年月 2021-04 → 部署名「検証用部署」→ 登録

```
company_id                 = c3664ef1-5571-4645-b30f-1474e7961c17
company_name               = 株式会社セールスフォース・ジャパン   ← 正しく紐づいた
company_text               = null
role_category_id           = 営業
department                 = 検証用部署                        ← 2026-09-09 追加分も通っている
started_at                 = 2021-04-01 / is_current = true
prefecture                 = null / remote_work_status = null   ← 入力しなかったので null
visibility_company         = real
visibility_company_profile = real
ow_experience_roles の行数  = 0（職種1つのときは書かない設計どおり）
```

### 0-1-5 なぜ「文言だけの問題」でもないか

`ow_experiences` の制約（実測）:

| 列 | NULL 可 |
|---|---|
| `role_category_id` | **NO** |
| `started_at` | **NO** |

**会社名だけでは行を作れない。** だから文言を丸ごと消すと会社名が黙って捨てられる
（CLAUDE.md「エラーと失敗を握りつぶさない原則」の事例4・5・6と同じ形）。

### 0-1-6 未コミットで既に入れてある変更

| | 変更前（本番） | working tree |
|---|---|---|
| 形 | 2行の黄色い枠 | 見出しの隣に **5文字**「保存に必要」 |
| 位置 | フォーム末尾（対象の欄から 375px で3画面ぶん） | 職種／入社年月の見出しそのもの |
| 書き出し | 「このまま進めると会社名は保存されません」＝**失敗の話** | 要件だけ |

⚠️「必須」とは書いていない。**空でも「登録して始める」は通る**ので嘘になる。

---

## 0-2 画面の長さ

### 実測（本番と同じファイル / 会社をマスタから選択済みの状態から）

**1280px**

| 職種の親 | ページ高さ | CTA「登録して始める」の位置 |
|---|---|---|
| 0つ | 1,493px | 1,328px |
| 1つ | 1,801px | 1,636px |
| 3つ | 1,979px | 1,815px |
| 5つ | 2,157px | 1,993px |

**375px**

| 職種の親 | ページ高さ | CTA の位置 | 画面何枚ぶん |
|---|---|---|---|
| 0つ | 1,758px | 1,594px | 2.2 |
| 1つ | 2,296px | 2,131px | 2.8 |
| 3つ | 2,619px | 2,454px | 3.2 |
| 5つ | 2,900px | 2,736px | **3.6** |

⚠️ 親を5つ選ぶと**チップ総数54個**。
⚠️ 親1つ目が一番伸びる（+538px / 375px）。2つ目以降は +160〜320px。

### 子チップの DOM 構造（`src/components/onboarding/RolePicker.tsx:111-164`）

```
{openParents.length > 0 && (
  <div style={{ display: "grid", gap: 10 }}>
    {openParents.map((p) => (
      <div>                        ← 親ごとの箱（bg-tint / border / radius）
        <p>{p.name} のなかで、さらに近いものがあれば（任意）</p>   ← 押せない見出し
        <div style={{ flexWrap: "wrap" }}>{子チップ}</div>
      </div>
    ))}
```

**アコーディオン化はできる構造。** 親ごとに独立した箱で、`openParents` から導出しているだけ。
per-parent の `open` state を足せば畳める。

⚠️ ただし**注意が2つ**（どちらも RolePicker.tsx のコメントに根拠あり）:
- **見出しを押せる見た目にしない**（`chip` の形・枠・背景を付けない）。
  2026-09-04 に「親チップと取り違える」という理由でこの形にしている
- **親チップが既に開閉トグルとして機能している**（選ぶと開く／シェブロン付き）。
  アコーディオンを足すと**トグルが2つ**になる

---

## 0-3 生年月日を入口で聞けるか

### 結論: **足せる。ただし「書けるが読めない」ので実装に注意が要る**

### 権限（実測）

| ロール | SELECT | UPDATE |
|---|---|---|
| `authenticated` | **false** | **true** |
| `anon` | false | — |

### 既存の書き込み経路

**`PUT /api/jobseeker/profile`（`src/app/api/jobseeker/profile/route.ts:105-110`）が既にある。**

```ts
if ("birth_date" in body) {
  const bd = body.birth_date;
  if (bd === null || bd === "") patch.birth_date = null;
  else if (typeof bd === "string" && BIRTH_RE.test(bd)) patch.birth_date = bd;
  else return 400 INVALID_BIRTH_DATE;
}
```

- クライアントは **`createClient()`（セッション＝authenticated）**（route.ts:12）
- 更新は `.update(patch).eq("auth_id", user.id)` で **`.select()` を付けていない**（route.ts:167-170）

⚠️★**`.select()` が無いことが効いている。** 付けると PostgREST が全列を返そうとし、
`birth_date` の SELECT 権限が無いため **403（42501）** になる
（CLAUDE.md「`PATCH` が 403 でも UPDATE が失敗したとは限らない」と同じ機構）。
**ここに `.select()` を足さないこと。**

### ⇒ 入口に足す場合

**既存の POST API に列を足す必要は無い。** オンボーディングから
`PUT /api/jobseeker/profile` を1本呼ぶだけでよい（`ow_experiences` 側とは別テーブル）。

⚠️ **経歴の POST（`/api/jobseeker/experiences`）には足さないこと。**
生年月日は経歴ではなく本人の属性。

### `ow_career_profiles.birth_year` との関係

| | 件数（2026-09-09 実測） |
|---|---|
| 実ユーザー（is_test / system を除く） | **11人** |
| `ow_users.birth_date` あり | **4人** |
| `ow_career_profiles.birth_year` あり | **1行** |

⚠️ 依頼文の「実ユーザー14人中10人が未入力」は**古い**。現在は 11人中7人が未入力。

**入口で入力させるなら `ow_users.birth_date` に書く。** 根拠は CLAUDE.md
「生年は `ow_users.birth_date` の1系統に決めた」「`ow_career_profiles.birth_year` は
表示にも集計にも使わない（anon の GRANT も 2026-08-20 に外した）」。

⚠️★**統合しない。** 値が食い違う実ユーザーが1人いる件は**未解決のまま残す**
（どちらが本人の申告か確認が要る）。入口で新しく入力させても、
**既存の `birth_year` は書き換えない・参照しない。**

⚠️ 年齢の扱いは CLAUDE.md「年齢は詳細だけ」に従う。
**一覧用の型に `age` / `birthYear` を持たせない。年齢での絞り込みを作らない。**

---

## 0-4 完了後の着地と意思表示

### 着地

**⚠️★`?next=` は読まれていない（不具合というより未実装）。**

- `OnboardingClient.tsx` に **`useSearchParams()` の呼び出しは1件も無い**
  （`grep` で当たる2件は**どちらもコメント**。170行目「needs useSearchParams → wrapped in Suspense」/
  1494行目「Suspense boundary for useSearchParams」）
- したがって `/onboarding?next=%2Fcompanies` の `next` は**捨てられている**

**実際の着地**: 送信後 `setDone(true)`（`OnboardingClient.tsx:401`）で
**完了画面に切り替わる。自動遷移はしない。** 選択肢は3つ（すべてハードコード）:

| リンク先 | |
|---|---|
| `/companies` | 主 |
| `/mypage` | 副 |
| `/biz/auth?company=...` | 企業の方向け |

### 意思表示

**オンボーディング完了画面には意思表示への導線が無い。**

到達するのは**次のページへ移動したとき**で、`OnboardingGuard` が誘導する:

| 場所 | 内容 |
|---|---|
| `components/jobseeker/OnboardingGuard.tsx:101-102` | `onboarding_completed` が false → `/onboarding` |
| `components/jobseeker/OnboardingGuard.tsx:110` | `career_stance` 未設定 → `/onboarding/stance?next=...` |

⇒ 実際の流れは **オンボーディング → 完了画面 →「企業を見る」→ その瞬間に `/onboarding/stance` へ飛ぶ。**
完了画面の直後に1枚挟まる形になっており、**完了画面で選んだ行き先には一度行けない。**

### スカウト関連の現状（実測 / `ow_profiles` 38行）

| | 件数 |
|---|---|
| `scout_enabled` の DB 既定値 | **`true`** |
| `scout_enabled` が NULL | **16** |
| `scout_enabled` が true | **22** |
| `career_stance` が NULL | **26** |

⚠️ `can_send_scout()` は NULL を false 扱いにする（CLAUDE.md）。
⚠️ 2026-08-27 に送信可否の軸は `scout_enabled` から **`career_stance`** に移っている。
**26件が未設定＝その人たちには届かない。**
⚠️ そもそも `SCOUT_SENDING_ENABLED` が未設定なので**現時点では誰にも送られない。**

---

## 0-5 公開範囲の見せ方

### オンボーディングが作る経歴の visibility（実測）

| 列 | DB 既定 | 実際に入った値 | 現在の全件 |
|---|---|---|---|
| `ow_experiences.visibility_company` | `'real'` | **`real`** | real 29 / masked 0 / hidden 0 |
| `ow_experiences.visibility_company_profile` | `'real'` | **`real`** | — |

**`OnboardingClient.tsx` が明示的に `visibility_company: "real"` を送っている**（POST の本文）。
DB 既定に任せているのではない。

⚠️★**依頼文の「既定は login_only のはず」は別の列の話。**
`login_only` は **`ow_users.visibility`** の既定（実測: `'login_only'::text`／
login_only 43 / public 0 / private 1）。
**経歴の公開範囲は `real`（実名で出す）が既定**で、別物。混同しないこと。

### 現在の表示

**⚠️ 公開範囲の説明は、いま画面に1つも無い。**

2026-09-09 に「その企業のページに『現役社員』として表示されます。見えるのは OPINIO に
ログインしている人だけです。」を外したため（柴さんの判断・`00d10db6`）。
外した時点で、**「登録した会社の企業ページに現役社員として名前が出る」ことを
保存前に知らせる場所は、規約・プライバシーポリシー・アプリ内のいずれにも無い。**

⚠️ 「見えるのはログイン中の人だけ」の側は**利用規約 第7条**とプライバシーポリシーが
カバーしている（プロフィールの公開範囲・初期設定「ログインユーザーのみ」）。
**カバーされていないのは「企業ページに出る」ほうだけ。**

### 置ける場所（案）

| 案 | 場所 | 重さ |
|---|---|---|
| a | 完了画面（「ようこそ」）に1行 | 軽い。ただし**保存後**なので同意にはならない |
| b | 「登録して始める」の直上に1行（グレー） | 軽い。保存前 |
| c | 利用規約 第7条に追記 | **改定日の告知が要る** |

---

## 修正候補（効果 / 変更の大きさ / リスク）

| # | 内容 | 効果 | 大きさ | リスク |
|---|---|---|---|---|
| 1 | **バナー → 「保存に必要」5文字**（working tree に実装済み・未コミット） | 大 | 小 | 小。伝達は残る |
| 2 | **子チップをアコーディオンにする**（既定で畳む） | 大（375px で最大 −1,100px） | 中 | **中**。親チップが既にトグルなので**開閉が2つ**になる。2026-09-04 の判断と衝突しうる |
| 3 | **`?next=` を読む** | 中 | 小 | 小。`safeNext` が既にある（`lib/auth/redirects.ts`） |
| 4 | **完了画面から `/onboarding/stance` へ直接送る** | 中 | 小 | 小。いまは次ページ遷移時に強制的に挟まっており、**選んだ行き先に一度行けない** |
| 5 | **生年月日を入口に1項目足す** | 中（11人中7人が未入力） | 小 | **小**。既存の PUT を呼ぶだけ。⚠️ `.select()` を足さないこと |
| 6 | **公開範囲の一文を戻す**（保存前・1行・グレー） | 中 | 小 | 小。⚠️ 3文には戻さない |
| 7 | ステップ分割＋進捗表示 | 大 | **大** | **大**。分割は進捗表示とセットでないと逆効果 |
| 8 | 職種を自由入力＋補完に | 中 | 大 | **大**。職種IDによるマッチング精度を捨てる判断が要る。**勧めない** |

### 推奨する順序

**1（コミットするだけ）→ 3 → 4 → 5 → 6 → 2 → 7**

⚠️ 2 は「畳む」こと自体より**トグルが2つになる**のが論点。
着手前に「親チップを押す＝選択」と「箱を開く」をどう分けるかを決める必要がある。

---

## 6. 検証データの後片付け

| | 作業前 | 作業後 |
|---|---|---|
| `ow_experiences` | 29 | **29** |
| `ow_experience_roles` | 20 | **20** |
| `contact+16` の経歴 | 0 | **0** |
| `ow_profiles.onboarding_completed`（同アカウント） | false | **false** |

⚠️ 保存テストは2回行い（1回目は 0-1-3 の自動操作 artifact）、どちらも削除した。
⚠️ 一時的に `public/__tmp-session.html` を置いてセッションを張ったが**削除済み**。
   ブラウザの `sb-` クッキーも消してある。
⚠️ 本番のファイルを dev に一時配置したが、**SHA-256 の一致を確認して復元済み**。

## 7. 確認できなかったこと

- **本番画面そのものでの DOM 実測**。セッション用トークンを端末に出す操作が
  権限で止まったため、**本番と同じファイルを dev に置いて**測った。
  コードは同一（`git show e2469d05`）だが、**本番の CDN / ISR 由来の差は見ていない。**
- **人間の所要時間**。自動操作なので測っていない（2026-08-12 と同じ制約）。
- **Wantedly との直接比較**。依頼文の記述を前提にしており、こちらでは通していない。
