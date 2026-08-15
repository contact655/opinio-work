# 宿題（日付の付かない置き場）

⚠️ **日付入りのスナップショット（`current-state-YYYYMMDD.md` など）に宿題を書かないこと。**
   次の版が出た時点で読まれなくなる。恒久的な宿題はこのファイルに集める。

書くときは「対象」「なぜ残っているか」「やるなら何をするか」の3つを入れる。
片付いたら行ごと消す（済みの一覧にしない。履歴は git にある）。

---

## 宿題: avatar_color / cover_color に値の検証が無い（2026-08-15 記録）

`PUT /api/jobseeker/profile` の `avatar_color` / `cover_color` は、
**100字以内の任意の文字列を受け取る**。CSS の値としてそのまま
`style` に埋まるため、本来はホワイトリスト（既定のグラデーション一覧）で
検証すべき列。

2026-08-15 の空入力正規化では**空→null だけを揃え、形式の検証は入れていない**。
入力UIは色の選択肢しか出さないので現状の実害は無いが、API を直接叩けば任意の値が入る。

対象: `ow_users.avatar_color` / `ow_users.cover_color`（どちらも 2026-08-15 時点で `''` は0件）

---

## 宿題: プロフィール画像・カバーに圧縮 / リサイズ / サイズ上限が無い（2026-08-15 記録）

**対象**: `/profile/edit` のアップロード（`ProfileEditClient.tsx` の `uploadPhoto`）。
バケットは `ow-uploads`、パスは `users/{avatars|covers}/{owUserId}/{Date.now()}.{ext}`。

**なぜ残っているか**: クライアントが `File` をそのまま `supabase.storage.upload` に渡しており、
**圧縮・リサイズ・サイズ上限のチェックがコード上に1つも無い**。
スマホで撮った数MBの写真がそのまま公開プロフィールに載る。

**やるなら**: アップロード前にクライアントで長辺をリサイズ（Canvas か `createImageBitmap`）し、
上限（例: 5MB）を超えるものは弾く。**弾いたことを画面に出す**（黙って落とさない）。

---

## 宿題: `social_links` の空文字がキーごと残る（2026-08-15 記録）

**対象**: `PUT /api/jobseeker/profile` の `social_links`（`ow_users.social_links` / JSONB）。

**なぜ残っているか**: 2026-08-15 に空入力を null へ寄せた（`lib/api/normalize.ts`）が、
対象は **text 列だけ**で JSONB は素通し（`patch.social_links = body.social_links as Json | null`）。
SNS の入力を空にして保存すると `null` ではなく **`{"x": ""}`** が残る（実測）。
表示側は truthy 判定なので画面は無事だが、キー存在判定（`social_links ? 'x'`）や
充填率の集計は誤る。

**やるなら**: 空文字の値を持つキーを落とし、全キーが空になったら列ごと null にする。
正規化は `normalize.ts` に足し、`profile/route.ts` がそれを通る形にする
（route に if を書き足さない）。既存データの掃除は**別コミットの migration**。

---

## 希望条件（転職の希望タブ）だけ自動保存のまま — フェーズ3で回収する

**対象**: `/profile/edit` の「転職の希望」タブ（`savePreferences` / `PUT /api/jobseeker/career-preferences`）。

チェックした瞬間に PUT される自動保存で、**他のカードだけが「保存」ボタン方式**になっている
（2026-08-15 のカード化で基本情報・職歴・学歴などはボタンに揃えた）。

**なぜ今直さないか**: 保存の作法を揃えるのは**カード単位保存に統一するフェーズ3の本体そのもの**。
ここだけ先に変えると、フェーズ3で同じ場所をもう一度触ることになる。

⚠️ 直すときは「保存していないのに完成度が上がる」形にしないこと。
   完成度はローカル state（`hasPrefs`）から出しているので、
   ボタン方式にすると**保存前に % が動く**状態が残る。あわせて見直す。

---

## 写真を削除しても Storage のオブジェクトが残る

**対象**: `DELETE /api/jobseeker/profile-photo`（`/profile/edit` の「削除」）。

`ow_users.avatar_url` / `cover_photo_url` は null になるが、**`ow-uploads` バケットの
実ファイルは残る**（2026-08-15 に検証で実測。1x1 PNG を上げて削除 →
`users/avatars/<id>/` にファイルが残っていた）。差し替えのたびに孤児が積もる。

⚠️ 消す実装を入れるときは、**URL からパスを復元して消す**形にすること
（`avatar_url` は publicUrl なので、バケット名以降を切り出す）。
別ユーザーのパスを消せないよう、`users/avatars/<自分の id>/` で始まることを必ず確認する。

---

## RLS が `USING(true)` かつ anon に SELECT がある テーブル一覧（2026-08-15 実測）

**この形は今回で3例目**（学歴 2026-08-06 → 実績3種＋発信コンテンツ 2026-08-15）。
残りが何件あるかを一度数えた。25件のうち **7件を塞いだので残り18件**
（20260815130000 で実績3種＋発信コンテンツ、20260815140000 で posts / post_likes / experience_roles）。

⚠️ **塞ぎ方は1つではない。** 「本人だけが見るもの」は own + admin、
   **「他人が読む前提のもの」は authenticated**（ログイン済みなら読める）。
   一律に own を当てると、フィードのように他人の行を読む画面が静かに空になる。
   **いいね数のような集計は、読める範囲が狭いと数字だけが小さくなる。**

判定に使ったクエリ:

```sql
with t as (select c.relname as tablename from pg_class c
             join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relkind='r' and c.relname like 'ow_%'),
     pol as (select tablename, bool_or(cmd='SELECT' and qual='true') as select_true
               from pg_policies where schemaname='public' group by tablename)
select t.tablename from t join pol p using (tablename)
 where p.select_true and has_table_privilege('anon','public.'||quote_ident(t.tablename),'SELECT');
```

⚠️ `information_schema.role_table_grants` は（実行ロールの都合で）空を返すことがある。
   **`has_table_privilege` を使う。**

| テーブル | 行数 | 個人データ | 備考 |
|---|---|---|---|
| ~~`ow_user_achievements`~~ | 0 | ✅ | **塞いだ**（20260815130000） |
| ~~`ow_user_awards`~~ | 0 | ✅ | **塞いだ** |
| ~~`ow_user_media_appearances`~~ | 0 | ✅ | **塞いだ** |
| ~~`ow_user_content_links`~~ | 0 | ✅ | **塞いだ** |
| ~~`ow_posts`~~ | 170 | ✅ | **塞いだ**（20260815140000）。★own ではなく **authenticated**（フィードは他人の投稿を読む画面） |
| ~~`ow_post_likes`~~ | 1 | ✅ | **塞いだ**。★同じく authenticated。own にすると**いいね数が静かに変わる** |
| `ow_post_comments` | 0 | ✅ | 誰が何にコメントしたか。**未対応**（0件のうちに塞ぐ。形は post_likes と同じはず） |
| ~~`ow_experience_roles`~~ | 6 | ✅ | **塞いだ**。★こちらは own（親 experience 経由）+ admin。読み取り経路が0件で、親より広いのは筋が通らないため |
| `ow_experience_stories` | 0 | ✅ | 経歴のストーリー |
| `ow_user_socials` | 0 | ✅ | 未使用テーブル（`ow_users.social_links` が現役） |
| `ow_articles` | 16 | — | 公開記事。公開が正しい |
| `ow_roles` / `ow_role_aliases` | 154 / 260 | — | 職種マスター。公開が正しい |
| `ow_schools` | 37 | — | 学校マスター。公開が正しい |
| `ow_tool_masters` | 78 | — | ツールマスター。公開が正しい |
| `ow_job_roles` | 20 | — | 求人の職種 |
| `ow_company_tools` | 9 | — | 企業の利用ツール |
| `ow_company_culture_tags` / `ow_company_office_photos` / `ow_company_segments` | 各0 | — | 企業側の公開情報 |
| `ow_job_assignees` | 0 | ⚠️ | 求人の担当者。**企業の内部情報**。行が入る前に見直す |
| `ow_job_matching_tags` / `ow_job_requirements` | 各0 | — | 求人の付帯情報 |
| `ow_story_sections` | 0 | — | 記事のセクション |
| `ow_settings` | 0 | ⚠️ | 運営設定。**行が入る前に見直す** |

**優先度**: 行数 × 個人データの有無で見る。
1. `ow_posts`（170行・個人データ・現に読める）
2. `ow_experience_roles`（6行・経歴の一部）／`ow_post_likes`（1行）
3. 0件のもの（`ow_job_assignees` / `ow_settings` / `ow_user_socials` /
   `ow_experience_stories` / `ow_post_comments`）は**書かれ始める前に**塞ぐ。
   ⚠️ `ow_post_comments` は post_likes と同じ理由で **authenticated** にすること
   （コメント数を他人も数える）

⚠️ 塞ぐときは**読み取り経路を先に確認する**。session クライアントで他人の行を読んでいる
   画面があると、RLS を own+admin にした瞬間に **HTTP 200 のまま中身だけ消える**
   （今回 `/u/[id]` の4クエリがこれに該当し、admin クライアントへ差し替えた）。
