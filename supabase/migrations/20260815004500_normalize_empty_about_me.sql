-- ow_users.about_me の空文字を null に寄せる
--
-- 2026-08-15 に API 側で「空入力は null」に揃えた（lib/api/normalize.ts）。
-- それ以前に PUT /api/jobseeker/profile が `''` をそのまま保存していたため、
-- 1行だけ `''` が残っている。表示側は truthy 判定なので画面の実害は無いが、
-- `count(about_me)` のような充填率の集計が「入力済み」と数えてしまう。
--
-- ⚠️ 対象は about_me = '' の行のみ。他の列・他の条件を混ぜない。
-- ⚠️ 実行前の実測（2026-08-15）: about_me = '' が 1件 / null が 28件。
--    他の text 列（name / location / future_aspirations / catchphrase /
--    avatar_url / cover_photo_url / avatar_color / cover_color / username）は
--    '' が 0件であることを確認済み。ここでは触らない。

update ow_users
   set about_me = null
 where about_me = '';
