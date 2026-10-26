-- ════════════════════════════════════════════════════════════════════════
-- メールアドレスを小文字で保存することを DB で保証する（2026-10-26 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★きっかけ: 担当者の招待（POST /api/biz/members/invite）のメール照合を、パターン照合（ilike）から
--    **小文字の完全一致**に変えた（ilike だと「*@*.*」で他人のメールに当たったため）。
--    完全一致は「保存されているメールが全部小文字」が前提なので、それを DB で保証する。
--
-- 対象（照合に使う列だけ）:
--    ow_users.email                    … 招待の照合・ログイン時の紐付け（linkOwUser.ts）
--    ow_company_admins.invited_email   … 招待の承諾の照合（accept/route.ts）
--   ⚠️ 問い合わせ・応募・面談の連絡先（ow_contact_submissions.email など）は照合に使っていないので対象外。
--      付けると、大文字まじりで入力した人のフォーム送信が 500 で落ちるようになる（書き込み側を全部直すまで付けない）。
--
-- ★あわせて、サインアップ時に ow_users を作るトリガー（handle_new_ow_user）でも lower() を通す。
--    auth.users.email は今は全行小文字だが、ここが CHECK に引っかかると **auth.users の INSERT ごと失敗し、
--    サインアップが止まる**ので、トリガーの側で必ず小文字にしておく。
--    ⚠️ DROP FUNCTION にしないこと（on_auth_user_created が依存している）。CREATE OR REPLACE で email の式だけ変える。
--
-- 作業前の実測（2026-10-26）: 小文字以外を含む行
--    ow_users.email 0 / 101行、ow_company_admins.invited_email 0 / 1行（23行は NULL）、auth.users.email 0 / 103行
-- 作業前の控え: .dumps/20261026-1625-ow_users-ow_workplace_reviews.sql ／ .dumps/20261026-1655-ow_company_admins.sql
-- データは変えない（制約とトリガーの関数だけ）。
-- 戻し方:
--    alter table public.ow_users drop constraint ow_users_email_lowercase;
--    alter table public.ow_company_admins drop constraint ow_company_admins_invited_email_lowercase;
--    （トリガーは lower() を外した元の式に戻す。元の全文はこのファイルの末尾）
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare a int; b int;
begin
  select count(*) into a from public.ow_users where email is distinct from lower(email);
  select count(*) into b from public.ow_company_admins where invited_email is not null and invited_email <> lower(invited_email);
  if a <> 0 or b <> 0 then
    raise exception '小文字以外のメールがある（ow_users % 行 / invited_email % 行）。先に確かめること', a, b;
  end if;
end $$;

alter table public.ow_users
  add constraint ow_users_email_lowercase check (email = lower(email));

alter table public.ow_company_admins
  add constraint ow_company_admins_invited_email_lowercase check (invited_email is null or invited_email = lower(invited_email));

CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ow_users
  -- ★2026-10-26: email は lower() を通す。ow_users_email_lowercase（CHECK）に引っかかると
  --   auth.users の INSERT ごと失敗してサインアップが止まるため。
  INSERT INTO public.ow_users (
    auth_id, email, name, created_at, updated_at
  )
  VALUES (
    NEW.id, lower(NEW.email),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      -- 2026-09-17: ここは split_part(NEW.email, '@', 1) だった。
      -- 本人が入力していない個人情報（メールアドレスの一部）が ow_users.name に入り、
      -- /people・企業ページ・/u/[id]・フィードに出ていた。
      -- 踏むのは名前を渡さない経路（招待・マジックリンク）。
      -- NULL にはできない（ow_users.name は NOT NULL。落とすとサインアップが止まる）。
      -- 'ユーザー' は src/lib/auth/linkOwUser.ts と揃えている。
      -- 片方を変えるときは、もう片方も変えること。
      'ユーザー'
    ),
    NOW(), NOW()
  )
  -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
  ON CONFLICT (email) DO NOTHING;

  -- ow_profiles（2026-08-04 追加）
  -- ⚠️ user_id は auth.users.id（ow_users.id ではない）。FK もそちらを向いている。
  -- ⚠️ ここが例外を投げると auth.users の INSERT ごと失敗し、サインアップが止まる。
  --    ow_profiles に NOT NULL かつ既定値なしの列を足さないこと。
  INSERT INTO public.ow_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ★トリガーが付いたままであること（作り直していないので付いているはず）
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgfoid = 'public.handle_new_ow_user'::regproc) then
    raise exception 'on_auth_user_created が handle_new_ow_user に付いていない';
  end if;
end $$;

commit;

-- 元のトリガー関数の本文（戻すとき用）は、VALUES の NEW.email が lower() なしだった点だけが違う。
-- 2026-10-26 時点の全文は 20260917090000 以降の版で、ow_profiles の INSERT のコメントに
-- 「scout_enabled は書かない」の一文があった（scout_enabled の列は 2026-10-08 に DROP 済みなので削った）。
