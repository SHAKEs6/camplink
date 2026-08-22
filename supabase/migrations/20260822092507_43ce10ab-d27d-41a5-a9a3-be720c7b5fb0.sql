ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pesapal_tracking_id TEXT;
CREATE INDEX IF NOT EXISTS orders_pesapal_tracking_id_idx ON public.orders (pesapal_tracking_id);