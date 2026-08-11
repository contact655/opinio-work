-- ═══════════════════════════════════════════════════════════════════════════
-- 経歴に「勤務地」と「理由データ」の箱を作る
--
-- ── なぜ今やるか（2026-08-12）──────────────────────────────────────────────
-- これからユーザー登録を本格的に集める。後から追記を頼んでも戻ってこない項目
-- だけを、登録が増える前にスキーマと入力UIへ用意しておく。
--
-- 中核価値は「求人票の建前を、在籍者の実データで検証できること」。
-- 2026-08-12 の調査（docs/current-state-20260812.md）で、それを支える2つが
-- どちらも存在しないことが分かった。
--
--   勤務地   … ow_experiences に勤務地に相当する列が1つも無い（全30列を確認）。
--              企業側の remote_work_status も 85社中83社が NULL。
--              「フルリモート可」を在籍者で検証する材料が両側とも無い。
--   理由     … join_reason（自由記述）が4件あるだけ。exit_reason は0件。
--              自由記述なので集計できない。
--
-- ── このmigrationがやること ────────────────────────────────────────────────
--   ① ow_experiences に prefecture / remote_work_status を追加（1-A）
--   ② ow_experiences に join_reasons / join_reason_primary / leave_reasons（1-B）
--   ③ ow_experience_gaps を新設（1-C。入社前後のギャップ6軸）
--
-- ⚠️ **追加のみ。既存14行の UPDATE / DELETE は一切しない。**
--    事後チェックで「既存の値が動いていないこと」「新列が全件 NULL であること」を
--    実測し、外れたらトランザクションごとロールバックする。
--
-- ── 直近に同じ列を触った migration（確認済み）──────────────────────────────
--   20260806170000_restrict_experience_salary … salary 4列の権限を剥奪
--   20260806190000_column_grants_sensitive     … join_reason の列単位 GRANT
--   20260807143353_visibility_company_default_real … 既定値の変更
--   いずれも本migrationが追加する列とは重ならない。打ち消しは無い。
--
-- ── 値はスラッグで固定する ─────────────────────────────────────────────────
-- 選択肢の値は英字スラッグ。日本語ラベルは src/lib/constants/careerReasons.ts が持つ。
-- 後から文言を変えても過去データと繋がるようにするため。
-- ⚠️ **削除と改名はしない。追加のみ。** CHECK を狭めると既存行が保存できなくなる。
--
-- ── 公開範囲 ───────────────────────────────────────────────────────────────
--   prefecture / remote_work_status … 表示する。anon / authenticated に SELECT を GRANT
--   理由データ3種 + gaps            … **非公開。本人と集計のみ。**
--                                      GRANT を書かない ＝ admin クライアント経由でしか
--                                      読めない（join_reason と同じ扱い）
--
-- ⚠️ ow_experiences は authenticated が **テーブルレベルの SELECT を持たない**
--    （列単位でのみ付与されている。2026-08-12 実測）。
--    したがって ADD COLUMN した列は**誰も SELECT できない状態で生まれる**。
--    表示したい列だけ明示的に GRANT する。これが本migrationの肝。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols int;
  v_dup  int;
BEGIN
  -- 追加する列がまだ無いこと
  SELECT count(*) INTO v_dup FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_experiences'
     AND column_name IN ('prefecture','remote_work_status',
                         'join_reasons','join_reason_primary','leave_reasons');
  IF v_dup <> 0 THEN
    RAISE EXCEPTION '追加しようとした列が既に % 件ある。中止', v_dup;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='ow_experience_gaps') THEN
    RAISE EXCEPTION 'ow_experience_gaps が既にある。中止';
  END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_experiences';
  IF v_cols <> 30 THEN
    RAISE EXCEPTION 'ow_experiences の列数が %（想定30）。中止', v_cols;
  END IF;

  -- ⚠️ 行数は中止条件にしない。追加のみのmigrationなので件数に依存しないため。
  --    「既存の値が動いていないこと」は事後チェックで実測する。
  RAISE NOTICE '適用前: ow_experiences % 列 / % 行', v_cols, (SELECT count(*) FROM public.ow_experiences);
END $$;

-- ═══ ① 勤務地（1-A）═══════════════════════════════════════════════════════

ALTER TABLE public.ow_experiences
  ADD COLUMN prefecture         text,
  ADD COLUMN remote_work_status text;

-- 都道府県は47値の CHECK にする。別マスタにしない。
--   ・47は固定集合で増減しない。マスタ化しても JOIN と GRANT と RLS が増えるだけ
--   ・TS 側には既に src/lib/utils/location.ts の PREFECTURES（47値）があり、
--     extractPrefecture() も同じ集合を前提にしている。新しい定数は作らず再利用する
--   ・CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」
ALTER TABLE public.ow_experiences
  ADD CONSTRAINT ow_experiences_prefecture_check CHECK (
    prefecture IS NULL OR prefecture = ANY (ARRAY[
      '北海道',
      '青森県','岩手県','宮城県','秋田県','山形県','福島県',
      '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
      '新潟県','富山県','石川県','福井県','山梨県','長野県',
      '岐阜県','静岡県','愛知県','三重県',
      '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
      '鳥取県','島根県','岡山県','広島県','山口県',
      '徳島県','香川県','愛媛県','高知県',
      '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
    ])
  );

-- ⚠️ 列名は remote_work_status。ow_jobs.work_style（CHECK の無いレガシー列）と
--    取り違えないため、CHECK 付きで正とされている側の名前に揃えた。
-- ⚠️ 値は ow_jobs.remote_work_status と同じ3値。
--    ow_companies 側は 'other' を含む4値だが、本人の勤務形態としては意味が取れず、
--    集計時に「その他」が溜まると検証に使えなくなるので入れない。
ALTER TABLE public.ow_experiences
  ADD CONSTRAINT ow_experiences_remote_work_status_check CHECK (
    remote_work_status IS NULL
    OR remote_work_status = ANY (ARRAY['full_remote','hybrid','on_site'])
  );

COMMENT ON COLUMN public.ow_experiences.prefecture IS
  'その在籍期間の勤務地（都道府県）。本人の居住地（ow_users.location）とは別物。'
  ' 直近（is_current=true）のみ入力UIで必須にしている。'
  ' ⚠️ DB では NOT NULL にしない。オンボーディングが勤務地なしで is_current=true の'
  ' 行を作るため（src/app/onboarding/OnboardingClient.tsx）。必須は UI 層だけ。';
COMMENT ON COLUMN public.ow_experiences.remote_work_status IS
  'その在籍期間の勤務形態（full_remote / hybrid / on_site）。'
  ' 企業・求人が名乗る remote_work_status を在籍者側から突き合わせるための列。'
  ' ⚠️ ow_jobs.work_style（CHECK 無しのレガシー列）とは別物。混同しないこと。';

-- ⚠️ **この GRANT が無いと誰も SELECT できない。**
--    ow_experiences の authenticated は SELECT を列単位でしか持っておらず、
--    ADD COLUMN した列は権限ゼロで生まれる（anon も同様）。
--    行の可否は RLS（ow_experiences_public_read / _login_only_read）が握る。
--    居住地 ow_users.location が既に anon 可なので、公開範囲の扱いは一貫している。
GRANT SELECT (prefecture, remote_work_status) ON TABLE public.ow_experiences TO anon;
GRANT SELECT (prefecture, remote_work_status) ON TABLE public.ow_experiences TO authenticated;

-- ═══ ② 入社理由・退職理由（1-B）═══════════════════════════════════════════

ALTER TABLE public.ow_experiences
  ADD COLUMN join_reasons        text[],
  ADD COLUMN join_reason_primary text,
  ADD COLUMN leave_reasons       text[];

-- 配列の部分集合判定は ow_companies.biz_model_types_check と同じ書き方（<@）。
-- ⚠️ 空配列 '{}' は通る。「1つも選ばなかった」と「未回答」を分けたい場合は
--    API 側で空配列を NULL に落とす（そうしている）。
ALTER TABLE public.ow_experiences
  ADD CONSTRAINT ow_experiences_join_reasons_check CHECK (
    join_reasons IS NULL OR join_reasons <@ ARRAY[
      'business','autonomy','people','salary','growth','work_style','skills','stability'
    ]
  );

ALTER TABLE public.ow_experiences
  ADD CONSTRAINT ow_experiences_leave_reasons_check CHECK (
    leave_reasons IS NULL OR leave_reasons <@ ARRAY[
      'salary','evaluation','management','outlook','job_fit','work_style',
      'relationships','company'
    ]
  );

-- 「決め手」は、選んだ入社理由の中の1つでなければならない。
-- ⚠️ これを DB で止めないと、チェックを外したのに決め手だけ残った行ができる。
--    集計で「決め手 = salary」なのに理由に salary が無い、という読めない行になる。
ALTER TABLE public.ow_experiences
  ADD CONSTRAINT ow_experiences_join_reason_primary_check CHECK (
    join_reason_primary IS NULL
    OR (join_reasons IS NOT NULL AND join_reason_primary = ANY (join_reasons))
  );

COMMENT ON COLUMN public.ow_experiences.join_reasons IS
  '入社理由（複数選択・スラッグ）。**非公開。本人と集計のみ。**'
  ' ⚠️ 既存の join_reason（自由記述・公開トグル visibility_reason つき）とは別列。'
  ' 自由記述の撤去は別タスク。それまで並存する。';
COMMENT ON COLUMN public.ow_experiences.join_reason_primary IS
  '入社の決め手（1つ）。join_reasons に含まれる値でなければ CHECK で弾かれる。**非公開。**';
COMMENT ON COLUMN public.ow_experiences.leave_reasons IS
  '退職理由（複数選択・スラッグ）。**非公開。本人と集計のみ。**'
  ' ⚠️ is_current=true の行には入らない想定だが CHECK では縛っていない。'
  ' 「現職に変更したのに退職理由が残っていて保存が落ちる」を避けるため。入力UIで出し分ける。';

-- ⚠️ **理由3種には GRANT を書かない。** これが非公開の担保。
--    ow_experiences の authenticated は SELECT を列単位でしか持たないので、
--    GRANT を書かなければ本人のセッションからも読めない（join_reason と同じ）。
--    読み書きは API が admin クライアントで行う。
--    書き込み側は authenticated がテーブルレベルの INSERT / UPDATE を持つため追加不要。

-- ═══ ③ 入社前後のギャップ（1-C）═══════════════════════════════════════════

-- ⚠️ 配列や jsonb にしない。軸ごとに集計する（「裁量は想像より厳しかった人が何%か」）
--    のが目的なので、行で持つ。UNIQUE(experience_id, axis) で1軸1行に固定する。
-- ⚠️ 「未回答」は行を作らないことで表す。だから axis / rating は NOT NULL でよい。
CREATE TABLE public.ow_experience_gaps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.ow_experiences(id) ON DELETE CASCADE,
  axis          text NOT NULL,
  rating        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ow_experience_gaps_axis_check CHECK (
    axis = ANY (ARRAY[
      'autonomy','onboarding','work_hours','evaluation','decision_speed','client_quality'
    ])
  ),
  CONSTRAINT ow_experience_gaps_rating_check CHECK (
    rating = ANY (ARRAY['better','as_expected','worse'])
  ),
  CONSTRAINT ow_experience_gaps_unique UNIQUE (experience_id, axis)
);

COMMENT ON TABLE public.ow_experience_gaps IS
  '入社前の想像と実際のギャップ。1経歴 × 1軸 = 1行。**非公開。本人と集計のみ。**'
  ' 他ユーザー・企業には一切出さない。anon には GRANT を付けていない。'
  ' ⚠️ 未回答は「行が無い」で表す。rating に "未回答" のような値を作らないこと。';
COMMENT ON COLUMN public.ow_experience_gaps.axis IS
  '評価軸のスラッグ。日本語ラベルは src/lib/constants/careerReasons.ts。'
  ' ⚠️ 削除と改名はしない。追加のみ。';
COMMENT ON COLUMN public.ow_experience_gaps.rating IS
  'better（想像より良かった）/ as_expected（想像通り）/ worse（想像より厳しかった）。';

-- ── GRANT（既定 ACL を打ち消してから付け直す）──────────────────────────────
-- 既定は 20260807050000 / 20260807060000 で絞ってあるが、
-- 「書いていない = 権限が無い」を migration 上で読み取れるように明示する。
REVOKE ALL ON TABLE public.ow_experience_gaps FROM PUBLIC;
REVOKE ALL ON TABLE public.ow_experience_gaps FROM anon;
REVOKE ALL ON TABLE public.ow_experience_gaps FROM authenticated;

-- ⚠️ anon には何も付けない（非公開データ）。GRANT 層で未ログインを完全に締める。
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ow_experience_gaps TO authenticated;
GRANT ALL ON TABLE public.ow_experience_gaps TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.ow_experience_gaps ENABLE ROW LEVEL SECURITY;

-- 本人の経歴にぶら下がる行だけ。
-- ⚠️ ow_users を自前で JOIN せず public.auth_ow_user_id() に寄せる（CLAUDE.md）。
--    この関数は SECURITY DEFINER / row_security=off / anon にも EXECUTE 付与済み（実測）。
-- ⚠️ 運営用の SELECT ポリシーは**あえて作らない**。集計は service_role
--    （createAdminClient）で行う方針で、/admin 配下はサーバーから admin クライアントで
--    読むことになっている（CLAUDE.md）。ブラウザセッションから読める経路を増やさない。
CREATE POLICY "ow_experience_gaps_own_manage" ON public.ow_experience_gaps
  FOR ALL TO authenticated
  USING (
    experience_id IN (
      SELECT e.id FROM public.ow_experiences e WHERE e.user_id = public.auth_ow_user_id()
    )
  )
  WITH CHECK (
    experience_id IN (
      SELECT e.id FROM public.ow_experiences e WHERE e.user_id = public.auth_ow_user_id()
    )
  );

-- updated_at は既存の汎用トリガー関数を使う（新しい関数を作らない）
CREATE TRIGGER trg_ow_experience_gaps_updated_at
  BEFORE UPDATE ON public.ow_experience_gaps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols       int;
  v_rows       int;
  v_join       int;
  v_exit       int;
  v_salary     int;
  v_dirty      int;
  v_gaps       int;
  v_checks     int;
  v_anon_gaps  int;
  v_auth_gaps  text;
  v_rls        boolean;
  v_pol        int;
  v_anon_pref  boolean;
  v_auth_pref  boolean;
  v_anon_rws   boolean;
  v_auth_rws   boolean;
  v_anon_jr    boolean;
  v_auth_jr    boolean;
  v_auth_lr    boolean;
  v_auth_ins   boolean;
  v_auth_upd   boolean;
BEGIN
  -- ① 列が5つ増えたこと
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_experiences';
  IF v_cols <> 35 THEN RAISE EXCEPTION '列数が %（想定35）。ロールバック', v_cols; END IF;

  -- ② 既存データが1行も動いていないこと（追加のみの担保）
  SELECT count(*), count(join_reason), count(exit_reason), count(salary_man)
    INTO v_rows, v_join, v_exit, v_salary FROM public.ow_experiences;
  IF v_rows   <> 14 THEN RAISE EXCEPTION '行数が %（適用前14）。ロールバック', v_rows; END IF;
  IF v_join   <> 4  THEN RAISE EXCEPTION 'join_reason が % 件（適用前4）。ロールバック', v_join; END IF;
  IF v_exit   <> 0  THEN RAISE EXCEPTION 'exit_reason が % 件（適用前0）。ロールバック', v_exit; END IF;
  IF v_salary <> 3  THEN RAISE EXCEPTION 'salary_man が % 件（適用前3）。ロールバック', v_salary; END IF;

  -- ③ 新列が全件 NULL であること（既存行を埋めていない）
  SELECT count(*) INTO v_dirty FROM public.ow_experiences
   WHERE prefecture IS NOT NULL OR remote_work_status IS NOT NULL
      OR join_reasons IS NOT NULL OR join_reason_primary IS NOT NULL
      OR leave_reasons IS NOT NULL;
  IF v_dirty <> 0 THEN
    RAISE EXCEPTION '新列が埋まっている行が % 件（このmigrationは埋めない）。ロールバック', v_dirty;
  END IF;

  -- ④ CHECK が5本増えたこと
  SELECT count(*) INTO v_checks FROM pg_constraint
   WHERE conrelid='public.ow_experiences'::regclass AND contype='c'
     AND conname IN ('ow_experiences_prefecture_check',
                     'ow_experiences_remote_work_status_check',
                     'ow_experiences_join_reasons_check',
                     'ow_experiences_leave_reasons_check',
                     'ow_experiences_join_reason_primary_check');
  IF v_checks <> 5 THEN RAISE EXCEPTION 'CHECK が % 本（想定5）。ロールバック', v_checks; END IF;

  -- ⑤ 勤務地2列は読める / 理由3列は読めない
  v_anon_pref := has_column_privilege('anon','public.ow_experiences','prefecture','SELECT');
  v_auth_pref := has_column_privilege('authenticated','public.ow_experiences','prefecture','SELECT');
  v_anon_rws  := has_column_privilege('anon','public.ow_experiences','remote_work_status','SELECT');
  v_auth_rws  := has_column_privilege('authenticated','public.ow_experiences','remote_work_status','SELECT');
  IF NOT (v_anon_pref AND v_auth_pref AND v_anon_rws AND v_auth_rws) THEN
    RAISE EXCEPTION '勤務地2列の SELECT 権限が付いていない（anon pref=% rws=% / auth pref=% rws=%）。ロールバック',
      v_anon_pref, v_anon_rws, v_auth_pref, v_auth_rws;
  END IF;

  v_anon_jr := has_column_privilege('anon','public.ow_experiences','join_reasons','SELECT');
  v_auth_jr := has_column_privilege('authenticated','public.ow_experiences','join_reasons','SELECT');
  v_auth_lr := has_column_privilege('authenticated','public.ow_experiences','leave_reasons','SELECT');
  IF v_anon_jr OR v_auth_jr OR v_auth_lr THEN
    RAISE EXCEPTION '理由列が SELECT できてしまう（anon join=% / auth join=% leave=%）。ロールバック',
      v_anon_jr, v_auth_jr, v_auth_lr;
  END IF;

  -- ⑥ 書き込みは通ること（POST / PATCH はセッションクライアントを使う）
  v_auth_ins := has_column_privilege('authenticated','public.ow_experiences','join_reasons','INSERT');
  v_auth_upd := has_column_privilege('authenticated','public.ow_experiences','join_reasons','UPDATE');
  IF NOT (v_auth_ins AND v_auth_upd) THEN
    RAISE EXCEPTION '理由列に書き込めない（INSERT=% UPDATE=%）。ロールバック', v_auth_ins, v_auth_upd;
  END IF;

  -- ⑦ ow_experience_gaps
  SELECT count(*) INTO v_gaps FROM public.ow_experience_gaps;
  IF v_gaps <> 0 THEN RAISE EXCEPTION 'gaps に % 行入っている（想定0）。ロールバック', v_gaps; END IF;

  SELECT count(*) INTO v_anon_gaps FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_experience_gaps' AND grantee='anon';
  IF v_anon_gaps <> 0 THEN
    RAISE EXCEPTION 'gaps に anon の権限が % 件残っている。ロールバック', v_anon_gaps;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.column_privileges
              WHERE table_schema='public' AND table_name='ow_experience_gaps' AND grantee='anon') THEN
    RAISE EXCEPTION 'gaps に anon の列単位権限が残っている。ロールバック';
  END IF;

  SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) INTO v_auth_gaps
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='ow_experience_gaps' AND grantee='authenticated';
  IF v_auth_gaps IS DISTINCT FROM 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'gaps の authenticated 権限が %（想定 DELETE,INSERT,SELECT,UPDATE）。ロールバック', v_auth_gaps;
  END IF;

  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid='public.ow_experience_gaps'::regclass;
  IF NOT v_rls THEN RAISE EXCEPTION 'gaps の RLS が無効。ロールバック'; END IF;

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='ow_experience_gaps';
  IF v_pol <> 1 THEN RAISE EXCEPTION 'gaps のポリシーが % 本（想定1）。ロールバック', v_pol; END IF;

  RAISE NOTICE '完了: ow_experiences % 列（+5、全件NULL）/ 既存 % 行は無変更 / gaps 作成（anon権限0・ポリシー1本）',
    v_cols, v_rows;
END $$;

COMMIT;
