-- PKSHA の公式URLを入れ、死んだ Clearbit の logo_url を落とす（2026-08-25）
--
-- ── 何が起きていたか（実測 2026-08-25）────────────────────────────────────
--   `ow_companies` 87社のうち **75社は Storage に移行済み**（60社を実測して全て200）。
--   残るのは **Clearbit のまま1社（PKSHA）** と **logo_url が空の11社**。
--   ⚠️ CLAUDE.md の「76社すべてが Clearbit」は 2026-08-11 時点の記述で、**既に古い**。
--
-- ── ⚠️★なぜ「Clearbit を null にする」だけではダメだったか ────────────────
--   `CompanyLogo` のフォールバックは
--     ① 生きている logo_url → ② **companyUrl か logoUrl から取り出したドメイン**の
--     Google favicon → ③ 頭文字
--   の順。**PKSHA は `url` が空**だったので、
--   **死んだ Clearbit URL がドメイン（pkshatech.com）の唯一の手がかり**になっていた。
--   先に null にすると ③ に落ち、**ロゴが頭文字に悪化する**。
--   → 先に `url` を入れてから落とす。
--
-- ⚠️ ドメインは**推測していない**。Clearbit URL に含まれていた `pkshatech.com` を
--    実際に開いて `<title>PKSHA Technology Inc.</title>` を確認している（2026-08-25）。
--
-- ⚠️ 対象は id で明示列挙する（CLAUDE.md「全社一括の UPDATE を禁止する」）。

update public.ow_companies
   set url = 'https://www.pkshatech.com/'
 where id = '09d67e54-0381-45c8-b698-568e1fc47033'
   and url is null;   -- ⚠️ 既に入っていたら触らない

update public.ow_companies
   set logo_url = null
 where id = '09d67e54-0381-45c8-b698-568e1fc47033'
   and logo_url = 'https://logo.clearbit.com/pkshatech.com';

-- ── 適用後の実測 ───────────────────────────────────────────────────────────
do $$
declare
  v_url text;
  v_logo text;
  v_clearbit int;
begin
  select url, logo_url into v_url, v_logo
    from public.ow_companies where id = '09d67e54-0381-45c8-b698-568e1fc47033';
  if v_url is null then
    raise exception 'PKSHA の url が入っていない（先に入れないとロゴが頭文字に落ちる）';
  end if;
  if v_logo is not null then
    raise exception 'PKSHA の logo_url が残っている';
  end if;
  select count(*) into v_clearbit from public.ow_companies where logo_url like '%clearbit%';
  if v_clearbit <> 0 then
    raise exception 'まだ clearbit を指す行が % 件ある', v_clearbit;
  end if;
end $$;
