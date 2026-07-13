-- Migration 221: add direct_message kind to ow_conversations
-- DM機能のために kind='direct_message' を許可する

ALTER TABLE ow_conversations
  DROP CONSTRAINT ow_conversations_kind_check,
  DROP CONSTRAINT ow_conversations_kind_consistency,
  DROP CONSTRAINT ow_conversations_stage_consistency;

ALTER TABLE ow_conversations
  ADD CONSTRAINT ow_conversations_kind_check
    CHECK (kind = ANY (ARRAY['company', 'mentor', 'editor', 'direct_message'])),

  ADD CONSTRAINT ow_conversations_kind_consistency
    CHECK (
      (kind = 'company'        AND company_id IS NOT NULL AND mentor_user_id IS NULL) OR
      (kind = 'mentor'         AND company_id IS NULL     AND mentor_user_id IS NOT NULL) OR
      (kind = 'editor'         AND company_id IS NULL     AND mentor_user_id IS NULL) OR
      (kind = 'direct_message' AND company_id IS NULL     AND mentor_user_id IS NOT NULL)
    ),

  ADD CONSTRAINT ow_conversations_stage_consistency
    CHECK (
      (kind = 'company'        AND stage = 'active') OR
      (kind = 'mentor'         AND stage = ANY (ARRAY['mediated', 'direct'])) OR
      (kind = 'editor'         AND stage = 'active') OR
      (kind = 'direct_message' AND stage = 'active')
    );
