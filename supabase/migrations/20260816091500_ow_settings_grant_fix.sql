-- ow_settings: authenticated の SELECT を戻す（直前の migration の訂正）
--
-- ⚠️ **直前の `20260816090000` は締めすぎた。**
--    `authenticated` からも SELECT の GRANT を剥がしたので、**運営（admin）でも
--    PostgREST 経由では読めない**（403 permission denied）。実測で確認した:
--
--      ① anon                    401 42501
--      ② ログイン済みの一般利用者    403 42501
--      ④ 運営（admin）            403 42501   ← ★狙いと違う
--
--    GRANT はロール（authenticated）に対する門で、**RLS より手前**にある。
--    admin も authenticated ロールで来るので、ここで落とすと
--    ポリシー（`ow_settings_select_admin`）まで到達しない。
--
-- ⚠️ したがって「admin だけが読める」は
--      GRANT: anon は剥奪 / authenticated は付与
--      RLS  : USING (auth_is_admin())
--    の組み合わせで作る。`ow_user_educations` が既にこの形
--    （authenticated にテーブルレベル SELECT があり、own + admin のポリシーで絞る）。
--
-- ⚠️ 塞ぎ方の一般則としてもここに書き残す:
--    **「誰にも読ませない」は GRANT で、「誰に読ませるか」は RLS で書く。**
--    両方を GRANT でやると、ポリシーが死んだまま残って次に読む人を誤らせる。

GRANT SELECT ON public.ow_settings TO authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon','public.ow_settings','SELECT') THEN
    RAISE EXCEPTION 'anon の SELECT が復活している。ロールバック';
  END IF;
  IF NOT has_table_privilege('authenticated','public.ow_settings','SELECT') THEN
    RAISE EXCEPTION 'authenticated の SELECT が付いていない。ロールバック';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_settings'
                    AND policyname='ow_settings_select_admin') THEN
    RAISE EXCEPTION 'admin の SELECT ポリシーが無い。ロールバック';
  END IF;
  RAISE NOTICE '完了: anon は剥奪のまま / authenticated は GRANT あり / 実際の可否は RLS（admin のみ）';
END $$;
