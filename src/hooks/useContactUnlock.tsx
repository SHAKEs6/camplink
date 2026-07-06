import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useContactUnlock(sellerId?: string | null) {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!user || !sellerId || user.id === sellerId) { setUnlocked(user?.id === sellerId); return; }
    setLoading(true);
    const { data } = await supabase.from("contact_unlocks").select("id")
      .eq("user_id", user.id).eq("seller_id", sellerId).maybeSingle();
    setUnlocked(!!data);
    setLoading(false);
  }, [user, sellerId]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (!user || !sellerId) return;
    const ch = supabase.channel(`unlock-${user.id}-${sellerId}-${Math.random().toString(36).slice(2,8)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_unlocks", filter: `user_id=eq.${user.id}` },
        () => check()
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, sellerId, check]);

  return { unlocked, loading, refresh: check };
}

export function useUnlockPrice() {
  const [price, setPrice] = useState<number>(0);
  useEffect(() => {
    supabase.from("app_settings").select("theme").eq("id", 1).maybeSingle().then(({ data }) => {
      const p = Number((data?.theme as any)?.["contact_unlock_price"] || 0);
      setPrice(p);
    });
  }, []);
  return price;
}
