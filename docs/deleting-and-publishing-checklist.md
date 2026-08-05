# 企業・求人・記事を削除／公開するときのチェックリスト

2026-08-05 作成。migration 238 / 239 の事故を繰り返さないために置いている。

---

## 削除するとき

### まず知っておくこと

**`ow_posts` の `ref_company_id` / `ref_job_id` / `ref_article_id` は `ON DELETE SET NULL`。**
企業や求人を消しても投稿の行は残り、**参照だけが黙って外れる**。エラーは出ない。

実際に起きたこと:

| migration | 消したもの | 参照が外れた投稿 |
|---|---|---|
| `238_delete_medimo.sql` | medimo（企業＋求人25件） | 25 + 1 |
| `239_delete_archi_freee_layerx.sql` | Archi Village / freee / LayerX | 24 + 3 |

合計60件（`job_posted` 56 / `company_joined` 4）。
239 は `ow_experiences` を `company_text` へ退避する手当てをしていたのに、
`ow_posts` は見落としていた。**手当てするテーブルを1つずつ思い出す方式では漏れる。**

参照が外れた投稿は `ow_posts_visible`（後述）から自動的に落ちるので**表示上の実害は無い**が、
行は残り続ける。

### 手順

1. **削除対象を参照している `ow_posts` を数える**

   ```sql
   SELECT post_type, count(*)
     FROM ow_posts
    WHERE ref_company_id = '<company_id>'
       OR ref_job_id IN (SELECT id FROM ow_jobs WHERE company_id = '<company_id>')
    GROUP BY post_type;
   ```

2. **削除対象テーブルへの FK を全部列挙する。** 「思い出す」のではなく引く。

   ```sql
   SELECT c.conrelid::regclass AS 参照元, a.attname AS 列, c.confdeltype AS 削除時動作
     FROM pg_constraint c
     JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f' AND c.confrelid = 'ow_companies'::regclass;
   -- confdeltype: a=NO ACTION  r=RESTRICT  c=CASCADE  n=SET NULL  d=SET DEFAULT
   ```

   `c`（CASCADE）は黙って関連行を巻き込む。`n`（SET NULL）は黙って参照を外す。
   **どちらもエラーにならない。** 止まるのは `r`（RESTRICT）だけ。

3. `ow_experiences` は `company_id` を `company_text` へ退避してから消す
   （`experience_company_xor` 制約に引っかかるため。239 の前例を踏襲する）

4. migration に事前・事後のガードを入れる。想定件数と違ったら `RAISE EXCEPTION` で
   トランザクションごと落とす

### やらないこと

**参照が外れた投稿を `DELETE` しない。** 消せば消すほど「後から見ると理由が分からない穴」が増える。
`ow_posts_visible` が表示から落とすので、行は残しておいてよい。

---

## 公開するとき

### 公開には2経路あり、片方しか投稿を作らない

| 経路 | フィード投稿 | `published_at` |
|---|---|---|
| `/biz/company` `/biz/jobs/[id]` `/admin/articles` の公開操作 | **作られる** | 入る |
| migration / SQL で直接 `is_published = true` / `status = 'published'` | **作られない** | NULL のまま |

実運用は後者。このままだと企業は増えるのにフィードだけ止まる。

2026-08-05 時点で `ow_companies.published_at` は **85社すべて NULL**（`is_published = true` の
76社を含む）。つまりアプリ経由の公開は本番で一度も行われていない。

### ⚠️ 公開には承認が要る（DB制約）

```sql
check_published_requires_approval  CHECK (is_published = false OR is_approved = true)
```

2026-08-05 に追加（`20260805101231_require_approval_before_publish.sql`）。
**`is_approved = true` でない企業を `is_published = true` にすると 23514 で弾かれる。**

それ以前は、この判定を持っていたのは `PATCH /api/biz/company` の1箇所だけで、
migration や SQL からは承認を飛ばして公開できた。実運用の公開は migration 経由が
主なので、**通っている経路の側にだけガードが無い**状態だった。

企業を公開する migration を書くときは、`is_approved` も同時に立てるか、
先に承認を済ませること。制約を外して公開しないこと。

### 手順

1. 一括投入・一括公開の migration を流す
2. **突合スクリプトを実行する**

   ```bash
   node scripts/backfill-feed-posts.mjs            # dry-run（既定）。対象件数だけ出る
   node scripts/backfill-feed-posts.mjs --apply    # 実際に作る
   ```

   部分UNIQUEインデックス3本が冪等性を担保するので、何度実行しても重複は作られない。

### 本番で公開トグルを押して検証しない

公開すると本番フィードに投稿が生成され、**取り消せない**。
非公開に戻しても投稿は残り、消せば幽霊投稿が増える（238/239 と同じ事故）。
検証はローカルかプレビュー環境で行う。

---

## `ow_posts_visible` について

フィード表示用の読み取り専用ビュー（`20260805035958_create_ow_posts_visible.sql`）。

- `job_posted` → `ref_job_id IS NOT NULL`
- `company_joined` → `ref_company_id IS NOT NULL`
- `article_published` → `ref_article_id IS NOT NULL`
- `user_post` とそれ以外の `post_type` → 素通し
  （`post_type` に CHECK 制約が無いため、未知の値を黙って消さない）

**読みはこのビューを使う。`ow_posts` を直に引かない。**
書き込みは従来どおり `ow_posts` に対して行う。

`security_invoker = true` を付けてある。これが無いとビューがオーナー権限で走り、
`ow_posts` の RLS を迂回する（`/u/[id]` は anon クライアントで引いているので実害が出る）。

### 変更するときの制約

**単一テーブルの `SELECT *` であることに依存している。**
ビューには FK が無いため、PostgREST のリソース埋め込み
（`user:ow_users!user_id(...)` / `ref_company:ow_companies!ref_company_id(...)` /
`ref_job:ow_jobs!ref_job_id(company:ow_companies!company_id(...))`）は、
PostgREST がビューの列を元テーブルの列まで辿れることで成立している。

**JOIN・集約・列の加工を足すと埋め込みが壊れる。** 変更するときは、埋め込みを
使っている全経路（feed の SSR / `api/jobseeker/posts` / `/feed/[postId]` /
`companies/[id]` / `schools/[id]` / `u/[id]`）を実際に叩いて確認すること。
型チェックでは落ちない。実行時に空配列や 400 が返る形で出る。

**`security_invoker = true` を外さない。** 外すとビューがオーナー権限で走り、
`ow_posts` の RLS を迂回する。`/u/[id]` は anon クライアントで引いているので実害が出る。
migration の事後チェックで `reloptions` を検証している。

---

## ow_companies に重複行がある（2026-08-05 記録）

株式会社Opinio がマスタに **2行** 入っている。

| 行 | id | 状態 |
|---|---|---|
| `株式会社Opinio` | `cf44d740` | 公開・slug=opinio・url / tagline あり。求人2件 / 記事1件 / 投稿1件 / admin 3件 |
| `株式会社Third Box` | `81cae8d8` | **非公開**・slug=third-box・中身は空。admin 3件のみ |

Third Box は旧社名（2025年6月に株式会社Opinio へ商号変更済み）。
ただし**社名が腐っているのではなく、行が2つある**状態。
`ow_company_tools` の動作確認用スタブとみられる（CLAUDE.md に company_id の記載あり）。

**DELETE も UPDATE もしない。** 非公開かつ中身が空なので実害はゼロ。

⚠️ **この行を公開しないこと。** 公開すると `company_joined` 投稿が生成され、
**存在しない社名でフィードに流れる**。しかも部分UNIQUEインデックスがあるため、
あとから社名を直しても投稿は作り直されない（本文は生成時の社名で固定される）。

社員を紐付けるときも `cf44d740` の方を使う。

### 部分UNIQUEインデックスは幽霊投稿に効かない

`idx_ow_posts_unique_job` などは `ref_* IS NOT NULL` を条件にしているため、
参照が外れた投稿は重複防止に効かない。
消した企業を再登録すると新しい投稿が作られ、古い幽霊と2件並ぶ形になる。
ただしビューが幽霊を落とすので**表示上は問題にならない**。事実として記録しておくだけ。
