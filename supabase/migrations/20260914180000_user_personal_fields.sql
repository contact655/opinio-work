-- ★本人の属性を `ow_users` に揃える（2026-09-14 / 柴さんの指示）
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
-- オンボーディングの冒頭で「あなたのこと」を聞くために、6列を足す。
--   family_name / given_name              … 姓・名（**分けて持つ**）
--   family_name_kana / given_name_kana    … セイ・メイ
--   gender                                … 性別（4値 + NULL）
--   phone                                 … 電話番号
--
-- ⚠️★**`ow_users.name` は残す。これまでどおり「表示の正」。**
--    `/people`・企業ページ・`/u/[id]`・フィードが読むのは今も `name`（NOT NULL）。
--    姓名は**入力の形**で、`name` は「姓＋名」として**同じ書き込み経路で一緒に**更新する。
--    ⚠️ 別経路で書くと「正と派生が食い違う」事故になる（`role_category_id` で踏んだ形）。
--
-- ⚠️★**既存の12人は機械で分割できない。** 実測（2026-09-14）: 氏名にスペースあり7 / なし5。
--    既存行は `name` のまま、姓名は NULL で置く（柴さん「これまでのユーザーは気にしないでOK」）。
--
-- ── ⚠️★★GRANT は「UPDATE だけ。SELECT は配らない」──────────────────────────
-- `ow_users` の RLS には **`ow_users_login_only_read`**
--   （`visibility = 'login_only' AND auth.uid() IS NOT NULL`）があり、
-- **ログインしていれば誰でも他人の行を読める**（実ユーザー12人は全員 `login_only`）。
-- ⇒ ここで `grant select` を書くと、**全員の電話番号・性別が PostgREST から読める。**
--
-- **既存の `birth_date` が同じ扱いになっている**（実測 2026-09-14）:
--     birth_date … anon SELECT false / authenticated SELECT **false** / UPDATE **true**
-- 本人に書かせるのは UPDATE、読むのは**サーバー側で admin クライアント＋本人に限定**。
-- ⚠️ `PUT /api/jobseeker/profile` が **`.select()` を付けていない**のはこのため。
--    付けると PostgREST が全列を返そうとして **403（42501）** になる。**足さないこと。**
--
-- ⚠️ INSERT の GRANT は要らない。`lib/auth/linkOwUser.ts` は **admin クライアント**で作る。
--
-- ⚠️ `location`（居住地）は**既にある列を再利用する**（5/46件）。`/u/[id]` に表示済みで
--    anon SELECT も配られている公開項目。新しい列を足さない。
--
-- ── 【廃止】にする3列（DROP しない）──────────────────────────────────────────
-- 同じ意味の列が既にあり、**どれもデータ0件・読み書きするコードも0件**だった（実測）:
--   ow_profiles.name_kana         … 40行中 0件。`name_kana` の grep は全部 `ow_schools` 側
--   ow_profiles.location          … 40行中 0件
--   ow_career_profiles.gender     … そのテーブル自体が 1行。読むコードは0
--     （`gender` の grep で出るのは全部 `genderRatio` ＝ 企業の女性比率。無関係）
-- ⚠️ **DROP しない。** COMMENT で印を付けるだけ（このリポジトリの既存のやり方）。

begin;

-- ── 事前アサート ────────────────────────────────────────────────────────────
do $$
declare v_rows int; v_cols int;
begin
  select count(*) into v_rows from public.ow_users;
  -- ⚠️ 足す前に、同名の列が無いことを確かめる（あるなら設計を見直す）
  select count(*) into v_cols
    from pg_attribute
   where attrelid='public.ow_users'::regclass and attnum>0 and not attisdropped
     and attname in ('family_name','given_name','family_name_kana','given_name_kana','gender','phone');
  if v_cols <> 0 then
    raise exception '足そうとしている列が既にある（% 件）。設計を見直すこと', v_cols;
  end if;
  raise notice '事前: ow_users % 行 / 追加する列は未存在', v_rows;
end $$;

-- ── 本体 ────────────────────────────────────────────────────────────────────
alter table public.ow_users
  add column family_name       text,
  add column given_name        text,
  add column family_name_kana  text,
  add column given_name_kana   text,
  add column gender            text,
  add column phone             text;

/* ⚠️★値の集合は UI / API / DB の CHECK を3つ揃える（CLAUDE.md）。
      ここが DB 側。語彙は `src/lib/constants/gender.ts` と同じにすること。
   ⚠️ **`prefer_not_to_say`（回答しない）を外さないこと。** 逃げ道が無いと嘘が入る。
   ⚠️ NULL は許す（未回答＝任意項目のため）。NOT NULL にしない。 */
alter table public.ow_users
  add constraint ow_users_gender_check
  check (gender is null or gender in ('male','female','other','prefer_not_to_say'));

comment on column public.ow_users.family_name      is '姓。⚠ 表示の正は name（姓＋名）。同じ経路で一緒に更新すること';
comment on column public.ow_users.given_name       is '名。⚠ 表示の正は name（姓＋名）。同じ経路で一緒に更新すること';
comment on column public.ow_users.family_name_kana is 'セイ（ふりがな）。⚠ SELECT の GRANT は配っていない。読むのは admin クライアントで本人の行だけ';
comment on column public.ow_users.given_name_kana  is 'メイ（ふりがな）。⚠ SELECT の GRANT は配っていない。読むのは admin クライアントで本人の行だけ';
comment on column public.ow_users.gender           is '性別（male/female/other/prefer_not_to_say）。⚠ 一覧に出さない・絞り込ませない（男女雇用機会均等法5条。年齢と同じ扱い）';
comment on column public.ow_users.phone            is '電話番号。⚠★企業には出さない。本人と運営だけ。SELECT の GRANT は配っていない';

/* ── GRANT: UPDATE だけ。**SELECT は配らない**（上の理由）───────────────────
   ⚠️ `ow_users` は SELECT も UPDATE も列単位。足しただけでは authenticated から
      **書けない列**が生まれ、しかも**エラーにならない**（「保存したのに変わらない」に化ける）。 */
grant update (family_name, given_name, family_name_kana, given_name_kana, gender, phone)
  on public.ow_users to authenticated;

-- ── 【廃止】の印（DROP しない）──────────────────────────────────────────────
comment on column public.ow_profiles.name_kana is
  '【廃止】2026-09-14。ふりがなの正は ow_users.family_name_kana / given_name_kana。'
  '適用時点で 40行中0件・読み書きするコードも0件だった。新しく読み書きしないこと';
comment on column public.ow_profiles.location is
  '【廃止】2026-09-14。居住地の正は ow_users.location。'
  '適用時点で 40行中0件。新しく読み書きしないこと';
comment on column public.ow_career_profiles.gender is
  '【廃止】2026-09-14。性別の正は ow_users.gender。'
  '適用時点でテーブル自体が1行・読むコードは0件だった。新しく読み書きしないこと';

-- ── 事後アサート（★catalog を見るだけでなく、権限を実測する）────────────────
do $$
declare c text; v_sel boolean; v_upd boolean; v_bad int := 0;
begin
  foreach c in array array['family_name','given_name','family_name_kana','given_name_kana','gender','phone']
  loop
    v_sel := has_column_privilege('authenticated','public.ow_users',c,'SELECT');
    v_upd := has_column_privilege('authenticated','public.ow_users',c,'UPDATE');
    -- ★SELECT は false、UPDATE は true が正
    if v_sel then
      raise warning '% : authenticated に SELECT が付いている（他人の行まで読める）', c;
      v_bad := v_bad + 1;
    end if;
    if not v_upd then
      raise warning '% : authenticated に UPDATE が無い（本人が保存できない）', c;
      v_bad := v_bad + 1;
    end if;
    if has_column_privilege('anon','public.ow_users',c,'SELECT') then
      raise warning '% : anon に SELECT が付いている', c;
      v_bad := v_bad + 1;
    end if;
  end loop;
  if v_bad <> 0 then
    raise exception '権限が想定と違う（% 件）。SELECT は配らず UPDATE だけ付ける', v_bad;
  end if;
  raise notice '事後: 6列とも SELECT なし / UPDATE あり（birth_date と同じ形）';
end $$;

/* gender の CHECK が張られていることを確かめる。
   ⚠️ 実際に不正値を入れて試さない —— 本番の行を触ることになる。
      効いているかは適用後に PostgREST で1回叩いて確かめる（下の検証手順）。 */
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.ow_users'::regclass and conname='ow_users_gender_check'
  ) then
    raise exception 'ow_users_gender_check が無い';
  end if;
  raise notice '事後: ow_users_gender_check あり';
end $$;

commit;
