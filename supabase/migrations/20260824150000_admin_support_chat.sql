ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_support boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.open_support_chat()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requester uuid := auth.uid();
  admin_user uuid;
  conversation_id uuid;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT user_id INTO admin_user FROM public.user_roles WHERE role = 'admin' AND user_id <> requester ORDER BY created_at LIMIT 1;
  IF admin_user IS NULL THEN
    SELECT user_id INTO admin_user FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  END IF;
  IF admin_user IS NULL THEN RAISE EXCEPTION 'support is not configured'; END IF;

  INSERT INTO public.conversations(user_a, user_b, is_support, last_message_at)
  VALUES (LEAST(requester, admin_user), GREATEST(requester, admin_user), true, now())
  ON CONFLICT (user_a, user_b) DO UPDATE SET is_support = true
  RETURNING id INTO conversation_id;
  RETURN conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_support_chat() TO authenticated;