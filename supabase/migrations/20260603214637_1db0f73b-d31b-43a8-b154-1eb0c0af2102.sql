CREATE OR REPLACE FUNCTION public.advance_music()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s jsonb;
  pl jsonb;
  cur int;
  nxt int;
  started_at timestamptz;
BEGIN
  SELECT theme INTO s FROM public.app_settings WHERE id = 1;
  IF s IS NULL THEN RETURN; END IF;

  IF (s ? 'music-playlist') AND jsonb_typeof(s->'music-playlist') = 'string' THEN
    BEGIN
      pl := (s->>'music-playlist')::jsonb;
    EXCEPTION WHEN others THEN
      pl := '[]'::jsonb;
    END;
  ELSE
    pl := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(pl) <> 'array' OR jsonb_array_length(pl) = 0 THEN RETURN; END IF;

  started_at := NULLIF(s->>'music-started-at','')::timestamptz;
  IF started_at IS NOT NULL AND now() - started_at < interval '3 seconds' THEN
    RETURN;
  END IF;

  cur := COALESCE(NULLIF(s->>'music-index','')::int, 0);
  nxt := (cur + 1) % jsonb_array_length(pl);

  UPDATE public.app_settings
  SET theme = theme || jsonb_build_object(
        'music-index', nxt::text,
        'music-started-at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'music-playing', '1'
      ),
      updated_at = now()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_music() TO authenticated;