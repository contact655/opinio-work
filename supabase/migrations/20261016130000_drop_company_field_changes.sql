-- 運営の「AIで埋める」の廃止に伴い、更新履歴の表を消す（2026-10-16 / 柴さんの判断）。
-- 作った migration（20261015140000）は本番の適用履歴と合わせるため残す。
-- 0行・この表を参照する外部キー/ビュー/関数/トリガー/ポリシーは0件（2026-10-16 実測）。
-- 作業前ダンプ: .dumps/20261016-*-ow_company_field_changes.sql
begin;
do $$
begin
  if (select count(*) from public.ow_company_field_changes) <> 0 then
    raise exception 'ow_company_field_changes に行がある。中止';
  end if;
end $$;
drop table public.ow_company_field_changes;  -- ⚠️ CASCADE を付けない（想定外の依存があれば失敗させる）
do $$
begin
  if to_regclass('public.ow_company_field_changes') is not null then
    raise exception 'drop できていない。中止';
  end if;
end $$;
commit;
