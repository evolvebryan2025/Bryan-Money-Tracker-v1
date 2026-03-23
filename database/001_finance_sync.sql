-- ============================================================
-- Bryan Finance App - Supabase Cloud Sync Schema
-- Mirrors localStorage structure as JSONB for seamless sync
-- ============================================================

-- Main sync table: one row per (user_email, data_type) pair
-- Each data_type stores its full array/object as JSONB
CREATE TABLE IF NOT EXISTS finance_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (
    data_type IN (
      'bills',
      'incomes',
      'expenses',
      'banks',
      'bank_txns',
      'team',
      'invoices',
      'monthly_history',
      'chat_history',
      'settings'
    )
  ),
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_email, data_type)
);

-- Enable Row Level Security
ALTER TABLE finance_sync ENABLE ROW LEVEL SECURITY;

-- RLS Policies: service-role key bypasses RLS, anon/authenticated
-- use email-based access. For now, allow all via service role.
CREATE POLICY "Service role full access" ON finance_sync
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups by user + data type
CREATE INDEX IF NOT EXISTS idx_finance_sync_user_type
  ON finance_sync(user_email, data_type);

-- Index for finding stale data
CREATE INDEX IF NOT EXISTS idx_finance_sync_updated
  ON finance_sync(updated_at);

-- ============================================================
-- Upsert function: insert or update a data_type for a user
-- Called via supabase.rpc('upsert_finance_data', { ... })
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_finance_data(
  p_email TEXT,
  p_type TEXT,
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO finance_sync (user_email, data_type, data, updated_at)
  VALUES (p_email, p_type, p_data, NOW())
  ON CONFLICT (user_email, data_type)
  DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW()
  RETURNING jsonb_build_object(
    'user_email', user_email,
    'data_type', data_type,
    'updated_at', updated_at
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Bulk upsert: sync all data types at once
-- Accepts a JSONB object keyed by data_type
-- e.g. { "bills": [...], "incomes": [...], "banks": [...] }
-- ============================================================
CREATE OR REPLACE FUNCTION bulk_upsert_finance_data(
  p_email TEXT,
  p_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  key TEXT;
  synced_types TEXT[] := '{}';
BEGIN
  FOR key IN SELECT jsonb_object_keys(p_payload)
  LOOP
    INSERT INTO finance_sync (user_email, data_type, data, updated_at)
    VALUES (p_email, key, p_payload->key, NOW())
    ON CONFLICT (user_email, data_type)
    DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW();

    synced_types := array_append(synced_types, key);
  END LOOP;

  RETURN jsonb_build_object(
    'user_email', p_email,
    'synced_types', to_jsonb(synced_types),
    'synced_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fetch all data for a user (returns one row per data_type)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_finance_data(
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT data_type, data, updated_at
    FROM finance_sync
    WHERE user_email = p_email
  LOOP
    result := result || jsonb_build_object(
      rec.data_type, jsonb_build_object(
        'data', rec.data,
        'updated_at', rec.updated_at
      )
    );
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
