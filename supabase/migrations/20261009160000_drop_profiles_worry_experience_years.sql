-- ════════════════════════════════════════════════════════════════════════
-- ow_profiles.worry / experience_years を落とす（2026-10-09 / 柴さんの指示）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★読み手も書き手も無い列
--   ・worry: 2026-08-17 に入力欄・API の受け口・完成度の判定から外した。読む画面は0。値は 6/88 行
--   ・experience_years: 2026-08-07 に職歴からの自動計算（lib/profile/tenure.ts）へ置き換えた。
--     API は受け取っても捨てている（career-preferences/route.ts）。読む画面は0。値は 6/88 行
--
-- ★落とす前に数えたこと（2026-10-09 / 本番）
--   ・src / scripts からの参照: コメントのみ（seed スクリプトの worry_category は別の列）
--   ・関数の本体（行コメントを除く）0 ／ ビュー 0 ／ ポリシー 0 ／ 制約 0 ／ 索引 0 ／ その他の依存 0
--     （陽性対照: 同じ式で career_stance → can_send_scout と CHECK 1、user_id → 関数13・ポリシー137 を検出）
--
-- ⚠️ 作業前ダンプ: .dumps/20261009-1759-ow_profiles.sql（88行。2列の値を含む）
-- ⚠️ CASCADE を付けない。
-- ════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  select count(*) into n from public.ow_profiles where worry is not null or experience_years is not null;
  if n > 12 then raise exception '想定外: 値のある行が % 行（想定は最大 12）', n; end if;
end $$;

alter table public.ow_profiles drop column worry;
alter table public.ow_profiles drop column experience_years;

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.ow_profiles'::regclass
               and attname in ('worry', 'experience_years') and not attisdropped) then
    raise exception '検算失敗: 列が残っている';
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.ow_profiles'::regclass
                   and attname = 'career_stance' and not attisdropped) then
    raise exception '検算失敗（陽性対照）: 他の列まで消えた';
  end if;
  raise notice '検算OK: worry / experience_years を落とした';
end $$;

commit;
