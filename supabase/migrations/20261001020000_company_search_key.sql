-- 企業検索を「入力の揺れ」に強くする ── 正規化済みの検索キー列を持つ
--
-- 柴さんの指示（2026-10-01）。きっかけは 田利 聖吾さんが
-- 「セールスフォース」と打ったのに候補を選ばず自由入力に落ちた件。
--
-- ⚠️★**カタカナ検索そのものは前から効いていた。** 効かないのは**入力の揺れ**。
--    実測（2026-10-01 / 本番。いずれも `株式会社セールスフォース・ジャパン` を探した）:
--
--      セールスフォース          … ✅ 出る
--      せーるすふぉーす          … ❌ 0件（ひらがな）
--      セールスフォースジャパン  … ❌ 0件（中黒なし）← ★ベタ打ちする人は必ず外れる
--      ｾｰﾙｽﾌｫｰｽ                  … ❌ 0件（半角カナ）
--      ＳＡＬＥＳＦＯＲＣＥ      … ❌ 0件（全角ラテン）
--
-- ── なぜ新しい正規化を書かないか ────────────────────────────────────────────
-- ⚠️★**`normalize_company_name()` が既に全部やっている**（ひらがな→カタカナ／
--    半角カナ→全角／全角ラテン→半角＋小文字／中黒・空白・ハイフン除去／法人格除去）。
--    検索がそれを見ていなかっただけ。**正規化の規則をもう1つ作らないこと。**
--
-- ── なぜ `normalized_name` をそのまま使わないか ─────────────────────────────
-- ⚠️★あれは **`name` だけ**から作る。掲載21社の多くは外資でラテン社名なので、
--    **カタカナの読みは `search_aliases` にしか無い。** 実測（案A＝name だけ正規化）:
--      まいなび → ✅ ／ さんさん・ぼっくす・のーしょん・ぴぼっと・えぬしーの → **全部 0件**
--    5列すべてを正規化して1本にまとめた本列（案B）なら **7/7 当たる。**
--
-- ⚠️★**列ごとに正規化してから連結する。** 連結してから正規化すると、
--    法人格の除去が**文字列の先頭と末尾にしか効かない**ので途中の「株式会社」が残る。
--
-- ⚠️ 索引は張らない。102社で Seq Scan のほうが速く、このリポジトリは既に
--    過剰インデックス（CLAUDE.md「FK にインデックスを足さないこと」）。
--
-- ⚠️★**これでも直らないものが1つある**（承知のうえ）: 読みの揺れ。
--    「スノーフレ**イ**ク」と「スノーフレ**ー**ク」は音が違うので正規化では畳めない。
--    → **`search_aliases` に両方書く運用**で受ける（現時点で該当は Snowflake 1社）。

begin;

-- ── ① 5列を正規化して1本にまとめる関数 ─────────────────────────────────────
create or replace function public.company_search_key(
  p_name           text,
  p_name_en        text,
  p_brand_name     text,
  p_slug           text,
  p_search_aliases text
) returns text
language sql
as $$
  /* ⚠️ concat_ws は NULL を飛ばす。空文字は nullif で NULL に倒す。
     ⚠️ 区切りの空白は**正規化のあとに**入れる（先に入れると normalize が消す）。 */
  select nullif(btrim(concat_ws(' ',
    public.normalize_company_name(p_name),
    public.normalize_company_name(p_name_en),
    public.normalize_company_name(p_brand_name),
    public.normalize_company_name(p_slug),
    public.normalize_company_name(p_search_aliases)
  )), '')
$$;

comment on function public.company_search_key(text,text,text,text,text) is
  '企業検索用の正規化キー。name / name_en / brand_name / slug / search_aliases を'
  '**列ごとに** normalize_company_name() へ通してから空白で連結する。'
  '⚠️ 検索するときは打った文字も normalize_company_name() に通すこと。'
  '⚠️ 正規化の規則はここに書かない。normalize_company_name() が唯一の実体。';

-- ── ② 列を足す ──────────────────────────────────────────────────────────────
-- ⚠️ `ow_companies` は UPDATE が列単位 GRANT なので、新しい列は**権限なしで生まれる**。
--    この列はトリガーしか書かないので、それが正しい状態（`normalized_name` と同じ）。
--    SELECT は anon にテーブルレベルなので、足すだけで読める。
alter table public.ow_companies add column if not exists search_key text;

comment on column public.ow_companies.search_key is
  '【導出】company_search_key() が作る検索用の正規化キー。'
  'trg_ow_companies_normalized_name が維持する。**手で UPDATE しないこと。**';

-- ── ③ 既存のトリガー関数を拡張する ──────────────────────────────────────────
-- ⚠️★**2本目のトリガーを足さないこと。** BEFORE INSERT OR UPDATE で全列を見る
--    既存のトリガーがあるので、そこに1行足せば `search_aliases` の更新にも追随する。
create or replace function public.ow_companies_set_normalized_name()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  NEW.normalized_name := public.normalize_company_name(NEW.name);
  /* ★2026-10-01 追加。検索の入力揺れを吸収するキー（理由は company_search_key の COMMENT） */
  NEW.search_key := public.company_search_key(
    NEW.name, NEW.name_en, NEW.brand_name, NEW.slug, NEW.search_aliases);
  RETURN NEW;
END
$function$;

-- ── ④ バックフィル ──────────────────────────────────────────────────────────
-- ⚠️ トリガーが計算するので、値を直接書かず「素通しの UPDATE」で発火させる。
--    ⚠️★`trg_guard_company_approval` は `is_published` を立てる方向だけを止めるので、
--       この UPDATE は通る（実測で確認する）。
update public.ow_companies set name = name;

-- ── ⑤ 検算 ──────────────────────────────────────────────────────────────────
do $$
declare n_null int; n_total int; v_sf text; v_pivot text;
begin
  select count(*) into n_total from public.ow_companies;
  select count(*) into n_null  from public.ow_companies where search_key is null;
  if n_null <> 0 then raise exception 'search_key が空の行がある: % / % 件', n_null, n_total; end if;

  select search_key into v_sf    from public.ow_companies where slug = 'salesforce';
  select search_key into v_pivot from public.ow_companies where slug = 'pivot';

  -- ★実際に外れていた4つの入力が当たることを、ここで確かめる
  if v_sf not ilike '%'||public.normalize_company_name('せーるすふぉーす')||'%' then
    raise exception 'ひらがなで当たらない: %', v_sf; end if;
  if v_sf not ilike '%'||public.normalize_company_name('セールスフォースジャパン')||'%' then
    raise exception '中黒なしで当たらない: %', v_sf; end if;
  if v_sf not ilike '%'||public.normalize_company_name('ｾｰﾙｽﾌｫｰｽ')||'%' then
    raise exception '半角カナで当たらない: %', v_sf; end if;
  if v_sf not ilike '%'||public.normalize_company_name('ＳＡＬＥＳＦＯＲＣＥ')||'%' then
    raise exception '全角ラテンで当たらない: %', v_sf; end if;
  if v_pivot not ilike '%'||public.normalize_company_name('ぴぼっと')||'%' then
    raise exception '別名がひらがなで当たらない: %', v_pivot; end if;

  raise notice 'search_key を % 件に入れた。salesforce=[%] pivot=[%]', n_total, v_sf, v_pivot;
end $$;

commit;
