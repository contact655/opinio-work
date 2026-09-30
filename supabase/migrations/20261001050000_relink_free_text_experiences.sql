-- 自由入力に落ちていた職歴11件を、マスタの企業へ紐づけ直す
--
-- 柴さんの指示（2026-10-01）。`20261001040000` で9社を足したので、それを含めて繋ぐ。
--
-- ⚠️★**2件は前から マスタにあったのに自由入力になっていた**（KOSKA / フライル）。
--    つまり「マスタに無いから落ちた」だけではなく、**候補を選び損ねている。**
--    同日に入れた検索の改善（ひらがな・中黒なしでも当たる／打った文字を強調）は
--    ここに効く。**紐づけ直しだけでは再発する。**
--
-- ⚠️★**コインタックスは残す。** 大阪の株式会社と横浜の有限会社があり、
--    利用者の入力「コインタックス」だけでは決められない（`20261001040000` の注記）。
--    ＝ この migration の後も**自由入力が1件だけ残るのが正しい状態。**
--
-- ⚠️ `experience_company_xor` は3つのうちちょうど1つを要求するので、
--    `company_id` を入れるのと同時に `company_text` を NULL にする。
-- ⚠️ `trg_update_company_member_counts` が在籍カウントを数え直す（+1 ではない）。
-- ⚠️ 適用後に `select public.rebuild_ow_transitions();` を流すこと。

begin;

/* ★対応表。⚠️ 職歴 id と slug を明示列挙する（全件一括の UPDATE を禁じている規則）。 */
create temporary table _relink(exp_id uuid primary key, slug text not null) on commit drop;
insert into _relink values
  ('dab620d1-ff5d-4994-885a-eaf3af7615ad','keyence'),               -- 田利 聖吾
  ('d4f4f40c-89c8-4d97-aa78-a0efe57bf946','otsuka-pharmaceutical'), -- 木村 勇人
  ('78e93da4-76bc-40d8-99ef-1a950040d6f8','transcosmos'),           -- 堀部 隼人
  ('fb3c9bf8-c4f6-425a-9d53-d3839c718200','jtb'),                   -- 辻本 はるな
  ('ef58721b-c02c-40c1-b2f4-bd185401d770','saison-technology'),     -- 高野 瑶子
  ('07f981cd-23c4-4aea-8bd9-23c399f6de44','quollio'),               -- 木村 勇人
  ('56686cb8-b12a-4a36-bb95-7fc2f4eb28a4','dior'),                  -- 山下 真澄
  ('2ea1dcff-17e1-41e3-9f80-e677b1158974','dxc-technology-japan'),  -- 馬場 智也
  ('3b2b5530-69b2-4389-9250-25249edda04a','mufg-morgan-stanley'),   -- 金澤 啓太郎
  -- ★以下2件は前からマスタにあった（選び損ね）
  ('ac8ab187-d423-4a3b-993b-5619d2fa5fad','koska'),                 -- 金澤 啓太郎
  ('b58b6b30-3794-4802-b3cd-c6ddff943453','flyle');                 -- 金澤 啓太郎（フライル）

-- ── 事前検算 ────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from _relink r join public.ow_experiences e on e.id = r.exp_id
   where e.company_id is null and e.company_text is not null;
  if n <> 11 then raise exception '対象が11件ではない（自由入力のもの）: % 件', n; end if;

  select count(*) into n from _relink r
   where not exists (select 1 from public.ow_companies c where c.slug = r.slug and c.is_test = false);
  if n <> 0 then raise exception '見つからない企業がある: % 件', n; end if;
end $$;

-- ── 紐づけ直す。⚠️ XOR があるので同時に company_text を落とす ─────────────────
update public.ow_experiences e
   set company_id = c.id, company_text = null
  from _relink r join public.ow_companies c on c.slug = r.slug
 where e.id = r.exp_id;

-- ── 事後検算 ────────────────────────────────────────────────────────────────
do $$
declare n int; n_free int;
begin
  select count(*) into n from _relink r join public.ow_experiences e on e.id = r.exp_id
   where e.company_id is not null and e.company_text is null and e.company_anonymized is null;
  if n <> 11 then raise exception '更新後が11件ではない: % 件', n; end if;

  -- ★残る自由入力は「コインタックス」1件だけ（実ユーザーぶん）
  select count(*) into n_free from public.ow_experiences e join public.ow_users u on u.id = e.user_id
   where e.company_text is not null
     and u.is_test is not true and u.is_system is not true and u.auth_id is not null;
  if n_free <> 1 then raise exception '残った自由入力が1件ではない: % 件', n_free; end if;

  raise notice '11件を紐づけ直した。残る自由入力は % 件（コインタックス）', n_free;
end $$;

commit;
