CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Hi! I am the Camplink Connect Assistant. I can help you with payments, orders, your account, and navigating Camplink Connect. What can I help you with?',
  support_url text NOT NULL DEFAULT '/chat',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ai_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_key text NOT NULL,
  session_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_key, session_key)
);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_rate_limits (
  actor_key text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(_actor_key text, _limit integer DEFAULT 20)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed boolean;
BEGIN
  INSERT INTO public.ai_rate_limits(actor_key, user_id, window_started_at, request_count)
  VALUES (_actor_key, nullif(split_part(_actor_key, ':', 1), 'guest'), now(), 1)
  ON CONFLICT (actor_key) DO UPDATE SET
    window_started_at = CASE WHEN public.ai_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE public.ai_rate_limits.window_started_at END,
    request_count = CASE WHEN public.ai_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE public.ai_rate_limits.request_count + 1 END;
  SELECT request_count <= greatest(1, _limit) INTO allowed FROM public.ai_rate_limits WHERE actor_key = _actor_key;
  RETURN allowed;
END;
$$;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read AI settings" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Guests read AI settings" ON public.ai_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Admins manage AI settings" ON public.ai_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users read enabled AI knowledge" ON public.ai_knowledge FOR SELECT TO authenticated USING (enabled = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage AI knowledge" ON public.ai_knowledge FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own AI conversations" ON public.ai_conversations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own AI conversations" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own AI messages" ON public.ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users create own AI messages" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(text, integer) TO anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
ALTER TABLE public.ai_messages REPLICA IDENTITY FULL;

INSERT INTO public.ai_knowledge (title, content)
VALUES
('Camplink Connect overview', 'Camplink Connect is a campus marketplace and community platform. Users can browse marketplace listings, add items to cart, place orders, use the wallet, and communicate through approved platform channels.'),
('Orders and payments', 'Customers place an order by choosing their location, pickup station, and pickup or door delivery. Supported payment paths include the Camplink wallet, PesaPal-supported methods such as M-Pesa and cards, and PayPal where enabled. Payment confirmation creates an order and a receipt.'),
('Wallet', 'The Camplink wallet can receive deposits and can be used for marketplace purchases. Wallet balance, deposits, transfers, and transaction history are available from the Wallet page.'),
('Account help', 'Users can register with email or phone, sign in, reset their own password through the password-reset flow, edit their profile, and sign out from the profile menu. For account support, use the in-app support conversation.'),
('Returns and support', 'For a payment, delivery, refund, or account question that is not answered in the app, contact Camplink support through the in-app chat. The assistant cannot approve refunds, change passwords, withdraw money, or perform administrative actions.')
ON CONFLICT DO NOTHING;
