CREATE OR REPLACE FUNCTION public.wallet_cash_purchase(_listing_id uuid, _quantity integer DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  buyer uuid := auth.uid();
  listing_row public.listings;
  qty integer := greatest(1, least(99, coalesce(_quantity, 1)));
  total bigint;
  order_id uuid := gen_random_uuid();
BEGIN
  IF buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO listing_row FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF listing_row IS NULL OR NOT listing_row.is_active OR listing_row.category <> 'marketplace' THEN
    RAISE EXCEPTION 'marketplace item is unavailable';
  END IF;
  IF listing_row.user_id = buyer THEN RAISE EXCEPTION 'you cannot buy your own listing'; END IF;
  total := greatest(1, round(listing_row.price * qty)::bigint);

  INSERT INTO public.orders(id, listing_id, buyer_id, seller_id, quantity, amount, phone, status, result_code, result_desc, mpesa_receipt)
  VALUES (order_id, listing_row.id, buyer, listing_row.user_id, qty, total, '', 'paid', 0, 'Paid from Camplink wallet', 'WALLET-' || order_id::text);
  PERFORM wallet_cash_debit(buyer, total, 'purchase', 'Marketplace purchase: ' || listing_row.title, order_id::text);
  PERFORM wallet_cash_credit(listing_row.user_id, total, 'sale', 'Marketplace sale: ' || listing_row.title, order_id::text);
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES
    (buyer, 'Purchase successful', 'KSh ' || total::text || ' paid from your wallet.', 'payment', '/wallet'),
    (listing_row.user_id, 'Item sold', 'You received KSh ' || total::text || ' in your wallet.', 'payment', '/wallet');
  RETURN order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_cash_purchase(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.wallet_cash_purchase(uuid, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.request_cash_withdrawal(bigint, text);
DROP FUNCTION IF EXISTS public.admin_approve_cash_withdrawal(uuid, text);
DROP FUNCTION IF EXISTS public.admin_reject_cash_withdrawal(uuid, text);
DROP FUNCTION IF EXISTS public.admin_list_cash_withdrawals();
DROP TABLE IF EXISTS public.withdrawal_requests;