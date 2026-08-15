-- ow_job_assignees_admin_manage → ow_job_assignees_member_manage（改名だけ）
--
-- ⚠️ **条件は1文字も変えていない。** 名前だけを実態に合わせる。
--
-- このポリシーは名前に admin と入っているが、条件は
--   「その求人の企業に **is_active な ow_company_admins 行がある人**」
-- で、`permission` を見ていない。つまり**管理者ではなくメンバー**が書ける。
--
-- ★実態のほうが正しい。求人の担当者を割り当てるのに管理者権限を要求する理由が無い
--   （3-2 で SELECT を `auth_is_company_member` にしたのと同じ判断）。
--   名前が admin を名乗っていると、次に読む人が
--   「管理者しか書けない」と誤読し、読みだけ厳しくする方向に直してしまう。

ALTER POLICY "ow_job_assignees_admin_manage" ON public.ow_job_assignees
  RENAME TO "ow_job_assignees_member_manage";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='ow_job_assignees'
                AND policyname='ow_job_assignees_admin_manage') THEN
    RAISE EXCEPTION '旧名が残っている。ロールバック';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='ow_job_assignees'
                    AND policyname='ow_job_assignees_member_manage' AND cmd='ALL') THEN
    RAISE EXCEPTION '新名の ALL ポリシーが無い。ロールバック';
  END IF;
  RAISE NOTICE '完了: 改名のみ（条件は変更なし）';
END $$;
