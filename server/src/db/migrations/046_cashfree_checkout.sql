-- Cashfree checkout: generalize provider order columns + welcome email tracking

ALTER TABLE checkout_orders
  RENAME COLUMN razorpay_order_id TO provider_order_id;

DROP INDEX IF EXISTS idx_checkout_orders_razorpay;

CREATE INDEX IF NOT EXISTS idx_checkout_orders_provider_order ON checkout_orders (provider_order_id)
  WHERE provider_order_id IS NOT NULL;

ALTER TABLE checkout_orders
  ADD COLUMN IF NOT EXISTS payment_session_id TEXT;

ALTER TABLE checkout_orders
  ALTER COLUMN provider SET DEFAULT 'cashfree';

UPDATE checkout_orders SET provider = 'cashfree' WHERE provider = 'razorpay';

ALTER TABLE player_accounts
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
