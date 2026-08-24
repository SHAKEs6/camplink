CREATE OR REPLACE FUNCTION public.seller_update_order_status(_order_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  order_row public.orders;
  item_title text;
  status_label text;
BEGIN
  SELECT * INTO order_row
  FROM public.orders
  WHERE id = _order_id AND seller_id = auth.uid()
  FOR UPDATE;

  IF order_row IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _status NOT IN ('processing', 'shipped', 'delivered') THEN RAISE EXCEPTION 'invalid order status'; END IF;
  IF order_row.status = 'paid' AND _status <> 'processing'
    OR order_row.status = 'processing' AND _status <> 'shipped'
    OR order_row.status = 'shipped' AND _status <> 'delivered' THEN
    RAISE EXCEPTION 'order status must advance one step at a time';
  END IF;

  UPDATE public.orders
  SET status = _status,
      delivered_at = CASE WHEN _status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = order_row.id;

  SELECT title INTO item_title FROM public.listings WHERE id = order_row.listing_id;
  status_label := CASE _status
    WHEN 'processing' THEN 'confirmed and is being prepared'
    WHEN 'shipped' THEN 'shipped and is on the way'
    ELSE 'delivered'
  END;

  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES (
    order_row.buyer_id,
    'Order ' || _status,
    coalesce(item_title, 'Your order') || ' has been ' || status_label || '.',
    'order',
    '/orders?order=' || order_row.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_update_order_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_order_seller(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  order_row public.orders;
  item_title text;
  delivery text;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = _order_id;
  IF order_row IS NULL OR order_row.status <> 'paid' OR order_row.seller_id IS NULL OR order_row.kind <> 'purchase' THEN RETURN; END IF;
  SELECT title INTO item_title FROM public.listings WHERE id = order_row.listing_id;
  delivery := CASE WHEN order_row.delivery_method = 'door' THEN 'Door delivery to ' || coalesce(order_row.delivery_address, 'the provided address') ELSE 'Pickup at ' || coalesce(order_row.pickup_station, 'the selected station') END;
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES (
    order_row.seller_id,
    'New order received',
    coalesce(item_title, 'Your listing') || ' was ordered. ' || delivery || '. Location: ' || coalesce(order_row.location, 'not provided') || '. Order ' || left(order_row.id::text, 8) || '.',
    'order',
    '/orders?order=' || order_row.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_order_seller(uuid) TO authenticated;