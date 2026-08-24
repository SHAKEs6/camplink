CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  INSERT INTO public.daily_bonus_claims(user_id, claim_date)
  VALUES (uid, today);

  RETURN public.wallet_cash_credit(
    uid,
    1,
    'daily_bonus',
    'Daily cash bonus',
    today::text
  );
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'already claimed today';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_bonus() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;