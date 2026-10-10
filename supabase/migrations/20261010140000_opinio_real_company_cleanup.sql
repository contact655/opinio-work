-- ════════════════════════════════════════════════════════════════════════
-- 株式会社Opinio を実在の採用企業として整える（2026-10-10 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★作業前の控え: .dumps/20261010-2354-ow_company_admins-ow_companies-ow_jobs-ow_job_roles-ow_job_assignees-ow_roles.sql
--
-- ① hshiba@opinio.co.jp（検証用）を Opinio の担当者から外す（is_active = false。行は消さない＝戻せる）。
--    ⚠️ Third Box・【テスト】サンプルワークスの担当者は残す（この行だけを id で指定）。
-- ② Opinio の ow_companies.user_id（hshiba+01@third-box.jp。担当者ではない検証用アカウント）を空にする。
--    ⚠️ この列には `auth.uid() = user_id` の RLS（own_select / own_update）が付いており、入っていると
--       そのアカウントに会社データの読み書きを PostgREST から直接渡す。担当者の判定は ow_company_admins で行うので、
--       実在の担当者（s.hisato1020）に付け替えず **空**にした（アプリの検証を通らない書き込み口を増やさないため）。
-- ③ Opinio の検証用の求人3件（下書き・is_test）を消す。ぶら下がるのは ow_job_roles 3行だけ（CASCADE）。
--    応募・提案・声かけ・ブックマークなどの参照は0件（2026-10-10 実測）。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  -- ① 担当者
  update public.ow_company_admins set is_active = false
   where id = '110f42dd-3564-4e06-ad36-5b410bf63032'
     and company_id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'
     and user_id = 'fe7dfe9b-75d4-4a75-a821-fa1a9599a416'
     and is_active;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: hshiba の担当者行が % 行', n; end if;

  -- ② user_id
  update public.ow_companies set user_id = null
   where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'
     and user_id = 'e6196319-718d-41cf-a671-a023c8a3308c';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '想定外: Opinio の user_id 更新が % 行', n; end if;

  -- ③ 検証用の求人3件（id を明示。is_test・下書き・Opinio のものだけ）
  delete from public.ow_jobs
   where id in ('00218b4f-2565-46e0-8f2b-15a41601a8f3', '6b18cfad-6c3f-41ca-b0eb-3da7230572dc', '94c4d533-8413-4f94-bd1d-53cc0ace3d39')
     and company_id = 'cf44d740-b835-454d-91a3-f1e2eddc7251'
     and is_test and status = 'draft';
  get diagnostics n = row_count;
  if n <> 3 then raise exception '想定外: 消す求人が % 件', n; end if;

  -- 検算
  if exists (select 1 from public.ow_company_admins a join public.ow_users u on u.id = a.user_id
              where a.company_id = 'cf44d740-b835-454d-91a3-f1e2eddc7251' and a.is_active and u.is_test) then
    raise exception '検算失敗: Opinio に有効な検証用の担当者が残っている';
  end if;
  if not exists (select 1 from public.ow_company_admins a join public.ow_users u on u.id = a.user_id
                  where a.company_id = 'cf44d740-b835-454d-91a3-f1e2eddc7251' and a.is_active and not u.is_test) then
    raise exception '検算失敗: Opinio に実在の担当者がいない';
  end if;
  if (select count(*) from public.ow_company_admins a join public.ow_users u on u.id = a.user_id
       where u.email = 'hshiba@opinio.co.jp' and a.is_active) <> 2 then
    raise exception '検算失敗: hshiba の有効な担当者行（Third Box・サンプルワークス）が2行でない';
  end if;
  raise notice '検算OK';
end $$;

commit;

-- ★戻すとき:
--   update ow_company_admins set is_active = true where id = '110f42dd-3564-4e06-ad36-5b410bf63032';
--   update ow_companies set user_id = 'e6196319-718d-41cf-a671-a023c8a3308c' where id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
--   求人3件は控え（.dumps）から戻す
