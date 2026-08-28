-- ═══════════════════════════════════════════════════════════════════════════
-- ツール（標準スキル）を Sansan まで広げ、生藤 弘樹さんに3件登録する（2026-08-29）
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
-- ① `ow_tool_masters` に **Sansan** を足す（78 → 79）
-- ② `ow_skills` に **Sansan** を足す（48 → 49）
-- ③ `ow_user_skills` に生藤さんの3件を入れる（0 → 3）
--      Salesforce / HubSpot / Sansan
--
-- ── ★出所 ──────────────────────────────────────────────────────────────────
-- **柴さんの申告**（2026-08-29）。「生藤さんは Salesforce・HubSpot・Sansan を
-- 使ったことがある」。⚠️ 推測ではない。⚠️ 公開情報から機械的に入れた値でもない。
--
-- ⚠️ **本人はいつでも自分で消せる**（`/mypage/details/skills`）。
--    `ow_user_skills` は本人の RLS で読み書きでき、運営が入れた行も同じ扱いになる。
--    「運営が入れたので消せない」形にはしていない。
--
-- ── なぜ Sansan がマスタに無かったか ────────────────────────────────────────
-- `ow_skills` 48件はすべて `tool_id` で `ow_tool_masters` に紐づいており、
-- **tool_id が NULL の行は1件も無い**（2026-08-29 実測）。
-- したがって Sansan も**両方に入れる**。片方だけだと形が割れる。
--
-- ⚠️ `category` は **`sales`**。`ow_tool_masters` の既存値は
--    crm 5 / marketing 7 / dev 23 / data 8 / communication 7 / sales 3 /
--    other 15 / calendar 2 / email 2 / ai 6 で、`sales` は Outreach / SalesLoft /
--    Gong の3件。Sansan（営業DB・名刺管理）はここが最も近い。
--    ⚠️ `crm` にしない。Salesforce / HubSpot / Zendesk / Freshsales /
--       Dynamics 365 の並びとは役割が違う。
--
-- ⚠️ `ow_skills.category` は **`product`**。CHECK が
--    product / method / sales_domain の3値なので、ツールは product しか取れない
--    （`src/lib/constants/skills.ts` の `SKILL_CATEGORIES` と同じ3値）。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ:
--     .dumps/20260829-0136-ow_user_skills-ow_skills-ow_tool_masters.sql
--     （スキーマ+データ / ow_user_skills 0行・ow_skills 48行・ow_tool_masters 78行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_tools int; v_skills int; v_us int; v_sansan int; v_null_tool int;
BEGIN
  SELECT count(*) INTO v_tools  FROM public.ow_tool_masters;
  SELECT count(*) INTO v_skills FROM public.ow_skills;
  SELECT count(*) INTO v_us     FROM public.ow_user_skills;

  IF v_tools  <> 78 THEN RAISE EXCEPTION 'ow_tool_masters が % 行（78 のはず）。中止', v_tools;  END IF;
  IF v_skills <> 48 THEN RAISE EXCEPTION 'ow_skills が % 行（48 のはず）。中止', v_skills; END IF;
  IF v_us     <> 0  THEN RAISE EXCEPTION 'ow_user_skills が % 行（0 のはず）。中止', v_us; END IF;

  -- ★二重適用を成功に見せない
  SELECT count(*) INTO v_sansan FROM public.ow_skills WHERE label = 'Sansan';
  IF v_sansan <> 0 THEN RAISE EXCEPTION 'Sansan が既にある。適用済み。中止'; END IF;

  -- ★「tool_id が NULL の行は無い」という前提（下で tool_id を必ず埋める根拠）
  SELECT count(*) INTO v_null_tool FROM public.ow_skills WHERE tool_id IS NULL;
  IF v_null_tool <> 0 THEN RAISE EXCEPTION 'tool_id が NULL の skill が % 件。前提が違う。中止', v_null_tool; END IF;

  RAISE NOTICE '適用前: tool_masters % / skills % / user_skills %', v_tools, v_skills, v_us;
END $$;

-- ── ① ツールマスタ ─────────────────────────────────────────────────────────
/* ⚠️ sort_order は既存の最大 200 の次。既存の値を詰め直さない */
INSERT INTO public.ow_tool_masters (name, aliases, category, sort_order, is_active)
VALUES ('Sansan', ARRAY['サンサン'], 'sales', 210, true);

-- ── ② 標準スキル ───────────────────────────────────────────────────────────
/* ⚠️ `tool_id` はサブクエリで引く。UUID を直書きすると、①で採番された値と
      食い違ってもエラーにならず、**別のツールに紐づいた行**が生まれる。 */
INSERT INTO public.ow_skills (label, aliases, category, tool_id, sort_order, is_active)
SELECT 'Sansan', ARRAY['サンサン'], 'product', t.id, 160, true
  FROM public.ow_tool_masters t
 WHERE t.name = 'Sansan';

-- ── ③ 生藤 弘樹さんのツール3件 ────────────────────────────────────────────
/* ⚠️ 対象は id で明示する（CLAUDE.md「全社一括の UPDATE を禁止する」と同じ筋）。
      `user_id` は **ow_users.id 空間**（auth.users.id ではない）。 */
INSERT INTO public.ow_user_skills (user_id, skill_id)
SELECT '0c99e403-7540-4cf9-8bb1-67571af4f2b6'::uuid, s.id
  FROM public.ow_skills s
 WHERE s.label IN ('Salesforce', 'HubSpot', 'Sansan');

DO $$
DECLARE v_tools int; v_skills int; v_us int; v_labels text; v_tool_ok int; v_user text;
BEGIN
  SELECT count(*) INTO v_tools  FROM public.ow_tool_masters;
  SELECT count(*) INTO v_skills FROM public.ow_skills;
  SELECT count(*) INTO v_us     FROM public.ow_user_skills;

  IF v_tools  <> 79 THEN RAISE EXCEPTION 'ow_tool_masters が % 行（78+1=79 のはず）。中止', v_tools;  END IF;
  IF v_skills <> 49 THEN RAISE EXCEPTION 'ow_skills が % 行（48+1=49 のはず）。中止', v_skills; END IF;
  IF v_us     <> 3  THEN RAISE EXCEPTION 'ow_user_skills が % 行（3 のはず）。中止', v_us; END IF;

  -- ★Sansan の skill が正しいツールに紐づいたこと（UUID 直書きをやめた理由）
  SELECT count(*) INTO v_tool_ok
    FROM public.ow_skills s JOIN public.ow_tool_masters t ON t.id = s.tool_id
   WHERE s.label = 'Sansan' AND t.name = 'Sansan';
  IF v_tool_ok <> 1 THEN RAISE EXCEPTION 'Sansan の skill が tool に紐づいていない。中止'; END IF;

  -- ★入ったのが本人の行で、中身が3つとも想定どおりであること
  SELECT string_agg(s.label, ', ' ORDER BY s.label) INTO v_labels
    FROM public.ow_user_skills us JOIN public.ow_skills s ON s.id = us.skill_id
   WHERE us.user_id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  IF v_labels IS DISTINCT FROM 'HubSpot, Salesforce, Sansan' THEN
    RAISE EXCEPTION '生藤さんのスキルが「%」（HubSpot, Salesforce, Sansan のはず）。中止', v_labels;
  END IF;

  -- ★他の人に入っていないこと
  SELECT count(*) INTO v_us FROM public.ow_user_skills
   WHERE user_id <> '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  IF v_us <> 0 THEN RAISE EXCEPTION '他の人に % 行入っている。中止', v_us; END IF;

  SELECT name INTO v_user FROM public.ow_users WHERE id = '0c99e403-7540-4cf9-8bb1-67571af4f2b6';
  RAISE NOTICE '完了: tool_masters % / skills % / % さんに「%」', v_tools, v_skills, v_user, v_labels;
END $$;

COMMIT;
