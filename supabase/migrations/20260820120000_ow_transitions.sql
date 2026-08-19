-- ═══════════════════════════════════════════════════════════════════════════
-- ow_transitions：転職（会社が変わった隣接ペア）を引けるようにする（2026-08-20）
--
-- ── 目的 ─────────────────────────────────────────────────────────────────
--   「美容師からIT営業になった人」「未経験から外資ITに転職した人」を
--   **WHERE 句で引ける**ようにする。いまは職歴を1件ずつ突き合わせないと分からない。
--
-- ── 今回作らないもの ─────────────────────────────────────────────────────
--   ⚠️ **検索UI・検索API・フリーワード解釈層は作らない。**
--      会社が変わる隣接ペアが**5件**（両側がマスタ企業なのは4件）しかなく、
--      検索を作っても動作確認すらできない。**構造だけ先に作る。**
--
-- ── 生成方式：バッチで全件洗い替え。トリガーは採らない ───────────────────
--   ① 遷移は**隣接ペア**なので、職歴を1行足すと前後の行の遷移も作り直しになる
--   ② `age_at_move` は `ow_users.birth_date` 依存。生年月日は職歴と無関係に
--      後から入るので、**職歴のトリガーでは拾えない**
--   ③ 量が小さい（現状9ペア）ので洗い替えで十分
--
--   実体は `public.rebuild_ow_transitions()`。**冪等**（TRUNCATE → 再構築）。
--
-- ── 3値（changed / unchanged / unknown）────────────────────────────────
--   ⚠️ **`is_role_change` / `is_industry_change` は boolean ではなく text の3値。**
--      自由入力の企業（実ユーザーの職歴の27.8%）は業種に結びつける手段が無い。
--      2値にすると「不明」を「変わらない」に潰してしまい、
--      **「異業界に転職した人」を数えたときに静かに少なく出る。**
--      列名が `is_` で始まるのに boolean でないのは読みにくいが、
--      **3値であることのほうが重要**なので名前より意味を優先した。
--
-- ── `moved_at` の定義 ────────────────────────────────────────────────────
--   **次の在籍の `started_at`**（＝新しい会社に入った日）を採る。
--   前職の `ended_at` を使わない理由:
--     ・`ended_at` は NULL でも保存できる（在籍中のまま次を足す人がいる）
--     ・空白期間があるとき「いつ転職したか」は**入社日**のほうが実態に近い
--   ⚠️ **空白期間・在籍の重なりはこの表では表現していない。**
--      必要になったら `gap_months` を足す（今回は入れない。使い道が決まっていない）。
--
-- ── 権限 ─────────────────────────────────────────────────────────────────
--   ⚠️ **anon にも authenticated にも GRANT しない。** 読むのは admin クライアントだけ。
--      開けると PostgREST から**全員分の転職履歴**が取れてしまう。
--   ⚠️ **RLS は有効にするが、ポリシーは1本も作らない。**
--      「誰にも読ませない」は GRANT で、「誰に読ませるか」は RLS で書く（CLAUDE.md）。
--      いまは誰にも読ませないので、**書くべきポリシーが無い**。
--      死んだポリシーを置くと、次に読む人が「誰かに開いている」と誤解する。
--   ⚠️ ポリシーを作らないことで、**ポリシー式が `ow_users` を副問い合わせする問題**
--      （実行ユーザーの権限で評価され、無関係な表が403になる）も持ち込まない。
--      authenticated に開けるときは、そのとき初めてポリシーを書く。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.ow_transitions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES public.ow_users(id) ON DELETE CASCADE,

  -- 会社。**マスタ紐づけと自由入力の両方を持つ**（自由入力を落とさないため）
  from_company_id             uuid REFERENCES public.ow_companies(id) ON DELETE SET NULL,
  to_company_id               uuid REFERENCES public.ow_companies(id) ON DELETE SET NULL,
  from_company_text           text,
  to_company_text             text,

  -- 職種
  from_role_category_id       uuid REFERENCES public.ow_roles(id) ON DELETE SET NULL,
  to_role_category_id         uuid REFERENCES public.ow_roles(id) ON DELETE SET NULL,

  -- 業種（`ow_companies.industry` のスナップショット。自由入力企業では NULL）
  from_industry               text,
  to_industry                 text,

  moved_at                    date NOT NULL,

  -- ⚠️ 算出できるのは実ユーザー14人中4人だけ。**これで絞る機能は作らない**
  age_at_move                 integer,
  -- 主軸はこちら。最も古い started_at から moved_at までの年数
  years_of_experience_at_move integer,

  is_role_change              text NOT NULL CHECK (is_role_change     IN ('changed','unchanged','unknown')),
  is_industry_change          text NOT NULL CHECK (is_industry_change IN ('changed','unchanged','unknown')),

  -- 洗い替えの時刻。行の鮮度を見るため
  built_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ow_transitions IS
  '転職（会社が変わった隣接ペア）。**バッチで全件洗い替え**する導出テーブルで、'
  'ここに直接 INSERT しない。再構築は public.rebuild_ow_transitions()。'
  '⚠️ anon / authenticated に GRANT しない（admin クライアントから読む）。';

COMMENT ON COLUMN public.ow_transitions.moved_at IS
  '次の在籍の started_at（新しい会社に入った日）。前職の ended_at ではない。';
COMMENT ON COLUMN public.ow_transitions.is_industry_change IS
  'changed / unchanged / unknown の3値。自由入力の企業は業種が引けないので unknown。'
  '⚠️ boolean にしないこと。unknown を unchanged に潰すと異業界転職が少なく出る。';
COMMENT ON COLUMN public.ow_transitions.age_at_move IS
  'moved_at 時点の年齢。birth_date が無ければ NULL。**絞り込みには使わない**（母数が少なすぎる）。';

CREATE INDEX IF NOT EXISTS ow_transitions_user_idx     ON public.ow_transitions (user_id);
CREATE INDEX IF NOT EXISTS ow_transitions_to_company   ON public.ow_transitions (to_company_id);
CREATE INDEX IF NOT EXISTS ow_transitions_from_company ON public.ow_transitions (from_company_id);
CREATE INDEX IF NOT EXISTS ow_transitions_moved_at     ON public.ow_transitions (moved_at);
CREATE INDEX IF NOT EXISTS ow_transitions_changes      ON public.ow_transitions (is_role_change, is_industry_change);

ALTER TABLE public.ow_transitions ENABLE ROW LEVEL SECURITY;

-- ⚠️ 明示的に剥がす。既定ACLで付いていないことは確かめるが、意図を残すために書く。
REVOKE ALL ON public.ow_transitions FROM anon, authenticated;

-- ── 洗い替え ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rebuild_ow_transitions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_count integer;
BEGIN
  /* ⚠️ 全件洗い替え。**冪等**（2回流しても同じ結果になる）。
        差分更新にしないのは、隣接ペアが前後の行に依存するため。 */
  DELETE FROM public.ow_transitions;

  INSERT INTO public.ow_transitions (
    user_id,
    from_company_id, to_company_id, from_company_text, to_company_text,
    from_role_category_id, to_role_category_id,
    from_industry, to_industry,
    moved_at, age_at_move, years_of_experience_at_move,
    is_role_change, is_industry_change
  )
  WITH exp AS (
    SELECT
      e.id, e.user_id, e.company_id, e.company_text, e.role_category_id,
      e.started_at, e.ended_at,
      /* 会社の同一性キー。マスタ紐づけは id、自由入力は正規化した社名、
         匿名企業は行ごとに別会社として扱う（同じ会社かどうか判定できないため）。 */
      COALESCE(e.company_id::text, LOWER(BTRIM(e.company_text)), 'anon:' || e.id::text) AS ckey
    FROM public.ow_experiences e
    JOIN public.ow_users u ON u.id = e.user_id
    /* ⚠️ 検証用アカウントとシステムユーザーは入れない。集計に混ざる。 */
    WHERE COALESCE(u.is_test, false) = false
      AND COALESCE(u.is_system, false) = false
  ),
  first_start AS (
    SELECT user_id, MIN(started_at) AS career_start FROM exp GROUP BY user_id
  ),
  pairs AS (
    SELECT
      user_id, ckey, company_id, company_text, role_category_id,
      LEAD(ckey)             OVER w AS to_ckey,
      LEAD(company_id)       OVER w AS to_company_id,
      LEAD(company_text)     OVER w AS to_company_text,
      LEAD(role_category_id) OVER w AS to_role_category_id,
      LEAD(started_at)       OVER w AS to_started_at
    FROM exp
    /* 並びは started_at。同じ月に始まった行は ended_at の早いほうを先にする
       （在籍が終わっていない行を後ろに置く）。 */
    WINDOW w AS (PARTITION BY user_id ORDER BY started_at, COALESCE(ended_at, DATE '9999-12-31'))
  )
  SELECT
    p.user_id,
    p.company_id, p.to_company_id, p.company_text, p.to_company_text,
    p.role_category_id, p.to_role_category_id,
    cf.industry, ct.industry,
    p.to_started_at AS moved_at,
    /* 年齢。誕生日が来ていなければ1引く。birth_date が無ければ NULL */
    CASE WHEN u.birth_date IS NULL THEN NULL
         ELSE EXTRACT(YEAR FROM AGE(p.to_started_at, u.birth_date))::int
    END,
    /* 社会人年数。最も古い在籍開始から moved_at まで。マイナスにはしない */
    GREATEST(0, EXTRACT(YEAR FROM AGE(p.to_started_at, fs.career_start))::int),
    /* 職種は ow_experiences で NOT NULL なので基本は判定できる。
       それでも unknown を持つのは、将来 NULL 可になったときに
       静かに unchanged へ倒れないようにするため。 */
    CASE WHEN p.role_category_id IS NULL OR p.to_role_category_id IS NULL THEN 'unknown'
         WHEN p.role_category_id <> p.to_role_category_id THEN 'changed'
         ELSE 'unchanged' END,
    /* ★業種は**両側がマスタ紐づけで、かつ industry が入っているときだけ**判定する。
       片側でも自由入力なら unknown。ここを2値にすると異業界転職が少なく出る。 */
    CASE WHEN cf.industry IS NULL OR ct.industry IS NULL THEN 'unknown'
         WHEN cf.industry <> ct.industry THEN 'changed'
         ELSE 'unchanged' END
  FROM pairs p
  JOIN public.ow_users u  ON u.id = p.user_id
  JOIN first_start fs     ON fs.user_id = p.user_id
  LEFT JOIN public.ow_companies cf ON cf.id = p.company_id
  LEFT JOIN public.ow_companies ct ON ct.id = p.to_company_id
  WHERE p.to_ckey IS NOT NULL
    /* ★会社が変わったペアだけ。同じ会社での役割変更は転職ではない。 */
    AND p.to_ckey <> p.ckey;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

COMMENT ON FUNCTION public.rebuild_ow_transitions() IS
  'ow_transitions を全件洗い替えする。冪等。戻り値は作った行数。'
  '⚠️ 手動実行のみ（2026-08-20 時点）。cron もトリガーも張っていない。';

/* ⚠️ 実行できるのは service_role（admin クライアント）だけにする。
      SECURITY DEFINER なので、anon / authenticated に EXECUTE を残すと
      誰でも洗い替えを走らせられる。 */
REVOKE ALL ON FUNCTION public.rebuild_ow_transitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_ow_transitions() TO service_role;

DO $$
DECLARE v_anon boolean; v_auth boolean; v_pol int; v_rls boolean;
BEGIN
  v_anon := has_table_privilege('anon','public.ow_transitions','SELECT');
  v_auth := has_table_privilege('authenticated','public.ow_transitions','SELECT');
  IF v_anon OR v_auth THEN
    RAISE EXCEPTION 'ow_transitions が anon(%) / authenticated(%) から読める。中止', v_anon, v_auth;
  END IF;

  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid='public.ow_transitions'::regclass;
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS が有効になっていない。中止'; END IF;

  SELECT count(*) INTO v_pol FROM pg_policy WHERE polrelid='public.ow_transitions'::regclass;
  IF v_pol <> 0 THEN RAISE EXCEPTION 'ポリシーが % 本ある（想定0）。中止', v_pol; END IF;

  IF has_function_privilege('anon','public.rebuild_ow_transitions()','EXECUTE')
     OR has_function_privilege('authenticated','public.rebuild_ow_transitions()','EXECUTE') THEN
    RAISE EXCEPTION '洗い替え関数が anon / authenticated から実行できる。中止';
  END IF;

  RAISE NOTICE 'ow_transitions: RLS 有効 / ポリシー0本 / anon・authenticated から読めない';
END $$;

COMMIT;
