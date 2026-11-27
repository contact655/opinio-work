-- ★株式会社エージェントを、資本金・代表メッセージ・これまでの歩みの検証（2026-11-27）の前の状態に戻す
--
-- 対象: ow_companies の1行だけ（id = 7a048a8e-2c44-4f09-a727-8d7e6350851c / 株式会社エージェント）
-- 戻す前の状態は .dumps/20261127-0926-ow_companies-ow_company_milestones.sql（検証で書き込む前に取ったダンプ）
--
-- 検証で変わったもの:
--   ① /biz/company の自動保存で draft_data に検証用の値が入り、updated_at が変わった
--   ② /admin/companies/[id] の保存（2回）で、null だった19列が空文字 '' になった
--      （運営の保存は空の入力欄を '' のまま書く。この動き自体は以前から。代表メッセージだけは 5dba17b4 で null にするよう直した）
--   ③ 資本金・これまでの歩みは、運営画面で消して保存したので、すでに元（null・0件）に戻っている
--
-- ⚠️ 空文字の列は nullif で戻す（検証のあとに誰かが値を入れていたら、その値は残す）。
-- ⚠️ updated_at は、検証の最後の保存の値のときだけ元に戻す（違えば中止）。
-- ⚠️ ow_company_business_domains / ow_company_customer_industries は運営の保存で同じ内容のまま入れ直されている。中身は変わっていないので触らない。

do $$
declare
  v_id constant uuid := '7a048a8e-2c44-4f09-a727-8d7e6350851c';
  v_n int;
begin
  if (select updated_at from public.ow_companies where id = v_id) <> '2026-11-27 00:40:52.015+00'::timestamptz then
    raise exception '中止: 株式会社エージェントの updated_at が検証の最後の保存から変わっている（ほかの更新があった）';
  end if;
  if (select count(*) from public.ow_company_milestones where company_id = v_id) <> 0 then
    raise exception '中止: これまでの歩みが0件ではない';
  end if;

  update public.ow_companies set
    url                  = nullif(url, ''),
    mission              = nullif(mission, ''),
    description          = nullif(description, ''),
    logo_url             = nullif(logo_url, ''),
    recruiter_name       = nullif(recruiter_name, ''),
    recruiter_role       = nullif(recruiter_role, ''),
    recruiter_message    = nullif(recruiter_message, ''),
    recruiter_avatar_url = nullif(recruiter_avatar_url, ''),
    opinio_comment       = nullif(opinio_comment, ''),
    casual_interview_url = nullif(casual_interview_url, ''),
    funding_stage        = nullif(funding_stage, ''),
    ceo_name             = nullif(ceo_name, ''),
    tagline              = nullif(tagline, ''),
    culture_description  = nullif(culture_description, ''),
    why_join             = nullif(why_join, ''),
    headquarters_address = nullif(headquarters_address, ''),
    nearest_station      = nullif(nearest_station, ''),
    brand_name           = nullif(brand_name, ''),
    ceo_message          = nullif(ceo_message, ''),
    capital_amount_yen   = null,
    draft_data           = null,
    updated_at           = '2026-10-15 10:52:57.442+00'::timestamptz
  where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception '中止: 更新した行が % 行（1行のはず）', v_n;
  end if;
end $$;
