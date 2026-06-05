
-- WALLETS
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  tier text NOT NULL DEFAULT 'bronze',
  frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- TRANSACTIONS
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  type text NOT NULL,
  description text,
  ref_id text,
  balance_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tx" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- CAMPAIGNS
CREATE TABLE public.reward_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_campaigns TO authenticated;
GRANT ALL ON public.reward_campaigns TO service_role;
ALTER TABLE public.reward_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view campaigns" ON public.reward_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage campaigns" ON public.reward_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.campaign_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.reward_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);
GRANT SELECT ON public.campaign_claims TO authenticated;
GRANT ALL ON public.campaign_claims TO service_role;
ALTER TABLE public.campaign_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own claims" ON public.campaign_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- PROMO CODES
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount bigint NOT NULL,
  max_uses int NOT NULL DEFAULT 1,
  used_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view promo" ON public.promo_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage promo" ON public.promo_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- REFERRALS
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR has_role(auth.uid(),'admin'));

-- DAILY BONUS
CREATE TABLE public.daily_bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT (now() at time zone 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_date)
);
GRANT SELECT ON public.daily_bonus_claims TO authenticated;
GRANT ALL ON public.daily_bonus_claims TO service_role;
ALTER TABLE public.daily_bonus_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own daily" ON public.daily_bonus_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create wallet on signup
CREATE OR REPLACE FUNCTION public.ensure_wallet(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets(user_id) VALUES(_uid) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.tier_for(_bal bigint) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _bal >= 10000 THEN 'diamond' WHEN _bal >= 5000 THEN 'gold' WHEN _bal >= 1000 THEN 'silver' ELSE 'bronze' END
$$;

-- Internal credit/debit
CREATE OR REPLACE FUNCTION public.wallet_credit(_uid uuid, _amount bigint, _type text, _desc text DEFAULT NULL, _ref text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal bigint;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  PERFORM ensure_wallet(_uid);
  UPDATE public.wallets SET balance = balance + _amount, tier = tier_for(balance + _amount), updated_at = now()
    WHERE user_id = _uid AND frozen = false RETURNING balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'wallet frozen or missing'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref_id, balance_after)
    VALUES(_uid, _amount, _type, _desc, _ref, new_bal);
  RETURN new_bal;
END $$;

CREATE OR REPLACE FUNCTION public.wallet_debit(_uid uuid, _amount bigint, _type text, _desc text DEFAULT NULL, _ref text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal bigint;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  PERFORM ensure_wallet(_uid);
  UPDATE public.wallets SET balance = balance - _amount, tier = tier_for(balance - _amount), updated_at = now()
    WHERE user_id = _uid AND frozen = false AND balance >= _amount RETURNING balance INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'insufficient balance or frozen'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref_id, balance_after)
    VALUES(_uid, -_amount, _type, _desc, _ref, new_bal);
  RETURN new_bal;
END $$;

-- Daily bonus
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.daily_bonus_claims(user_id, claim_date) VALUES(uid, today);
  RETURN wallet_credit(uid, 10, 'daily_bonus', 'Daily login bonus', today::text);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'already claimed today';
END $$;

-- Send points
CREATE OR REPLACE FUNCTION public.wallet_transfer(_to uuid, _amount bigint, _note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF uid = _to THEN RAISE EXCEPTION 'cannot send to yourself'; END IF;
  ref := gen_random_uuid()::text;
  PERFORM wallet_debit(uid, _amount, 'transfer_out', COALESCE(_note,'Sent points'), ref);
  PERFORM wallet_credit(_to, _amount, 'transfer_in', COALESCE(_note,'Received points'), ref);
  RETURN (SELECT balance FROM wallets WHERE user_id = uid);
END $$;

-- Redeem promo
CREATE OR REPLACE FUNCTION public.redeem_promo(_code text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pc public.promo_codes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO pc FROM public.promo_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF pc IS NULL OR NOT pc.active THEN RAISE EXCEPTION 'invalid code'; END IF;
  IF pc.expires_at IS NOT NULL AND pc.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;
  IF pc.used_count >= pc.max_uses THEN RAISE EXCEPTION 'fully redeemed'; END IF;
  INSERT INTO public.promo_redemptions(code_id, user_id) VALUES(pc.id, uid);
  UPDATE public.promo_codes SET used_count = used_count + 1 WHERE id = pc.id;
  RETURN wallet_credit(uid, pc.amount, 'promo', 'Promo: ' || pc.code, pc.id::text);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'already redeemed';
END $$;

-- Claim campaign
CREATE OR REPLACE FUNCTION public.claim_campaign(_cid uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.reward_campaigns;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO c FROM public.reward_campaigns WHERE id = _cid;
  IF c IS NULL OR NOT c.active THEN RAISE EXCEPTION 'inactive'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;
  INSERT INTO public.campaign_claims(campaign_id, user_id) VALUES(_cid, uid);
  RETURN wallet_credit(uid, c.amount, 'campaign', c.title, _cid::text);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'already claimed';
END $$;

-- Referral
CREATE OR REPLACE FUNCTION public.apply_referral(_referrer uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF uid = _referrer THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO public.referrals(referrer_id, referee_id) VALUES(_referrer, uid);
  PERFORM wallet_credit(_referrer, 50, 'referral', 'Referral bonus', uid::text);
  RETURN wallet_credit(uid, 25, 'referral', 'Welcome referral bonus', _referrer::text);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'referral already recorded';
END $$;

-- Admin
CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(_uid uuid, _amount bigint, _note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF NOT has_role(caller, 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  PERFORM ensure_wallet(_uid);
  IF _amount > 0 THEN
    RETURN wallet_credit(_uid, _amount, 'admin_credit', COALESCE(_note,'Admin credit'), caller::text);
  ELSE
    RETURN wallet_debit(_uid, -_amount, 'admin_debit', COALESCE(_note,'Admin debit'), caller::text);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_freeze_wallet(_uid uuid, _frozen boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  PERFORM ensure_wallet(_uid);
  UPDATE public.wallets SET frozen = _frozen, updated_at = now() WHERE user_id = _uid;
END $$;

-- Trigger to auto-create wallet on profile insert
CREATE OR REPLACE FUNCTION public.on_profile_create_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_wallet_init ON public.profiles;
CREATE TRIGGER profiles_wallet_init AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_create_wallet();

-- Backfill existing users
INSERT INTO public.wallets(user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;

-- Realtime
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
