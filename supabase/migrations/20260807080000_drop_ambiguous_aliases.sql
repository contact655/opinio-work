-- ═══════════════════════════════════════════════════════════════════════════
-- 大分類名と同じ別名を2件削除する
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 「カスタマーサクセス」と「事業開発」が、**大分類の正式名でありながら
-- 子職種の別名にもなっていた**。検索すると大分類と子の両方が候補に出る。
--
--   カスタマーサクセス → カスタマーサクセスマネージャー（CSM） の別名
--   事業開発          → 事業開発（BizDev）                     の別名
--
-- ⚠️ 別名は「その職種の別の呼び方」であって、**上位概念を入れると意味が壊れる**。
--    queries.ts の getRoleAliases にも同じ注意書きがある。
--
-- ── 削除しても検索できなくならない（確認済み）────────────────────────────────
-- 検索は**職種名そのもの**も対象にしているため、別名を消しても両方に当たる。
--   RoleSearchSelect の match() … `r.name.includes(needle)` を先に見る
--   /jobs の getRoleAliases    … ow_roles.name を辞書に入れている（E-1）
-- したがって「カスタマーサクセス」と打つと、
--   大分類「カスタマーサクセス」        … 名前が完全一致
--   子「カスタマーサクセスマネージャー（CSM）」… 名前が部分一致
-- の両方が出る。「事業開発」も同じ（子は「事業開発（BizDev）」）。
--
-- ⚠️ 別名の重複0件という状態を保つのが目的。ここを崩すと
--    「検索上は同じもの」の職種が生まれ、統合すべきかの判断ができなくなる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_target int;
BEGIN
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 120 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定120）。中止', v_alias; END IF;

  -- 消す2件がちょうど1件ずつ存在し、想定の職種に付いていること
  SELECT count(*) INTO v_target FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id = a.role_id
   WHERE (a.alias = 'カスタマーサクセス' AND r.name = 'カスタマーサクセスマネージャー（CSM）')
      OR (a.alias = '事業開発'          AND r.name = '事業開発（BizDev）');
  IF v_target <> 2 THEN RAISE EXCEPTION '削除対象が % 件（想定2）。中止', v_target; END IF;

  -- 受け皿になる職種名が存在すること（消したあとに検索で当たる先）
  IF NOT EXISTS (SELECT 1 FROM public.ow_roles WHERE name='カスタマーサクセス' AND parent_id IS NULL AND is_active) THEN
    RAISE EXCEPTION '大分類「カスタマーサクセス」が無い。中止';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ow_roles WHERE name='事業開発' AND parent_id IS NULL AND is_active) THEN
    RAISE EXCEPTION '大分類「事業開発」が無い。中止';
  END IF;

  RAISE NOTICE '適用前: 別名 % 件 / 削除対象 2 件', v_alias;
END $$;

DELETE FROM public.ow_role_aliases a
 USING public.ow_roles r
 WHERE r.id = a.role_id
   AND ((a.alias = 'カスタマーサクセス' AND r.name = 'カスタマーサクセスマネージャー（CSM）')
     OR (a.alias = '事業開発'          AND r.name = '事業開発（BizDev）'));

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_left int; v_dup int; v_roles int;
BEGIN
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 118 THEN RAISE EXCEPTION '別名が % 件（想定118）。ロールバック', v_alias; END IF;

  SELECT count(*) INTO v_left FROM public.ow_role_aliases
   WHERE alias IN ('カスタマーサクセス','事業開発');
  IF v_left <> 0 THEN RAISE EXCEPTION '対象の別名が % 件残っている。ロールバック', v_left; END IF;

  -- 別名の重複が0件のままであること
  SELECT count(*) INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup <> 0 THEN RAISE EXCEPTION '別名の重複が % 件ある。ロールバック', v_dup; END IF;

  -- 職種は触っていないこと
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。ロールバック', v_roles; END IF;

  RAISE NOTICE '完了: 別名 % 件（-2）/ 重複0件 / ow_roles % 件は変更なし', v_alias, v_roles;
END $$;

COMMIT;
