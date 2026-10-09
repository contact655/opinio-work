-- ════════════════════════════════════════════════════════════════════════
-- 企業からの「声かけ」を受け取るか —— ow_profiles に列を足す（2026-10-09 / 声かけ 段1）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★足すだけ（古いコードのままでも壊れない）。
--
-- ★値の意味（3値）
--   null  … まだ選んでいない。**受け取らない扱い**（既存の利用者は全員ここから始まる）
--   true  … 受け取る
--   false … 受け取らない
--   ⚠️★既定値を true にしないこと。転職意欲の説明（候補者検索に出る／提案の対象になる）に
--      「企業から直接連絡が届く」は含まれていないので、既存の利用者を受け取る側に倒すと
--      同意の範囲を後から広げることになる（CLAUDE.md「設定の意味を後から拡大しない」）。
--   ⚠️ null と false を潰さないこと。null の人にだけ /mypage で一度だけ確認のカードを出す。
--
-- ★権限: ow_profiles は SELECT / UPDATE ともテーブルレベルの GRANT（列単位ではない）なので、
--   足した列はそのまま本人が読み書きできる（RLS は本人の行だけ）。下で検算する。
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.ow_profiles
  add column if not exists accept_company_approaches boolean;

comment on column public.ow_profiles.accept_company_approaches is
  E'企業からの「声かけ」を受け取るか（2026-10-09）。null = まだ選んでいない（受け取らない扱い）/ true = 受け取る / false = 受け取らない。\n⚠️ 既定値を true にしない（既存の利用者の同意の範囲を広げるため）。転職意欲（career_stance）とは別の設定。';

do $$
begin
  if not has_column_privilege('authenticated', 'public.ow_profiles', 'accept_company_approaches', 'SELECT')
     or not has_column_privilege('authenticated', 'public.ow_profiles', 'accept_company_approaches', 'UPDATE') then
    raise exception '検算失敗: authenticated が accept_company_approaches を読み書きできない';
  end if;
  if exists (select 1 from ow_profiles where accept_company_approaches is not null) then
    raise exception '検算失敗: 既存の行に値が入っている（全員 null から始まるはず）';
  end if;
  raise notice '検算OK: accept_company_approaches を足した（全行 null）';
end $$;

commit;

-- ★戻すとき:
--   alter table public.ow_profiles drop column accept_company_approaches;
