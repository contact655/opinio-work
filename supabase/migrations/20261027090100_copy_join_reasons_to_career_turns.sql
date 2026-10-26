-- ════════════════════════════════════════════════════════════════════════
-- 旧の決め手（ow_experiences.join_reasons）を、転機の3問の Q1 として ow_career_turns に写す
-- （2026-10-27 / フェーズ1c・柴さんの決定＝案a）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★2026-10-27 に柴さんの了承を得て当てた（控え: .dumps/20261027-0156-ow_career_turns-ow_experiences.sql）。
--
-- 決めたこと（docs/phase1c-proposal-20261027.md の対応表）:
--   ・旧12個のキーは新15個に同じキーのまま入っているので、値はそのまま写す
--   ・★一番の決め手（join_reason_primary）は写さない
--   ・旧の列（join_reasons ほか）は変えない（INSERT だけ）
--   ・写した行は answered_at を null、copied_from_legacy_at を入れる
--     → 画面では「質問が新しくなりました」（答え直し）として出し、以前の決め手を初期値に入れる
--   ・転機の単位はその会社のいちばん古い職歴。25件とも、決め手が入っている行＝いちばん古い行だった（2026-10-27 実測）
--
-- 対象（experience_id を明示列挙。25件 = 実在の利用者 19件・検証用 6件。2026-10-27 実測）
--   ⚠️ 想定と違えば中止する（件数・既に行がある・決め手が空になっている）
--
-- 作業前の控え: 当てる直前に ./scripts/dump-tables.sh ow_career_turns ow_experiences を取る
-- 戻し方: delete from public.ow_career_turns where copied_from_legacy_at is not null and answered_at is null and skipped_at is null;
--         （本人が答え直した行は answered_at が入るので消えない）
-- ════════════════════════════════════════════════════════════════════════

begin;

create temporary table _targets(experience_id uuid primary key) on commit drop;
insert into _targets(experience_id) values
  ('396b8d04-a744-4b8f-9857-f2d78f3d2550'),('78e93da4-76bc-40d8-99ef-1a950040d6f8'),  -- 堀部 隼人
  ('56686cb8-b12a-4a36-bb95-7fc2f4eb28a4'),('fedaa0dd-952d-49c3-bbcb-6fc577186939'),  -- 山下 真澄
  ('44c2ebc2-8984-4836-b03e-c378a4eba8bf'),('e20acbde-0427-4d82-8803-7ef2880bbc07'),  -- 武川 幸平
  ('dbb6447e-fd2f-43e8-b7c4-dd239dd6aad9'),('2659bebb-d40b-42b7-b978-e5602808e425'),('33a05715-d53c-4499-b3c4-e11fa4a61546'),  -- 河野 佑輔
  ('ab0e552b-0bf1-4d82-a739-d98c26d049ca'),  -- 清水 健太
  ('968b89ab-46f7-4e78-a337-889b47f68480'),('dab620d1-ff5d-4994-885a-eaf3af7615ad'),  -- 田利 聖吾
  ('6610a9c2-80a6-400b-8efd-47a74a38211f'),  -- 福永陽貴
  ('67d58932-855a-41fc-aa6a-e7f653f375d6'),('fb3c9bf8-c4f6-425a-9d53-d3839c718200'),  -- 辻本 はるな
  ('b58b6b30-3794-4802-b3cd-c6ddff943453'),('3b2b5530-69b2-4389-9250-25249edda04a'),('d0c081d4-b626-44ae-96ce-146b4af3bc23'),  -- 金澤 啓太郎
  ('ef58721b-c02c-40c1-b2f4-bd185401d770'),  -- 高野 瑶子
  -- 検証用（is_test）
  ('0bd1691e-3a07-424c-8bc9-365b8f322075'),('ad0fe9ad-db6c-4002-af40-f3f6f2bbdfd0'),
  ('65e26541-46de-4e2c-a816-db8560df5ce2'),('96bc4a9d-3156-4681-8f12-672d12b2b243'),
  ('3bd2011c-0ec7-4b64-9c43-cf341affab5d'),('f2c930c2-d9d3-4629-a61a-9582c37e788d');

do $$
declare n_target int; n_with_reasons int; n_existing int; n_before int; n_after int;
begin
  select count(*) into n_target from _targets;
  select count(*) into n_with_reasons from public.ow_experiences e join _targets t on t.experience_id = e.id
   where coalesce(array_length(e.join_reasons, 1), 0) > 0;
  select count(*) into n_existing from public.ow_career_turns c join _targets t using (experience_id);
  if n_target <> 25 or n_with_reasons <> 25 or n_existing <> 0 then
    raise exception '想定と違う: 対象 % / 決め手あり % / 既に行あり %', n_target, n_with_reasons, n_existing;
  end if;

  select count(*) into n_before from public.ow_career_turns;
  insert into public.ow_career_turns (experience_id, user_id, decisive_reasons, copied_from_legacy_at)
  select e.id, e.user_id, e.join_reasons, now()
    from public.ow_experiences e join _targets t on t.experience_id = e.id;
  select count(*) into n_after from public.ow_career_turns;
  if n_after <> n_before + 25 then
    raise exception '写した件数が想定と違う: % → %', n_before, n_after;
  end if;
  raise notice 'ow_career_turns % → %', n_before, n_after;
end $$;

commit;
