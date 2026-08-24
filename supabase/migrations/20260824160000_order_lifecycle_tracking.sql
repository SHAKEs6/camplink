ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS tracking_longitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS tracking_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.seller_update_order_location(_order_id uuid, _latitude numeric, _longitude numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row public.orders;
BEGIN
  IF _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'invalid coordinates'; END IF;
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id AND seller_id = auth.uid() FOR UPDATE;
  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF order_row.status NOT IN ('paid', 'processing', 'shipped') THEN RAISE EXCEPTION 'order cannot be tracked in its current state'; END IF;
  UPDATE public.orders SET tracking_latitude = _latitude, tracking_longitude = _longitude, tracking_updated_at = now(), status = CASE WHEN status = 'paid' THEN 'processing' ELSE status END WHERE id = _order_id;
  INSERT INTO public.notifications(user_id, title, body, type, link) VALUES (order_row.buyer_id, 'Order location updated', 'The seller updated the live location for your order.', 'order', '/orders');
END;
$$;

CREATE OR REPLACE FUNCTION public.seller_confirm_order_delivered(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row public.orders;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id AND seller_id = auth.uid() FOR UPDATE;
  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF order_row.status IN ('cancelled', 'delivered') THEN RAISE EXCEPTION 'order is already closed'; END IF;
  UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = order_row.id;
  INSERT INTO public.notifications(user_id, title, body, type, link) VALUES (order_row.buyer_id, 'Order delivered', 'The seller marked your order as delivered.', 'order', '/orders');
END;
$$;

CREATE OR REPLACE FUNCTION public.buyer_cancel_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row public.orders;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id AND buyer_id = auth.uid() FOR UPDATE;
  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF order_row.status IN ('cancelled', 'delivered') THEN RAISE EXCEPTION 'order cannot be cancelled now'; END IF;
  IF order_row.provider = 'wallet' THEN
    PERFORM wallet_cash_credit(order_row.buyer_id, order_row.amount, 'purchase_refund', 'Refund for cancelled order', order_row.id::text);
    UPDATE public.orders SET status = 'cancelled', cancelled_at = now(), refund_status = 'refunded', result_desc = 'Cancelled and refunded to wallet' WHERE id = order_row.id;
  ELSE
    UPDATE public.orders SET status = 'cancelled', cancelled_at = now(), refund_status = CASE WHEN status = 'pending' THEN 'not_required' ELSE 'refund_pending' END, result_desc = CASE WHEN status = 'pending' THEN 'Cancelled before payment' ELSE 'Cancellation recorded; payment provider refund pending' END WHERE id = order_row.id;
  END IF;
  INSERT INTO public.notifications(user_id, title, body, type, link) VALUES
    (order_row.seller_id, 'Order cancelled', 'The buyer cancelled order ' || left(order_row.id::text, 8) || '.', 'order', '/orders');
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_update_order_location(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_confirm_order_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_cancel_order(uuid) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
