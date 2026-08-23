import { useEffect, useState } from "react";
import { Cookie, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cookieConsentName, decodeCookieConsent, defaultCookieConsent, encodeCookieConsent, CookieConsent as CookieConsentValue } from "@/lib/cookieConsent";

type Consent = CookieConsentValue;
const COOKIE = cookieConsentName;
const defaults = defaultCookieConsent;

const read = (): Consent | null => {
  const raw = document.cookie.split("; ").find(item => item.startsWith(`${COOKIE}=`))?.split("=")[1];
  if (!raw) return null;
  return decodeCookieConsent(raw);
};

const write = (consent: Consent) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeCookieConsent(consent)}; Max-Age=15552000; Path=/; SameSite=Lax${secure}`;
};

export const CookieConsent = () => {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => setConsent(read()), []);
  if (consent) return null;

  const save = (next: Consent) => { write(next); setConsent(next); setSettingsOpen(false); };
  const rows: Array<[keyof Consent, string, string]> = [
    ["analytics", "Analytics cookies", "Help us understand usage so we can improve Camplink."],
    ["preferences", "Preference cookies", "Remember choices such as display and notification preferences."],
    ["marketing", "Marketing cookies", "Support relevant campaigns and offers."],
  ];

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><p className="font-semibold">Cookies on Camplink</p><p className="mt-1 text-xs text-muted-foreground">Essential cookies keep you signed in and protect the site. Optional cookies are off until you choose.</p></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="gradient-accent" onClick={() => save({ analytics: true, preferences: true, marketing: true })}>Accept all</Button>
          <Button size="sm" variant="outline" onClick={() => save(defaults)}>Reject optional</Button>
          <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-1 h-3.5 w-3.5" />Customize</Button>
        </div>
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Cookie preferences</DialogTitle><DialogDescription>Essential cookies are always active. Choose which optional categories you allow.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">Essential cookies</p><p className="text-xs text-muted-foreground">Authentication, security, and core functionality.</p></div><Switch checked disabled /></div>
            {rows.map(([key, label, detail]) => <div key={key} className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div><Switch checked={consent?.[key] ?? false} onCheckedChange={value => setConsent(current => ({ ...(current ?? defaults), [key]: value }))} /></div>)}
            <Button className="w-full gradient-accent" onClick={() => save(consent ?? defaults)}>Save preferences</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};