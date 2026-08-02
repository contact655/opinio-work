-- LP の FV「いま話を聞ける現役社員」で引用文として表示される talk_themes を更新する。
-- FV は talk_themes の先頭要素だけを表示する。
--
-- 対象は ow_users にアカウントがある2名のみ。
-- 金澤 啓太郎・山崎 華奈は本人のアカウントが無く、掲載同意は「表示してよい」という同意で
-- あってアカウント作成の同意ではないため、ow_users には登録しない。
-- 表示用データは src/app/(jobseeker)/page.tsx の LP_GUEST_MEMBERS で持つ。
-- 経緯: 運営が作った ow_users 行を本人が後から引き継ぐ経路が求職者導線に無く、
--       同じ email でサインアップすると trigger の ON CONFLICT DO NOTHING で握り潰され、
--       ow_users 行が紐づかないまま認証だけ通る状態になる。

-- 生藤さんには既存テーマが4件あるため、指定文言を先頭に足して既存は残す。
-- array_remove で既存の同一要素を除いてから先頭に付けるので、再実行しても重複しない。
UPDATE ow_company_members
SET talk_themes = ARRAY['外資SaaSのCRM営業']
                  || COALESCE(array_remove(talk_themes, '外資SaaSのCRM営業'), ARRAY[]::text[]),
    updated_at  = now()
WHERE user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';   -- 生藤 弘樹（セールスフォース・ジャパン）

UPDATE ow_company_members
SET talk_themes = ARRAY['SIerの金融ソリューション営業']
                  || COALESCE(array_remove(talk_themes, 'SIerの金融ソリューション営業'), ARRAY[]::text[]),
    updated_at  = now()
WHERE user_id = 'b51fc35e-776a-425e-876f-dcb2005c4389';   -- 木村 雅樹（伊藤忠テクノソリューションズ）
