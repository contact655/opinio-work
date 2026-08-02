-- 運営が先に作成した ow_users 行を、本人が後からサインアップして引き継ぐ経路の土台。
--
-- 背景:
--   運営が作った行は auth_id IS NULL の状態で存在する。本人が同じ email でサインアップすると
--   trigger handle_new_ow_user() の INSERT が UNIQUE(email) に衝突し、ON CONFLICT DO NOTHING で
--   握り潰されていた。auth_id は NULL のままなので、認証は通っているのに ow_users 行が
--   紐づかないユーザーが生まれていた。
--
-- 引き継ぎは trigger では行わない。trigger は auth.users への INSERT 時（= メールアドレスの
-- 所有証明より前）に発火するため、ここで email 一致だけを根拠に紐付けると
-- 「他人のメールアドレスで登録して経歴ごと乗っ取る」経路になる。
-- 引き継ぎは /auth/callback（= 送信されたリンクをクリックした人、または OAuth 完了者しか
-- 到達できない）でのみ行う。

-- ── 1. 引き継ぎの監査列 ──────────────────────────────────────────────
ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS auth_linked_at timestamptz;

COMMENT ON COLUMN ow_users.auth_linked_at IS
  '運営が先に作成した行（auth_id IS NULL）に、本人のサインアップで auth_id を補完した日時。'
  ' 通常のサインアップで作られた行では NULL のまま。行の引き継ぎを追跡するための監査列。';

-- ── 2. trigger の意図をコメントで固定し、握り潰す対象を email 衝突だけに絞る ──
-- 裸の ON CONFLICT DO NOTHING は auth_id 衝突など「想定外の衝突」まで飲み込むため、
-- 競合対象を (email) に明示する。email 衝突は「運営が作った行が既にある」正常系なので
-- ここでは何もせず、後続の /auth/callback が所有証明つきで引き継ぐ。
CREATE OR REPLACE FUNCTION public.handle_new_ow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ow_users (
    auth_id, email, name, visibility, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'public', NOW(), NOW()
  )
  -- email が既にある = 運営が先に作った行が存在する。ここでは紐付けず callback に任せる。
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_ow_user() IS
  'auth.users への INSERT で ow_users 行を自動生成する。'
  ' email が既存（= 運営が先に作った行がある）の場合は何もしない。'
  ' その行への auth_id 補完は /auth/callback の resolveOrLinkOwUser() が'
  ' メールアドレスの所有証明を得たうえで行う。ここで紐付けてはならない。';
