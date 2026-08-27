-- ═══════════════════════════════════════════════════════════════════════════
-- 言語マスタ ow_languages を作り、ow_user_languages から参照する（2026-08-27）
--
-- ── なぜ ────────────────────────────────────────────────────────────────────
-- `ow_user_languages.name` が**自由入力**（`<input type="text">`）だったため、
-- 「英語が話せる人」が `/search` で引けなかった。表記が揺れると突き合わせられない。
-- `ow_skills` / `ow_user_skills`（2026-08-27）と同じ形に揃える。
--
-- ★**実データ 0 行のうちに入れる**（実測 2026-08-27: 0行 / 0ユーザー）。
--   移行するデータが無いので、UNIQUE も FK も無条件で付けられる。
--   作業前ダンプ: .dumps/20260827-1557-ow_user_languages.sql
--
-- ── ★`name` を残す理由（重要）──────────────────────────────────────────────
-- `language_id` を足しても **`name` は NOT NULL のまま残す。**
-- 読み手のうち `u/[id]/page.tsx` と `mypage/page.tsx` の2つが
-- **別セッションの作業中で触れない**ため、`.select("id, name, proficiency, sort_order")`
-- を join に書き換えられない。`name` は**マスタの `label` の複製**として扱う。
--
-- ⚠️ **複製である以上、勝手な値が入れば二重管理になる。**
--    API 側で「`language_id` のマスタの `label` と `name` が一致すること」を必ず検証する
--    （自由入力の復活を防ぐ唯一の防御）。
-- ⚠️ join への切り替えは、あの2ファイルが空いてからの別作業。→ docs/todo.md
--
-- ── ★`iso_639_1` を `/search` の語彙に入れないこと ─────────────────────────
-- 列としては持つが、**索引（照合語）には入れない。**
-- 2文字コードは日本語の文にも英文にも当たりすぎる:
--   `it`（イタリア語）→「IT業界」「IT企業」に当たる
--   `id`（インドネシア語）→「id」「Android」…
--   `my`（ミャンマー語）/ `no`（ノルウェー語）/ `am` / `is` → 英文の普通の語
-- 2026-08-27 に `Miro` → `IR`、`Microsoft Teams` → `CRO` で実際に踏んだのと同じ形。
-- **照合に使ってよいのは `label` と `aliases` だけ。**
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① マスタ ───────────────────────────────────────────────────────────────
create table public.ow_languages (
  id uuid primary key default gen_random_uuid(),

  -- 表示名。⚠️ UNIQUE。`ow_user_languages.name` はこの綴りの複製
  label text not null unique,

  /* ISO 639-1 の2文字コード。⚠️ **`/search` の語彙には使わない**（冒頭の注記）。
     持っているのは、将来 hreflang や外部データと突き合わせるときの正準キーとして。
     ⚠️ いま読んでいるコードは無い。使い始めるときは誤爆の検討からやり直すこと。 */
  iso_639_1 text unique check (iso_639_1 ~ '^[a-z]{2}$'),

  /* 別名。⚠️ `ow_skills.aliases` と同じ形。`/search` はここも見る */
  aliases text[] not null default '{}',

  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

comment on table public.ow_languages is
  '話せる言語のマスタ。ow_user_languages から参照する。運営が管理する（書き込みは auth_is_admin のみ）。';
comment on column public.ow_languages.iso_639_1 is
  'ISO 639-1 の2文字コード。⚠️ /search の照合語には使わない（it/id/my/no が普通の語に当たるため）。照合は label と aliases だけ。';
comment on column public.ow_languages.aliases is
  '別名。English / えいご のような表記ゆれを /search で引くためのもの。';

create index ow_languages_sort_idx on public.ow_languages (sort_order);

-- ── ② 権限。★`ow_skills` と同じ形 ──────────────────────────────────────────
-- 読みは誰でも（マスタなので隠す理由が無い）。書き込みは RLS で運営だけに絞る。
-- ⚠️ `authenticated` から GRANT を剥がさないこと。**運営も authenticated で来る**
--    ので、剥がすと RLS まで到達せず運営でも書けなくなる（CLAUDE.md）。
alter table public.ow_languages enable row level security;

grant select on public.ow_languages to anon;
grant select, insert, update, delete on public.ow_languages to authenticated;

create policy "public read languages"
  on public.ow_languages for select using (true);
create policy "admins manage languages"
  on public.ow_languages for all using (auth_is_admin());

-- ── ③ 初期投入（17語）──────────────────────────────────────────────────────
-- ⚠️ **ネパール語・ミャンマー語・モンゴル語は入れない。** IT/SaaS の求人条件としては
--    弱く、識別力の無い語彙を増やさない方針（`ow_skills` から Slack・Gmail を
--    外したのと同じ判断）。広東語・オランダ語・トルコ語も同じ理由で採らない。
-- ⚠️ `aliases` に**2文字コードを入れない**（冒頭の注記）。
--    「中文」「北京語」のような実際に使われる別名だけを入れる。
insert into public.ow_languages (label, iso_639_1, aliases, sort_order) values
  ('英語',          'en', array['English','えいご','イングリッシュ'],                        1),
  ('日本語',        'ja', array['Japanese','にほんご','国語'],                              2),
  ('中国語',        'zh', array['Chinese','Mandarin','マンダリン','北京語','中文','普通話'], 3),
  ('韓国語',        'ko', array['Korean','ハングル','朝鮮語'],                              4),
  ('ベトナム語',    'vi', array['Vietnamese'],                                              5),
  ('フランス語',    'fr', array['French','仏語'],                                           6),
  ('ドイツ語',      'de', array['German','独語'],                                           7),
  ('スペイン語',    'es', array['Spanish','西語'],                                          8),
  ('ポルトガル語',  'pt', array['Portuguese','ブラジルポルトガル語'],                        9),
  ('イタリア語',    'it', array['Italian','伊語'],                                          10),
  ('ロシア語',      'ru', array['Russian','露語'],                                          11),
  ('タイ語',        'th', array['Thai'],                                                   12),
  ('インドネシア語','id', array['Indonesian','インドネシア'],                                13),
  ('マレー語',      'ms', array['Malay','マレーシア語'],                                    14),
  ('タガログ語',    'tl', array['Tagalog','フィリピン語','Filipino'],                        15),
  ('ヒンディー語',  'hi', array['Hindi'],                                                   16),
  ('アラビア語',    'ar', array['Arabic'],                                                  17);

-- ── ④ ow_user_languages 側 ────────────────────────────────────────────────
-- ⚠️ `nullable` にしてある。既存行が 0 なので NOT NULL でも通るが、
--    **マスタから外した言語を後で無効化したとき**に行を残せる形にしておく。
--    ⚠️ 入力経路は API で必須にする（アプリからは NULL の行を作らせない）。
alter table public.ow_user_languages
  add column language_id uuid references public.ow_languages(id);

comment on column public.ow_user_languages.language_id is
  '言語マスタ。⚠️ name はこの行の label の複製。API が一致を検証している（自由入力の復活を防ぐため）。';

-- ★同じ言語を2回持たせない。⚠️ 0行のいまだから無条件で付けられる
alter table public.ow_user_languages
  add constraint ow_user_languages_user_language_uniq unique (user_id, language_id);

create index ow_user_languages_language_id_idx on public.ow_user_languages (language_id);

-- ⚠️ この表は authenticated にテーブルレベルで GRANT されている（列単位ではない）ので、
--    列を足しただけで読める。実測で確かめる（下の DO ブロック）。

-- ── ⑤ 検証。★「エラーが出なかった」を成功にしない ──────────────────────────
DO $$
DECLARE
  v_langs   int;
  v_iso     int;
  v_dupe    text;
  v_rows    int;
  v_sel     boolean;
  v_ins     boolean;
  v_anon    boolean;
  v_pol     int;
  v_pol_sk  int;
BEGIN
  SELECT count(*) INTO v_langs FROM public.ow_languages;
  IF v_langs <> 17 THEN RAISE EXCEPTION 'ow_languages が % 行（17 のはず）。中止', v_langs; END IF;

  -- ISO コードが全部入っていて重複していないこと
  SELECT count(DISTINCT iso_639_1) INTO v_iso FROM public.ow_languages WHERE iso_639_1 IS NOT NULL;
  IF v_iso <> 17 THEN RAISE EXCEPTION 'iso_639_1 が % 種（17 のはず）。中止', v_iso; END IF;

  -- ★入れないと決めた語が紛れていないこと
  SELECT string_agg(label, ', ') INTO v_dupe FROM public.ow_languages
   WHERE label IN ('ネパール語','ミャンマー語','モンゴル語','広東語','オランダ語','トルコ語');
  IF v_dupe IS NOT NULL THEN RAISE EXCEPTION '入れない語が入っている: %。中止', v_dupe; END IF;

  -- ★別名に2文字コードが紛れていないこと（/search の誤爆源）
  SELECT string_agg(l.label || ':' || a, ', ') INTO v_dupe
    FROM public.ow_languages l, unnest(l.aliases) a WHERE a ~ '^[A-Za-z]{2}$';
  IF v_dupe IS NOT NULL THEN RAISE EXCEPTION '別名に2文字の語がある（誤爆源）: %。中止', v_dupe; END IF;

  -- ★label と aliases が互いに重複していないこと（同じ語で2言語が立つのを防ぐ）
  SELECT string_agg(t.term, ', ') INTO v_dupe FROM (
    SELECT lower(term) AS term FROM (
      SELECT label AS term FROM public.ow_languages
      UNION ALL SELECT unnest(aliases) FROM public.ow_languages
    ) x GROUP BY lower(term) HAVING count(*) > 1
  ) t;
  IF v_dupe IS NOT NULL THEN RAISE EXCEPTION '照合語が重複している: %。中止', v_dupe; END IF;

  -- ow_user_languages 側
  SELECT count(*) INTO v_rows FROM public.ow_user_languages;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_user_languages が % 行ある（0 のはず。前提が違う）。中止', v_rows; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ow_user_languages' AND column_name='language_id') THEN
    RAISE EXCEPTION 'language_id が生えていない。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ow_user_languages'::regclass
                    AND conname='ow_user_languages_user_language_uniq') THEN
    RAISE EXCEPTION 'unique (user_id, language_id) が無い。中止';
  END IF;
  -- ★name は NOT NULL のまま（読み手2ファイルが触れないので落とせない）
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='ow_user_languages'
                AND column_name='name' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'name が nullable になっている。読み手が壊れる。中止';
  END IF;

  -- ★列を足したら権限を実測する（CLAUDE.md）
  v_sel := has_column_privilege('authenticated','public.ow_user_languages','language_id','SELECT');
  v_ins := has_column_privilege('authenticated','public.ow_user_languages','language_id','INSERT');
  IF NOT v_sel OR NOT v_ins THEN
    RAISE EXCEPTION 'language_id が authenticated から使えない（SELECT=% / INSERT=%）。中止', v_sel, v_ins;
  END IF;

  -- マスタ側の権限。★anon も読める（ow_skills と同じ）
  v_anon := has_table_privilege('anon','public.ow_languages','SELECT');
  IF NOT v_anon THEN RAISE EXCEPTION 'anon が ow_languages を読めない。中止'; END IF;
  IF NOT has_table_privilege('authenticated','public.ow_languages','INSERT') THEN
    RAISE EXCEPTION 'authenticated が INSERT できない。運営も書けなくなる。中止';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.ow_languages'::regclass) THEN
    RAISE EXCEPTION 'ow_languages の RLS が有効になっていない。中止';
  END IF;

  SELECT count(*) INTO v_pol    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='ow_languages';
  SELECT count(*) INTO v_pol_sk FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='ow_skills';
  IF v_pol <> v_pol_sk THEN
    RAISE EXCEPTION 'ポリシーが % 本（ow_skills と同じ % 本のはず）。中止', v_pol, v_pol_sk;
  END IF;

  RAISE NOTICE '完了: ow_languages % 行 / ポリシー % 本 / language_id SELECT=% INSERT=%',
    v_langs, v_pol, v_sel, v_ins;
END $$;

COMMIT;
