-- contact+16〜+27 の12アカウントに is_test を立てる（2026-08-26）
--
-- ── なぜ ──────────────────────────────────────────────────────────────────
-- 社内の検証用アカウント `contact+NN@opinio.co.jp` のうち、
-- **`+01`〜`+15` は全て `is_test = true` なのに `+16`〜`+27` の12件が false** だった。
-- 番号16でぴったり途切れており、フラグの立て忘れ。
--
-- ⚠️ **実害が出ていた。** セールスフォース・ジャパン（`listing_status = 'listed'`）の
--    企業ページに、ログイン済みの訪問者から**3件が実在の人物として見えていた**
--    （2026-08-26 実測 / `/api/jobseeker/companies/{id}/employees`）:
--      現役社員 … 山田 三郎（+17）／相川 隆二（+27）
--      OB/OG   … 山田 25（+25）
--    さらに +27 は 2026-08-25 に**面談対応者として掲載**されており、
--    「話を聞ける人」として出ていた。
--    ⚠️ 未ログインには漏れていない（全員 `visibility = 'login_only'` で人数のみ）。
--
-- `getPublicAmbassadorsCached` / `getCompanyEmployees` は `is_test` を除外するので、
-- **フラグを立てるだけで消える。コード変更は不要。**
--
-- ── 対象の選び方 ────────────────────────────────────────────────────────────
-- ⚠️ CLAUDE.md「全社一括の UPDATE を禁止する。対象を id または name で明示列挙する」。
--    `email like 'contact+%'` では書かない。**12件の id を並べる。**
-- ⚠️ 実ユーザーには触らない。同じ `@opinio.co.jp` でも
--    `hiroki.ikuto.placeholder@opinio.co.jp`（生藤 弘樹・実在）と
--    `system@opinio.co.jp`（システムユーザー）は**対象外**。
--    gmail / icloud の実ユーザー（木村・大塚・福永ほか）も対象外。
--
-- ── 直近にこの列を触った migration ────────────────────────────────────────────
-- `ow_users.is_test` は archive/276 / 277 で導入。以降この列を一括で触った
-- migration は無く、打ち消しは起きない（2026-08-26 に確認）。
--
-- ⚠️ **行を消さない。** CLAUDE.md「本番で検証用アカウントを作らない」の理由と同じで、
--    `ow_users` を参照する FK 45列のうち29列が ON DELETE CASCADE。
--    フラグを立てるだけにする。

update public.ow_users
   set is_test = true, updated_at = now()
 where id in (
   '191828d9-5dba-490b-a987-e357775979a7',  -- contact+16 山田 二郎
   'e77568ab-ac29-469f-aef2-4a8ca417836f',  -- contact+17 山田 三郎     ★SF に現役社員として出ていた
   '92ac6991-09f8-4f51-9758-621868ab0884',  -- contact+18 山田 18郎
   'ee706b89-3600-4251-93d1-5a0d4c5653fa',  -- contact+19 安藤 政治
   '4ea30b7e-187f-4560-9790-38e6b7e4b100',  -- contact+20 山並 大事
   'd476881c-ac4e-42f0-a42d-f191d2e8bccd',  -- contact+21 山並 大事郎
   '5e094489-212e-4826-a969-1b545ed46b0d',  -- contact+22 鈴木 愛人
   '046e48ee-1a47-4b34-b113-e3a7149538dc',  -- contact+23 鈴木 愛人
   '52b5d602-3182-4f0f-a4a0-5a40455c5c44',  -- contact+24 山田 空次郎
   'b0968ba2-b855-4b6d-81c2-56dac0584668',  -- contact+25 山田 25       ★SF に OB/OG として出ていた
   '56d784c9-30cf-4a4a-be88-50d80197c8aa',  -- contact+26 山田 25
   '7095dd09-f0d3-418d-b3de-fa46908b2fbe'   -- contact+27 相川 隆二     ★SF に現役社員＋面談対応者として出ていた
 );

-- ★12行ちょうど変わったことを確かめる。多くても少なくても中止する。
do $$
declare n integer;
begin
  select count(*) into n from public.ow_users
   where email like 'contact+%@opinio.co.jp' and is_test = false;
  if n <> 0 then
    raise exception 'contact+NN で is_test=false が % 件残っている（0 のはず）', n;
  end if;

  -- ⚠️ 適用前の実測（2026-08-26）: is_test=true は **20件**、false は18件（総数38）。
  --    contact+ 系だけでなく hshiba / contact+user10 / contact+001 なども含むので 15 ではない。
  select count(*) into n from public.ow_users where is_test = true;
  if n <> 32 then
    raise exception 'is_test=true の総数が % 件（20 + 12 = 32 のはず）', n;
  end if;
end $$;
