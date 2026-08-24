ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS discount_ksh bigint;

UPDATE public.promo_codes
SET discount_ksh = amount
WHERE discount_ksh IS NULL;

ALTER TABLE public.promo_codes
  ALTER COLUMN discount_ksh SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consume_promo_code(_code text, _user_id uuid, _order_id text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  promo public.promo_codes;
  discount bigint;
BEGIN
  IF nullif(trim(coalesce(_code, '')), '') IS NULL THEN RETURN 0; END IF;
  SELECT * INTO promo FROM public.promo_codes WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF promo IS NULL OR NOT promo.active THEN RAISE EXCEPTION 'invalid promo code'; END IF;
  IF promo.expires_at IS NOT NULL AND promo.expires_at < now() THEN RAISE EXCEPTION 'promo code expired'; END IF;
  IF promo.used_count >= promo.max_uses THEN RAISE EXCEPTION 'promo code fully redeemed'; END IF;
  INSERT INTO public.promo_redemptions(code_id, user_id) VALUES (promo.id, _user_id);
  UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = promo.id;
  discount := greatest(0, coalesce(promo.discount_ksh, promo.amount));
  RETURN discount;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'promo code already used';
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_promo_code(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.wallet_cash_purchase_with_location(
  _listing_id uuid,
  _quantity integer DEFAULT 1,
  _location text DEFAULT NULL,
  _pickup_station text DEFAULT NULL,
  _delivery_method text DEFAULT 'pickup',
  _address text DEFAULT NULL,
  _latitude numeric DEFAULT NULL,
  _longitude numeric DEFAULT NULL,
  _promo_code text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  order_id uuid;
  discount bigint;
  original_amount bigint;
BEGIN
  IF _latitude IS NULL OR _longitude IS NULL OR _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'valid exact location is required';
  END IF;
  order_id := public.wallet_cash_purchase(_listing_id, _quantity, _location, _pickup_station, _delivery_method, _address);
  SELECT amount INTO original_amount FROM public.orders WHERE id = order_id FOR UPDATE;
  discount := least(original_amount - 1, public.consume_promo_code(_promo_code, auth.uid(), order_id::text));
  IF discount > 0 THEN
    PERFORM public.wallet_cash_credit(auth.uid(), discount, 'promo_discount', 'Marketplace promo discount', order_id::text);
    PERFORM public.wallet_cash_debit((SELECT seller_id FROM public.orders WHERE id = order_id), discount, 'promo_discount', 'Marketplace promo discount', order_id::text);
    UPDATE public.orders SET amount = amount - discount WHERE id = order_id;
  END IF;
  UPDATE public.orders SET delivery_latitude = _latitude, delivery_longitude = _longitude WHERE id = order_id AND buyer_id = auth.uid();
  RETURN order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_cash_purchase_with_location(uuid, integer, text, text, text, text, numeric, numeric, text) TO authenticated;