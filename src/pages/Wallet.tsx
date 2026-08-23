import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet as WalletIcon, Gift, Send, Ticket, Users, Trophy, History, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { PesapalButton } from "@/components/PesapalButton";
import { PayPalButton } from "@/components/PayPalButton";

type Tx = { id: string; amount: number; type: string; description: string | null; balance_after: number; created_at: string; is_cash?: boolean };
type Campaign = { id: string; title: string; description: string | null; amount: number; expires_at: string | null };

const TIERS: Record<string, { label: string; min: number; color: string }> = {
  bronze: { label: "🥉 Bronze", min: 0, color: "text-orange-400" },
  silver: { label: "🥈 Silver", min: 1000, color: "text-slate-300" },
  gold: { label: "🥇 Gold", min: 5000, color: "text-yellow-400" },
  diamond: { label: "💎 Diamond", min: 10000, color: "text-cyan-300" },
};

const Wallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [cash, setCash] = useState(0);
  const [tier, setTier] = useState("bronze");
  const [frozen, setFrozen] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [promo, setPromo] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [cashTo, setCashTo] = useState("");
  const [cashAmt, setCashAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [topup, setTopup] = useState("");

  useEffect(() => { document.title = "Wallet — Camplink"; }, []);

  const refresh = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: w }, { data: t }, { data: c }, { data: claims }, { data: dc }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reward_campaigns").select("*").eq("active", true).order("created_at", { ascending: false }),
      supabase.from("campaign_claims").select("campaign_id").eq("user_id", user.id),
      supabase.from("daily_bonus_claims").select("id").eq("user_id", user.id).eq("claim_date", today).maybeSingle(),
    ]);
    if (w) { setBalance(w.balance); setCash((w as any).cash_balance ?? 0); setTier(w.tier); setFrozen(w.frozen); }
    else { try { await supabase.rpc("claim_daily_bonus" as any); } catch {} }
    setTxs((t as any) ?? []);
    setCampaigns((c as any) ?? []);
    setClaimedIds(new Set(((claims as any) ?? []).map((x: any) => x.campaign_id)));
    setDailyClaimed(!!dc);
  };

  useEffect(() => { refresh(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wallet:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const claimDaily = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("claim_daily_bonus" as any);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("+10 points 🎁"); refresh(); }
  };

  const redeemPromo = async () => {
    if (!promo.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("redeem_promo" as any, { _code: promo.trim() });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Promo redeemed 🎟️"); setPromo(""); refresh(); }
  };

  const send = async () => {
    const n = parseInt(sendAmt, 10);
    if (!sendTo || !n || n <= 0) { toast.error("Pick a recipient and amount"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("wallet_transfer" as any, { _to: sendTo, _amount: n });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Sent ✈️"); setSendTo(""); setSendAmt(""); refresh(); }
  };

  const sendCash = async () => {
    const n = parseInt(cashAmt, 10);
    if (!cashTo || !n || n <= 0) { toast.error("Pick a recipient and amount"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("wallet_cash_transfer" as any, { _to: cashTo, _amount: n });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`Sent KSh ${n.toLocaleString()} 💸`); setCashTo(""); setCashAmt(""); refresh(); }
  };

  const claimCampaign = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("claim_campaign" as any, { _cid: id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Claimed ✨"); refresh(); }
  };

  const referralLink = user ? `${window.location.origin}/auth?ref=${user.id}` : "";
  const copyRef = () => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied"); };

  const nextTier = Object.entries(TIERS).find(([_, v]) => v.min > balance);
  const tierInfo = TIERS[tier] ?? TIERS.bronze;

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4"><WalletIcon className="h-6 w-6 text-accent" /><h1 className="text-2xl font-extrabold">My Wallet</h1></div>

      <Card className="gradient-card p-5 mb-4 relative overflow-hidden">
        {frozen && <div className="absolute top-2 right-2 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">FROZEN</div>}
        <p className="text-xs text-muted-foreground">Money balance</p>
        <p className="text-4xl font-extrabold">KSh {cash.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-3">Reward points</p>
        <p className="text-2xl font-extrabold">{balance.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">pts</span></p>
        <p className={`text-sm mt-1 font-semibold ${tierInfo.color}`}><Trophy className="inline h-4 w-4 mr-1" />{tierInfo.label}</p>
        {nextTier && (
          <p className="text-[11px] text-muted-foreground mt-1">{(nextTier[1].min - balance).toLocaleString()} pts to {nextTier[1].label}</p>
        )}
      </Card>

      <Tabs defaultValue="earn">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="earn"><Gift className="h-3 w-3 mr-1" />Earn</TabsTrigger>
          <TabsTrigger value="send"><Send className="h-3 w-3 mr-1" />Send</TabsTrigger>
          <TabsTrigger value="redeem"><Ticket className="h-3 w-3 mr-1" />Redeem</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="earn" className="space-y-3 mt-3">
          <Card className="gradient-card p-4">
            <p className="font-semibold text-sm">🎁 Daily login bonus</p>
            <p className="text-xs text-muted-foreground mb-2">Claim +10 points every day.</p>
            <Button className="w-full gradient-accent" disabled={busy || dailyClaimed} onClick={claimDaily}>
              {dailyClaimed ? "Already claimed today" : "Claim +10 pts"}
            </Button>
          </Card>

          <Card className="gradient-card p-4">
            <p className="font-semibold text-sm flex items-center gap-1"><Users className="h-4 w-4" /> Referral program</p>
            <p className="text-xs text-muted-foreground mb-2">Earn 50 pts per friend. They get 25 pts.</p>
            <div className="flex gap-2">
              <Input readOnly value={referralLink} className="text-xs" />
              <Button size="icon" variant="outline" onClick={copyRef}><Copy className="h-4 w-4" /></Button>
            </div>
          </Card>

          <p className="font-semibold text-sm mt-2 flex items-center gap-1"><Sparkles className="h-4 w-4" /> Reward campaigns</p>
          {campaigns.length === 0 && <p className="text-xs text-muted-foreground">No active campaigns.</p>}
          {campaigns.map(c => (
            <Card key={c.id} className="gradient-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.title}</p>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                  <p className="text-xs text-accent font-bold mt-1">+{c.amount} pts</p>
                </div>
                <Button size="sm" disabled={busy || claimedIds.has(c.id)} onClick={() => claimCampaign(c.id)}>
                  {claimedIds.has(c.id) ? "Claimed" : "Claim"}
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="send" className="space-y-2 mt-3">
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Send className="h-4 w-4" /> Send money (KSh)</p>
            <p className="text-[11px] text-muted-foreground">Available: KSh {cash.toLocaleString()}</p>
            <Label className="text-xs">Recipient user ID</Label>
            <Input value={cashTo} onChange={e => setCashTo(e.target.value)} placeholder="uuid…" />
            <Label className="text-xs">Amount (KSh)</Label>
            <Input inputMode="numeric" value={cashAmt} onChange={e => setCashAmt(e.target.value.replace(/\D/g, ""))} placeholder="500" />
            <Button className="w-full gradient-accent" disabled={busy} onClick={sendCash}>Send money</Button>
          </Card>
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Send className="h-4 w-4" /> Send points to a user</p>
            <Label className="text-xs">Recipient user ID</Label>
            <Input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="uuid…" />
            <Label className="text-xs">Amount</Label>
            <Input type="number" value={sendAmt} onChange={e => setSendAmt(e.target.value)} placeholder="100" />
            <Button className="w-full gradient-accent" disabled={busy} onClick={send}>Send</Button>
            <p className="text-[11px] text-muted-foreground">Tip: copy a user's ID from their profile page.</p>
          </Card>
        </TabsContent>

        <TabsContent value="redeem" className="space-y-3 mt-3">
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Sparkles className="h-4 w-4" /> Add money to wallet</p>
            <p className="text-xs text-muted-foreground">Add real money to your wallet in KSh. Credited the moment payment confirms.</p>
            <div className="space-y-2">
              <Label htmlFor="topup-amt" className="text-xs">Amount (KSh)</Label>
              <Input id="topup-amt" inputMode="numeric" value={topup} onChange={e => setTopup(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 500" />
              <div className="flex gap-1.5 flex-wrap">
                {[100, 500, 1000, 5000].map(v => (
                  <Button key={v} size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setTopup(String(v))}>KSh {v.toLocaleString()}</Button>
                ))}
              </div>
              <PesapalButton kind="wallet_topup" amount={Number(topup) || 0} disabled={Number(topup) < 10}
                label={`Top up${Number(topup) >= 10 ? ` KSh ${Number(topup).toLocaleString()}` : ""} with M-Pesa / Card`} />
              <PayPalButton kind="wallet_topup" amount={Number(topup) || 0} disabled={Number(topup) < 10}
                label={`Top up${Number(topup) >= 10 ? ` KSh ${Number(topup).toLocaleString()}` : ""} with PayPal`} />
            </div>
          </Card>
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Ticket className="h-4 w-4" /> Promo code</p>
            <div className="flex gap-2">
              <Input value={promo} onChange={e => setPromo(e.target.value.toUpperCase())} placeholder="WELCOME100" />
              <Button onClick={redeemPromo} disabled={busy}>Redeem</Button>
            </div>
          </Card>
          <Card className="gradient-card p-4">
            <p className="font-semibold text-sm">🛒 Marketplace discounts</p>
            <p className="text-xs text-muted-foreground">Use points at checkout: 100 pts = KSh 10 off any listing.</p>
          </Card>
          <Card className="gradient-card p-4">
            <p className="font-semibold text-sm">⭐ Boost listings</p>
            <p className="text-xs text-muted-foreground">Spend 500 pts to feature a listing on the home feed.</p>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-1 mt-3">
          {txs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No transactions yet</p>}
          {txs.map(t => (
            <Card key={t.id} className="p-3 gradient-card flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.description || t.type}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.type}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${t.amount > 0 ? "text-emerald-400" : "text-destructive"}`}>{t.amount > 0 ? "+" : ""}{t.is_cash ? `KSh ${Math.abs(t.amount).toLocaleString()}` : `${t.amount} pts`}</p>
                <p className="text-[10px] text-muted-foreground">bal {t.is_cash ? `KSh ${t.balance_after.toLocaleString()}` : `${t.balance_after} pts`}</p>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

export default Wallet;
