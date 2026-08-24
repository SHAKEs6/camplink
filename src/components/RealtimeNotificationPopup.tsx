import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { getNotificationHref } from "@/lib/notificationLink";

type N = { id: string; title: string; body: string | null; link: string | null };

/** Centered popup that appears in real-time when a new notification arrives. */
export const RealtimeNotificationPopup = () => {
  const { user } = useAuth();
  const [n, setN] = useState<N | null>(null);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("rt-popup-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setN(payload.new as N)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return (
    <Dialog open={!!n} onOpenChange={(o) => !o && setN(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary animate-pulse" />{n?.title}</DialogTitle>
          {n?.body && <DialogDescription>{n.body}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setN(null)}>Dismiss</Button>
          {n && (
            <Link to={getNotificationHref(n.link)} className="flex-1" onClick={() => setN(null)}>
              <Button className="w-full gradient-accent">Open</Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
