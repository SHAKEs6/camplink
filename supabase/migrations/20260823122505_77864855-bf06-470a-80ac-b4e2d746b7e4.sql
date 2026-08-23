CREATE OR REPLACE FUNCTION public.admin_cash_adjust(_uid uuid, _amount bigint, _note text DEFAULT NULL::text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE caller uuid := auth.uid();
BEGIN
  IF NOT has_role(caller, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  PERFORM ensure_wallet(_uid);
  IF _amount > 0 THEN
    RETURN wallet_cash_credit(_uid, _amount, 'admin_cash_credit', COALESCE(_note,'Admin deposit'), caller::text);
  ELSE
    RETURN wallet_cash_debit(_uid, -_amount, 'admin_cash_debit', COALESCE(_note,'Admin withdrawal'), caller::text);
  END IF;
END $function$;