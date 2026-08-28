-- ═══════════════════════════════════════════════════════════════════════════
-- みずほ証券株式会社を作り、自由入力の経歴1件を寄せる（2026-08-28）
--
-- ── なぜ作るか ──────────────────────────────────────────────────────────────
-- docs/todo.md「自由入力の企業名を `company_id` に寄せる導線」の**最後の1件**。
-- 実測（2026-08-28 / 実ユーザーの経歴13件）: `company_id` あり 12 / 自由入力 1。
-- 残る1件が「みずほ証券株式会社」で、**`ow_companies` に存在しなかった**ため
-- `canonical_company_id` で寄せる先が無く、「名寄せ」ではなく
-- 「企業を作るか」の判断になっていた。→ 柴さんの指示で作る。
--
-- 対象の経歴: 木村雅樹（`b51fc35e-…`・**is_test ではない実ユーザー**）
--             2017-04-01 〜 2021-10-31（在籍中ではない）
--
-- ── ★どこまで見えるようにするか ────────────────────────────────────────────
-- **ページは見えるが、ディレクトリには載せない。**
--   `is_published  = true`   … 経歴からのリンク先が要る。false だと**404 の行き止まり**になる
--   `listing_status= 'draft'` … `/companies` の一覧・検索・sitemap・LP には出さない
--
-- CLAUDE.md「企業ページは作られた時点で見える。運営が決めるのは一覧掲載だけ」
-- （2026-08-13）に従う。**経歴に出てくる企業はページだけ必要で、ディレクトリには要らない。**
-- 前例: 海光電業株式会社 / スマートキャンプ株式会社（どちらも同じ組み合わせ）。
--
-- ⚠️ 一覧掲載オフのページには `noindex` が付く（`companies/[id]/page.tsx`）。
-- ⚠️ フィードの `company_joined` は `listing_status → 'listed'` でしか作られないので、
--    この migration では**投稿は生まれない**（IT/SaaS のディレクトリに
--    「参加しました」と流れてしまうのを避けたい）。
--
-- ── ★公開ゲートとの関係 ────────────────────────────────────────────────────
-- `checkPublishable` / `findPublishBlockers` は **業種（`industry_id`）が非 NULL** を要求する。
-- 事業領域は業種マスタの `requires_business_domain` 次第で、
-- **「金融・保険」は `false`** なので不要（実測）。
-- → `industry_id` を入れてあるので `/admin/companies` の「要対応」には出ない。
--    ⚠️ **業種を空のまま作らないこと。** 作った瞬間に要対応が1件増える。
--
-- ── ★入れた値と、入れなかった値 ────────────────────────────────────────────
-- **公式サイト（www.mizuho-sc.com）は 403 で自動取得できない**（curl も WebFetch も）。
-- したがって会社概要から機械的に読み取ることはできなかった。
--
-- 代わりに **TLS の EV 証明書**で法人を検証した（EV は CA が法人実在性を審査する）:
--   subject: O=Mizuho Securities Co., Ltd. / L=Chiyoda-ku / ST=Tokyo / C=JP
--            serialNumber=0100-01-008687（会社法人等番号）
--   issuer : Cybertrust Japan SureServer EV CA G3   （2026-08-28 実測）
--
-- → **裏の取れた4つだけ入れる**: `name` / `name_en` / `url` / `industry_id`。
-- ⚠️ `description` / `founded_year` / `employee_count` / `headquarters_address` は
--    **NULL のままにする。** 証明書で分かるのは「千代田区」までで住所ではないし、
--    設立年や従業員数は確認できていない。CLAUDE.md「推測値を投入しない」
--    「値が無いことを、ある値に置き換えない」。**それらしい値で埋めないこと。**
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260828-1643-ow_companies-ow_experiences.sql
--   （スキーマ+データ / ow_companies 87行・ow_experiences 24行）
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_dup int; v_slug int; v_exp int; v_ind int; v_co int;
BEGIN
  SELECT count(*) INTO v_dup  FROM public.ow_companies WHERE name = 'みずほ証券株式会社';
  IF v_dup <> 0 THEN RAISE EXCEPTION '同名の企業が既に % 件ある。中止', v_dup; END IF;

  SELECT count(*) INTO v_slug FROM public.ow_companies WHERE slug = 'mizuho-securities';
  IF v_slug <> 0 THEN RAISE EXCEPTION 'slug が衝突している。中止'; END IF;

  -- ★寄せる対象がちょうど1件であること
  SELECT count(*) INTO v_exp FROM public.ow_experiences WHERE company_text = 'みずほ証券株式会社';
  IF v_exp <> 1 THEN RAISE EXCEPTION '対象の経歴が % 件（1 のはず）。中止', v_exp; END IF;

  -- ★業種マスタが想定どおりであること（事業領域が不要な業種を選んでいる）
  SELECT count(*) INTO v_ind FROM public.ow_industries
   WHERE id = 'e99bd0c3-9a8b-48a9-8ace-cc9e79ad511b'
     AND name = '金融・保険' AND is_active AND requires_business_domain = false;
  IF v_ind <> 1 THEN RAISE EXCEPTION '業種「金融・保険」が想定と違う。中止'; END IF;

  SELECT count(*) INTO v_co FROM public.ow_companies;
  RAISE NOTICE '適用前: ow_companies % 行', v_co;
END $$;

INSERT INTO public.ow_companies (
  name, name_en, slug, normalized_name, url, industry_id,
  source, is_approved, is_published, published_at, listing_status
) VALUES (
  'みずほ証券株式会社',
  'Mizuho Securities Co., Ltd.',            -- EV 証明書の O=
  'mizuho-securities',
  'みずほ証券',                              -- 法人格を落とした形（既存の慣習に合わせる）
  'https://www.mizuho-sc.com/',
  'e99bd0c3-9a8b-48a9-8ace-cc9e79ad511b',   -- 金融・保険（requires_business_domain = false）
  'manual',
  true,                                     -- 運営が内容を確認して作った
  true,                                     -- ページは見える（経歴のリンク先）
  /* ⚠️ CLAUDE.md「migration で is_published を true にするときも published_at を埋める」。
        埋めないと「いつ何社公開したか」を再構成できなくなる（80社が NULL のままになった前例）。 */
  now(),
  'draft'                                   -- ディレクトリには載せない
);

/* ★経歴を寄せる。
   ⚠️ `experience_company_xor` は company_id / company_text / company_anonymized の
      **ちょうど1つ**を要求する。`company_text` を NULL にしないと 23514 で落ちる。 */
UPDATE public.ow_experiences e
   SET company_id   = (SELECT id FROM public.ow_companies WHERE name = 'みずほ証券株式会社'),
       company_text = NULL
 WHERE e.company_text = 'みずほ証券株式会社';

DO $$
DECLARE
  v_co int; v_new int; v_linked int; v_free int; v_pub timestamptz;
BEGIN
  SELECT count(*) INTO v_co FROM public.ow_companies;
  IF v_co <> 88 THEN RAISE EXCEPTION 'ow_companies が % 行（87+1=88 のはず）。中止', v_co; END IF;

  SELECT count(*) INTO v_new FROM public.ow_companies
   WHERE name = 'みずほ証券株式会社' AND industry_id IS NOT NULL
     AND is_published = true AND listing_status = 'draft';
  IF v_new <> 1 THEN RAISE EXCEPTION '作った行が想定と違う。中止'; END IF;

  SELECT published_at INTO v_pub FROM public.ow_companies WHERE name = 'みずほ証券株式会社';
  IF v_pub IS NULL THEN RAISE EXCEPTION 'published_at が NULL。中止'; END IF;

  -- ★経歴が寄っていること（XOR も満たしていること）
  SELECT count(*) INTO v_linked FROM public.ow_experiences e
    JOIN public.ow_companies c ON c.id = e.company_id
   WHERE c.name = 'みずほ証券株式会社' AND e.company_text IS NULL;
  IF v_linked <> 1 THEN RAISE EXCEPTION '寄せた経歴が % 件（1 のはず）。中止', v_linked; END IF;

  -- ★実ユーザーの自由入力が 0 件になったこと（この項目の目的）
  SELECT count(*) INTO v_free FROM public.ow_experiences e
    JOIN public.ow_users u ON u.id = e.user_id
   WHERE e.company_text IS NOT NULL AND u.is_test = false AND u.is_system = false;
  IF v_free <> 0 THEN RAISE EXCEPTION '実ユーザーの自由入力が % 件残っている。中止', v_free; END IF;

  RAISE NOTICE '完了: ow_companies % 行 / 寄せた経歴 % 件 / 実ユーザーの自由入力 % 件',
    v_co, v_linked, v_free;
END $$;

COMMIT;
