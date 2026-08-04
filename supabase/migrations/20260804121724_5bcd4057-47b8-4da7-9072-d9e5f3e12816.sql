ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS paypal_order_id text,
  ADD COLUMN IF NOT EXISTS amount_usd numeric;

ALTER TABLE public.orders ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN phone SET DEFAULT '';

CREATE INDEX IF NOT EXISTS orders_paypal_order_id_idx ON public.orders (paypal_order_id);