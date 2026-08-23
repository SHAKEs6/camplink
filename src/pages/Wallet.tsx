import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet as WalletIcon, Send, History, PlusCircle, Banknote } from "lucide-react";
import { toast } from "sonner";
import { PesapalButton } from "@/components/PesapalButton";
import { PayPalButton } from "@/components/PayPalButton";

type Tx = { id: string; amount: number; type: string; description: string | null; balance_after: number; created_at: string; is_cash?: boolean };

const Wallet = () => {
  const { user } = useAuth();
  const [cash, setCash] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cashTo, setCashTo] = useState("");
  const [cashAmt, setCashAmt] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const [topup, setTopup] = useState("");

  useEffect(() => { document.title = "Wallet — Camplink"; }, []);

  const refresh = async () => {
    if (!user) return;
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).eq("is_cash", true).order("created_at", { ascending: false }).limit(50),
    ]);
    if (w) { setCash((w as any).cash_balance ?? 0); setFrozen(w.frozen); }
    setTxs((t as any) ?? []);
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

  const sendCash = async () => {
    const n = parseInt(cashAmt, 10);
    if (!cashTo || !n || n <= 0) { toast.error("Pick a recipient and amount"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("wallet_cash_transfer_to" as any, { _recipient: cashTo, _amount: n });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`Sent KSh ${n.toLocaleString()} 💸`); setCashTo(""); setCashAmt(""); refresh(); }
  };

  const requestWithdrawal = async () => {
    const n = parseInt(withdrawAmt, 10);
    if (!n || n < 10 || !withdrawPhone.trim()) { toast.error("Enter a valid phone number and at least KSh 10"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_cash_withdrawal" as any, { _amount: n, _phone: withdrawPhone.trim() });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Withdrawal request submitted"); setWithdrawAmt(""); refresh(); }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4"><WalletIcon className="h-6 w-6 text-accent" /><h1 className="text-2xl font-extrabold">My Wallet</h1></div>

      <Card className="gradient-card p-5 mb-4 relative overflow-hidden">
        {frozen && <div className="absolute top-2 right-2 text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded">FROZEN</div>}
        <p className="text-xs text-muted-foreground">Wallet balance</p>
        <p className="text-4xl font-extrabold">KSh {cash.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground mt-2">Real money. Deposit with M-Pesa or card, send to other users, or spend in the marketplace.</p>
      </Card>

      <Tabs defaultValue="deposit">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="deposit"><PlusCircle className="h-3 w-3 mr-1" />Deposit</TabsTrigger>
          <TabsTrigger value="send"><Send className="h-3 w-3 mr-1" />Send</TabsTrigger>
          <TabsTrigger value="withdraw"><Banknote className="h-3 w-3 mr-1" />Withdraw</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-3 mt-3">
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><PlusCircle className="h-4 w-4" /> Deposit money</p>
            <p className="text-xs text-muted-foreground">Send money into your wallet via PesaPal (M-Pesa or card). Credited the moment payment confirms.</p>
            <Label htmlFor="topup-amt" className="text-xs">Amount (KSh)</Label>
            <Input id="topup-amt" inputMode="numeric" value={topup} onChange={e => setTopup(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 500" />
            <div className="flex gap-1.5 flex-wrap">
              {[100, 500, 1000, 5000].map(v => (
                <Button key={v} size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setTopup(String(v))}>KSh {v.toLocaleString()}</Button>
              ))}
            </div>
            <PesapalButton kind="wallet_topup" amount={Number(topup) || 0} disabled={Number(topup) < 10}
              label={`Deposit${Number(topup) >= 10 ? ` KSh ${Number(topup).toLocaleString()}` : ""} with M-Pesa / Card`} />
            <PayPalButton kind="wallet_topup" amount={Number(topup) || 0} disabled={Number(topup) < 10}
              label={`Deposit${Number(topup) >= 10 ? ` KSh ${Number(topup).toLocaleString()}` : ""} with PayPal`} />
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-2 mt-3">
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Send className="h-4 w-4" /> Send money (KSh)</p>
            <p className="text-[11px] text-muted-foreground">Available: KSh {cash.toLocaleString()}</p>
            <Label className="text-xs">Recipient username, phone, email, or ID</Label>
            <Input value={cashTo} onChange={e => setCashTo(e.target.value)} placeholder="username or 0712 345 678" />
            <Label className="text-xs">Amount (KSh)</Label>
            <Input inputMode="numeric" value={cashAmt} onChange={e => setCashAmt(e.target.value.replace(/\D/g, ""))} placeholder="500" />
            <Button className="w-full gradient-accent" disabled={busy} onClick={sendCash}>Send money</Button>
            <p className="text-[11px] text-muted-foreground">Use the exact username or phone number saved on their profile.</p>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-2 mt-3">
          <Card className="gradient-card p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><Banknote className="h-4 w-4" /> Withdraw money (KSh)</p>
            <p className="text-[11px] text-muted-foreground">Available: KSh {cash.toLocaleString()}. Funds are reserved immediately and returned if an admin rejects the request.</p>
            <Label className="text-xs">M-Pesa phone number</Label>
            <Input value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" />
            <Label className="text-xs">Amount (KSh)</Label>
            <Input inputMode="numeric" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value.replace(/\D/g, ""))} placeholder="500" />
            <Button className="w-full gradient-accent" disabled={busy} onClick={requestWithdrawal}>Request withdrawal</Button>
            <p className="text-[11px] text-muted-foreground">Minimum withdrawal: KSh 10. An admin will process the M-Pesa payout.</p>
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
                <p className={`text-sm font-bold ${t.amount > 0 ? "text-emerald-400" : "text-destructive"}`}>{t.amount > 0 ? "+" : "-"}KSh {Math.abs(t.amount).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">bal KSh {t.balance_after.toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

export default Wallet;
