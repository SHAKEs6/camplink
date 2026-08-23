import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/AvatarUpload";
import { LogOut, Shield, Trash2, Smartphone, Wallet as WalletIcon, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isMobile, isMobileNotifyEnabled, setMobileNotifyEnabled } from "@/lib/mobileNotifications";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Profile = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [wallet, setWallet] = useState<{ balance: number; cash: number; tier: string } | null>(null);

  const [mobileNotify, setMobileNotify] = useState(isMobileNotifyEnabled());
  useEffect(() => { document.title = "Profile — Camplink"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,phone,avatar_url,suspended").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setPhone(data?.phone ?? "");
        setAvatar(data?.avatar_url ?? null);
        setSuspended(!!data?.suspended);
      });
    supabase.from("wallets").select("balance,cash_balance,tier").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setWallet({ balance: Number(data.balance) || 0, cash: Number((data as any).cash_balance) || 0, tier: data.tier }); });
    const ch = supabase.channel(`wallet-profile-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (p: any) => p.new && setWallet({ balance: Number(p.new.balance) || 0, cash: Number(p.new.cash_balance) || 0, tier: p.new.tier }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name.slice(0,60),
      phone: phone.slice(0,30),
      avatar_url: avatar,
    }).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (!confirm("Permanently delete your account? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    const { error } = await supabase.functions.invoke("delete-user", { body: {} });
    if (error) { toast.error(error.message); return; }
    toast.success("Account deleted");
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold mb-4">👤 Profile</h1>

      {suspended && (
        <Card className="p-3 mb-3 border-destructive bg-destructive/10 text-sm text-destructive">
          ⚠️ Your account is suspended. You can browse but can't post or message.
        </Card>
      )}

      <Card className="p-5 gradient-card space-y-4">
        <AvatarUpload userId={user!.id} value={avatar} fallback={(name || user?.email || "U").slice(0,2).toUpperCase()} onChange={setAvatar} size={80} />
        <div>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          {isAdmin && <span className="inline-flex items-center gap-1 text-[10px] mt-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold"><Shield className="h-3 w-3" />Admin</span>}
        </div>
        <div><Label>Display name</Label><Input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254…" maxLength={30} /></div>
        <Button className="w-full gradient-accent" onClick={save}>Save profile</Button>
      </Card>

      <Link to="/wallet">
        <Card className="p-4 gradient-card mt-3 hover:shadow-glow transition-smooth flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full gradient-accent flex items-center justify-center shrink-0">
              <WalletIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">My Wallet</p>
              <p className="text-xs text-muted-foreground">
                {wallet ? `KSh ${wallet.cash.toLocaleString()} · ${wallet.balance.toLocaleString()} pts · ${wallet.tier}` : "View balance & rewards"}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Card>
      </Link>

      {isAdmin && (
        <Link to="/admin"><Card className="p-4 gradient-card mt-3 hover:shadow-glow transition-smooth flex items-center gap-3"><Shield className="h-5 w-5 text-accent" /><span className="font-semibold">Open Admin Panel</span></Card></Link>
      )}

      <Card className="p-4 gradient-card mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-semibold">Mobile notifications</p>
            <p className="text-[11px] text-muted-foreground">Vibration + sound on your phone {isMobile() ? "" : "(mobile only)"}</p>
          </div>
        </div>
        <Switch checked={mobileNotify} onCheckedChange={(v) => { setMobileNotify(v); setMobileNotifyEnabled(v); }} />
      </Card>

      <Card className="p-4 gradient-card mt-3">
        <p className="text-xs text-muted-foreground mb-2">App contact</p>
        <p className="text-sm">📞 +254 702 060 628</p>
        <p className="text-sm">✉️ shakesian6@gmail.com</p>
      </Card>

      <Button variant="outline" className="w-full mt-4" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
      <Button variant="outline" className="w-full mt-2 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={deleteAccount}>
        <Trash2 className="h-4 w-4 mr-2" />Delete my account
      </Button>
    </AppShell>
  );
};

export default Profile;
