-- ★学校マスタに 幼稚園・小学校・中学校 を足す（2026-09-28 / 柴さんの指示）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 狙いは「**同じ中学校出身の人がどこで活躍しているか**」を見られるようにすること。
-- それには**人と人を学校で突き合わせる**必要があり、自由入力では足りない。
--
-- ⚠️★**表記ゆれは既に出ている。** 実測（2026-09-28 / ow_user_educations 18行）:
--    高校で同じ学校が「**朝霞**」と「**埼玉県立朝霞西高等学校**」の2行で入っている。
--    CLAUDE.md が企業について決めているのと同じ形
--    （「`company_id` の集合で突き合わせる。社名の文字列で比べないこと」）。
--
-- ⚠️★**促しを先に足さない。** 突き合わせられないデータが増えるだけで、
--    集まった後の名寄せは企業側で実際に苦労している作業。**器を先に直す。**
--
-- ── ⚠️ `degree` とは別物。混同しないこと ──────────────────────────────────
-- `ow_user_educations.degree` は**元から小学校卒〜博士まで入る**
--   （`ow_user_educations_degree_check`。2026-08-07 に小中学校卒を足した経緯がある）。
-- 足りなかったのは **`ow_schools.type`（学校マスタの種別）**だけ。
--
-- ── 実測（適用前）──────────────────────────────────────────────────────────
--
-- | | |
-- |---|---|
-- | `ow_schools` | **37行**（university 32 / highschool 4 / graduate_school 1） |
-- | `ow_user_educations` | 18行 / 10人 |
-- | うち 中学校卒 / 小学校卒 | **各1件。どちらも `school_id` が NULL**（自由入力） |
--
-- ⚠️★**既存データは1行も動かない。** CHECK に値を足すだけ
--    （`college` / `vocational` は使われていないが**残す**。消すと既存の想定を壊す）。
-- ⚠️★**自由入力（`ow_user_educations.school`）は残す。** マスタに無い学校を
--    入れられなくすると、入口の摩擦が増える（企業ピッカーと同じ判断）。
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-1649-ow_schools.sql（11,126 バイト / 37行）

do $$
declare
  n bigint;
  before_rows bigint;
begin
  -- ★既存の CHECK が想定どおりであること（別セッションが先に触っていたら中止）
  select count(*) into n from pg_constraint
   where conrelid = 'public.ow_schools'::regclass
     and conname = 'ow_schools_type_check'
     and pg_get_constraintdef(oid) =
         'CHECK ((type = ANY (ARRAY[''university''::text, ''graduate_school''::text, ''college''::text, ''highschool''::text, ''vocational''::text])))';
  if n <> 1 then
    raise exception '既存の ow_schools_type_check が想定と違う。中止する';
  end if;

  select count(*) into before_rows from public.ow_schools;
  if before_rows <> 37 then
    raise exception '学校マスタの行数が想定（37）と違う: %。中止する', before_rows;
  end if;
end $$;

alter table public.ow_schools drop constraint ow_schools_type_check;

alter table public.ow_schools add constraint ow_schools_type_check
  check (type = any (array[
    /* ⚠️★並びは段の順（幼稚園 → 大学院）。TS 側（lib/constants/schools.ts）と揃える */
    'kindergarten'::text,      -- 幼稚園・保育園
    'elementary'::text,        -- 小学校
    'junior_high'::text,       -- 中学校
    'highschool'::text,
    'vocational'::text,
    'college'::text,
    'university'::text,
    'graduate_school'::text
  ]));

comment on column public.ow_schools.type is
  '学校の種別。⚠️ 語彙は src/lib/constants/schools.ts（SCHOOL_TYPES）と3層で揃える。'
  '⚠️ ow_user_educations.degree（小学校卒〜博士）とは別物。混同しないこと。';

-- ⚠️ 検算。**「ALTER が通った」だけでは足りない**ので、実際に入るかを試して消す。
do $$
declare
  n bigint;
  after_rows bigint;
begin
  select count(*) into after_rows from public.ow_schools;
  if after_rows <> 37 then
    raise exception '学校マスタの行数が変わった: %', after_rows;
  end if;

  -- ★新しい3値が実際に INSERT できること（入れて必ず消す）
  insert into public.ow_schools (name, type) values
    ('__probe_kindergarten__', 'kindergarten'),
    ('__probe_elementary__',   'elementary'),
    ('__probe_junior_high__',  'junior_high');

  select count(*) into n from public.ow_schools where name like '__probe_%__';
  if n <> 3 then
    raise exception '新しい3値が入らなかった（%件）', n;
  end if;

  delete from public.ow_schools where name like '__probe_%__';
  select count(*) into n from public.ow_schools where name like '__probe_%__';
  if n <> 0 then
    raise exception '検証行が消えていない（%件）', n;
  end if;

  -- ★既存の値も引き続き通ること
  insert into public.ow_schools (name, type) values ('__probe_university__', 'university');
  delete from public.ow_schools where name = '__probe_university__';

  -- ★知らない値は弾かれること（弾かれなければ CHECK が効いていない）
  begin
    insert into public.ow_schools (name, type) values ('__probe_bad__', 'cram_school');
    delete from public.ow_schools where name = '__probe_bad__';
    raise exception 'CHECK が効いていない（知らない値が入った）';
  exception when check_violation then
    null;  -- 期待どおり
  end;

  select count(*) into after_rows from public.ow_schools;
  if after_rows <> 37 then
    raise exception '検証のあと行数が戻っていない: %', after_rows;
  end if;

  raise notice '学校種別を8値にした（幼稚園・小学校・中学校を追加）/ 行数 % のまま / 知らない値は弾かれる', after_rows;
end $$;
