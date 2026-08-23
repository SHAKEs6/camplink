ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS pickup_code text;

CREATE OR REPLACE FUNCTION public.wallet_cash_purchase_checkout(
  _listing_id uuid,
  _quantity integer,
  _customer_name text,
  _phone text,
  _email text,
  _fulfillment_type text,
  _pickup_location text DEFAULT NULL,
  _delivery_address text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, pickup_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  buyer uuid := auth.uid();
  listing_row public.listings;
  qty integer := greatest(1, least(99, coalesce(_quantity, 1)));
  total bigint;
  new_order uuid := gen_random_uuid();
  new_code text := upper(encode(gen_random_bytes(4), 'hex'));
BEGIN
  IF buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF nullif(trim(_customer_name), '') IS NULL THEN RAISE EXCEPTION 'full name required'; END IF;
  IF nullif(trim(_phone), '') IS NULL THEN RAISE EXCEPTION 'phone number required'; END IF;
  IF lower(_fulfillment_type) NOT IN ('pickup', 'delivery') THEN RAISE EXCEPTION 'choose pickup or delivery'; END IF;
  IF lower(_fulfillment_type) = 'pickup' AND nullif(trim(_pickup_location), '') IS NULL THEN RAISE EXCEPTION 'pickup location required'; END IF;
  IF lower(_fulfillment_type) = 'delivery' AND nullif(trim(_delivery_address), '') IS NULL THEN RAISE EXCEPTION 'delivery address required'; END IF;

  SELECT * INTO listing_row FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF listing_row IS NULL OR NOT listing_row.is_active OR listing_row.category <> 'marketplace' THEN RAISE EXCEPTION 'marketplace item is unavailable'; END IF;
  IF listing_row.user_id = buyer THEN RAISE EXCEPTION 'you cannot buy your own listing'; END IF;
  total := greatest(1, round(listing_row.price * qty)::bigint);

  PERFORM wallet_cash_debit(buyer, total, 'purchase', 'Marketplace purchase: ' || listing_row.title, new_order::text);
  PERFORM wallet_cash_credit(listing_row.user_id, total, 'sale', 'Marketplace sale: ' || listing_row.title, new_order::text);
  INSERT INTO public.orders(id, listing_id, buyer_id, seller_id, quantity, amount, phone, status, result_code, result_desc, mpesa_receipt, customer_name, customer_email, fulfillment_type, pickup_location, delivery_address, pickup_code)
  VALUES (new_order, listing_row.id, buyer, listing_row.user_id, qty, total, trim(_phone), 'confirmed', 0, 'Paid from Camplink wallet', 'WALLET-' || new_order::text, trim(_customer_name), nullif(trim(_email), ''), lower(_fulfillment_type), nullif(trim(_pickup_location), ''), nullif(trim(_delivery_address), ''), new_code);
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES
    (buyer, 'Order confirmed', 'Order ' || upper(left(new_order::text, 8)) || ' is being prepared.', 'order', '/cart'),
    (listing_row.user_id, 'New order received', 'You received an order for ' || listing_row.title || '.', 'order', '/admin');
  RETURN QUERY SELECT new_order, new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(_order_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  order_row public.orders;
  next_code text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _status NOT IN ('confirmed', 'preparing', 'ready_for_pickup', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'invalid order status'; END IF;
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  next_code := CASE WHEN _status = 'ready_for_pickup' AND order_row.pickup_code IS NULL THEN upper(encode(gen_random_bytes(4), 'hex')) ELSE order_row.pickup_code END;
  UPDATE public.orders SET status = _status, pickup_code = next_code, updated_at = now() WHERE id = _order_id;
  IF _status = 'ready_for_pickup' THEN
    INSERT INTO public.notifications(user_id, title, body, type, link)
    VALUES (order_row.buyer_id, 'Your order is ready!', 'Order ' || upper(left(_order_id::text, 8)) || ' is ready for pickup. Pickup code: ' || next_code, 'delivery', '/cart');
  ELSIF _status = 'delivered' THEN
    INSERT INTO public.notifications(user_id, title, body, type, link)
    VALUES (order_row.buyer_id, 'Order completed', 'Order ' || upper(left(_order_id::text, 8)) || ' has been delivered.', 'delivery', '/cart');
  ELSE
    INSERT INTO public.notifications(user_id, title, body, type, link)
    VALUES (order_row.buyer_id, 'Order update', 'Order ' || upper(left(_order_id::text, 8)) || ' is now ' || replace(_status, '_', ' ') || '.', 'order', '/cart');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_pickup(_order_id uuid, _pickup_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row public.orders;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF order_row.status <> 'ready_for_pickup' THEN RAISE EXCEPTION 'order is not ready for pickup'; END IF;
  IF order_row.pickup_code IS NULL OR upper(trim(_pickup_code)) <> upper(order_row.pickup_code) THEN RAISE EXCEPTION 'invalid pickup code'; END IF;
  UPDATE public.orders SET status = 'delivered', updated_at = now() WHERE id = _order_id;
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES (order_row.buyer_id, 'Pickup verified', 'Your order ' || upper(left(_order_id::text, 8)) || ' has been collected.', 'delivery', '/cart');
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_cash_purchase_checkout(uuid, integer, text, text, text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wallet_cash_purchase_checkout(uuid, integer, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_pickup(uuid, text) TO authenticated;