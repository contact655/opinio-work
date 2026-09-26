-- ★ow_users.is_active_mentor と mentor_registered_at を落とす（2026-09-27 / 柴さんの指示）
--
-- 同日に落とした is_mentor（20260927040000）と同じ、DROP 済みの ow_mentors の名残。
-- メンター機能は存在しない（ow_mentors は migration 140 で DROP、kind='mentor' の会話は
-- 0件で作る経路も無い、「話せる人」の実体は ow_company_members）。
-- ⚠️ mentor_themes は**既に無い**（この2列より前に落とされている。2026-09-27 実測）。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0333-ow_users.sql（32,246 バイト / スキーマ+データ / 54行）
--
-- ⚠️★**今回はコード先行デプロイが要らない。** is_mentor のときと違い、
--    src の実コードからの参照が **0件**（`grep` で確認。types.ts の型定義だけ）。
--    select に名前が出てこないので、落としても 400 になる経路が無い。
--    ⚠️ 参照がある列を落とすときは、**必ず読む側を先に出すこと**（20260927040000 の注記）。
--
-- ⚠️ 依存の確認（2026-09-27 実測。FK では追えないものも数えてある）:
--      関数の本文 / ビュー / RLS ポリシーの式 / CHECK 等の制約 / 索引 …… **すべて0件**
--
-- ⚠️ 列単位 GRANT も列と一緒に消える。実測（落とす前）:
--      is_active_mentor      anon SELECT ○ / authenticated SELECT ○ UPDATE ○
--      mentor_registered_at  anon SELECT ×（意図して配っていない9列の1つ）/
--                            authenticated SELECT ○ UPDATE ○
--    ⚠️★CLAUDE.md の「anon から落とした9列」の一覧から mentor_registered_at が減る。
--       同じコミットで CLAUDE.md も直すこと。
--
-- ⚠️★**ow_conversations.mentor_user_id は落とさない。** 列名だけの名残で、
--    中身は kind='direct_message' の相手。現役の列（2026-09-27 実測で3件中2件が保持）。

do $$
declare
  n_active bigint;
  n_reg    bigint;
begin
  -- ⚠️ 想定と違えば中止する。1件でもあれば、それは誰かが使い始めたということ。
  select count(*) into n_active from public.ow_users where is_active_mentor;
  select count(*) into n_reg    from public.ow_users where mentor_registered_at is not null;
  if n_active <> 0 or n_reg <> 0 then
    raise exception
      'ow_users: is_active_mentor=true が % 件 / mentor_registered_at が % 件ある。DROP を中止する',
      n_active, n_reg;
  end if;
end $$;

alter table public.ow_users drop column is_active_mentor;
alter table public.ow_users drop column mentor_registered_at;
