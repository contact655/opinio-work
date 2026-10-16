-- ★「この会社について」の目盛りを5段階（-2〜+2）から7段階（-3〜+3）に広げる（2026-10-16 / 柴さんの判断）。
--   対象: A 期待への評価（ow_experience_expectations.rating）／ B 入社前とのずれ（ow_experience_gap_shifts.value）。
--   C 合っていたか（0〜10）は変えない。
--
-- ⚠️ 本番の行は両表とも0件（2026-10-16 実測）。値の意味（-2 が端）を持つ行が無いうちに広げる。
--    回答がたまってから広げると、5段階と7段階の値が同じ列に混ざって比べられなくなる。
-- ⚠️ 画面と API は src/lib/constants/careerReasons.ts の SCALE_VALUES（-3〜+3）を見る。片方だけ変えないこと。
--
-- 戻し方: 両表の行が -2〜+2 に収まっていることを確かめてから、下の CHECK を -2〜2 に張り直す。

begin;

do $$
begin
  if (select count(*) from public.ow_experience_expectations where rating is not null) <> 0
     or (select count(*) from public.ow_experience_gap_shifts) <> 0 then
    raise exception '既に回答の行がある。目盛りの意味が混ざるので中止';
  end if;
end $$;

alter table public.ow_experience_expectations drop constraint ow_experience_expectations_rating_check;
alter table public.ow_experience_expectations add constraint ow_experience_expectations_rating_check
  check (rating is null or rating between -3 and 3);

alter table public.ow_experience_gap_shifts drop constraint ow_experience_gap_shifts_value_check;
alter table public.ow_experience_gap_shifts add constraint ow_experience_gap_shifts_value_check
  check (value between -3 and 3);

comment on column public.ow_experience_expectations.rating is
  '-3 期待を下回った … 0 期待通り … +3 期待を上回った（7段階。2026-10-16 に5段階から広げた）。null = 未回答';
comment on column public.ow_experience_gap_shifts.value is
  '-3 左の端 … 0 想像通り … +3 右の端（7段階。左右の言葉は careerReasons.ts の GAP_SHIFT_AXES）';

commit;
