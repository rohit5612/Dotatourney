-- Season 2 Phase 3: checkout commerce, webhooks, card assets

CREATE TABLE IF NOT EXISTS checkout_orders (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal INTEGER NOT NULL DEFAULT 0,
  coin_discount INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  razorpay_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  card_tier TEXT NOT NULL DEFAULT 'default',
  coins_applied INTEGER NOT NULL DEFAULT 0,
  registration_id UUID REFERENCES player_registrations (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkout_orders_account ON checkout_orders (player_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_orders_tournament ON checkout_orders (tournament_id);
CREATE INDEX IF NOT EXISTS idx_checkout_orders_razorpay ON checkout_orders (razorpay_order_id)
WHERE razorpay_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  event_type TEXT NOT NULL DEFAULT '',
  payment_id TEXT,
  order_id TEXT,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_payment ON payment_webhooks (payment_id)
WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_card_assets (
  id UUID PRIMARY KEY,
  player_account_id UUID NOT NULL REFERENCES player_accounts (id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  asset_url TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_account_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_player_card_assets_account ON player_card_assets (player_account_id);

ALTER TABLE player_registrations
ADD COLUMN IF NOT EXISTS checkout_order_id UUID REFERENCES checkout_orders (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_provider TEXT,
ADD COLUMN IF NOT EXISTS payment_ref TEXT,
ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMPTZ;
