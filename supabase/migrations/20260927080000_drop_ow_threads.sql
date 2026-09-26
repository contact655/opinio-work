-- ★ow_threads を落とす（2026-09-27 / 柴さんの指示）
--
-- 同日に落とした ow_messages（20260927070000）の相手（`ow_messages.thread_id`）。
-- CLAUDE.md の「🗑 未使用テーブル（DROP 候補）」の最後の1つ。
-- 「カジュアル面談の実体は ow_casual_meetings へ移行済み」（archive の ow_threads →
-- ow_casual_meetings 移行）で、この表は移行前の形のまま残っていた。
--
-- ⚠️ 作業前ダンプ: .dumps/20260927-0401-ow_threads.sql（2,856 バイト / スキーマ+データ / **0行**）
--
-- ⚠️ 依存の確認（2026-09-27 実測。FK では追えないものも数えてある）:
--      **この表を指す FK        0件**  ← だから CASCADE を付けずに落とせる
--        （ow_messages が唯一の参照元だったが、20260927070000 で先に落としてある）
--      この表が持つ FK          0件
--      RLS ポリシー             4本
--      トリガー                 0件
--      関数の本文からの参照     0件
--      ビュー                   0件
--      索引                     2本（表と一緒に消える）
--      GRANT                    0件（anon にも authenticated にも配っていない
--                                    ＝ アプリのセッションからは元々触れない）
--      src からの参照           0件（scripts/seed-messages.ts は 20260927070000 で削除済み）
--      行数                     0
--
-- ⚠️★**CASCADE を付けないこと。** 指す FK が0件と確かめてあるので素の DROP で通る。
--    通らなければ**想定外の依存がある**ということなので、黙って壊すより失敗させたい。
--
-- ⚠️★**`ow_casual_meetings` と取り違えないこと。** カジュアル面談の実体はそちらで、現役。

do $$
declare
  n bigint;
  n_ref bigint;
begin
  -- ⚠️ 想定と違えば中止する。1行でもあれば、それは誰かが使い始めたということ。
  select count(*) into n from public.ow_threads;
  if n <> 0 then
    raise exception 'ow_threads に % 行ある。DROP を中止する', n;
  end if;

  -- ⚠️ この表を指す FK が増えていたら中止する（CASCADE で巻き込まないため）。
  select count(*) into n_ref
    from pg_constraint
   where confrelid = 'public.ow_threads'::regclass;
  if n_ref <> 0 then
    raise exception 'ow_threads を指す FK が % 本ある。DROP を中止する', n_ref;
  end if;
end $$;

drop table public.ow_threads;
