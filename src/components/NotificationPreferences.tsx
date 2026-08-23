import { useEffect, useState } from "react";
import { Bell, Mail, MessageSquare, Smartphone, ShoppingBag, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Preferences = {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  order_updates: boolean;
  delivery_alerts: boolean;
};

const defaults: Preferences = {
  email_enabled: true,
  sms_enabled: true,
  push_enabled: true,
  order_updates: true,
  delivery_alerts: true,
};

export const NotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("notification_preferences").select("email_enabled,sms_enabled,push_enabled,order_updates,delivery_alerts")
      .eq("user_id", user.id).maybeSingle()
      .then(async ({ data }) => {
        if (data) setPreferences(data as Preferences);
        else await supabase.from("notification_preferences").insert({ user_id: user.id });
      });
  }, [user?.id]);

  const update = async (key: keyof Preferences, value: boolean) => {
    if (!user) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...next });
    setSaving(false);
    if (error) { setPreferences(preferences); toast.error(error.message); }
  };

  const rows = [
    { key: "push_enabled" as const, icon: Smartphone, label: "Push notifications", detail: "Browser and OneSignal alerts" },
    { key: "email_enabled" as const, icon: Mail, label: "Email notifications", detail: "Important account and payment updates" },
    { key: "sms_enabled" as const, icon: MessageSquare, label: "SMS notifications", detail: "Important updates sent to your phone" },
    { key: "order_updates" as const, icon: ShoppingBag, label: "Order updates", detail: "Purchases, payments, and seller updates" },
    { key: "delivery_alerts" as const, icon: Truck, label: "Delivery alerts", detail: "Dispatch and delivery status changes" },
  ];

  return (
    <Card className="p-4 gradient-card mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4 text-accent" />
        <div><p className="text-sm font-semibold">Notification preferences</p><p className="text-[11px] text-muted-foreground">{saving ? "Saving…" : "Choose how Camplink keeps you updated"}</p></div>
      </div>
      <div className="space-y-3">
        {rows.map(({ key, icon: Icon, label, detail }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0"><Icon className="h-4 w-4 text-muted-foreground shrink-0" /><div className="min-w-0"><p className="text-sm">{label}</p><p className="text-[10px] text-muted-foreground truncate">{detail}</p></div></div>
            <Switch checked={preferences[key]} onCheckedChange={(value) => update(key, value)} disabled={saving} />
          </div>
        ))}
      </div>
    </Card>
  );
};