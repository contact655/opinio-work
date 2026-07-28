-- ⑥ ツール・技術スタック機能
-- ow_tool_masters: 全社共有ツール・技術スタックマスタ
-- ow_company_tools: 企業↔ツールの中間テーブル
-- SQL Editor で適用済み（2026-07-28）。supabase migration repair で履歴登録。

-- ── テーブル作成 ──────────────────────────────────────────────────────────────

CREATE TABLE ow_tool_masters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  aliases     TEXT[] NOT NULL DEFAULT '{}',
  category    TEXT NOT NULL CHECK (category IN (
                'crm','marketing','cloud_infra','dev',
                'data','communication','productivity','security'
              )),
  description TEXT,
  logo_url    TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ow_company_tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  tool_id     UUID NOT NULL REFERENCES ow_tool_masters(id) ON DELETE CASCADE,
  note        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, tool_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE ow_tool_masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tool masters"
  ON ow_tool_masters FOR SELECT USING (true);
CREATE POLICY "admins manage tool masters"
  ON ow_tool_masters FOR ALL USING (auth_is_admin());

ALTER TABLE ow_company_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read company tools"
  ON ow_company_tools FOR SELECT USING (true);
CREATE POLICY "company admins manage tools"
  ON ow_company_tools FOR ALL USING (auth_is_company_admin(company_id));
CREATE POLICY "admins manage company tools"
  ON ow_company_tools FOR ALL USING (auth_is_admin());

-- ── 初期データ 67件 ───────────────────────────────────────────────────────────

INSERT INTO ow_tool_masters (name, aliases, category, sort_order) VALUES
-- crm (8件)
('Salesforce',             ARRAY['SFDC','Sales Cloud','Salesforce CRM','セールスフォース'],    'crm', 10),
('HubSpot',                ARRAY['HubSpot CRM','HubSpot Sales Hub'],                           'crm', 20),
('Zendesk',                ARRAY['Zendesk Support','Zendesk Sell'],                             'crm', 30),
('Freshsales',             ARRAY['Freshworks CRM'],                                             'crm', 40),
('Outreach',               ARRAY[]::TEXT[],                                                     'crm', 50),
('SalesLoft',              ARRAY['Salesloft'],                                                  'crm', 60),
('Gong',                   ARRAY[]::TEXT[],                                                     'crm', 70),
('Microsoft Dynamics 365', ARRAY['Dynamics CRM','Dynamics 365'],                               'crm', 80),
-- marketing (7件)
('Marketo',                ARRAY['Adobe Marketo','Marketo Engage'],                             'marketing', 10),
('Pardot',                 ARRAY['Salesforce Pardot','Marketing Cloud Account Engagement'],     'marketing', 20),
('Google Analytics',       ARRAY['GA4','Universal Analytics','グーグルアナリティクス'],         'marketing', 30),
('Google Ads',             ARRAY['Google AdWords'],                                             'marketing', 40),
('Meta Ads',               ARRAY['Facebook Ads','Meta Business Suite'],                         'marketing', 50),
('Braze',                  ARRAY[]::TEXT[],                                                     'marketing', 60),
('Mailchimp',              ARRAY[]::TEXT[],                                                     'marketing', 70),
-- cloud_infra (9件)
('AWS',                    ARRAY['Amazon Web Services','アマゾンウェブサービス'],               'cloud_infra', 10),
('Google Cloud',           ARRAY['GCP','Google Cloud Platform'],                                'cloud_infra', 20),
('Microsoft Azure',        ARRAY['Azure'],                                                      'cloud_infra', 30),
('Cloudflare',             ARRAY[]::TEXT[],                                                     'cloud_infra', 40),
('Datadog',                ARRAY[]::TEXT[],                                                     'cloud_infra', 50),
('New Relic',              ARRAY[]::TEXT[],                                                     'cloud_infra', 60),
('Terraform',              ARRAY['HashiCorp Terraform'],                                        'cloud_infra', 70),
('Docker',                 ARRAY[]::TEXT[],                                                     'cloud_infra', 80),
('Kubernetes',             ARRAY['k8s'],                                                        'cloud_infra', 90),
-- dev (14件)
('GitHub',                 ARRAY['Github','github'],                                            'dev', 10),
('GitLab',                 ARRAY[]::TEXT[],                                                     'dev', 20),
('TypeScript',             ARRAY['TS'],                                                         'dev', 30),
('Go',                     ARRAY['Golang'],                                                     'dev', 40),
('Python',                 ARRAY[]::TEXT[],                                                     'dev', 50),
('Java',                   ARRAY[]::TEXT[],                                                     'dev', 60),
('Ruby',                   ARRAY[]::TEXT[],                                                     'dev', 70),
('React',                  ARRAY['React.js'],                                                   'dev', 80),
('Next.js',                ARRAY[]::TEXT[],                                                     'dev', 90),
('Vue.js',                 ARRAY['Vue'],                                                        'dev', 100),
('Node.js',                ARRAY['NodeJS'],                                                     'dev', 110),
('Ruby on Rails',          ARRAY['Rails','RoR'],                                                'dev', 120),
('Supabase',               ARRAY[]::TEXT[],                                                     'dev', 130),
('PostgreSQL',             ARRAY['Postgres'],                                                   'dev', 140),
-- data (8件)
('Tableau',                ARRAY[]::TEXT[],                                                     'data', 10),
('Looker',                 ARRAY['Looker Studio','Google Looker'],                              'data', 20),
('BigQuery',               ARRAY['Google BigQuery'],                                            'data', 30),
('Snowflake',              ARRAY[]::TEXT[],                                                     'data', 40),
('dbt',                    ARRAY['data build tool'],                                            'data', 50),
('Amazon Redshift',        ARRAY['Redshift'],                                                   'data', 60),
('Elasticsearch',          ARRAY['Elastic'],                                                    'data', 70),
('Mixpanel',               ARRAY[]::TEXT[],                                                     'data', 80),
-- communication (7件)
('Slack',                  ARRAY[]::TEXT[],                                                     'communication', 10),
('Microsoft Teams',        ARRAY['Teams'],                                                      'communication', 20),
('Zoom',                   ARRAY[]::TEXT[],                                                     'communication', 30),
('Google Meet',            ARRAY['Google Hangouts','Meet'],                                     'communication', 40),
('Chatwork',               ARRAY['ChatWork','チャットワーク'],                                  'communication', 50),
('LINE WORKS',             ARRAY['ラインワークス'],                                             'communication', 60),
('Webex',                  ARRAY['Cisco Webex'],                                                'communication', 70),
-- productivity (8件)
('Notion',                 ARRAY[]::TEXT[],                                                     'productivity', 10),
('Asana',                  ARRAY[]::TEXT[],                                                     'productivity', 20),
('Jira',                   ARRAY['Atlassian Jira','JIRA'],                                     'productivity', 30),
('Confluence',             ARRAY['Atlassian Confluence'],                                       'productivity', 40),
('Microsoft 365',          ARRAY['Office 365','M365','Microsoft Office'],                       'productivity', 50),
('Google Workspace',       ARRAY['G Suite','Google Apps'],                                      'productivity', 60),
('Backlog',                ARRAY[]::TEXT[],                                                     'productivity', 70),
('Monday.com',             ARRAY['monday'],                                                     'productivity', 80),
-- security (6件)
('CrowdStrike',            ARRAY['CrowdStrike Falcon'],                                         'security', 10),
('Palo Alto Networks',     ARRAY['Palo Alto','PANW'],                                           'security', 20),
('Okta',                   ARRAY[]::TEXT[],                                                     'security', 30),
('Zscaler',                ARRAY[]::TEXT[],                                                     'security', 40),
('Splunk',                 ARRAY[]::TEXT[],                                                     'security', 50),
('KnowBe4',                ARRAY[]::TEXT[],                                                     'security', 60);
