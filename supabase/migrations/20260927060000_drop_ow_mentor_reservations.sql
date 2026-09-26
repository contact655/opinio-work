-- ★ow_mentor_reservations を落とす（2026-09-27 / 柴さんの指示）
--
-- メンター機能の最後の残骸。CLAUDE.md が「🗑 未使用テーブル（DROP 候補）」として
-- 挙げていたもの（「メンター機能自体が無い。`ow_mentors` は migration 132 で作られ
-- 140 で DROP 済み。『話せる人』の実体は `ow_company_members`。src からの参照0件」）。
-- 同日に画面・型・生成経路と ow_users のメンター4列を落としてあり、これが最後。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0336-ow_mentor_reservations.sql
--    （5,069 バイト / スキーマ+データ / **0行**）
--
-- ⚠️ 依存の確認（2026-09-27 実測。FK では追えないものも数えてある）:
--      **この表を指す FK        0件**  ← だから CASCADE を付けずに落とせる
--      この表が持つ FK          3本（ow_users ×2 / ow_company_admins ×1）
--      RLS ポリシー             3本
--      トリガー                 1本（trg_mentor_reservations_updated_at）
--      関数の本文からの参照     0件
--      ビュー                   0件
--      GRANT                    0件（anon にも authenticated にも配っていない）
--      行数                     0
--    → FK・ポリシー・トリガーは DROP TABLE で一緒に消える。
--
-- ⚠️★**CASCADE を付けないこと。** この表を指す FK が0件だと確かめてあるので、
--    素の DROP で通る。通らなければ**想定外の依存がある**ということなので、
--    黙って壊すより失敗させたい。
--
-- ⚠️★**トリガー関数は表と一緒には消えない。** `update_mentor_reservations_updated_at()`
--    はこの表**専用**（使っているトリガーは1つだけ／他の関数からの参照も0件）なので、
--    落とさないと**孤児の関数が残る**。順序は「表 → 関数」。
--    ⚠️ 共有の `set_updated_at` 系ではないことを実測で確かめてある。**他の表の
--       updated_at トリガーを巻き込まないこと。**
--
-- ⚠️ ow_conversations.mentor_user_id は**落とさない**。列名だけの名残で、
--    中身は kind='direct_message' の相手（現役）。

do $$
declare
  n bigint;
  n_ref bigint;
begin
  -- ⚠️ 想定と違えば中止する。1行でもあれば、それは誰かが使い始めたということ。
  select count(*) into n from public.ow_mentor_reservations;
  if n <> 0 then
    raise exception 'ow_mentor_reservations に % 行ある。DROP を中止する', n;
  end if;

  -- ⚠️ この表を指す FK が増えていたら中止する（CASCADE で巻き込まないため）。
  select count(*) into n_ref
    from pg_constraint
   where confrelid = 'public.ow_mentor_reservations'::regclass;
  if n_ref <> 0 then
    raise exception 'ow_mentor_reservations を指す FK が % 本ある。DROP を中止する', n_ref;
  end if;
end $$;

drop table public.ow_mentor_reservations;

-- ⚠️ 表を落としたあと。この関数はこの表専用で、残すと孤児になる。
drop function if exists public.update_mentor_reservations_updated_at();
