-- 役職の選択肢を 5 → 10 に広げる（2026-10-01 / 柴さんの指示）
--
-- ⚠️★**UI だけ足すと「選べるのに保存できない」**（CLAUDE.md「UI / API / DB の CHECK を
--    3つ揃える」）。`rank` は DB の CHECK が baseline からあるので、
--    広げないと **23514 で職歴の保存が丸ごと 500 になる**（`degree` の小中学校卒と同じ形）。
--
-- ⚠️★**既存5つの値は1文字も変えていない。** 実データ（適用前の実測・全70行）は
--      none 15 / leader 5 / manager 1 / NULL 49。残り7つは0件。
--    ＝ **既存行はすべて新しい CHECK を通る。**
--
-- ⚠️ 広げるだけなので**1段階でよい**。値を**改名**するときは3段階
--    （広げる → UPDATE → 狭める）。混同しないこと。
--
-- ⚠️★順序は UI 側（`src/lib/constants/careerOptions.ts` の `RANKS`）と同じにしてある。
--    **CHECK の並びに意味は無い**が、突き合わせるときに読みやすいので揃えておく。
--    ⚠️ 値を足す日は**この2箇所を同じコミットで**変えること。

-- 事前: 既存の値が新しい集合に収まっているか（収まらなければ中止）
do $$
declare
  はみ出し int;
begin
  select count(*) into はみ出し from public.ow_experiences
   where rank is not null
     and rank <> all (array['none','chief','leader','manager','senior_manager',
                            'general_manager','division_head','corporate_officer',
                            'executive','ceo']);
  if はみ出し > 0 then
    raise exception '新しい集合に収まらない rank が % 行ある。広げる前に中身を見ること', はみ出し;
  end if;
end $$;

alter table public.ow_experiences
  drop constraint if exists ow_experiences_rank_check;

alter table public.ow_experiences
  add constraint ow_experiences_rank_check
  check (rank = any (array['none','chief','leader','manager','senior_manager',
                           'general_manager','division_head','corporate_officer',
                           'executive','ceo']));

-- 事後: 10個すべてが通り、知らない値は弾かれること
do $$
declare
  def text;
  v text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conrelid = 'public.ow_experiences'::regclass
     and conname = 'ow_experiences_rank_check';

  if def is null then
    raise exception 'ow_experiences_rank_check が作られていない';
  end if;

  foreach v in array array['none','chief','leader','manager','senior_manager',
                           'general_manager','division_head','corporate_officer',
                           'executive','ceo'] loop
    if def !~ ('''' || v || '''') then
      raise exception '% が CHECK に入っていない', v;
    end if;
  end loop;

  -- ⚠️ NULL（未入力）は引き続き通ること。NOT NULL にしない
  --    （5択は任意で、入れていない人が 49 行いる）
  if def ~ 'NOT NULL' then
    raise exception 'rank を NOT NULL にしてはいけない';
  end if;
end $$;
