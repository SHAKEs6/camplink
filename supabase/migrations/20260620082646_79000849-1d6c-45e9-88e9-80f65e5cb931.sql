CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  amount bigint NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  mpesa_receipt text,
  result_code integer,
  result_desc text,
  raw_callback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_buyer_idx ON public.orders(buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON public.orders(seller_id, created_at DESC);
CREATE INDEX orders_checkout_idx ON public.orders(checkout_request_id);

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Buyers can create their orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();