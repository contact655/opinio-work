-- Migration 140: Drop mentor-related tables
-- (Data exported to docs/mentor-export/ before deletion)

DROP TABLE IF EXISTS ow_mentor_reservations CASCADE;
DROP TABLE IF EXISTS ow_mentor_categories CASCADE;
DROP TABLE IF EXISTS ow_consultation_requests CASCADE;
DROP TABLE IF EXISTS ow_consultations CASCADE;
DROP TABLE IF EXISTS ow_consultation_categories CASCADE;
DROP TABLE IF EXISTS consultation_cases CASCADE;
DROP TABLE IF EXISTS ow_mentors CASCADE;
