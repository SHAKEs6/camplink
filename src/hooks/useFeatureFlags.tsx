import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlags = {
  reels_enabled: boolean;
  hookup_enabled: boolean;
};

const defaults: FeatureFlags = { reels_enabled: false, hookup_enabled: false };

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlags>(defaults);

  useEffect(() => {
    let mounted = true;
    (supabase as any).from("app_settings").select("reels_enabled, hookup_enabled").eq("id", 1).maybeSingle()
      .then(({ data }: { data: Partial<FeatureFlags> | null }) => {
        if (mounted && data) setFlags({ ...defaults, ...data });
      });
    return () => { mounted = false; };
  }, []);

  return flags;
};