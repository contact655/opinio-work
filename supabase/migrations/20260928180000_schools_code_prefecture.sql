-- ★学校マスタに 学校コード・都道府県・廃止年月日 を足す（2026-09-28 / 柴さんの指示）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- 文部科学省「学校コード」（令和7年5月1日時点・確定版）から高校を投入する前段。
-- 3つとも**投入と同時にしか入れられない**情報なので、先に器を作る。
--
-- | 列 | なぜ要るか |
-- |---|---|
-- | `school_code` | ★**恒久の公式ID**。企業の法人番号と同じ役割。**これが無いと次の更新で名前で突き合わせることになり、表記ゆれで重複が増える**（実測: 既に「朝霞」と「埼玉県立朝霞西高等学校」の2行がある） |
-- | `prefecture` | ★**同名の学校が13組ある**（「聖光学院高等学校」「開智高等学校」など、都道府県違いの別の学校）。名前だけ出すと選ぶ人が見分けられない |
-- | `closed_at` | ★**廃止校190件を入れるため**。学歴は過去の話なので、2023年に廃止された高校を2010年に卒業した人が実在する。入れないとその人は自由入力にしかならず、**まさに避けたい表記ゆれになる** |
--
-- ⚠️★**既存37件はすべて NULL のまま。** 値を足すだけで、1行も動かない。
--    既存4件の高校への学校コードの紐づけは**投入の migration で行う**（名前が一致することを実測済み）。
--
-- ── 権限 ────────────────────────────────────────────────────────────────────
-- ⚠️ `ow_schools` の SELECT は**表レベル**（実測 2026-09-28: anon / authenticated とも 10/10列）。
--    したがって新しい列は**足せばそのまま読める**。`grant` は要らない。
--    ⚠️ 3列とも**文科省が公表している公開情報**なので、読めて問題ない。
--    ⚠️ RLS は `ow_schools_authenticated_select`（`USING (true)`）の1本だけ。
--       anon には行が返らない（CLAUDE.md の「RLS で弾かれても 200 + 0件」の例）。**変えない。**
--
-- ⚠️ 作業前ダンプ: .dumps/20260928-1649-ow_schools.sql（11,126 バイト / 37行）

do $$
declare n bigint;
begin
  select count(*) into n from public.ow_schools;
  if n <> 37 then
    raise exception '学校マスタの行数が想定（37）と違う: %。中止する', n;
  end if;
  -- ★同じ列を後から足されていないこと
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='ow_schools'
     and column_name in ('school_code','prefecture','closed_at');
  if n <> 0 then
    raise exception '足そうとしている列が既にある（%件）。中止する', n;
  end if;
end $$;

alter table public.ow_schools
  /* ⚠️★**UNIQUE を張る。** 同じ学校を2回入れないための唯一の歯止め。
        ⚠️ NULL は重複できる（既存37件はすべて NULL）ので、既存行は弾かれない。 */
  add column school_code text unique,
  /* ⚠️ 「東京都」のような都道府県名をそのまま入れる。コード（13）にしない
        —— 画面に出すのが目的で、変換表を1つ増やす理由が無い。 */
  add column prefecture text,
  /* ⚠️★NULL は「廃止されていない」。**「不明」ではない**（文科省データは全校ぶん持っている） */
  add column closed_at date;

comment on column public.ow_schools.school_code is
  '文部科学省の学校コード（恒久ID）。⚠️ 再同期と重複防止に使う。名前で突き合わせないこと。';
comment on column public.ow_schools.prefecture is
  '都道府県名（「東京都」など）。⚠️ 同名の学校が複数あるので、画面では名前と併記する。';
comment on column public.ow_schools.closed_at is
  '廃止年月日。⚠️ NULL は「廃止されていない」。学歴は過去の話なので廃止校も残す。';

-- ⚠️ 検算。**「ALTER が通った」だけでは足りない**ので、実際に入るかを試して消す。
do $$
declare n bigint; rows_before bigint;
begin
  select count(*) into rows_before from public.ow_schools;
  if rows_before <> 37 then raise exception '行数が変わった: %', rows_before; end if;

  -- ★既存37件はすべて NULL のまま
  select count(*) into n from public.ow_schools
   where school_code is not null or prefecture is not null or closed_at is not null;
  if n <> 0 then raise exception '既存行に値が入っている（%件）', n; end if;

  -- ★3列とも実際に書けること
  insert into public.ow_schools (name, type, school_code, prefecture, closed_at)
  values ('__probe__', 'highschool', '__PROBE_CODE__', '東京都', '2025-03-31');
  select count(*) into n from public.ow_schools where name='__probe__'
     and school_code='__PROBE_CODE__' and prefecture='東京都' and closed_at='2025-03-31';
  if n <> 1 then raise exception '3列に書けなかった'; end if;

  -- ★UNIQUE が効くこと（効かないと同じ学校を2回入れられる）
  begin
    insert into public.ow_schools (name, type, school_code)
    values ('__probe2__', 'highschool', '__PROBE_CODE__');
    delete from public.ow_schools where name in ('__probe__','__probe2__');
    raise exception 'school_code の UNIQUE が効いていない';
  exception when unique_violation then
    null;  -- 期待どおり
  end;

  -- ★NULL は重複できること（既存37件が弾かれないことの確認）
  insert into public.ow_schools (name, type) values ('__probe3__','highschool'), ('__probe4__','highschool');

  delete from public.ow_schools where name like '__probe%__';
  select count(*) into n from public.ow_schools;
  if n <> 37 then raise exception '検証のあと行数が戻っていない: %', n; end if;

  raise notice '3列を足した / 既存37件はすべて NULL / UNIQUE は効く / NULL は重複できる';
end $$;
