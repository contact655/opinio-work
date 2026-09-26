-- ★ow_messages を落とす（2026-09-27 / 柴さんの指示）
--
-- CLAUDE.md が「🗑 未使用テーブル（DROP 候補）」に挙げていたもの
-- （「アプリが使うのは `ow_conversation_messages`。名前が似た別テーブルが残っている」）。
--
-- ⚠️★**取り違えないこと。落とすのは `ow_messages`。** アプリのメッセージは
--    `ow_conversation_messages`（src からの参照 **12箇所**）。
--    `ow_messages` は src からの参照 **0件**（実測 2026-09-27）。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0351-ow_messages.sql（2,497 バイト / スキーマ+データ / **0行**）
--
-- ⚠️ 依存の確認（2026-09-27 実測。FK では追えないものも数えてある）:
--      **この表を指す FK        0件**  ← だから CASCADE を付けずに落とせる
--      この表が持つ FK          0件
--      RLS ポリシー             3本（service_role_all_messages / thread_participants_read /
--                                    users_insert_messages）
--      トリガー                 0件
--      関数の本文からの参照     0件
--      ビュー                   0件
--      索引                     1本（表と一緒に消える）
--      GRANT                    0件（anon にも authenticated にも配っていない
--                                    ＝ アプリのセッションからは元々触れない）
--      行数                     0
--
-- ⚠️★**CASCADE を付けないこと。** 指す FK が0件と確かめてあるので素の DROP で通る。
--    通らなければ**想定外の依存がある**ということなので、黙って壊すより失敗させたい。
--
-- ⚠️★**`ow_threads` は今回落としていない。** `ow_messages.thread_id` の相手で、
--    同じく0行・src からの参照0件・指す FK も0件だが、指示の範囲は `ow_messages` だけ。
--    落とすときは同じ手順（ダンプ → 依存を数える → この形の migration）。
--
-- ⚠️ 同じ migration では落とさないが、`scripts/seed-messages.ts` は
--    `ow_threads` と `ow_messages` **だけ**を触る本番書き込みスクリプトで、
--    この DROP で動かなくなる。**同じコミットで削除してある。**

do $$
declare
  n bigint;
  n_ref bigint;
begin
  -- ⚠️ 想定と違えば中止する。1行でもあれば、それは誰かが使い始めたということ。
  select count(*) into n from public.ow_messages;
  if n <> 0 then
    raise exception 'ow_messages に % 行ある。DROP を中止する', n;
  end if;

  -- ⚠️ この表を指す FK が増えていたら中止する（CASCADE で巻き込まないため）。
  select count(*) into n_ref
    from pg_constraint
   where confrelid = 'public.ow_messages'::regclass;
  if n_ref <> 0 then
    raise exception 'ow_messages を指す FK が % 本ある。DROP を中止する', n_ref;
  end if;
end $$;

drop table public.ow_messages;
