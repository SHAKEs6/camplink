
REVOKE EXECUTE ON FUNCTION public.claim_daily_bonus() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wallet_transfer(uuid,bigint,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_promo(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_campaign(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_referral(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid,bigint,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_freeze_wallet(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid,bigint,text,text,text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_debit(uuid,bigint,text,text,text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_profile_create_wallet() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_daily_bonus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_transfer(uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_freeze_wallet(uuid,boolean) TO authenticated;
