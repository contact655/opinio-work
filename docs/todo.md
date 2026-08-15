# 宿題（日付の付かない置き場）

⚠️ **日付入りのスナップショット（`current-state-YYYYMMDD.md` など）に宿題を書かないこと。**
   次の版が出た時点で読まれなくなる。恒久的な宿題はこのファイルに集める。

書くときは「対象」「なぜ残っているか」「やるなら何をするか」の3つを入れる。
片付いたら行ごと消す（済みの一覧にしない。履歴は git にある）。

---

## avatar_color / cover_color に値の検証が無い（2026-08-15 記録）

**対象**: `PUT /api/jobseeker/profile` の `avatar_color` / `cover_color`
（`ow_users` の2列。どちらも 2026-08-15 時点で `''` は0件）。

**なぜ残っているか**: **100字以内の任意の文字列**を受け取っている。
CSS の値としてそのまま `style` に埋まる列なのに、形式の検証が無い。
2026-08-15 の空入力正規化では**空→null だけを揃え、検証は入れていない**。
入力UIは色の選択肢しか出さないので現状の実害は無いが、API を直接叩けば任意の値が入る。

**やるなら**: 既定のグラデーション一覧をホワイトリストにして、外れた値は **400**
（黙って既定色に落とさない）。⚠️ 許容値は `src/lib/constants/` の1箇所に置き、
UI と API が同じ定数を見る（CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。

---

## プロフィール画像・カバーに圧縮 / リサイズ / サイズ上限が無い（2026-08-15 記録）

**対象**: `/profile/edit` のアップロード（`ProfileEditClient.tsx` の `uploadPhoto`）。
バケットは `ow-uploads`、パスは `users/{avatars|covers}/{owUserId}/{Date.now()}.{ext}`。

**なぜ残っているか**: クライアントが `File` をそのまま `supabase.storage.upload` に渡しており、
**圧縮・リサイズがコード上に1つも無い**。スマホで撮った数MBの写真がそのまま公開プロフィールに載る。

⚠️ **サイズ上限は「無い」ではなく「バケット側にある」**（2026-08-15 実測で訂正）。
   `ow-uploads` は `file_size_limit = 5 MiB`、`allowed_mime_types` は jpeg/png/webp/gif。
   超えるとアップロードは失敗するが、**画面には何も出ない**のが問題。

**やるなら**: アップロード前にクライアントで長辺をリサイズ（Canvas か `createImageBitmap`）し、
上限（例: 5MB）を超えるものは弾く。**弾いたことを画面に出す**（黙って落とさない）。

---

## `social_links` の空文字がキーごと残る（2026-08-15 記録）

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

## ow-uploads の孤児ファイル 100件（企業ロゴ以外）

**対象**: `ow-uploads` バケットのうち、DB のどの列からも参照されていないファイル。
2026-08-15 に削除の実装とパス限定のポリシーを入れたので**これ以上は増えない**。
残っているのは過去分。

| 場所 | 件数 | サイズ | 中身 |
|---|---|---|---|
| `mentors/photos/` | 12 | 6.7 MB | **メンター機能ごと廃止済み**（`ow_mentors` は DROP 済み）。消してよい |
| `companies/logos/` | 87 | 4.7 MB | → **別項目**（下の「企業ロゴ」を見る。消すのが本筋ではない） |
| `companies/office-photos/` | 1 | 300 kB | 参照されていない1枚 |

**なぜ残っているか**: 個人の写真ではないので急がない。
`users/` 配下の孤児1件（利用者のカバー写真）は 2026-08-15 に削除済み。

**やるなら**: `mentors/photos/` の12件と `companies/office-photos/` の1件を消す。
⚠️ **突き合わせは URL のクエリ文字列を落としてから行うこと。**
   2026-08-15 に `?t=…` 付きの URL を「参照なし」と誤判定し、
   **実在する利用者のアバターを孤児と数えた**（削除前の再確認で気づいた）。

```sql
-- 正しい突き合わせ（クエリを落とす）
split_part(split_part(url,'?',1),'#',1)
```

---

## 企業ロゴ87件がアップロード済みなのに使われていない

**対象**: `ow-uploads` の `companies/logos/`（87ファイル・4.7 MB）と `ow_companies.logo_url`。

**なぜ残っているか**: ロゴはアップロードされているのに、`logo_url` は
**死んだ Clearbit の URL を指したまま**（CLAUDE.md「logo_url は 76社すべて
`logo.clearbit.com` で、ホストは名前解決すらしない」）。
画面は `CompanyLogo` が Google favicon にフォールバックして凌いでいる。

⚠️ **「孤児だから消す」ではない。** アップロード済みのロゴを `logo_url` が
   指すようにするのが本筋。消すと、正しい向きに直す材料が無くなる。

**やるなら**: `companies/logos/{company_id}/` の最新ファイルを `logo_url` に入れる
migration を書く。⚠️ 企業ごとに対応が取れているかを先に確かめること
（フォルダ名の company_id が実在するか、1社に複数ある場合どれが最新か）。
それでも残るファイル（対応する企業が無い等）だけを、上の孤児掃除に回す。

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

---

## 希望勤務地（`desired_prefectures`）がマッチングに使われていない（2026-08-15 記録）

**対象**: `ow_profiles.desired_prefectures`（2026-08-15 のフェーズ2で追加）。
入力は `/profile/edit` の「希望勤務地・勤務スタイル」カード、
表示は `/biz/candidates` の候補者カード（「希望勤務地: 東京都・神奈川県」）。

**なぜ残っているか**: **入力させて表示までしているのに、絞り込みにも推薦にも使っていない。**
実測（2026-08-15）:
- `src/lib/matching/scoreJob.ts` の軸は **職種48 / 年収30 / フェーズ24 / 勤務形態18 の4つだけ**で、
  **勤務地の概念が無い**（`desired_prefectures` を1度も読んでいない）
- `/biz/candidates` は `desired_prefectures` を select して**表示しているだけ**。
  絞り込みの条件には入っていない

⚠️ この状態を放置すると「入力させたのに使われない」になる（CLAUDE.md の禁止事項）。
   列と入力欄が先にできているぶん、忘れると気づけない。

**やるなら**（3つセットで考える）:
1. `scoreJob` に**勤務地の軸を新設**する。⚠️ 重みは4軸の合計と `MIN_SCORE`（30）に影響するので、
   足すだけでなく既存の重みを見直すこと。理由文（`reasonParts`）も1行足す
2. ★**「フルリモートは全都道府県を対象にするか」をそこで決める。**
   決めずに実装すると、フルリモート希望者が勤務地の軸で必ず減点される
   （`desired_work_styles` に `full_remote` を持つ人の扱い）
3. `/biz/candidates` の絞り込みに `desired_prefectures` を足す（今は表示のみ）

⚠️ 求人側の勤務地は `ow_jobs.location`（自由文字列）で、都道府県の正規化がされていない。
   軸を作る前に、求人側の値が都道府県として突き合わせられる形かを先に確かめること。
