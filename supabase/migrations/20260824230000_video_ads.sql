ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS video_url text;

NOTIFY pgrst, 'reload schema';
