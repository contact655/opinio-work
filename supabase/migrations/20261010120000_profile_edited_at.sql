-- ════════════════════════════════════════════════════════════════════════
-- 本人がプロフィールを最後に編集した日時（2026-10-10 / 候補者探し 段1）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★何に使うか: 候補者検索のカードの「プロフィールの更新日」と、保存した条件の「新着」（段3）。
--
-- ★動かす条件（柴さんの判断）: **本人が編集する内容**（職歴・学歴・自己紹介・スキルなど、
--   企業に見えるプロフィールの中身）を、**本人のセッションで**変えたときだけ。
--   ⚠️ 運営の修正（/admin は service_role）・migration（postgres）・ログイン（auth_linked_at 等）では動かない。
--   ⚠️ `ow_users.updated_at` を使わない理由がこれ（運営の修正でも動く）。
--
-- ★判定: `auth.role() = 'authenticated'` かつ、その行の持ち主が `auth.uid()` 本人。
--   本人の編集の API（/api/jobseeker/*）はセッションのクライアントで書いている（2026-10-10 に全数確認）。
--   ⚠️ 管理用のクライアントで書いている経路（職歴の複数職種 ow_experience_roles など）は数えない。
--      職歴そのものの追加・更新はセッションで書くので、そちらで動く。
--
-- ★書き込みの権限: この列は anon / authenticated に GRANT しない（本人が直接書き換えられない）。
--   書くのはトリガーだけ。
--
-- ★既存の行は埋めない（NULL＝記録なし）。それらしい日時で埋めない（推測値を入れない）。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_users add column if not exists profile_edited_at timestamptz;
comment on column public.ow_users.profile_edited_at is
  '本人がプロフィールの中身を最後に編集した日時（2026-10-10）。本人のセッションの編集だけで動き、運営の修正・ログインでは動かない。トリガーだけが書く。NULL は記録なし（2026-10-10 より前に編集した人も NULL）';

-- ── ① ow_users の内容の列（BEFORE UPDATE で自分の行に書く）─────────────────────────
create or replace function public.ow_users_mark_profile_edited()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(auth.role(), '') = 'authenticated' and new.auth_id is not null and new.auth_id = auth.uid()
     and (new.name is distinct from old.name
       or new.family_name is distinct from old.family_name
       or new.given_name is distinct from old.given_name
       or new.headline is distinct from old.headline
       or new.about_me is distinct from old.about_me
       or new.future_aspirations is distinct from old.future_aspirations
       or new.location is distinct from old.location
       or new.social_links is distinct from old.social_links
       or new.avatar_url is distinct from old.avatar_url
       or new.cover_photo_url is distinct from old.cover_photo_url
       or new.catchphrase is distinct from old.catchphrase) then
    new.profile_edited_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_ow_users_mark_profile_edited on public.ow_users;
create trigger trg_ow_users_mark_profile_edited
  before update on public.ow_users
  for each row execute function public.ow_users_mark_profile_edited();

-- ── ② 子の表（職歴・学歴・スキルなど）。⚠️ ow_users を書くので SECURITY DEFINER ────────
--   TG_ARGV[0] = 'ow'（user_id が ow_users.id）／ 'auth'（user_id が auth.users.id）
create or replace function public.touch_profile_edited()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or auth.uid() is null then
    return null;
  end if;
  if tg_op = 'DELETE' then v_uid := old.user_id; else v_uid := new.user_id; end if;
  if v_uid is null then return null; end if;
  if tg_argv[0] = 'auth' then
    update public.ow_users set profile_edited_at = now() where auth_id = v_uid and auth_id = auth.uid();
  else
    update public.ow_users set profile_edited_at = now() where id = v_uid and auth_id = auth.uid();
  end if;
  return null;
end;
$function$;
revoke execute on function public.touch_profile_edited() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['ow_experiences','ow_user_educations','ow_user_skills','ow_user_certifications',
                           'ow_user_achievements','ow_user_awards','ow_user_languages',
                           'ow_user_media_appearances','ow_user_content_links'] loop
    execute format('drop trigger if exists trg_%s_touch_profile_edited on public.%I', t, t);
    execute format('create trigger trg_%s_touch_profile_edited after insert or update or delete on public.%I for each row execute function public.touch_profile_edited(%L)', t, t, 'ow');
  end loop;
end $$;

-- 関心のある職種（auth 空間）
drop trigger if exists trg_ow_profile_desired_roles_touch_profile_edited on public.ow_profile_desired_roles;
create trigger trg_ow_profile_desired_roles_touch_profile_edited
  after insert or update or delete on public.ow_profile_desired_roles
  for each row execute function public.touch_profile_edited('auth');

-- 希望（勤務地・働き方・年収）。⚠️ 転職意欲・声かけの受け取り・お知らせの設定では動かさない
drop trigger if exists trg_ow_profiles_touch_profile_edited on public.ow_profiles;
create trigger trg_ow_profiles_touch_profile_edited
  after update on public.ow_profiles
  for each row
  when (old.desired_work_styles is distinct from new.desired_work_styles
     or old.desired_prefectures is distinct from new.desired_prefectures
     or old.desired_salary_min is distinct from new.desired_salary_min
     or old.desired_salary_max is distinct from new.desired_salary_max)
  execute function public.touch_profile_edited('auth');

-- ── 検算 ──────────────────────────────────────────────────────────────────
do $$
begin
  if has_column_privilege('authenticated', 'public.ow_users', 'profile_edited_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.ow_users', 'profile_edited_at', 'SELECT')
     or has_column_privilege('anon', 'public.ow_users', 'profile_edited_at', 'SELECT') then
    raise exception '検算失敗: クライアントのロールから読める・書ける';
  end if;
  if (select count(*) from pg_trigger where tgname like 'trg_%touch_profile_edited' and not tgisinternal) <> 11 then
    raise exception '検算失敗: トリガーの数が 11 ではない';
  end if;
  raise notice '検算OK: profile_edited_at と 12 本のトリガー（ow_users ＋ 子の表 11）';
end $$;

commit;

-- ★戻すとき:
--   drop trigger ... （上の 12 本）; drop function public.touch_profile_edited(); drop function public.ow_users_mark_profile_edited();
--   alter table public.ow_users drop column profile_edited_at;
