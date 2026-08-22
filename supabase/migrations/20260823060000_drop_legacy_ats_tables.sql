-- ============================================================================
-- 旧ATSプロダクトの44表を落とす
--
-- 2026-08-23。届出のための調査で見つかり、同日 20260823050000 で
-- anon / authenticated の GRANT を剥がした表。**使用者がいないことを確認して削除する。**
--
-- ── この表は何だったか ──────────────────────────────────────────────────
-- `ow_` 接頭辞を持たない44表は、この Supabase プロジェクトを共有していた
-- **別アプリ（マルチテナント型のATS／人材紹介CRM）の試作**の名残。
-- `tenants` / `tenant_id` を軸にした schema で、このリポジトリの migration 履歴には
-- 最初から存在しない（baseline のダンプに初出）。
--
-- 実データ129行はすべて **2026-03-11〜03-27** に作られたもの。
-- サーバーが割り当てる xmin（クライアントから偽装できない）で確認したところ、
-- 全129行が 2026-05-11 の取引より前の番号で、**以後まったく触られていない**。
-- 2026-08-23 に「別アプリはもう使っていない」ことを確認したため削除する。
--
-- ── ⚠️ なぜ急いだか ─────────────────────────────────────────────────────
-- **anon が SELECT / INSERT / UPDATE / DELETE の4権限を持っていた**（44表中41表）。
-- RLS は有効だったがポリシーが anon にも開いており、**未ログインで実際に行が
-- 返っていた**（candidate_documents / candidate_notes / applications など9表）。
-- 中身はダミーだったが、`candidates` は13行の実データ（氏名・メール13件・電話7件・
-- 年収）を持っており、ポリシーが1本変われば出る位置にあった。
--
-- ⚠️ 求職者向けサービスのDBに人材紹介の候補者台帳が同居している状態そのものを
--    解消する。**同じ形を作らないこと。**
--
-- ── 削除しても壊れないことの確認（適用前に実施）────────────────────────
--   ① このリポジトリの src からの参照 **0件**
--      （543ファイルを走査。陽性対照 `.from("ow_jobs")` は61件ヒット）
--   ② 44表を副問い合わせする `ow_` 側の RLS ポリシー **0本**
--   ③ **44表の「外」から44表を参照している外部キー 0本**
--      （陽性対照: 44表から外への外部キーは16本あるので検出は効いている）
--   ④ ビュー・関数からの参照 … 精査した結果**すべて誤検出**だった:
--        ・`ow_business_monthly_stats` … 列の別名 `AS applications` に当たっていた。
--          実体は ow_companies / ow_jobs / ow_applications のみ
--        ・`ow_uploads_can_write`      … Storage のフォルダ名の文字列 `'companies'`
--        ・`merge_role`                … JSONキーと変数名の `jobs`
--   ⑤ Edge Function **0本** / pg_cron 拡張 **未導入** / Webhook トリガー **0本**
--   ⑥ トリガーは6本あるが**すべて44表自身の上**（updated_at と portal_token）。
--      表と一緒に落ちる。
--
-- ⚠️ **`get_tenant_id()` は孤児になる。**（本文が `agents` を参照している）
--    呼び出し元は**44表自身の tenant_isolation ポリシー14本だけ**なので、
--    表を落とせば呼ぶものが無くなる。**このmigrationでは落としていない**
--    （スコープ外。別タスクで判断する）。
--
-- ⚠️ `work_histories_company_id_fkey` は `ow_companies` を**参照する側**なので、
--    落としても ow_companies は無傷。
--
-- ── ⚠️ Storage は消えない ───────────────────────────────────────────────
-- `candidate-documents` バケット（非公開・2ファイル・約1.99MB）は
-- **テーブルを落としても残る。** 今回は**意図して残している**。
-- 保全済み: .dumps/storage-candidate-documents/（manifest.json に元パス）
-- ⚠️ 「表は消えたがファイルだけ残る」状態なので、扱いを決めること。
--
-- ── 復元 ────────────────────────────────────────────────────────────────
-- 作業前ダンプ: .dumps/20260823-0031-*.sql （11ファイル / 計 149,474 バイト）
--   CREATE TABLE 44/44 表 / 実データ 129行（candidates 13行を含む）
--   ⚠️ `.gitignore` 済み。**コミットしない。**
-- ⚠️ pg_dump の既定で GRANT 文は入っていない。戻すときは権限を自分で付けること。
--    ただし**戻すなら anon には配らないこと**（それが今回の問題の原因）。
-- ============================================================================

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_tables int;
  v_rows   int := 0;
  v_ow     int;
  r        record;
  n        int;
BEGIN
  SELECT count(*) INTO v_tables FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname NOT LIKE 'ow\_%';

  IF v_tables <> 44 THEN
    RAISE EXCEPTION '旧ATSの表が44件ではない（%件）。対象が変わっている', v_tables;
  END IF;

  -- 合計行数を実カウントする（統計の概算ではなく）
  FOR r IN SELECT c.relname FROM pg_class c
            WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
              AND c.relname NOT LIKE 'ow\_%'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.relname) INTO n;
    v_rows := v_rows + n;
  END LOOP;

  IF v_rows <> 129 THEN
    RAISE EXCEPTION '合計行数が129ではない（%行）。ダンプを取った対象と違う', v_rows;
  END IF;

  /* ow_ 側の表数。⚠️ **実測値をベタ書きする（2026-08-23: 92表）。**
     TEMP TABLE で持ち回すと、migration が1トランザクションで流れなかったときに
     消えて③が落ちる。定数なら実行のされ方に依存しない。 */
  SELECT count(*) INTO v_ow FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname LIKE 'ow\_%';
  IF v_ow <> 92 THEN
    RAISE EXCEPTION 'ow_ 側が92表ではない（%表）。前提が変わっているので中止', v_ow;
  END IF;

  RAISE NOTICE '削除前: 旧ATS %表 / 合計 %行 / ow_ 側 %表', v_tables, v_rows, v_ow;
END $$;

-- ── ② 依存順に落とす ────────────────────────────────────────────────────
-- ⚠️ **CASCADE は使わない。** 使うと想定外のものを巻き込んでも気づけない。
--    参照される側を後に置く（子 → 親）。順序が違えば依存エラーで止まる。
--    段の算出は外部キーのトポロジカルソート（2026-08-23 実測）。

-- 段0: 参照されていない表（31）
DROP TABLE public.agent_client_relations;
DROP TABLE public.agent_company_access;
DROP TABLE public.agent_members;
DROP TABLE public.ai_interviews;
DROP TABLE public.candidate_certifications;
DROP TABLE public.candidate_documents;
DROP TABLE public.candidate_educations;
DROP TABLE public.candidate_hearings;
DROP TABLE public.candidate_job_activities;
DROP TABLE public.candidate_messages;
DROP TABLE public.candidate_notes;
DROP TABLE public.candidate_timeline_events;
DROP TABLE public.candidate_work_histories;
DROP TABLE public.channels;
DROP TABLE public.competing_offers;
DROP TABLE public.concurrent_applications;
DROP TABLE public.crm_activities;
DROP TABLE public.crm_applications;
DROP TABLE public.crm_client_companies;
DROP TABLE public.crm_interviews;
DROP TABLE public.iv_messages;
DROP TABLE public.job_interests;
DROP TABLE public.nurturing_candidates;
DROP TABLE public.offer_letters;
DROP TABLE public.salary_viewers;
DROP TABLE public.scout_history;
DROP TABLE public.scout_messages;
DROP TABLE public.selection_feedback;
DROP TABLE public.talent_profiles;
DROP TABLE public.tenant_master_options;
DROP TABLE public.work_histories;   -- ⚠️ ow_companies を参照する側。ow_ 側は無傷

-- 段1（5）
DROP TABLE public.crm_candidates;
DROP TABLE public.employer_jobs;
DROP TABLE public.evaluations;
DROP TABLE public.iv_interviews;
DROP TABLE public.talent_pool;

-- 段2（3）
DROP TABLE public.applications;
DROP TABLE public.employer_profiles;
DROP TABLE public.iv_companies;

-- 段3（3）
DROP TABLE public.agents;
DROP TABLE public.candidates;
DROP TABLE public.jobs;

-- 段4（1）
DROP TABLE public.companies;

-- 段5（1）— 全体の親
DROP TABLE public.tenants;

-- ── ③ 適用後の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_left int;
  v_ow   int;
BEGIN
  SELECT count(*) INTO v_left FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname NOT LIKE 'ow\_%';
  IF v_left <> 0 THEN
    RAISE EXCEPTION '旧ATSの表が%件残っている', v_left;
  END IF;

  SELECT count(*) INTO v_ow FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname LIKE 'ow\_%';

  -- ⚠️ ow_ 側を1つでも巻き込んでいたら止める（CASCADE を使わない理由そのもの）
  IF v_ow <> 92 THEN
    RAISE EXCEPTION 'ow_ 側の表数が変わっている（92 → %）。巻き添えが起きている', v_ow;
  END IF;

  RAISE NOTICE '削除後: 旧ATS 0表 / ow_ 側 %表（変化なし）/ public 合計 %表', v_ow, v_ow;
END $$;
