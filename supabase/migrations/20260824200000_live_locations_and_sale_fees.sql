ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS location_latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS location_longitude numeric(9, 6);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS delivery_longitude numeric(9, 6);

CREATE TABLE IF NOT EXISTS public.admin_sale_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fee_cents integer NOT NULL DEFAULT 50 CHECK (fee_cents = 50),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sale_fees_created_idx ON public.admin_sale_fees(created_at DESC);
GRANT SELECT ON public.admin_sale_fees TO authenticated;
ALTER TABLE public.admin_sale_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view sale fees" ON public.admin_sale_fees;
CREATE POLICY "Admins view sale fees" ON public.admin_sale_fees
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_admin_sale_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'purchase' AND NEW.status = 'paid' AND NEW.seller_id IS NOT NULL THEN
    INSERT INTO public.admin_sale_fees(order_id, seller_id)
    VALUES (NEW.id, NEW.seller_id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_admin_sale_fee ON public.orders;
CREATE TRIGGER orders_admin_sale_fee
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_admin_sale_fee();

CREATE OR REPLACE FUNCTION public.wallet_cash_purchase_with_location(
  _listing_id uuid,
  _quantity integer DEFAULT 1,
  _location text DEFAULT NULL,
  _pickup_station text DEFAULT NULL,
  _delivery_method text DEFAULT 'pickup',
  _address text DEFAULT NULL,
  _latitude numeric DEFAULT NULL,
  _longitude numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_id uuid;
BEGIN
  IF _latitude IS NULL OR _longitude IS NULL OR _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'valid exact location is required';
  END IF;
  order_id := public.wallet_cash_purchase(_listing_id, _quantity, _location, _pickup_station, _delivery_method, _address);
  UPDATE public.orders
  SET delivery_latitude = _latitude, delivery_longitude = _longitude
  WHERE id = order_id AND buyer_id = auth.uid();
  RETURN order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_cash_purchase_with_location(uuid, integer, text, text, text, text, numeric, numeric) TO authenticated;