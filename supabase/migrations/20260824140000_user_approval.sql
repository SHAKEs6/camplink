ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET approved = true WHERE approved = false;

CREATE OR REPLACE FUNCTION public.approve_owner_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'shakesian@gmail.com' THEN
    UPDATE public.profiles SET approved = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approve_owner_after_signup ON auth.users;
CREATE TRIGGER approve_owner_after_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.approve_owner_on_signup();

CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _user_id = auth.uid() AND NOT _approved THEN RAISE EXCEPTION 'you cannot revoke your own approval'; END IF;
  UPDATE public.profiles SET approved = _approved WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user profile not found'; END IF;
  INSERT INTO public.notifications(user_id, title, body, type, link)
  VALUES (_user_id, CASE WHEN _approved THEN 'Account approved' ELSE 'Account approval revoked' END,
    CASE WHEN _approved THEN 'An administrator approved your Camplink account.' ELSE 'Your Camplink account approval was revoked. Contact support if this is unexpected.' END,
    'admin_action', '/auth');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user(uuid, boolean) TO authenticated;