# 非公開企業の勤務先が、本人にだけ「不明な企業」と出る（2026-09-12 / フェーズ1 調査）

**ソースを読んで確認した事実**と**本番DBの実測値**だけを書く。推測は「推測」と明記する。
調査時点の HEAD は `b4290d8a`。**コードは変更していない。**

---

## 1-1. 「非公開企業」の実体

### 列

| 列 | 型 | 既定 | COMMENT（DB に入っている原文） |
|---|---|---|---|
| **`ow_companies.is_published`** | boolean NOT NULL | **true** | 「**詳細ページが見えるか（404ゲート）**。既定 true。運営がページを取り下げるときだけ false にする。一覧・検索に出すかは listing_status」 |
| `listing_status` | enum NOT NULL | `listed` | 「掲載状態: draft=非掲載, listed=事実情報として掲載（ディレクトリ）」 |
| `is_approved` | boolean NOT NULL | false | 「運営が内容を確認したか。**ページの可視性とは無関係**」 |

**非公開を決めているのは `is_published` の1列だけ。NULL は無い**（NOT NULL）。

### 経緯（migration から追える）

| いつ | 何が |
|---|---|
| baseline | `ow_companies_published_read USING (is_published = true OR status = 'active')` |
| **2026-09-05** | `20260905080000_drop_status_second_publish_gate.sql` で **`status = 'active'` を外した**。理由は「**anon が PostgREST を直接叩くと、取り下げたはずの企業を読めたまま**だった」（検証企業を1社作って実測、90 → 91社になることを確認している） |

⚠️★**この migration が示しているのは「anon／第三者に読ませない」意図**であって、
**本人に読ませない意図ではない。** 何のための非公開かは
CLAUDE.md「企業ページの3つのスイッチ」に書かれたとおり
**運営の承認（`is_approved`）と分類（業種・事業領域）が済むまでページを見せない**こと。

### 件数（2026-09-12 実測）

| | |
|---|---|
| `is_published = false` の企業 | **13社** |
| うち在籍者（`ow_experiences.company_id`）がいる | **3社**（Archi Village / ニトリ / プルデンシャル生命保険） |
| 該当する職歴 | **3件** |
| 該当する実ユーザー | **1人（長谷川陽希）** |

⚠️★**docs/todo.md に「実ユーザー3人」と書いたのは誤り。正しくは1人・3件。**
   3社それぞれに1人ずついたのを人数として足していた。**この調査で訂正する。**

⚠️★**その1人は、3件すべてが非公開企業。** ＝ **自分の職歴が全部「非公開」に見えている。**

3社とも **`source = 'user'`**（`POST /api/jobseeker/companies` ＝ 職歴入力の企業ピッカーから
本人が登録した）で、作成は 2026-09-07。**本人が名前を打って作った会社が、本人に見えていない。**

---

## 1-2. 落ちている経路

### 会社名を引いているのは1箇所

[src/app/(jobseeker)/mypage/page.tsx](../src/app/\(jobseeker\)/mypage/page.tsx) の
**258〜262行**（`companyInfoById` を作るところ）。

```ts
const { data: companies, error: companiesErr } = await supabase   // ★セッションのクライアント
  .from("ow_companies")
  .select("id, name, logo_url, ..., is_published")
  .in("id", masterCompanyIds);
```

**職歴カードも理由モーダルも、この1本の結果（`companyInfoById`）から作られる。経路は同じ。**
ここが0件になった後、**別々の分岐**で別々の文言になる。

| 画面 | 実体 | 出る文言 |
|---|---|---|
| 職歴カード（タイムライン） | `lib/utils/timeline.ts` **186行** `company_name = r.company_anonymized ?? "非公開"` | **「非公開」** |
| 編集モーダル・理由モーダルの見出し | `lib/experiences/toStint.ts` **26行** `companyNameById.get(...) ?? "不明な企業"` | **「不明な企業」** |
| 「転職・面談の状況」の在籍会社 | `mypage/page.tsx` **295行** `companyInfoById.get(...)?.name ?? "—"` | **「—」** |

**原因は1つ、分岐は3つ。** ⚠️ `MergedTimeline` は
「非公開企業 / 非公開 / 不明な企業」を**匿名企業として鍵アイコンで描く**（765行）ので、
**本人が入力した実名の会社が、匿名で登録した会社と同じ見た目になる。**

### 落としているのは GRANT ではなく RLS

`ow_companies` の SELECT ポリシー（原文）:

| ポリシー | ロール | USING |
|---|---|---|
| **`ow_companies_published_read`** | **PUBLIC** | **`(is_published = true)`** |
| `ow_companies_own_select` | PUBLIC | `(auth.uid() = user_id)` |
| `ow_companies_member_select` | PUBLIC | `auth_is_company_member(id)` |
| `ow_companies_admin_read` | authenticated | `auth_is_admin()` |

`user_id` は **89社中2社にしか入っていない**実質未使用の列（CLAUDE.md）なので、
求職者にはどのポリシーも当たらない。

**GRANT は落ちていない**（実測 2026-09-12）:

```
has_table_privilege('anon','ow_companies','SELECT')          = true
has_table_privilege('authenticated','ow_companies','SELECT') = true
列単位の SELECT: anon 153/153 ・ authenticated 153/153
```

**実測（PostgREST を直接）**:

| | status | body |
|---|---|---|
| anon が非公開企業（ニトリ）を名指し | **200** | **`[]`** ← RLS |
| anon が公開企業（セールスフォース）を名指し | 200 | 1行返る（対照） |

⚠️ CLAUDE.md「RLS で弾かれても 403 ではない。200 ＋ 0件が返る」のとおりの形。
   **`?? "不明な企業"` がその0件を既定値で埋めている。**

---

## 1-3. 影響範囲 ——★**見えていないのは本人だけ**

| 誰が見るか | 画面 | 会社名は？ | 実体 |
|---|---|---|---|
| **本人** | `/mypage` 職歴カード | ❌ **「非公開」**＋鍵アイコン | セッションのクライアント |
| **本人** | 理由モーダルの見出し | ❌ **「不明な企業 を選んだ理由は？」** | 同上（`toStint`） |
| **本人** | 職歴の編集モーダル | ❌ **「不明な企業」** | 同上 |
| **本人** | 「転職・面談の状況」の在籍会社 | ❌ **「—」** | 同上 |
| 他の利用者 | **`/u/[id]`（公開プロフィール）** | ✅ **実名で出る** | **admin クライアント**。「`adminSupabase` を使い `is_published=false` の企業名も取得（プロフィール表示用）」と**コメントに明記**（`u/[id]/page.tsx` 427行） |
| 他の利用者 | **`/people`** | ✅ **実名で出る** | `lib/people/directory.ts` 254行。「ここは `createAdminClient` なので取れる（`/u/[id]` も同じ理由で admin に切り替えている）」と**コメントに明記** |
| 企業 | **`/biz/candidates`** | ✅ **実名で出る**（`visibility_company` が real のとき） | admin ＋ `resolveExperienceCompanyName` |
| 未ログイン | `/u/[id]` | — | この利用者は `ow_users.visibility = 'login_only'` なので**ページごと見えない**（会社名以前の話） |
| 未ログイン | 企業ページの社員一覧 | — | 非公開企業は**ページ自体が 404** |

⚠️ 該当の3件はいずれも `visibility_company = 'real'` / `visibility_company_profile = 'real'`
   （＝本人は伏せていない）。**伏せている人の話ではない。**

⚠️ 職歴からのリンクは `isPublished !== false` で落ちる（`timeline.ts` 178行）ので、
   **名前が出るようになってもリンクにはならない**（404 の行き止まりを作らない仕様。変えない）。

---

## 1-4. 意図の切り分け（判断の中心）

### 他人に見せない意図

**明らかにある。** 2026-09-05 の migration が、まさに
「anon が PostgREST 経由で取り下げ済みの企業を読めていた」ことを塞いでいる。

### 本人に見せない意図

**根拠は1つも見つからなかった。** 逆向きの根拠が3つある。

| # | 根拠 |
|---|---|
| ① | **`is_published` の COMMENT が「詳細ページが見えるか（404ゲート）」**。守っているのは**ページ**であって社名ではない |
| ② | **公開プロフィール `/u/[id]` と `/people` は、すでに admin で非公開企業の社名を出している**（どちらもコメントに理由が明記されている）。**第三者には出していて、本人にだけ出ていない** |
| ③ | **その社名は本人が入力した値**（3社とも `source = 'user'`。職歴入力の企業ピッカーから本人が登録） |

⇒ **「本人には見せる」は RLS の意図に反しない。** いま起きているのは意図ではなく、
`/mypage` だけがセッションのクライアントで引いている**取りこぼし**。

### 本人経由で第三者に漏れる経路が増えるか

**増えない。** 本人に見せる情報は、**すでに `/u/[id]` と `/people` が第三者に見せているもの**。

| 経路 | 変わるか |
|---|---|
| 公開プロフィール `/u/[id]` | **変わらない**（すでに admin で実名） |
| 企業向けの候補者一覧 `/biz/candidates` | **変わらない**（すでに admin で実名） |
| 未ログイン・検索エンジン | **変わらない**（`/mypage` は本人しか開けない。ISR も無い） |
| OGP | **変わらない**（`/mypage` に OG 画像は無い） |
| API のレスポンス | **`/mypage` はサーバーコンポーネントで、JSON を返す口が無い** |

⚠️★**ただし案の選び方で変わる。** RLS を広げる案（下記 案A）は
**PostgREST の口も同時に開く**ので、そちらは別に評価する。

---

## 1-5. 直し方の候補

### 案A: RLS に「自分の職歴が参照している企業は本人が読める」を足す

```sql
create function auth_has_experience_at(target_company_id uuid) returns boolean
  language sql stable security definer set search_path = public set row_security = off as $$
  select exists (select 1 from ow_experiences e join ow_users u on u.id = e.user_id
                  where e.company_id = target_company_id and u.auth_id = auth.uid());
$$;
create policy ow_companies_own_experience_read on ow_companies for select to authenticated
  using (auth_has_experience_at(id));
```

| | |
|---|---|
| 良い点 | セッションのクライアントで引いている**すべての経路が一度に直る**（`/mypage` と `GET /api/jobseeker/experiences`） |
| ⚠️ 副作用① | **行ごと開くので153列すべてが読める。** `ow_companies` の SELECT はテーブルレベル GRANT（実測）。`draft_data`・`notification_emails` まで、その利用者が PostgREST から読めるようになる |
| ⚠️ 副作用② | **2026-09-05 に狭めたばかりの方向と逆。** あの migration は「PostgREST の口が広かった」ことを塞いだもの |
| ⚠️ 副作用③ | `ow_companies` の SELECT に permissive ポリシーが1本増える（advisor の `multiple_permissive_policies` は既に371件） |
| 規約 | ポリシー式は `ow_users` を直接引かない（SECURITY DEFINER 関数の中に閉じる）ので、CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」には抵触しない |

### 案B（推奨）: `/mypage` の会社名だけ admin で引く

`mypage/page.tsx` の `ow_companies` の1クエリを `createAdminClient()` に替える。
**対象は `masterCompanyIds`＝本人の職歴（と出向先）が参照する id だけ**なので、
広がるのは「本人が自分で入力した会社の名前」に限られる。

| | |
|---|---|
| 良い点 | **`/u/[id]`・`/people` と同じ形**。どちらも同じ理由で admin に切り替えた前例があり、コメントも残っている |
| 良い点 | **DB を触らない。** PostgREST の口は1ミリも広がらない |
| 良い点 | 返す列は**いま SELECT している9列だけ**（`draft_data` などは触らない） |
| ⚠️ 注意 | `createAdminClient` は RLS を迂回するので、**`.in("id", masterCompanyIds)` の絞りが唯一の防波堤**。この配列が本人の職歴由来であることをコメントで固定する（CLAUDE.md「`createAdminClient` で引く画面は条件を書き忘れると全件出る」） |
| ⚠️ 注意 | `GET /api/jobseeker/experiences`（**112行**）が同じ形で落ちている。**src からの呼び出しは0件**（実測）だが生きたルートなので、**同じコミットで直す**。直さないと同じ不具合が2箇所に残る |

### 案C: 何もしない（3社を運営が公開する運用で回す）

| | |
|---|---|
| ⚠️ | **直らない。** `POST /api/jobseeker/companies` は今後も `is_published = false` で作るので、**職歴に会社を登録した人は毎回この状態になる** |
| ⚠️ | 公開ゲート（承認＋業種＋事業領域）を通す必要があり、**運営の作業が発生する** |

### 推奨

**案B。** 理由は3つ。

1. **既に同じ判断が2箇所で下されている**（`/u/[id]` / `/people`）。3箇所目を別の方式で作らない
2. **2026-09-05 に狭めた方向と矛盾しない。** 案Aは PostgREST の口を開け直す
3. **列が増えない。** 案Aは153列を開くが、案Bは今と同じ9列のまま

⚠️ 案Aを採るとしたら、条件は「PostgREST から `ow_companies` の機微列（`draft_data` /
   `notification_emails`）を**列単位 GRANT で先に閉じる**」こと。**それは別タスク。**

---

# フェーズ2 実装と検証（2026-09-12 / 案B）

柴さんの確定: **他人からの見え方は現状維持。** `/mypage` の会社名だけ admin で引く。**DB は触らない。**

## 変更したファイル

| ファイル | 何を |
|---|---|
| `src/app/(jobseeker)/mypage/page.tsx` | `ow_companies` の1クエリを `createAdminClient()` に替えた（＋理由のコメント） |
| `src/app/api/jobseeker/experiences/route.ts` | **コメントだけ**。同じ形で落ちていること・`/mypage` は直したこと・使い始めるときに揃えることを残した |

**admin で引いている列（9列。増やさないこと）**

```
id, name, logo_url, logo_letter, logo_gradient, industry, phase, employee_count, is_published
```

⚠️ 対象は `masterCompanyIds`＝**本人の職歴（と出向先）が参照する company_id だけ**。
RLS を迂回しているので、**この `.in()` が唯一の防波堤**であることをコメントに固定した。

## 本人側（`contact+26` に非公開企業（株式会社ニトリ）の現職を1件作って確認）

| 画面 | 変更前 | 変更後 |
|---|---|---|
| タイムラインの会社名 | **「非公開」**＋鍵アイコン | **「株式会社ニトリ」** |
| 理由モーダルの見出し | 「**不明な企業** を選んだ理由は？」 | 「**株式会社ニトリ** を選んだ理由は？」 |
| 職歴の編集モーダル | 「不明な企業」 | **「株式会社ニトリ」** |
| 行の `aria-label` | 「不明な企業 を編集」 | 「**株式会社ニトリ** を編集」 |
| 「転職・面談の状況」の在籍会社（RSC ペイロードの `currentCompanies`） | `{"name":"—"}` | `{"name":"株式会社ニトリ"}` |
| プロフィールヘッダーの在籍企業 | 出ない（「不明な企業」は社名ではないので除外される） | **「ニトリ」** |

**解消しなかった分岐は無い。** 文言3つ（「非公開」「不明な企業」「—」）は
**1本のクエリを直しただけで揃って解消した。**
⚠️ `/mypage` の HTML に残る「非公開」2件は、理由ボタンの
`aria-label="選んだ理由を回答する（非公開）"` で**別物**。

## 他人側3面 —— 変更前後で差分0

⚠️★**最初の計測は失敗した。** `/people` が 8人 → 5人に見えたが、
**変更前の取得が `unstable_cache`（1800秒）の古い実体**だった。
変更を `git stash` して同じ URL を叩いたら**変更後と同じ5人**が返ったので、
**この差は自分の変更とは無関係**と確定した（CLAUDE.md が3回踏んだと書いている罠。
`./scripts/dev-cold.sh` を通していなかった）。

**測り直した手順**: `git stash` で HEAD のコードに戻す → `./scripts/dev-cold.sh`（`.next` を消して cold 起動）
→ 3面を取得 → `git stash pop` → **もう一度 `./scripts/dev-cold.sh`** → 同じ3面を取得 → 比較。

| 面 | 変更前 | 変更後 | 差分 |
|---|---|---|---|
| 公開プロフィール `/u/044385ab…`（実ユーザー本人を**他人のセッション**で閲覧） | 96,968 B | 96,968 B | **テキスト0行**。生バイトの差は `?v=<timestamp>`（CSS/JS のキャッシュ回避）**6箇所だけ** |
| ユーザー一覧 `/people` | 144,729 B | 144,729 B | 同上 |
| 企業向けの候補者一覧 `/biz/candidates`（セールスフォースの管理者 `contact+08`） | 93,863 B | 93,863 B | 同上 |

⚠️ 公開プロフィールには**変更前から** Archi Village 4回・ニトリ 2回・プルデンシャル 2回が出ている
（＝他人には元から実名で見えていた。フェーズ1の結論どおり）。**その数は変更後も同じ。**

⚠️★**`/biz/candidates` は候補者を1人も描画していない。** 有料プランのゲートに当たり
「候補者検索は有料プランの機能です」の案内だけが出る（有料は現在0社）。
**この面は「変わらない」ことしか測れていない** ——候補者行そのものが出ないため。
コード上はこの経路（admin ＋ `resolveExperienceCompanyName`）に**一切触れていない**。

## その他の確認

| 何を | 結果 |
|---|---|
| **未ログインで非公開企業の詳細ページ** | **本番 opinio.jp で3社とも 404**（ニトリ / Archi Village / プルデンシャル）。`is_published` のゲートは効いている。⚠️ **dev では 200** ——`getCompanyBySlugOrId` が `NODE_ENV !== "development"` のときだけ絞る既知の分岐（CLAUDE.md）。**dev で見て「漏れた」と読まないこと** |
| `/mypage` の応答に機微列が混ざっていないか | `draft_data` / `notification_emails` / `about_markdown` / `capital_notes` / `is_approved` / `reality_disclosure` とも **0件**。RSC ペイロードに載るのは上の9列だけ |
| 実ユーザー（長谷川陽希）の3件 | **読み取りのみで確認。** 直した経路と同じ列・同じ条件（本人の職歴が参照する company_id）で引くと **3社とも社名が返る**（Archi Village / プルデンシャル生命保険 / ニトリ）。⚠️ **本人のアカウントにはログインしていない**（実ユーザーのセッションは使わない）。描画側は `contact+26` で同じ経路を通して確認済み |

## 後始末

検証で作った職歴1件は `DELETE /api/jobseeker/experiences/[id]` で削除。
ゲートを通すために入れた `ow_profiles.career_stance` も NULL に戻した。

**`ow_experiences` 34行 ／ `ow_companies` 103行 ／ `ow_experience_gaps` 1行**（いずれも作業前と一致）。
