-- ═══════════════════════════════════════════════════════════════════════════
-- 新規ユーザーの visibility を既定値（login_only）に任せる
--
-- ── 背景 ────────────────────────────────────────────────────────────────────
-- migration 198（2026-07-13）で ow_users.visibility の既定を
-- 'public' → 'login_only' に変更し、既存107名を一括で login_only に戻した。
-- 「本人が明示的に public を選んだか判別できないため」という理由だった。
--
-- ところが同時に更新されるべきだった **サインアップ時のトリガー**
-- handle_new_ow_user が visibility に 'public' をハードコードで INSERT しており、
-- カラム既定値が使われていなかった。
-- 結果、2026-07-13 以降に登録した人は本人が選んでいないのに public になっていた。
--
-- ── 対象（2026-08-04 実測）──────────────────────────────────────────────────
-- migration 198 以降に作成され visibility='public' の行:
--   実ユーザー   1名  鈴木 太郎 <contact+15@opinio.co.jp>
--   テスト       13名 contact+001〜+14（すべて is_test = true）
--
-- 鈴木さんは created_at と updated_at が完全一致（差分 00:00:00）で、
-- 設定画面を一度も触っていない。つまり public は本人の選択ではない。
--
-- ⚠️ visibility の変更履歴は残っていないため、「本人が意図的に public を選んだ」か
--    どうかを一般には判別できない。今回は対象が1名で、その1名に
--    設定を触った形跡が無いことを確認したうえで戻している。
--    今後 public を選ぶ人が出てからでは同じ判定ができないので、
--    UI 側で public の意味を正しく説明することとセットで行う。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① トリガーから visibility の明示指定を外す ────────────────────────────
--    列リストから visibility を落とし、カラム既定値（login_only）に任せる。
--    ここに 'public' を書き戻さないこと。書き戻すと migration 198 の意図が再び壊れる。
CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ow_users (
    auth_id, email, name, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NOW(), NOW()
  )
  -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  v_default text;
  v_target  int;
  v_touched int;
  v_updated int;
  v_public_after int;
BEGIN
  -- ── ② カラム既定値が login_only であること ──────────────────────────────
  --    ここが public のままだと、トリガーから外した意味が無い。
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='ow_users' AND column_name='visibility';
  IF v_default IS NULL OR v_default NOT LIKE '%login_only%' THEN
    RAISE EXCEPTION 'visibility のカラム既定値が login_only ではない（現在: %）。中止', v_default;
  END IF;

  -- ── ③ 戻す対象を数える ──────────────────────────────────────────────────
  SELECT count(*) INTO v_target
    FROM ow_users
   WHERE visibility = 'public'
     AND created_at > '2026-07-13 08:29:00+00';  -- migration 198 適用時刻（JST 17:29）

  -- ── ④ 設定を触った形跡がある行が混ざっていないか ────────────────────────
  --    updated_at が created_at より後にずれている行は、本人が何かを保存している。
  --    visibility を触ったとは限らないが、機械的に戻すのは避けて中止する。
  SELECT count(*) INTO v_touched
    FROM ow_users
   WHERE visibility = 'public'
     AND created_at > '2026-07-13 08:29:00+00'
     AND updated_at > created_at + interval '5 minutes';

  IF v_touched > 0 THEN
    RAISE EXCEPTION
      '設定を保存した形跡のある public ユーザーが % 名いる。本人が選んだ可能性があるため一括変更を中止', v_touched;
  END IF;

  RAISE NOTICE '対象: % 名（うち設定を触った形跡: % 名）', v_target, v_touched;

  -- ── ⑤ login_only に戻す ─────────────────────────────────────────────────
  UPDATE ow_users
     SET visibility = 'login_only'
   WHERE visibility = 'public'
     AND created_at > '2026-07-13 08:29:00+00';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- ── ⑥ 事後チェック ──────────────────────────────────────────────────────
  IF v_updated <> v_target THEN
    RAISE EXCEPTION '更新件数が % 件（想定 % 件）。ロールバック', v_updated, v_target;
  END IF;

  SELECT count(*) INTO v_public_after
    FROM ow_users
   WHERE visibility='public' AND created_at > '2026-07-13 08:29:00+00';
  IF v_public_after > 0 THEN
    RAISE EXCEPTION 'migration198以降の public が % 名残っている。ロールバック', v_public_after;
  END IF;

  -- migration 198 以前の行（既に login_only）を巻き込んでいないこと
  IF EXISTS (SELECT 1 FROM ow_users
              WHERE created_at <= '2026-07-13 08:29:00+00' AND visibility NOT IN ('login_only','private')) THEN
    RAISE EXCEPTION '198以前の行の visibility が想定外。ロールバック';
  END IF;

  RAISE NOTICE '完了: % 名を login_only に戻した', v_updated;
END $$;

COMMIT;
