-- Guest sponsor contributions: OTP verification + Cashfree payment

CREATE TABLE IF NOT EXISTS sponsor_contributions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_rupees INTEGER NOT NULL,
  flow_stage TEXT NOT NULL DEFAULT 'awaiting_otp',
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  provider_order_id TEXT,
  payment_session_id TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_contributions_email_lower
  ON sponsor_contributions (lower(email));

CREATE INDEX IF NOT EXISTS idx_sponsor_contributions_flow_stage
  ON sponsor_contributions (flow_stage, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_contributions_pending_email
  ON sponsor_contributions (lower(email))
  WHERE flow_stage IN ('awaiting_otp', 'awaiting_payment');

CREATE INDEX IF NOT EXISTS idx_sponsor_contributions_provider_order
  ON sponsor_contributions (provider_order_id)
  WHERE provider_order_id IS NOT NULL;
