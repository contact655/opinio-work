-- 運営が「確認した」を記録できるようにする（2026-08-25）
--
-- ★2026-08-24 に会社の事前承認を廃止したため、なりすましは**後から見つけて外す**しかない。
--   ところが「どの行をもう見たか」を記録する場所が無く、運営は**掲載日で判断する**しかなかった。
--   → 見る頻度を決めても取りこぼす。**未確認だけが残る**形にする。
--
-- ⚠️ **列は1つだけ。「誰が確認したか」は持たない。**
--    運営は少人数で、`ops_reviewed_by` を足すと **ID の空間**（auth.users.id か
--    ow_users.id か）を決める話が付いてくる（CLAUDE.md「DB 関数の書き方」）。
--    必要になってから、名前で空間を示す形で足すこと（例: `ops_reviewed_by_ow_user_id`）。
--
-- ⚠️ **GRANT を配らない。** `ow_company_members` は SELECT が**列単位**で配られている
--    （anon 11/14・authenticated 12/14）。この列は運営だけが読む値なので、
--    どちらにも配らない。運営画面は `createAdminClient`（service_role）で読むため
--    GRANT を通らない。
--    ⚠️ **公開側や本人向けの画面からこの列を select しないこと。** 1列でも入ると
--       クエリが丸ごと 403 になり、`?? []` で受けている側では「0件」として静かに素通りする。

alter table public.ow_company_members
  add column ops_reviewed_at timestamptz;

comment on column public.ow_company_members.ops_reviewed_at is
  '運営が内容を確認した時刻。null は未確認。⚠️ 運営専用（anon/authenticated には GRANT しない）';

-- ⚠️ 索引は張らない。行は6件（2026-08-25 実測）で、絞り込みは全件走査で足りる。
--    このDBはユーザーテーブル10MBに対し索引6MB・411本と既に過剰（CLAUDE.md）。

-- ── 適用後の実測 ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_attribute
     where attrelid = 'public.ow_company_members'::regclass
       and attname = 'ops_reviewed_at' and not attisdropped
  ) then
    raise exception 'ops_reviewed_at が作られていない';
  end if;
  -- ⚠️ 配っていないことを確かめる（配ると公開側の select に混ざる事故が起きうる）
  if has_column_privilege('anon', 'public.ow_company_members', 'ops_reviewed_at', 'SELECT') then
    raise exception 'anon に SELECT が付いている（運営専用の列）';
  end if;
  if has_column_privilege('authenticated', 'public.ow_company_members', 'ops_reviewed_at', 'SELECT') then
    raise exception 'authenticated に SELECT が付いている（運営専用の列）';
  end if;
end $$;
