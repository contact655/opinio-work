-- 規約同意の記録を ow_terms_agreements に一本化する（2026-08-25）
--
-- ── 何をするか ──────────────────────────────────────────────────────────────
--   `ow_company_admins` の同意4列に「未使用」と書き残すだけ。**列は落とさない。**
--   同じコミットで、この4列へ書こうとしていたコードを削除している。
--
-- ── なぜ未使用と言い切れるか（2026-08-25 実測）────────────────────────────
--   ① **書き込みが一度も成功していない。**
--      `POST /api/biz/companies` の spread は `body.agreedTermsBusiness`（camelCase）を
--      見ていたが、送信側（CreateCompanyClient）は `agreed_terms_business`（snake_case）
--      で送っていた。**名前が食い違っており、条件が常に false だった。**
--   ② **その値の出どころも死んでいた。** 元は `user_metadata.agreed_terms_business` で、
--      それを書くのは `/biz/auth` の step 2 だけ。step 2 は 6c5e45ca（2026-07-23）以降
--      **到達不能**だった。
--   ③ **読んで判定している箇所が src に0件。**
--   ④ 実データ:
--        auth.users             60人中 **0人** が agreed_terms_business を持つ
--        ow_company_admins      12行中 **0行** が非 NULL
--
-- ── 生きている記録 ──────────────────────────────────────────────────────────
--   `ow_terms_agreements`（`terms_type` = listing / placement / 旧 business）。
--   入口は `/biz/company`（掲載）と `/biz/candidates`（人材紹介）。
--   掲載の同意は「変更を公開する」ボタンのゲートとして機能している。
--
-- ⚠️ **DROP しない。** 今日 `saas_category_id` にしたのと同じ扱いで、
--    列と（無い）値は残し、行き先だけを COMMENT に書く。
--
-- ⚠️ `agreed_fee_15pct` は二重に死んでいる。成果報酬そのものが 2026-08-21 に
--    廃止された（掲載サービスは月額のみ。/terms/listing 第4条2項）。
--
-- 作業前ダンプ: .dumps/20260825-2043-ow_company_admins.sql （12行）

BEGIN;

-- 事前チェック: 本当に1行も使われていないこと。1行でも入っていたら中止する
DO $$
DECLARE v_used bigint;
BEGIN
  SELECT count(*) INTO v_used FROM public.ow_company_admins
   WHERE agreed_terms_business IS NOT NULL
      OR agreed_fee_15pct IS NOT NULL
      OR agreed_terms_version IS NOT NULL
      OR agreed_at IS NOT NULL;
  IF v_used <> 0 THEN
    RAISE EXCEPTION '中止: 同意列に値が入っている行が % 件ある。未使用という前提が崩れている', v_used;
  END IF;
END $$;

COMMENT ON COLUMN public.ow_company_admins.agreed_terms_business IS
  '【未使用】規約同意は ow_terms_agreements に一本化（2026-08-25）。この列は未使用';

COMMENT ON COLUMN public.ow_company_admins.agreed_fee_15pct IS
  '【未使用】規約同意は ow_terms_agreements に一本化（2026-08-25）。この列は未使用。⚠️ 成果報酬15%そのものが 2026-08-21 に廃止されている';

COMMENT ON COLUMN public.ow_company_admins.agreed_terms_version IS
  '【未使用】規約同意は ow_terms_agreements に一本化（2026-08-25）。この列は未使用。版は ow_terms_agreements 側に記録される';

COMMENT ON COLUMN public.ow_company_admins.agreed_at IS
  '【未使用】規約同意は ow_terms_agreements に一本化（2026-08-25）。この列は未使用';

COMMIT;
