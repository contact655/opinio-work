-- ★ow_companies の文字列の列に残っている空文字 '' を null に戻す（2026-11-27 / 柴さんの指示）
--
-- なぜ: 運営画面（/admin/companies/[id]）の保存が、空の入力欄を '' のまま書いていた（保存APIは同日に直した。lib/utils/blankToNull.ts）。
--       '' は表示側の `brand_name ?? name` で「値がある」と読まれ、フィード・求人一覧・フォロー一覧などで社名が空になっていた。
--
-- 対象（2026-11-27 実測。文字列の列すべてを数えて、'' があったのはこの1行・8列だけ）:
--   株式会社Opinio（id = cf44d740-b835-454d-91a3-f1e2eddc7251）
--     brand_name / nearest_station / opinio_comment / casual_interview_url /
--     recruiter_name / recruiter_role / recruiter_message / recruiter_avatar_url
--
-- ⚠️ 全社一括にしない（CLAUDE.md の migration の決まり）。行は id で、列は名前で明示する。
-- ⚠️ nullif で戻すので、適用までに誰かが値を入れた列はそのまま残る。
-- ⚠️ updated_at は触らない（内容は変わらない。'' と null は画面では同じ「空」）。
-- 作業前ダンプ: .dumps/20261127-1004-ow_companies.sql
-- 戻し方: 必要なら同じ8列を '' に戻す（update ... set brand_name = '' ... where id = 上の id）

do $$
declare
  v_id constant uuid := 'cf44d740-b835-454d-91a3-f1e2eddc7251';
  v_before int;
  v_after int;
  v_n int;
begin
  -- 検算（前）: '' のセルが会社全体で8つ、すべてこの1行
  select count(*) into v_before
    from public.ow_companies c, jsonb_each(to_jsonb(c)) kv
   where kv.value = '""'::jsonb;
  if v_before <> 8 then
    raise exception '中止: 空文字のセルが % 個（8個のはず）。調べ直してから当てること', v_before;
  end if;

  update public.ow_companies set
    brand_name           = nullif(brand_name, ''),
    nearest_station      = nullif(nearest_station, ''),
    opinio_comment       = nullif(opinio_comment, ''),
    casual_interview_url = nullif(casual_interview_url, ''),
    recruiter_name       = nullif(recruiter_name, ''),
    recruiter_role       = nullif(recruiter_role, ''),
    recruiter_message    = nullif(recruiter_message, ''),
    recruiter_avatar_url = nullif(recruiter_avatar_url, '')
  where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception '中止: 更新した行が % 行（1行のはず）', v_n;
  end if;

  -- 検算（後）: '' のセルが0
  select count(*) into v_after
    from public.ow_companies c, jsonb_each(to_jsonb(c)) kv
   where kv.value = '""'::jsonb;
  if v_after <> 0 then
    raise exception '中止: 空文字のセルがまだ % 個残っている', v_after;
  end if;
end $$;
