-- ════════════════════════════════════════════════════════════════════════════
-- 会社ページの公開（一覧への掲載）を企業が自分で行えるようにする（2026-10-28 / 柴さんの判断）
--
-- ★変えること
--   ① CHECK check_listed_requires_approval（掲載中なら is_approved = true）を外す
--   ② trg_guard_company_approval の「未承認の企業は公開できない」を外す
--   ③ 代わりに、停止中（suspended_at IS NOT NULL）は企業が公開に戻せないようにする
--      エラー文言：「このページは運営により停止されています」
--   ④ 停止の列（suspended_* / unsuspend_requested_at）は運営だけが書ける。INSERT でも止める
--
-- ★変えないこと
--   ・is_approved の列は残す（企業は書き換えられないまま）。ただし公開の条件には使わない
--   ・必要な項目（業種・事業領域・従業員数・本社所在地）と掲載規約の同意はアプリが止める（checkPublishable）
--
-- ⚠️ 前提: 20261028120000_moderation_suspension.sql が先に当たっていること（suspended_at を参照する）
-- ⚠️ DROP FUNCTION は使わない（トリガーが依存）。CREATE OR REPLACE。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── ① CHECK を外す ─────────────────────────────────────────────────────────
alter table public.ow_companies drop constraint check_listed_requires_approval;

-- ── ②③④ ガードを差し替える ──────────────────────────────────────────────────
create or replace function public.guard_company_approval()
returns trigger
language plpgsql
set search_path = public   -- ⚠️ 今の定義と同じ（SECURITY INVOKER のまま）
as $$
BEGIN
  /* 運営の経路はそのまま通す。
     ⚠️ `/admin/companies` は admin クライアント（service_role）で更新する。
        RLS は迂回するが**トリガーは迂回しない**ので、ここで除外する。 */
  IF current_user = 'service_role' OR public.auth_is_admin() THEN
    RETURN NEW;
  END IF;

  /* ④ 停止の記録は運営だけ（作るときも、変えるときも） */
  IF TG_OP = 'INSERT' THEN
    IF NEW.suspended_at IS NOT NULL OR NEW.suspended_by IS NOT NULL OR NEW.suspension_reason IS NOT NULL
       OR NEW.suspended_prev_is_published IS NOT NULL OR NEW.suspended_prev_listing_status IS NOT NULL
       OR NEW.unsuspend_requested_at IS NOT NULL THEN
      RAISE EXCEPTION '停止の記録は運営だけが書けます' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION '企業の承認は運営が行います' USING ERRCODE = '42501';
  END IF;

  IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.suspended_prev_is_published IS DISTINCT FROM OLD.suspended_prev_is_published
     OR NEW.suspended_prev_listing_status IS DISTINCT FROM OLD.suspended_prev_listing_status
     OR NEW.unsuspend_requested_at IS DISTINCT FROM OLD.unsuspend_requested_at THEN
    RAISE EXCEPTION '停止の記録は運営だけが書けます' USING ERRCODE = '42501';
  END IF;

  /* ③ 停止中は公開に戻せない。⚠️ 非公開にする向き・内容の編集（draft_data など）は通す */
  IF OLD.suspended_at IS NOT NULL AND (
       (NEW.is_published IS DISTINCT FROM OLD.is_published AND NEW.is_published = true)
    OR (NEW.listing_status IS DISTINCT FROM OLD.listing_status AND NEW.listing_status = 'listed')
  ) THEN
    RAISE EXCEPTION 'このページは運営により停止されています' USING ERRCODE = '42501';
  END IF;

  /* ② 承認の有無では止めない（2026-10-28 までは未承認の企業の公開をここで止めていた） */
  RETURN NEW;
END
$$;

-- INSERT にも効かせる（それまでは BEFORE UPDATE だけ）
drop trigger trg_guard_company_approval on public.ow_companies;
create trigger trg_guard_company_approval
  before insert or update on public.ow_companies
  for each row execute function public.guard_company_approval();

-- ── 検算 ───────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'check_listed_requires_approval') then
    raise exception 'CHECK が残っている';
  end if;
  if (select count(*) from pg_trigger where tgname = 'trg_guard_company_approval' and not tgisinternal) <> 1 then
    raise exception 'トリガーが1本でない';
  end if;
  /* ⚠️ 行コメントとブロックコメントを落としてから見る（落とさないと注記に当たる。2026-10-28 に一度当たって止まった） */
  if regexp_replace(regexp_replace((select prosrc from pg_proc where proname = 'guard_company_approval'),
       '/\*.*?\*/', '', 'g'), '--[^' || chr(10) || ']*', '', 'g')
     like '%運営の承認が完了するまで公開できません%' then
    raise exception '承認のチェックが残っている';
  end if;
end $$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- 戻し方（未承認で掲載中の会社が無いことを確かめてから。あれば先に draft へ）
--   alter table ow_companies add constraint check_listed_requires_approval
--     check ((listing_status <> 'listed'::listing_status_enum) or (is_approved = true));
--   guard_company_approval を 2026-10-28 以前の本文（承認チェックあり）で CREATE OR REPLACE
--   トリガーは BEFORE UPDATE だけに戻す
-- ════════════════════════════════════════════════════════════════════════════
