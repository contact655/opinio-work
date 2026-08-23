-- プロフィールURL用 username の形式を DB でも縛る（2026-08-23）
--
-- 形式: 先頭は英字、以降は小文字英数字と _、3〜30文字
--   ^[a-z][a-z0-9_]{2,29}$
--
-- ⚠️ **`src/lib/constants/username.ts` の `USERNAME_PATTERN` と同じ式。**
--    CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
--    片方だけ変えると「入力できるのに保存できない」か「保存できるのに絞れない」になる。
--
-- ⚠️ **ハイフンを許さないのは意図的。** UUID にはハイフンが入るので、
--    禁じておくと username と UUID の名前空間が絶対に衝突しない。
--    `/u/[id]` は両方を受けるため、この性質に依存している。
--
-- ⚠️ **先頭を英字に限るのも意図的。** 既存の username は UUID の先頭8桁
--    （`0c99e403` など）で、数字始まりを禁じると
--    新しく「UUID の断片に見える username」を作れなくなる。
--
-- ⚠️ **NOT VALID で入れる。** 既存12件はこの形式を満たさない（数字始まり）。
--    既存行は検証せず、**新しく入れる値・更新する値だけ**を縛る。
--    ⚠️ 既存値を機械的に書き換えないこと。共有済みのURLが死ぬ。
--    ⚠️ 将来 VALIDATE CONSTRAINT する場合は、先に既存値の移行方針を決めること。
--
-- ⚠️ 予約語（admin / api / mypage など）は**ここに入れない**。
--    ルートが増えるたびに migration を書く運用になるため、
--    `RESERVED_USERNAMES`（TypeScript 側）で弾く。書き込む経路は
--    `PUT /api/jobseeker/profile` の1つだけ。
--
-- ⚠️ 一意性は既存の `ow_users_username_unique` に任せる。
--    CHECK が小文字だけを許すので、大文字違いの重複は原理的に発生しない。
--    `lower(username)` の索引を追加しない（冗長な索引を増やさない。
--     2026-08-23 に冗長索引18本を落としたばかり）。

alter table public.ow_users
  add constraint ow_users_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,29}$')
  not valid;

comment on constraint ow_users_username_format on public.ow_users is
  'プロフィールURL用。先頭英字＋小文字英数字と_ の3〜30文字。既存のUUID断片を残すため NOT VALID。式は src/lib/constants/username.ts と揃える';
