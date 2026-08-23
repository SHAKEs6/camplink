ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS cash_balance bigint NOT NULL DEFAULT 0;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS is_cash boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount > 0),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx
  ON public.withdrawal_requests(user_id, created_at DESC);

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.wallet_cash_credit(
  _uid uuid, _amount bigint, _type text, _desc text DEFAULT NULL, _ref text DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal bigint;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  PERFORM ensure_wallet(_uid);
  UPDATE public.wallets
  SET cash_balance = cash_balance + _amount, updated_at = now()
  WHERE user_id = _uid AND frozen = false
  RETURNING cash_balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'wallet frozen or missing'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref_id, balance_after, is_cash)
  VALUES (_uid, _amount, _type, _desc, _ref, new_bal, true);
  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_cash_debit(
  _uid uuid, _amount bigint, _type text, _desc text DEFAULT NULL, _ref text DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal bigint;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  PERFORM ensure_wallet(_uid);
  UPDATE public.wallets
  SET cash_balance = cash_balance - _amount, updated_at = now()
  WHERE user_id = _uid AND frozen = false AND cash_balance >= _amount
  RETURNING cash_balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'insufficient balance or frozen'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref_id, balance_after, is_cash)
  VALUES (_uid, -_amount, _type, _desc, _ref, new_bal, true);
  RETURN new_bal;
END;
$$;

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
  RETURN (SELECT cash_balance FROM public.wallets WHERE user_id = sender);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_cash_withdrawal(_amount bigint, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  request_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount < 10 THEN RAISE EXCEPTION 'minimum withdrawal is KSh 10'; END IF;
  IF length(regexp_replace(coalesce(_phone, ''), '\D', '', 'g')) < 9 THEN RAISE EXCEPTION 'valid phone number required'; END IF;

  request_id := gen_random_uuid();
  PERFORM wallet_cash_debit(uid, _amount, 'withdrawal_pending', 'Withdrawal request', request_id::text);
  INSERT INTO public.withdrawal_requests(id, user_id, amount, phone)
  VALUES (request_id, uid, _amount, trim(_phone));
  RETURN request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_cash_withdrawal(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.withdrawal_requests
  SET status = 'approved', note = _note, processed_by = auth.uid(), processed_at = now()
  WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal is not pending'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_cash_withdrawals()
RETURNS TABLE (
  id uuid, user_id uuid, amount bigint, phone text, status text,
  note text, created_at timestamptz, display_name text, email text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT w.id, w.user_id, w.amount, w.phone, w.status, w.note, w.created_at,
         p.display_name, p.email
  FROM public.withdrawal_requests w
  LEFT JOIN public.profiles p ON p.id = w.user_id
  ORDER BY w.created_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_cash_withdrawal(_request_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_row public.withdrawal_requests;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO request_row FROM public.withdrawal_requests
  WHERE id = _request_id AND status = 'pending' FOR UPDATE;
  IF request_row IS NULL THEN RAISE EXCEPTION 'withdrawal is not pending'; END IF;
  PERFORM wallet_cash_credit(request_row.user_id, request_row.amount, 'withdrawal_refund', 'Withdrawal rejected', request_row.id::text);
  UPDATE public.withdrawal_requests
  SET status = 'rejected', note = _note, processed_by = auth.uid(), processed_at = now()
  WHERE id = _request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_cash_credit(uuid, bigint, text, text, text) FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.wallet_cash_debit(uuid, bigint, text, text, text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_cash_transfer_to(text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cash_withdrawal(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_cash_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_cash_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_cash_withdrawals() TO authenticated;