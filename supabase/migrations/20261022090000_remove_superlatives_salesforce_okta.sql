-- ★掲載企業の一言・本文から、根拠を示していない言い切りを外す（2026-10-22 / 柴さんの了承待ち）
--
-- 対象（id を明示）:
--   c3664ef1-5571-4645-b30f-1474e7961c17 株式会社セールスフォース・ジャパン … tagline / description の「世界No.1」
--   f8ebbe74-b647-46ea-869f-b126d1c4f316 Okta Japan株式会社              … description の「グローバルリーダー」「圧倒的存在感」、時点の無い「世界18,400社以上」
--
-- 調べ方（2026-10-22 / 掲載中・公開中・is_test でない企業）:
--   tagline と description を「No.1・ナンバーワン・世界一・日本一・業界最大・最大級・唯一・最高・圧倒的・リーディング」で検索し、当たったのはこの2社だけ。
--
-- 同じ列を触った直近の migration:
--   20260728061244_salesforce_japan_capital_fields.sql が Salesforce の description を入れた（この「世界No.1」の出どころ）。打ち消しではなく、その文言を直すもの。
--   tagline に触れた migration は src / migrations に見当たらない（2026-06-02 の updated_at のまま）。
--
-- 企業側の下書き（draft_data）に tagline / description は無い（2026-10-22 確認）＝「変更を公開する」で元に戻らない。
-- 作業前ダンプ: .dumps/20261022-1325-ow_companies.sql（130行）
--
-- 戻し方: 下の「前の値」をそのまま UPDATE し直す。

begin;

do $$
declare
  n int;
begin
  -- ★いまの値が想定どおりでなければ中止（誰かが先に直していたら上書きしない）
  select count(*) into n from ow_companies
   where id = 'c3664ef1-5571-4645-b30f-1474e7961c17'
     and tagline = '世界No.1 CRMで、ビジネスの未来を変える'
     and description = '世界No.1のCRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中小企業まで幅広く提供。グローバル約73,000名（2024年1月期末）が在籍する米国NYSE上場企業の日本法人。';
  if n <> 1 then raise exception 'Salesforce の現在値が想定と違う（%件）。中止', n; end if;

  select count(*) into n from ow_companies
   where id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316'
     and description = 'アイデンティティ・アクセス管理（IAM）のグローバルリーダーの日本法人。シングルサインオン・多要素認証・ライフサイクル管理を統合した「Okta Identity Cloud」は世界18,400社以上が採用。Auth0買収後、開発者向けIAM市場でも圧倒的存在感。';
  if n <> 1 then raise exception 'Okta の現在値が想定と違う（%件）。中止', n; end if;
end $$;

update ow_companies set
  tagline     = '顧客管理と営業・マーケティングの仕組みを、1つの基盤にまとめる',
  description = 'CRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中小企業まで幅広く提供。グローバル約73,000名（2024年1月期末）が在籍する米国NYSE上場企業の日本法人。'
where id = 'c3664ef1-5571-4645-b30f-1474e7961c17';

update ow_companies set
  description = 'アイデンティティ・アクセス管理（IAM）を手がける米Okta, Inc.の日本法人。シングルサインオン・多要素認証・ライフサイクル管理を統合した「Okta Identity Cloud」を提供する。2021年にAuth0を買収し、開発者向けのIAMも扱う。'
where id = 'f8ebbe74-b647-46ea-869f-b126d1c4f316';

do $$
declare
  n int;
begin
  select count(*) into n from ow_companies
   where listing_status = 'listed' and is_published and not is_test
     and (coalesce(tagline,'') || coalesce(description,'')) ~ '(No\.?1|ナンバーワン|世界一|日本一|業界最大|最大級|唯一|最高|圧倒的|リーディング|グローバルリーダー)';
  if n <> 0 then raise exception '適用後も言い切りが残っている（%社）。中止', n; end if;
end $$;

commit;

-- 前の値（戻すとき用）:
--   Salesforce tagline     = '世界No.1 CRMで、ビジネスの未来を変える'
--   Salesforce description = '世界No.1のCRMプラットフォーム「Salesforce」を日本で展開。営業・マーケティング・カスタマーサービス領域のクラウドサービスをエンタープライズから中小企業まで幅広く提供。グローバル約73,000名（2024年1月期末）が在籍する米国NYSE上場企業の日本法人。'
--   Okta description       = 'アイデンティティ・アクセス管理（IAM）のグローバルリーダーの日本法人。シングルサインオン・多要素認証・ライフサイクル管理を統合した「Okta Identity Cloud」は世界18,400社以上が採用。Auth0買収後、開発者向けIAM市場でも圧倒的存在感。'
