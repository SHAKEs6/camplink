ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'video';
ALTER TABLE public.reel_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.reel_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS reel_comments_parent_idx ON public.reel_comments(parent_id);