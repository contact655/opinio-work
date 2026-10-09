-- ════════════════════════════════════════════════════════════════════════
-- 会社規模の帯（2026-10-10 / 声かけまわり 段1）—— 値を入れる（企業ごとに明示列挙）
-- ════════════════════════════════════════════════════════════════════════
--
-- ★全社一括の UPDATE をしない（CLAUDE.md）。85社を id で明示列挙し、
--   **自由記述の employee_count が想定どおりの原文のときだけ**書き換える（原文が変わっていたら中止）。
--   同じ列（employee_count_band / employee_count_as_of）を触った直近の migration は無い
--   （20261010020000 で作ったばかり）ことを確認済み。
--
-- ★変換の決めごと（柴さんの判断 2026-10-10）
--   ・「約N名」は概数なので、その数が入る帯（約200名 → 51-200、約50名 → 11-50、約1000名 → 501-1000）
--   ・「N名以上」は下限の数が入る帯（3500名以上・3,000名以上・1600名以上 → 1001-5000）。
--     ⚠️ この3社は docs/company-size-band-20261010.md の「運営が確認する一覧」に載せてある。
--        空にすると、規模で範囲を絞っている求職者に届かなくなり、掲載中の企業が損をするため。
--   ・単体とグループの両方があれば単体（採用する法人の人数を優先し、無ければ書いてある数字を使う）。
--     グローバルの人数だけのもの（2,300名（グローバル））はそのまま使う。
--   ・時点は括弧の中の年月から。月までしか分からないものも日まで分かるものも**月初**を入れる
--     （画面は「◯年◯月時点」と月まで出す）。
--   ⚠️ 推測で埋めない。原文が空の企業は帯も空のまま。
--
-- ★作業前のダンプ: .dumps/ に ow_companies を取ってから当てる。
-- ★戻すとき: update public.ow_companies set employee_count_band = null, employee_count_as_of = null
--            where id in (下の85社);
-- ════════════════════════════════════════════════════════════════════════

begin;

create temp table _band(id uuid primary key, raw text not null, band text not null, as_of date) on commit drop;
insert into _band(id, raw, band, as_of) values
  ('09d67e54-0381-45c8-b698-568e1fc47033'::uuid, '382名（2026年2月時点・単体）', '201-500', '2026-02-01'::date),  -- 株式会社PKSHA Technology / N名
  ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'::uuid, '約200名', '51-200', null::date),  -- クラウドフレア・ジャパン株式会社 / 約N名 → その数の帯
  ('0b93a8f2-d378-4d5a-aecc-9040fde2113c'::uuid, '258名（2025年12月31日時点）', '201-500', '2025-12-01'::date),  -- スパイダープラス株式会社 / N名
  ('0d4734e0-0717-475e-a6d1-806aa2cd45ff'::uuid, '2,300名（グローバル）', '1001-5000', null::date),  -- New Relic株式会社 / N名
  ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64'::uuid, '約500名', '201-500', null::date),  -- Meta日本法人 / 約N名 → その数の帯
  ('1027a327-18c0-4191-b27b-a28bf5781126'::uuid, '約200名', '51-200', null::date),  -- クーパ・ソフトウェア株式会社 / 約N名 → その数の帯
  ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'::uuid, '約50名', '11-50', null::date),  -- ザクトリー株式会社 / 約N名 → その数の帯
  ('138ff010-8671-414a-ab06-752d61f50dd7'::uuid, '単体6,425名 / グループ12,862名（2026年4月現在）', '5001-10000', '2026-04-01'::date),  -- 伊藤忠テクノソリューションズ株式会社 / 単体を使う（採用する法人の人数を優先）
  ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'::uuid, '約30名', '11-50', null::date),  -- クリックハウス株式会社 / 約N名 → その数の帯
  ('1e541353-c177-40a9-968a-af3af14e1194'::uuid, '約200名', '51-200', null::date),  -- エラスティック株式会社 / 約N名 → その数の帯
  ('1f73df31-8e55-4e70-a928-afe1150d72d0'::uuid, '約100名', '51-200', null::date),  -- Dropbox Japan株式会社 / 約N名 → その数の帯
  ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'::uuid, '約1800名', '1001-5000', null::date),  -- 日本オラクル株式会社 / 約N名 → その数の帯
  ('20cd4ddd-f00e-4065-909d-97a317558ad3'::uuid, '約30,000名（2026年6月1日時点）', '10001+', '2026-06-01'::date),  -- アクセンチュア株式会社 / 約N名 → その数の帯
  ('27988ac1-fd93-445d-a9fd-6dad74c92686'::uuid, '約2500名', '1001-5000', null::date),  -- シスコシステムズ合同会社 / 約N名 → その数の帯
  ('28b826eb-fb86-4124-aa08-c489cad662f1'::uuid, '約65名', '51-200', null::date),  -- 株式会社シンカ / 約N名 → その数の帯
  ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'::uuid, '1600名以上', '1001-5000', null::date),  -- 株式会社タイミー / N名以上 → 下限の帯（運営が確認する）
  ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'::uuid, '約400名', '201-500', null::date),  -- フォーティネットジャパン合同会社 / 約N名 → その数の帯
  ('355ce5c6-0412-4512-8864-1d477c97c917'::uuid, '約50名', '11-50', null::date),  -- ミラクル株式会社 / 約N名 → その数の帯
  ('3efd857e-315c-4650-9727-1e5aa1245753'::uuid, '約100名', '51-200', null::date),  -- アリスタネットワークス合同会社 / 約N名 → その数の帯
  ('40dca29e-aa4b-4654-aada-8e29763f8521'::uuid, '約2800名', '1001-5000', null::date),  -- 日本マイクロソフト株式会社 / 約N名 → その数の帯
  ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'::uuid, '約200名', '51-200', null::date),  -- ブレイズ株式会社 / 約N名 → その数の帯
  ('4df6e844-74d6-4f50-98f9-08468a12f1dc'::uuid, '約600名', '501-1000', null::date),  -- ServiceNow Japan合同会社 / 約N名 → その数の帯
  ('4fecbf31-498c-40b0-a04e-3a6cb978433f'::uuid, '約100名', '51-200', null::date),  -- ゲインサイト・ジャパン株式会社 / 約N名 → その数の帯
  ('53ea9a54-feef-413b-8a7c-e31e4def2e11'::uuid, '約100名', '51-200', null::date),  -- ブラックライン株式会社 / 約N名 → その数の帯
  ('565b0f13-252d-44d0-8b90-e00acacf4b75'::uuid, '約100名', '51-200', null::date),  -- MongoDB Japan合同会社 / 約N名 → その数の帯
  ('60304f29-e070-4ef6-9b44-8a899a411a8d'::uuid, '3,000名以上', '1001-5000', null::date),  -- アサヒビール株式会社 / N名以上 → 下限の帯（運営が確認する）
  ('6396920c-70d3-47d2-9f4e-67bc2efe262f'::uuid, '約300名', '201-500', null::date),  -- アカマイ・テクノロジーズ合同会社 / 約N名 → その数の帯
  ('63d390da-e8c4-464a-8c30-e112fcd2709c'::uuid, '約270名', '201-500', null::date),  -- 株式会社irodas / 約N名 → その数の帯
  ('6c218a59-a951-44ee-9003-163956376554'::uuid, '約100名', '51-200', null::date),  -- Asana Japan株式会社 / 約N名 → その数の帯
  ('7a048a8e-2c44-4f09-a727-8d7e6350851c'::uuid, '1-10名', '1-10', null::date),  -- 株式会社エージェント / 範囲
  ('7baafcb1-d929-46c1-97be-b0fb580b480b'::uuid, '約100名', '51-200', null::date),  -- ページャーデューティー株式会社 / 約N名 → その数の帯
  ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'::uuid, '約1500名', '1001-5000', null::date),  -- グーグル合同会社 / 約N名 → その数の帯
  ('7dac3c6e-bc5f-4550-9170-4338ea809be2'::uuid, '約600名', '501-1000', null::date),  -- ヴイエムウェア株式会社 / 約N名 → その数の帯
  ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11'::uuid, '1,497名（2026年4月末時点）', '1001-5000', '2026-04-01'::date),  -- 株式会社SmartHR / N名
  ('829a1ea9-d577-4404-9ba7-e301680523a8'::uuid, '約300名', '201-500', null::date),  -- エヌビディア合同会社 / 約N名 → その数の帯
  ('87bcae88-2779-4bf7-b461-b3c8661b2764'::uuid, '約200名', '51-200', null::date),  -- クラウドストライク合同会社 / 約N名 → その数の帯
  ('88defb4b-b18c-437b-8b7d-d41a43232af4'::uuid, '約100名', '51-200', null::date),  -- Twilio Japan合同会社 / 約N名 → その数の帯
  ('8b9f84b0-b4be-4191-8322-07c6a2e5e91a'::uuid, '2,077名（2026年5月末時点・単体）', '1001-5000', '2026-05-01'::date),  -- Sansan株式会社 / N名
  ('8dc04d46-3430-45de-91f8-e37c8880b8a5'::uuid, '約400名', '201-500', null::date),  -- 株式会社ワークデイ / 約N名 → その数の帯
  ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'::uuid, '約300名', '201-500', null::date),  -- 株式会社コンカー / 約N名 → その数の帯
  ('943620b5-0fa2-48b4-a072-d47f900ba9f0'::uuid, '約300名', '201-500', null::date),  -- ウーバー・ジャパン株式会社 / 約N名 → その数の帯
  ('94edfbe5-0496-4c1d-865c-d2d448232135'::uuid, '約300名', '201-500', null::date),  -- クアルコムジャパン合同会社 / 約N名 → その数の帯
  ('99132c64-ff07-4945-aeb6-7e21e6c256c9'::uuid, '約100名', '51-200', null::date),  -- KnowBe4 Japan合同会社 / 約N名 → その数の帯
  ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'::uuid, '約1500名', '1001-5000', null::date),  -- 日本ヒューレット・パッカード合同会社 / 約N名 → その数の帯
  ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'::uuid, '約10000名', '5001-10000', null::date),  -- 日本IBM株式会社 / 約N名 → その数の帯
  ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'::uuid, '約50名', '11-50', null::date),  -- キリバ株式会社 / 約N名 → その数の帯
  ('a5ffac90-70aa-4242-b867-6d9334317851'::uuid, '約300名', '201-500', null::date),  -- Datadog Japan合同会社 / 約N名 → その数の帯
  ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'::uuid, '約2000名（日本）', '1001-5000', null::date),  -- アマゾン ウェブ サービス ジャパン合同会社 / 約N名 → その数の帯
  ('aaaaaaaa-0001-0001-0001-000000000007'::uuid, '約300名（日本）', '201-500', null::date),  -- HubSpot Japan株式会社 / 約N名 → その数の帯
  ('ae15610d-477a-410d-b74a-54ab3e351add'::uuid, '約200名', '51-200', null::date),  -- Databricks Japan株式会社 / 約N名 → その数の帯
  ('b1d7996c-d260-4025-b495-bd1e2b9bb795'::uuid, '1,023名（2026年9月1日時点）', '1001-5000', '2026-09-01'::date),  -- 株式会社アンドパッド / N名
  ('b8aa0e3d-828c-4bbe-b588-88450aab5739'::uuid, '約50名', '11-50', null::date),  -- nCino株式会社 / 約N名 → その数の帯
  ('b8b7a2d4-20a8-4fe1-8651-61a6503f762e'::uuid, '9,902名', '5001-10000', null::date),  -- 富士フイルムビジネスイノベーションジャパン株式会社 / N名
  ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'::uuid, '約3000名', '1001-5000', null::date),  -- SAPジャパン株式会社 / 約N名 → その数の帯
  ('be74d989-db8f-4be1-882c-40cf94e07fe2'::uuid, '約100名', '51-200', null::date),  -- パランティア・テクノロジーズ / 約N名 → その数の帯
  ('bf24736f-fa65-4c5a-9764-98c96ace3b07'::uuid, '約50名', '11-50', null::date),  -- Notion Labs Japan合同会社 / 約N名 → その数の帯
  ('c32027b9-cfbd-4a70-bf4c-464e42790db4'::uuid, '約1500名', '1001-5000', null::date),  -- 株式会社日本HP / 約N名 → その数の帯
  ('c3664ef1-5571-4645-b30f-1474e7961c17'::uuid, '3500名以上', '1001-5000', null::date),  -- 株式会社セールスフォース・ジャパン / N名以上 → 下限の帯（運営が確認する）
  ('c7353772-0c07-4f0d-8d20-294215125303'::uuid, '約200名', '51-200', null::date),  -- 株式会社Box Japan / 約N名 → その数の帯
  ('cb386dd2-427c-49d1-b3f8-1e1d3a921fd8'::uuid, '50名', '11-50', null::date),  -- 株式会社フライル / N名
  ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'::uuid, '約200名', '51-200', null::date),  -- Snowflake合同会社 / 約N名 → その数の帯
  ('ce44864d-5e66-4684-8723-29282e3d6f5c'::uuid, '約85名', '51-200', null::date),  -- 【テスト】株式会社サンプルワークス（検証用） / 約N名 → その数の帯
  ('cf44d740-b835-454d-91a3-f1e2eddc7251'::uuid, '〜10名', '1-10', null::date),  -- 株式会社Opinio / 〜N名
  ('cf939b76-5fa3-4066-a921-601ca22d1e95'::uuid, '約8,070名（2025年12月現在・単体）', '5001-10000', '2025-12-01'::date),  -- 株式会社マイナビ / 約N名 → その数の帯
  ('d079cdfe-f8f1-49db-b871-117651136362'::uuid, '約200名', '51-200', null::date),  -- スマートキャンプ株式会社 / 約N名 → その数の帯
  ('d1c26664-5643-42bc-84e4-6f0c940bb39d'::uuid, '約73名', '51-200', null::date),  -- 株式会社Translead / 約N名 → その数の帯
  ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'::uuid, '約200名', '51-200', null::date),  -- 合同会社Zendesk / 約N名 → その数の帯
  ('d71a7da6-a769-456e-99ab-a077d89a0d43'::uuid, '88名（2026年4月1日時点）', '51-200', '2026-04-01'::date),  -- 株式会社フォトラクション / N名
  ('da8cfab5-f5c2-4648-b866-895be46a1494'::uuid, '約150名', '51-200', null::date),  -- DocuSign Japan株式会社 / 約N名 → その数の帯
  ('daa558e5-054f-4475-ab00-3817170759ce'::uuid, '約50名', '11-50', null::date),  -- OpenAI Japan合同会社 / 約N名 → その数の帯
  ('dcd2c652-4335-4031-b4d2-a4f22c98182b'::uuid, '約1000名', '501-1000', null::date),  -- アップルジャパン合同会社 / 約N名 → その数の帯
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid, '約200名', '51-200', null::date),  -- ゼットスケーラー株式会社 / 約N名 → その数の帯
  ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'::uuid, '約100名', '51-200', null::date),  -- WalkMe株式会社 / 約N名 → その数の帯
  ('e459ac79-5dad-499d-bb65-b758d4281123'::uuid, '約50名', '11-50', null::date),  -- コング・ジャパン株式会社 / 約N名 → その数の帯
  ('e7e9b0be-20c2-4434-afea-7a27c89332e2'::uuid, '約1000名', '501-1000', null::date),  -- Indeed Japan株式会社 / 約N名 → その数の帯
  ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'::uuid, '約700名', '501-1000', null::date),  -- インテル株式会社 / 約N名 → その数の帯
  ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'::uuid, '約800名', '501-1000', null::date),  -- アドビ株式会社 / 約N名 → その数の帯
  ('f201ed17-a9e2-4859-85aa-474578b2870d'::uuid, '約1500名', '1001-5000', null::date),  -- レノボ・ジャパン合同会社 / 約N名 → その数の帯
  ('f32e6905-f25f-4c01-b64f-c5695fd45a1d'::uuid, '約20名', '11-50', null::date),  -- アンソロピックジャパン合同会社 / 約N名 → その数の帯
  ('f4a6aa23-3775-4548-981b-156e416ef6f6'::uuid, '約500名', '201-500', null::date),  -- パロアルトネットワークス株式会社 / 約N名 → その数の帯
  ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'::uuid, '約2000名', '1001-5000', null::date),  -- デル・テクノロジーズ株式会社 / 約N名 → その数の帯
  ('f8ebbe74-b647-46ea-869f-b126d1c4f316'::uuid, '約200名', '51-200', null::date),  -- Okta Japan株式会社 / 約N名 → その数の帯
  ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'::uuid, '220名（2026年4月時点）', '201-500', '2026-04-01'::date),  -- Ubie株式会社 / N名
  ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e'::uuid, '約150名', '51-200', null::date),  -- アトラシアン株式会社 / 約N名 → その数の帯
  ('fde6f9c3-e2a5-457f-a6f1-e184b3a57682'::uuid, '259名（2026年1月現在）', '201-500', '2026-01-01'::date)   -- 海光電業株式会社 / N名
;

do $$
declare v_missing int; v_changed int; v_already int;
begin
  select count(*) into v_missing from _band b left join ow_companies c on c.id = b.id where c.id is null;
  select count(*) into v_changed from _band b join ow_companies c on c.id = b.id where c.employee_count is distinct from b.raw;
  select count(*) into v_already from ow_companies where employee_count_band is not null;
  if (select count(*) from _band) <> 85 or v_missing <> 0 or v_changed <> 0 or v_already <> 0 then
    raise exception '中止: 件数 % / 見つからない % / 原文が変わった % / 既に帯がある %（想定は 85 / 0 / 0 / 0）',
      (select count(*) from _band), v_missing, v_changed, v_already;
  end if;
end $$;

update public.ow_companies c
   set employee_count_band = b.band, employee_count_as_of = b.as_of
  from _band b
 where c.id = b.id and c.employee_count = b.raw;

do $$
declare v_n int; v_asof int;
begin
  select count(*) into v_n from ow_companies where employee_count_band is not null;
  select count(*) into v_asof from ow_companies where employee_count_as_of is not null;
  if v_n <> 85 or v_asof <> 11 then
    raise exception '検算失敗: 帯 % 社・時点 % 社（想定は 85 / 11）', v_n, v_asof;
  end if;
  raise notice '検算OK: 帯を 85 社（うち検証用1社）、時点を 11 社に入れた';
end $$;

commit;
