
-- Contact unlocks: one row per buyer→seller pair once unlocked
CREATE TABLE public.contact_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  amount bigint NOT NULL DEFAULT 0,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, seller_id)
);
GRANT SELECT, INSERT ON public.contact_unlocks TO authenticated;
GRANT ALL ON public.contact_unlocks TO service_role;
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer reads own unlocks" ON public.contact_unlocks
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = seller_id);
CREATE POLICY "admins read all unlocks" ON public.contact_unlocks
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

-- Ads shown in the feed
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT ALL ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active ads" ON public.ads FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage ads" ON public.ads FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER ads_touch BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend orders with a kind so mpesa-callback can route unlocks vs purchases
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'purchase';
