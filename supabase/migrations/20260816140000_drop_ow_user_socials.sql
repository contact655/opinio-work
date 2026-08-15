-- ═══════════════════════════════════════════════════════════════════════════
-- ow_user_socials を DROP する
--
-- ── なぜ消すか（2026-08-16 実測）────────────────────────────────────────
--   行 **0件** ／ src からの参照 **0件** ／ 他テーブルからの FK **0** ／
--   ビュー **0** ／ 関数 **0** ／ トリガー **0**（DROP 直前に取り直した値）
--
--   ① 用途が既存テーブルと重なる。
--      「並び順つき・ラベルつきのリンク集」は `ow_user_content_links` が担っている
--      （url / platform / title / description / thumbnail_url / sort_order）。
--      単純な SNS リンクは `ow_users.social_links`（JSONB）が現役で、2名が使用中。
--   ② **この表のほうが対応プラットフォームが狭い。**
--      CHECK は note / x / github / linkedin / other の5種で、
--      現役の `SNS_PLATFORMS`（x / linkedin / github / instagram / facebook /
--      youtube / note）に届いていない。使い始めるにも作り直しが要る。
--   ③ 参照が無いので、消して壊れるものが無い（型は `npm run gen:types` で追随）。
--
-- ── ★消した設計判断（ここにしか残らないので必ず読むこと）──────────────────
--   この表には **`oauth_token`** 列があった。`FOR SELECT USING (true)` ＋ anon に
--   GRANT が付いた状態で、**値が入っていたら未ログインの第三者がトークンを読めた**
--   （0件だったので実害なし。2026-08-16 に own + admin へ絞ってから、ここで消す）。
--
--   ⚠️ **SNS 連携をやるときに、この表を復活させないこと。**
--      トークンは**クライアントから読めるテーブルに置かない**。
--      own ポリシーにしても「本人は読める」＝ブラウザに出せる状態は変わらない
--      （2026-08-16 に実測で確認した）。
--      サーバー専用の置き場（service_role のみ GRANT）か Supabase Vault を使い、
--      **アプリからはトークンそのものを返さない**設計にする。
--
--   ⚠️ 「並び順・表示ラベル・認証済みバッジ」が欲しくなったら、
--      新しい表を作る前に `ow_user_content_links` に列を足せないかを先に見ること。
--      同じ用途の表を2つ持つと、どちらが正かが画面ごとに割れる。
--
-- ⚠️ DROP の前に CLAUDE.md のチェックリストを通した。PL/pgSQL の本体は Postgres が
--    依存として追跡しないため、FK が0でも関数の中で参照されていることがある
--    （上記のとおり関数0件を確認済み）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.ow_user_socials;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ow_user_socials が % 件ある。消さない', v_rows; END IF;

  IF (SELECT count(*) FROM pg_constraint WHERE confrelid='public.ow_user_socials'::regclass) <> 0 THEN
    RAISE EXCEPTION '他テーブルから参照されている（FK）。消さない';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='v'
                AND pg_get_viewdef(c.oid) LIKE '%ow_user_socials%') THEN
    RAISE EXCEPTION 'ビューから参照されている。消さない';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.prokind='f'
                AND pg_get_functiondef(p.oid) LIKE '%ow_user_socials%') THEN
    RAISE EXCEPTION '関数から参照されている。消さない';
  END IF;

  RAISE NOTICE 'DROP 直前の確認: 0件 / FK0 / ビュー0 / 関数0';
END $$;

DROP TABLE public.ow_user_socials;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='ow_user_socials') THEN
    RAISE EXCEPTION 'テーブルが残っている。ロールバック';
  END IF;
  RAISE NOTICE '完了: ow_user_socials を DROP した';
END $$;

COMMIT;
