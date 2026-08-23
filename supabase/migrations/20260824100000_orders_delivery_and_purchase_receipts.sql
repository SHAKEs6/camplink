ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS pickup_station text,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address text;

DROP FUNCTION IF EXISTS public.wallet_cash_purchase(uuid, integer);

CREATE OR REPLACE FUNCTION public.wallet_cash_purchase(
  _listing_id uuid,
  _quantity integer DEFAULT 1,
  _location text DEFAULT NULL,
  _pickup_station text DEFAULT NULL,
  _delivery_method text DEFAULT 'pickup',
  _address text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  buyer uuid := auth.uid();
  listing_row public.listings;
  qty integer := greatest(1, least(99, coalesce(_quantity, 1)));
  total bigint;
  order_id uuid := gen_random_uuid();
BEGIN
  IF buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF nullif(trim(coalesce(_location, '')), '') IS NULL OR nullif(trim(coalesce(_pickup_station, '')), '') IS NULL THEN
    RAISE EXCEPTION 'location and pickup station are required';
  END IF;
  IF _delivery_method NOT IN ('pickup', 'door') THEN RAISE EXCEPTION 'invalid delivery method'; END IF;
  IF _delivery_method = 'door' AND nullif(trim(coalesce(_address, '')), '') IS NULL THEN RAISE EXCEPTION 'delivery address is required'; END IF;
  SELECT * INTO listing_row FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF listing_row IS NULL OR NOT listing_row.is_active OR listing_row.category <> 'marketplace' THEN RAISE EXCEPTION 'marketplace item is unavailable'; END IF;
  IF listing_row.user_id = buyer THEN RAISE EXCEPTION 'you cannot buy your own listing'; END IF;
  total := greatest(1, round(listing_row.price * qty)::bigint);
  INSERT INTO public.orders(id, listing_id, buyer_id, seller_id, quantity, amount, phone, location, pickup_station, delivery_method, delivery_address, status, result_code, result_desc, mpesa_receipt, kind, provider)
  VALUES (order_id, listing_row.id, buyer, listing_row.user_id, qty, total, '', trim(_location), trim(_pickup_station), _delivery_method, nullif(trim(_address), ''), 'paid', 0, 'Paid from Camplink wallet', 'WALLET-' || order_id::text, 'purchase', 'wallet');
  PERFORM wallet_cash_debit(buyer, total, 'purchase', 'Marketplace purchase: ' || listing_row.title, order_id::text);
  PERFORM wallet_cash_credit(listing_row.user_id, total, 'sale', 'Marketplace sale: ' || listing_row.title, order_id::text);
  INSERT INTO public.notifications(user_id, title, body, type, link) VALUES
    (buyer, 'Purchase successful', 'KSh ' || total::text || ' paid from your wallet.', 'payment', '/cart'),
    (listing_row.user_id, 'Item sold', 'You received KSh ' || total::text || ' in your wallet.', 'payment', '/wallet');
  RETURN order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_cash_purchase(uuid, integer, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wallet_cash_purchase(uuid, integer, text, text, text, text) TO authenticated;