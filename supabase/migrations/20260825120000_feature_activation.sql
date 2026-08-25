ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS reels_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hookup_enabled boolean NOT NULL DEFAULT false;