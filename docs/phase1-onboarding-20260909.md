# オンボーディング フェーズ1 で確定したこと（2026-09-09 / 本番反映 2026-09-10）

調査は [docs/phase0-onboarding-20260909.md](phase0-onboarding-20260909.md)。
本番のコミットは **`3048fa83`**（`/api/health` の `commit` で照合済み）。

| # | commit | 内容 |
|---|---|---|
| ② | `4c463bf5` | CLAUDE.md に企業サジェストの検証手順を追記 |
| ① | `2390e965` | 保存の要件を警告バナー → 欄の隣の「保存に必要」5文字 |
| ④ | `c8f1e2d0` | 公開範囲の説明を、位置を変えて戻す |
| ⑤ | `a37a7f62` | 生年月日を入口で任意入力 |
| ⑥ | `a14781e2` | 375px で主CTAを下端に貼る |
| ③ | `3048fa83` | `?next=` を stance まで持ち回る（A案）＋ **完了画面の削除** |
| — | `c58bfc2c` | CLAUDE.md に「select は1つずつセット」を追記 |
| — | `fc274d7a` | フェーズ0の調査結果 |

---

## 1. 完了画面を削除した理由

**削除したもの**: `/onboarding` の「ようこそ、OPINIO へ！」＋行き先3つ
（掲載中の企業を見てみる ／ プロフィールを設定する ／ 採用担当者・企業の方はこちら）。

### 理由①（設計）: 選ばせておいて選ばせていなかった

行き先を3つ選ばせる画面なのに、**どれを押しても `OnboardingGuard` が直後に
`/onboarding/stance` へ引き剥がしていた**（`OnboardingGuard.tsx:110`）。
`career_stance` が未設定の人は遷移のたびに stance へ飛ぶので、
完了画面で選んだ行き先には**一度も到達できない。**

### 理由②（機械的な確証）: `setDone` が未使用になり lint がエラーを出した

A案（完了画面を経由せず stance へ `router.replace`）を入れた瞬間に、

```
231:16  Error: 'setDone' is assigned a value but never used.  @typescript-eslint/no-unused-vars
```

**死にコードになった確証。** 残すと「効いていない仕組みの上に実装が積まれる」
（このリポジトリが `?next=` で実際にやってしまったこと）。

### 消えたリンクの行き先は、すべて他から入れる（2026-09-09 実測）

| 消えたリンク | 代替 |
|---|---|
| `/companies` | `next` の既定（`DEFAULT_AFTER_ONBOARDING`）が同じ役割 |
| `/mypage` | ヘッダーのユーザーメニュー |
| `/biz/auth` | **求職者側ヘッダーの「企業の方はこちら」（→ `/business`）とフッター**。唯一の入口ではないことを確認済み |

⚠️★**戻すなら、`OnboardingGuard` が stance へ引き剥がす動きとどう両立させるかを
   先に決めること。** 決めずに戻すと、また「押しても行けない画面」になる。

---

## 2. A案を選んだ理由と、B案に戻す場合の変更点

### 3案

| 案 | 持ち方 |
|---|---|
| **A（採用）** | 完了画面を経由せず `router.replace("/onboarding/stance?next=" + next)` |
| B | 完了画面を残し、主CTAの href を `/onboarding/stance?next=<next>` にする |
| C | `sessionStorage` に退避して stance が読む |

### A を選んだ理由（柴さんの判断）

> 完了画面は「行き先を選ばせる画面」なのに、OnboardingGuard が直後に stance へ
> 引き剥がしている。経由させること自体が矛盾しているので、経由をやめる。

技術的にも:
- **新しい状態を1つも足さない。** stance 側に `next` の受け口と `safeNext` が既にある
- C は状態が増える。タブを閉じると消え、`safeNext` の検証も別途要る

### ★A にできず B にできること（1つだけある）

**完了画面で利用者が行き先を選べること。**

B なら「プロフィールを設定する」を押した場合、`OnboardingGuard` が `next=/mypage` を
付けて stance を挟むので、答え終わったあと `/mypage` に着く。
つまり「企業一覧を見る／プロフィールを設定する」の**選択は B なら生き返る**。

A は常に `next`（＝見ようとしていたページ、無ければ既定）へ戻すので、この選択は無い。

⚠️ C に A でできないことは無い（URL で運べるので `sessionStorage` は不要）。

### B に戻す場合の変更点

1. `OnboardingClient.tsx` の `finish()` の締めを
   `router.replace(...)` → `setDone(true)` に戻し、`done` state を復活させる
2. 削除した完了画面の JSX を戻す（`3048fa83` の差分から取れる）
3. **主CTAの href を `/onboarding/stance?next=<next>` にする**
   （`/companies` 直リンクに戻すと `next` が失われる）
4. 副CTAは素の href のままでよい。`OnboardingGuard` が `next=/mypage` を付けて
   stance を挟むので、結果として `/mypage` に着く

⚠️★**3 を忘れると「完了画面は戻ったが `next` は失われる」状態になる。**
   `?next=` が読まれていなかった 2026-09-09 以前と実質同じ。

### 既定の行き先は1箇所

**`DEFAULT_AFTER_ONBOARDING`（`src/lib/auth/redirects.ts`）= `/companies`。**
`stance/page.tsx` の `"/companies"` 直書きも置き換えた。

⚠️ `/auth` と `postAuth` は**それぞれ自前の既定**を持っている。あちらは
「認証後どこへ行くか」で関心が違うので、ここに寄せていない。

⚠️ `next` は**必ず `safeNext` を通す**。素の値を `router.replace` に渡すと
`//evil.com` や `/\evil.com` で外部へ飛ばせる（オープンリダイレクト）。

### 通しの実測（**本番** opinio.jp / `3048fa83` / is_test `contact+16`）

```
① /mypage/bookmarks へアクセス
   → /onboarding?next=%2Fmypage%2Fbookmarks          （OnboardingGuard）
② 会社・職種・入社年月を入れて「登録して始める」
   → /onboarding/stance?next=%2Fmypage%2Fbookmarks   （完了画面を経由しない）
③ 「転職について」に答えて「次へ」
   → /mypage/bookmarks                                （見ようとしていたページに戻った）
```

dev では加えてオープンリダイレクトも確認:
`?next=https%3A%2F%2Fevil.example.com%2Fx` → `/onboarding/stance?next=%2Fcompanies`（既定に落ちる）。

⚠️★**`OnboardingGuard` は完了をタブ内の `sessionStorage` に覚える。**
   検証で誘導が起きないときは、まず `sessionStorage` を疑うこと（実際に1回踏んだ）。

---

## 3. 公開範囲の文言と、その裏取り

### 文言（`/onboarding` の h2 直下・固定で1つ・1文）

> 選んだ会社の企業ページに、**あなたの名前が実名で表示されます**
> （見えるのは OPINIO にログインしている人だけです）。

⚠️ 入力欄ごとにバッジを散らさない。2026-08-19 に
「緑バッジと紫バッジが 1,138px 離れて同時に見えない」問題を踏んでいる。
⚠️ **会社を選ぶ前から出す（条件を付けない）。** 入力し終えてから知らせるのでは同意にならない。
⚠️ **1文にする。3文には戻さない**（2026-08-14 に一度3文→1文に縮めている）。

### ★裏取りの結果（2026-09-09 / 本番実測）

**同意を取るための文なので、コードの意図ではなく実測で確かめた。**

| 何を | 未ログイン（anon） | ログイン中 |
|---|---|---|
| `/api/jobseeker/companies/[id]/employees` | `{"authenticated":false,"current":[],"alumni":[],...}` **氏名0件** | **木村雅樹 / 生藤 / 鈴木 五郎 / 関西 南** |
| `/companies/salesforce` の HTML | 氏名0件・`/u/` リンク0件・「現役社員」の見出しも出ない | 同じ（**人物はクライアントで取る**。`f9d6d051`） |

**UI 以外**（RLS が `USING(true)` で anon に開いていた前例があるため、UIだけでは確認にならない）:

| 何を | 結果 |
|---|---|
| anon で `ow_users` を直接（PostgREST） | **200 / 0行**。テーブルは44行あるので**遮断の証明になる** |
| anon で `ow_experiences` / `ow_career_profiles` | **200 / 0行** |
| anon で `ow_company_members` | 行は返るが `ow_users(name)` の埋め込みは **`null`**、`select=*` は **401**（列単位 GRANT） |
| `sitemap.xml`（124 URL） | `/u/` は **0件** |
| 構造化データ（JSON-LD） | `Organization` と `WebSite` のみ。氏名なし |
| OGP | `og:description` は社名・タグライン・従業員数、`og:image` は社名・タグライン・事業領域のみ |
| `/people` と `/u/<username>` を anon で | **ログイン画面へリダイレクト** |

⚠️ 「`/people` が 200」と一瞬見えたのは `curl -L` がリダイレクトを追った結果。
**中身を見るまで判定しないこと。**

### ★★この文言を変えるときは、この確認をやり直すこと

**同意の文なので、実態と違えば「公開範囲について誤った説明をした」ことになる。**
やり直す手順は上の2つの表のとおり:

1. 社員一覧 API を anon とログイン中の両方で叩き、氏名の有無を比べる
2. anon で PostgREST を直接叩く（`ow_users` / `ow_experiences` / `ow_career_profiles` /
   `ow_company_members` の埋め込み）
3. sitemap・JSON-LD・OGP・`/people`・`/u/` も見る

⚠️★**「アプリのUIには出ない」だけでは確認にならない。**
⚠️★**空のテーブルでは遮断を証明できない**（RLS で弾かれても 200 / 0件が返るため）。
   行があるテーブルで測ること。

---

## 4. その他このフェーズで決めたこと

| | |
|---|---|
| 保存の要件 | 黄色いバナー → **職種／入社年月の見出しの隣に「保存に必要」5文字**。⚠️「必須」とは書かない（空でも「登録して始める」は通る） |
| 生年月日 | `ow_users.birth_date` の1系統だけ。⚠️ `ow_career_profiles.birth_year` には**書かない**。⚠️ `PUT /api/jobseeker/profile` に **`.select()` を足さない**（403 になる） |
| 主CTA | 375px で `position: sticky; bottom: 0`（`.onb-cta-sticky`）。⚠️「後で設定する」は**貼らない**（任意入力の画面で離脱ボタンが常時見える状態を作らない） |
| 並び | **会社名 → 部署 → 職種**。現職と「これまでの職歴」の両方 |

⚠️ 着手しなかったもの: 子チップのアコーディオン化（親チップが既にトグルで開閉が2つになる論点が未解決）／
ステップ分割（進捗表示とセットでないと逆効果）／職種の自由入力（マッチング精度を捨てる判断が要る）。

---

## 5. 後片付け

| | 作業前 | 作業後 |
|---|---|---|
| `ow_experiences` | 29 | **29** |
| `ow_experience_roles` | 20 | **20** |
| `contact+16` の `birth_date` | null | **null** |
| 同 `onboarding_completed` | false | **false** |
| 同 `career_stance` | null | **null** |

一時ファイル（`public/__tmp-session.html`・scratchpad の資格情報）と
ブラウザの `sb-` クッキー・`sessionStorage` も削除済み。

⚠️ 本番の検証は**既存の `is_test` アカウント**（`contact+16@opinio.co.jp`）で行い、
新規の auth ユーザーは作っていない。セッションは `generateLink` +
`/auth/confirm`（メールと同じ経路。**送信はされない**）で張った。
