CREATE OR REPLACE FUNCTION public.wallet_cash_transfer_to(_recipient text, _amount bigint, _note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender uuid := auth.uid();
  recipient uuid;
  matches int;
  ref text := gen_random_uuid()::text;
  normalized text := lower(trim(_recipient));
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF normalized = '' THEN RAISE EXCEPTION 'recipient required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  SELECT count(*)::int INTO matches
  FROM public.profiles p
  WHERE lower(coalesce(p.username, '')) = normalized
     OR lower(coalesce(p.display_name, '')) = normalized
     OR lower(coalesce(p.email, '')) = normalized
     OR p.id::text = normalized
     OR (regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') <> ''
         AND regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(normalized, '\D', '', 'g'));

  IF matches = 0 THEN RAISE EXCEPTION 'recipient not found'; END IF;
  IF matches > 1 THEN RAISE EXCEPTION 'recipient is ambiguous; use username or phone'; END IF;
  SELECT p.id INTO recipient
  FROM public.profiles p
  WHERE lower(coalesce(p.username, '')) = normalized
     OR lower(coalesce(p.display_name, '')) = normalized
     OR lower(coalesce(p.email, '')) = normalized
     OR p.id::text = normalized
     OR (regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') <> ''
         AND regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(normalized, '\D', '', 'g'))
  LIMIT 1;
  IF sender = recipient THEN RAISE EXCEPTION 'cannot send to yourself'; END IF;

  PERFORM wallet_cash_debit(sender, _amount, 'transfer_out', coalesce(_note, 'Sent money'), ref);
  PERFORM wallet_cash_credit(recipient, _amount, 'transfer_in', coalesce(_note, 'Received money'), ref);
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES (recipient, 'Money received', 'You received KSh ' || _amount::text || ' in your Camplink wallet.', 'payment', '/wallet');
  RETURN (SELECT cash_balance FROM public.wallets WHERE user_id = sender);
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_cash_transfer_to(text, bigint, text) TO authenticated;