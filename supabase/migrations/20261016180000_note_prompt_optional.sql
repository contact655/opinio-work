-- ★「この会社について」のひとことを、書き出しを選ばない自由記述にする（2026-10-16 / 柴さんの指示）。
--
-- それまで ow_experience_notes.prompt は NOT NULL で、3つの書き出し
-- （wish_known / fits_who / pleasant_surprise）のどれかを必須にしていた。
-- 画面は書き出しを送らなくなる（prompt = null）ので、null を許す。
--
-- ⚠️ 既存の値（3つの書き出し）は CHECK に残す。null 以外の値はこれまでどおり3つに限る。
-- ⚠️ 適用前の実測（2026-10-16 / 本番）: ow_experience_notes は 0 行。書き換える行は無い。
--
-- 戻し方（null の行が無いときだけ）:
--   alter table public.ow_experience_notes drop constraint ow_experience_notes_prompt_check;
--   alter table public.ow_experience_notes add constraint ow_experience_notes_prompt_check
--     check (prompt in ('wish_known','fits_who','pleasant_surprise'));
--   alter table public.ow_experience_notes alter column prompt set not null;

alter table public.ow_experience_notes alter column prompt drop not null;

alter table public.ow_experience_notes drop constraint ow_experience_notes_prompt_check;
alter table public.ow_experience_notes add constraint ow_experience_notes_prompt_check
  check (prompt is null or prompt in ('wish_known','fits_who','pleasant_surprise'));

comment on column public.ow_experience_notes.prompt is
  '書き出し。2026-10-16 から画面では選ばせない（null）。wish_known / fits_who / pleasant_surprise は以前の行のためだけに残す';
