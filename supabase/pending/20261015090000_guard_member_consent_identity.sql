-- ============================================================================
-- ow_company_members：本人以外が「同意済み」を作れないようにする（段階1）
-- ★★**未適用。柴さんの了承を得てから supabase/migrations/ へ移して当てる。**
--    （CLAUDE.md「本番 DB への書き込みは、適用の前に止まって了承を得る」）
-- ============================================================================
--
-- ── 何を塞ぐか ──────────────────────────────────────────────────────────────
-- ① ★**`user_id` / `company_id` の付け替え。** 2026-10-15 にポリシーを読んで見つけた
--    （**実行しての確認はしていない**。本番で試すと実在の行が変わるため）。
--
--      ・`company_admin_update_member`（UPDATE / authenticated）は
--         USING auth_company_can(company_id,'work') で、**WITH CHECK が無い**
--         ＝ 列の制限が無い（authenticated はテーブル単位で UPDATE を持つ）
--      ・`guard_member_consent` は **display_consent が変わるときだけ**本人確認をする
--
--    ⇒ 企業の担当者が PostgREST から、同じ会社の**同意済みの行**（自分のものでも、
--      同意した同僚のものでもよい）の `user_id` を別の社員に書き換えると、
--      display_consent は true のまま変わらないのでトリガーを通り、
--      **その社員が本人の同意なしに「面談OK」として公開される**
--      （画面に出る条件の「その会社に is_current の職歴がある」は、実在の社員なら満たす）。
--    ⚠️ 有料プランのゲートは API にしか無いので、**無料の企業でも通る形**。
--
--    → 付け替えは**誰にも許さない**。アプリで user_id / company_id を UPDATE している
--      コードは 0 件（2026-10-15 に src を検索）。行を作り直せば済む。
--
-- ② INSERT にもトリガーを掛ける。display_consent = true の行を作れるのは、
--    本人・service_role・OPINIO の運営だけ（UPDATE と同じ条件）。
--    RLS（member_self_apply / company_admin_invite_member）で既に塞がっているが、
--    **ポリシーを1本足しただけで開く**形なので、トリガーでも同じ線を引く。
--
-- ── 段階1で塞がないもの（★段階2の提案） ──────────────────────────────────
-- service_role の素通しは**残す**。招待の承諾（POST /api/mypage/ambassador-invite）と
-- 担当者の自己登録（POST /api/biz/ambassador/self-register）が admin クライアント
-- （service_role）で display_consent=true を書いているため、外すとこの2つが止まる。
-- ⇒ この2経路は、**アプリの判定**（lib/companyMembers/invite.ts ほか）が本体のまま。
-- ⚠️ 本人の登録（ambassador-self-register）と本人のオン/オフ（ambassador-visibility）は
--    **本人のセッション（authenticated）で書いている**ので、段階1の時点で DB が本人確認をしている
--    （2026-10-15 にコードを読み直して確認。初版のコメントは「4経路とも admin」と誤っていた）。
-- ⇒ 段階2（今回はやらない）: 上の2経路も本人のセッションで書く形に移してから、
--    service_role の素通しを外す。
--
-- ── 既存データ ─────────────────────────────────────────────────────────────
-- 行は1つも変えない（トリガーと関数の差し替えだけ）。
-- ⚠️ CREATE OR REPLACE を使う。DROP FUNCTION しない（トリガーが依存している）。
-- ⚠️ 戻し方: 下の「戻すとき」を当てる（関数は 20261015 以前の本文に戻る）。
-- ============================================================================

begin;

create or replace function public.guard_member_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ① 本人・会社の付け替えは誰にも許さない（service_role と運営も含む）
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.company_id is distinct from old.company_id then
      raise exception '面談対応者の本人・会社は変更できません（行を作り直してください）'
        using errcode = 'P0003';
    end if;
  end if;

  -- ② 同意の状態が変わる（INSERT で true を入れる場合を含む）
  if (tg_op = 'INSERT' and new.display_consent = true)
     or (tg_op = 'UPDATE' and new.display_consent is distinct from old.display_consent) then
    -- 本人以外は変更できない
    -- ⚠️ `auth.uid()`（auth 空間）ではなく `auth_ow_user_id()`（ow_users 空間）と比べる。
    if new.user_id is distinct from public.auth_ow_user_id()
       -- ⚠️ サーバー側（service_role）は許す（段階1）。呼び出し側が本人確認をしている。
       --    `SECURITY DEFINER` の中では `current_user` が所有者に化けるので使わない。
       and coalesce(auth.role(), '') <> 'service_role'
    then
      -- OPINIO の運営は例外（サポート対応のため）
      -- ⚠️ `ow_user_roles.user_id` は auth 空間なので `auth.uid()` のままが正しい。
      if not exists (
        select 1 from ow_user_roles
        where ow_user_roles.user_id = auth.uid()
          and ow_user_roles.role = 'admin'
      ) then
        raise exception '面談対応者の公開同意は、本人のみが変更できます'
          using errcode = 'P0003';
      end if;
    end if;

    -- 同意した日時を記録する。⚠️ 取り下げても消さない（意味は「最後に同意した日時」）
    if new.display_consent = true then
      if tg_op = 'UPDATE' or new.consent_at is null then
        new.consent_at := now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- INSERT にも掛ける（トリガーを張り替える。関数は消さない）
drop trigger if exists trg_guard_member_consent on public.ow_company_members;
create trigger trg_guard_member_consent
  before insert or update on public.ow_company_members
  for each row execute function public.guard_member_consent();

-- 検算
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.ow_company_members'::regclass
       and tgname = 'trg_guard_member_consent'
       and (tgtype & 4) <> 0   -- INSERT
       and (tgtype & 16) <> 0  -- UPDATE
  ) then
    raise exception 'trg_guard_member_consent が INSERT/UPDATE に掛かっていない';
  end if;
end $$;

commit;

-- ── 戻すとき ───────────────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists trg_guard_member_consent on public.ow_company_members;
-- create trigger trg_guard_member_consent before update on public.ow_company_members
--   for each row execute function public.guard_member_consent();
-- -- 関数本文は 20261015 以前のもの（`pg_get_functiondef` を作業前ダンプで保存しておくこと）
-- commit;
