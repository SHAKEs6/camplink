import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { showBrowserNotification } from "@/lib/browserNotifications";
import { showMobileNotification } from "@/lib/mobileNotifications";
import { getNotificationHref } from "@/lib/notificationLink";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notification[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    supabase.from("notification_preferences").select("push_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setPushEnabled(data?.push_enabled ?? true));
    const ch = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev]);
          toast(n.title, { description: n.body ?? undefined });
          if (pushEnabled) {
            showBrowserNotification(n.title, n.body ?? undefined, n.link ?? undefined);
            showMobileNotification(n.title, n.body ?? undefined, n.link ?? undefined);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, pushEnabled]);

  const unread = items.filter((i) => !i.is_read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setItems([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] gradient-accent border-0">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-semibold text-sm">Notifications</p>
          <div className="flex gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
                <Check className="h-3 w-3 mr-1" />Read all
              </Button>
            )}
            {items.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={clearAll}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground p-6 text-center">You're all caught up 🎉</p>
          ) : (
            items.map((n) => {
              const href = getNotificationHref(n.link);
              const inner = (
                <div
                  className={`p-3 border-b border-border/50 hover:bg-secondary/40 transition-smooth cursor-pointer ${
                    !n.is_read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => markRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              );
              return (
                <Link to={href} key={n.id} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
