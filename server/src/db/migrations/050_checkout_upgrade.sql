-- Card upgrade checkout orders (delta pricing between bundle tiers)

ALTER TABLE checkout_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'registration',
  ADD COLUMN IF NOT EXISTS upgrade_from_tier TEXT;

CREATE INDEX IF NOT EXISTS idx_checkout_orders_registration
  ON checkout_orders (registration_id)
  WHERE registration_id IS NOT NULL;
