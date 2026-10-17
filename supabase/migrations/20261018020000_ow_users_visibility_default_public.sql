-- ★新しく登録する人のプロフィールの公開範囲を、初期値「公開」にする（2026-10-18 作成 / 柴さんの判断）
--
-- ★利用規約 第7条3項・プライバシーポリシー 5-2 の改定（2026-10-18 効力発生。既存の利用者全員から個別に同意済み / 柴さん確認）に合わせて当てる。
-- ★同じ日に出したコード:
--    src/middleware.ts（/u/ をログイン必須から外す）／ src/app/robots.ts（/u/ の Disallow を外す）／
--    src/app/(jobseeker)/u/[id]/page.tsx（「公開」だけ index・未ログインで「公開」以外はログインへ）／
--    src/components/profile/view/UserProfileContent.tsx（未ログインにアクティビティを出さない）／
--    src/app/onboarding/OnboardingClient.tsx（登録の画面で初期設定を明示）／
--    src/app/biz/employees/EmployeesClient.tsx（招待文の「見えるのはログインしている人だけ」を外す）
--
-- ⚠️★既存の利用者の値は変えない。列の初期値を変えるだけなので、この migration の後に作られる行だけが「公開」になる。
--    既存の人を「公開」にするのは、本人が設定で選んだときだけ（規約 第7条2項「ユーザーは…選択することができます」）。
-- ⚠️ 行はトリガー handle_new_ow_user が作るが、visibility を書いていない（20260917090000 で確認済み）ので、
--    この初期値がそのまま効く。src/lib/auth/linkOwUser.ts も visibility を書かない（2026-09-16）。
--
-- 戻し方: alter table public.ow_users alter column visibility set default 'login_only';

begin;

do $$
declare v text;
begin
  select column_default into v from information_schema.columns
   where table_schema = 'public' and table_name = 'ow_users' and column_name = 'visibility';
  if v is distinct from '''login_only''::text' then
    raise exception '想定と違う初期値: %。中止する', v;
  end if;
end $$;

alter table public.ow_users alter column visibility set default 'public';

do $$
declare v text;
begin
  select column_default into v from information_schema.columns
   where table_schema = 'public' and table_name = 'ow_users' and column_name = 'visibility';
  if v is distinct from '''public''::text' then
    raise exception '初期値が public になっていない: %。ロールバック', v;
  end if;
end $$;

commit;
