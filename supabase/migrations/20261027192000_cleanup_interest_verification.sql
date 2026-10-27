-- ★「話を聞いてみたい」フェーズ1a の検証で作った行を id を指定して片づけ、検証用の会社を下書きに戻す
--   （2026-10-27 / 柴さんの指示。検証は contact+25（押した人）と contact+50（担当者）だけで行った）
-- 作業前ダンプ: .dumps/20261027-1822-ow_company_admins-ow_for_you_reactions-…sql
-- ⚠️ 【テスト】担当者なし株式会社 は消さない（listing_status を 'draft' に戻すだけ）

do $$
declare
  v_user constant uuid := 'b0968ba2-b855-4b6d-81c2-56dac0584668'; -- contact+25
  v_convs constant uuid[] := array['f53aeeaa-d345-4c69-a582-1f975a4a50e2','26d3a322-60f9-4034-9fe0-fbe6c39996ff']::uuid[];
  n int;
begin
  delete from ow_for_you_reactions
   where user_id = v_user and company_id in ('81cae8d8-38bf-4497-8fa1-1fbb2741239d','b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19');
  get diagnostics n = row_count; if n <> 2 then raise exception 'reactions: % 行', n; end if;

  delete from ow_notifications where id = 'e5a7661e-62d1-4fc9-aa6d-eee133116c14';
  get diagnostics n = row_count; if n <> 1 then raise exception 'notifications: % 行', n; end if;

  delete from ow_conversation_messages where id in (
    '77f720bb-d1fe-41ad-92aa-3dd2d08c7c7d','2e2c0b69-90c5-46dd-afca-9ca3ad991bc3',
    '1cf99c08-9f7f-47cd-a326-59e0af13e2f7','6173612c-8ba6-42ef-af42-342c2186ae7d');
  get diagnostics n = row_count; if n <> 4 then raise exception 'messages: % 行', n; end if;

  delete from ow_conversation_participants where id in (
    'dc7a63a2-ce76-4bd6-b1c5-a6731ba5c1e4','eccba6d8-2d45-47d0-b5b7-1d80af42fd62','764def02-b38a-40dc-a59b-d4a7d259c576');
  get diagnostics n = row_count; if n <> 3 then raise exception 'participants: % 行', n; end if;

  delete from ow_conversations where id = any(v_convs);
  get diagnostics n = row_count; if n <> 2 then raise exception 'conversations: % 行', n; end if;

  delete from ow_company_admins where id = 'd2a6f4c1-8e3b-4b7a-9c55-1f0e7a3b2c48';
  get diagnostics n = row_count; if n <> 1 then raise exception 'admins: % 行', n; end if;

  update ow_companies set listing_status = 'draft' where id = 'b7c1e0a4-5d2f-4c8e-9a31-6f0d2e4b7a19' and is_test;
  get diagnostics n = row_count; if n <> 1 then raise exception 'company draft: % 行', n; end if;
end $$;
