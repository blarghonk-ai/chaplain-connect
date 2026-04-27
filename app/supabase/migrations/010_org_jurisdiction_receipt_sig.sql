-- ============================================================
-- Migration 010 — Org jurisdiction + deletion receipt signature
--
-- 1. Add country_code to organizations (jurisdiction declaration)
-- 2. Add signature + signing_algorithm to data_deletion_receipts
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'US';

ALTER TABLE data_deletion_receipts
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signing_algorithm text DEFAULT 'hmac-sha256';
