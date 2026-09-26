-- ★ow_users.is_mentor を落とす（2026-09-27 / 柴さんの指示）
--
-- メンター機能は存在しない。
--   ・ow_mentors は migration 132 で作られ 140 で DROP 済み（テーブルが無い）
--   ・kind='mentor' の会話は0件で、作る経路も無い
--     （createConversation の枝は 2026-09-27 に削除。/api/mentor-reservations も無い）
--   ・「話せる人」の実体は ow_company_members（CLAUDE.md）
--
-- ⚠️★**読む側は先に外してデプロイ済み**（63993cb5）。
--    列を先に落とすと、本番の古いコードが select に is_mentor を含めたまま
--    400 を返す（?? [] で受けている側では静かに0件になる）。順序を入れ替えないこと。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0325-ow_users.sql（32,596 バイト / スキーマ+データ / 54行）
--
-- ⚠️ 依存の確認（2026-09-27 実測）。FK では追えないものも数えてある:
--      関数の本文（pg_get_functiondef）     0件
--      ビュー（pg_get_viewdef）              0件
--      RLS ポリシーの式                      0件
--      CHECK 等の制約                        0件
--      索引                                  idx_ow_users_is_mentor の1本だけ
--    → 索引は DROP COLUMN で一緒に消える。CASCADE は付けない
--      （想定外の依存があるなら、黙って壊すより失敗させたい）。
--
-- ⚠️ 列単位 GRANT（anon SELECT / authenticated SELECT・UPDATE）も列と一緒に消える。
--    revoke を別に書く必要は無い。
--
-- ⚠️★**is_active_mentor と mentor_registered_at は今回落としていない。**
--    同じ ow_mentors の名残（どちらも本番0件）だが、指示の範囲は is_mentor だけ。
--    落とすときは同じ手順（読む側を先に外してデプロイ → ダンプ → この形の migration）。
-- ⚠️★**ow_conversations.mentor_user_id は落とさない。** 列名だけの名残で、
--    中身は kind='direct_message' の相手。3件中2件が持っている現役の列。

do $$
declare
  n_true bigint;
begin
  -- ⚠️ 想定と違えば中止する（CLAUDE.md「推測で進めない」）。
  --    true が1件でもあれば、それは誰かが使い始めたということ。
  select count(*) into n_true from public.ow_users where is_mentor;
  if n_true <> 0 then
    raise exception 'ow_users.is_mentor が true の行が % 件ある。DROP を中止する', n_true;
  end if;
end $$;

alter table public.ow_users drop column is_mentor;
