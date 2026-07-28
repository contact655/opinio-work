-- Salesforce Japan: ツールデータ投入（暫定値）
-- Slack / Google カレンダー / Gmail / AWS は公式発表に基づく。
-- Salesforce / Tableau は自社製品の社内利用。
-- ChatGPT / Claude / Gemini は出典未確認の暫定値 → 取材で確認すること。

DO $$
DECLARE
  cid uuid := 'c3664ef1-5571-4645-b30f-1474e7961c17';
BEGIN
  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 1 FROM ow_tool_masters WHERE name = 'Google カレンダー';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 2 FROM ow_tool_masters WHERE name = 'Gmail';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 3 FROM ow_tool_masters WHERE name = 'Salesforce';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 4 FROM ow_tool_masters WHERE name = 'Slack';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 5 FROM ow_tool_masters WHERE name = 'Tableau';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 6 FROM ow_tool_masters WHERE name = 'AWS';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 7 FROM ow_tool_masters WHERE name = 'ChatGPT';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 8 FROM ow_tool_masters WHERE name = 'Claude';

  INSERT INTO ow_company_tools (company_id, tool_id, sort_order)
  SELECT cid, id, 9 FROM ow_tool_masters WHERE name = 'Gemini';
END $$;
