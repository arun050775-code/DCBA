-- ============================================================
-- DCBA Migration: Cheques in Hand, Transaction ID, Cheque Fields
-- Run this in Supabase SQL Editor (DCBA project)
-- ============================================================

-- 1. Add cheque fields and transaction_id to rent_collections
ALTER TABLE rent_collections
  ADD COLUMN IF NOT EXISTS cheque_no TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS cheque_date DATE,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS cheque_status TEXT DEFAULT 'pending'
    CHECK (cheque_status IN ('pending','deposited','bounced','cancelled'));

-- 2. Add cheque_date, transaction_id, cheque_status to income_entries
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS cheque_date DATE,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS cheque_status TEXT DEFAULT 'pending'
    CHECK (cheque_status IN ('pending','deposited','bounced','cancelled'));

-- Done! Run this before deploying.
