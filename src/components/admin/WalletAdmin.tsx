import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wallet as WalletIcon, Plus, Minus, Snowflake, Sun, Trash2, Megaphone, Ticket, Copy } from "lucide-react";
import { toast } from "sonner";

type WalletRow = { user_id: string; balance: number; tier: string; frozen: boolean; display_name?: string; email?: string };

export const WalletAdmin = () => {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cAmt, setCAmt] = useState("");
  const [pCode, setPCode] = useState("");
  const [pAmt, setPAmt] = useState("");
  const [pUses, setPUses] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: w }, { data: p }, { data: c }, { data: pc }] = await Promise.all([
      supabase.from("wallets").select("*").order("balance", { ascending: false }),
      supabase.from("profiles").select("id,display_name,email"),
      supabase.from("reward_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    ]);
    const byId = new Map((p ?? []).map(u => [u.id, u]));
    setWallets(((w as any) ?? []).map((x: any) => ({ ...x, ...byId.get(x.user_id) })));
    setCampaigns(c ?? []); setPromos(pc ?? []);
  };
  useEffect(() => { load(); }, []);

  const adjust = async (uid: string, amount: number) => {
    const note = prompt(`${amount > 0 ? "Credit" : "Debit"} ${Math.abs(amount)} pts — note?`) ?? undefined;
    const { error } = await supabase.rpc("admin_wallet_adjust" as any, { _uid: uid, _amount: amount, _note: note });
    if (error) toast.error(error.message); else { toast.success("Adjusted"); load(); }
  };

  const freeze = async (uid: string, frozen: boolean) => {
    const { error } = await supabase.rpc("admin_freeze_wallet" as any, { _uid: uid, _frozen: frozen });
    if (error) toast.error(error.message); else { toast.success(frozen ? "Frozen" : "Unfrozen"); load(); }
  };

  const copyUserId = async (userId: string) => {
    await navigator.clipboard.writeText(userId);
    toast.success("User ID copied");
  };

  const createCampaign = async () => {
    const amt = parseInt(cAmt, 10);
    if (!cTitle.trim() || !amt) { toast.error("Title + amount required"); return; }
    setBusy(true);
    const { error } = await supabase.from("reward_campaigns").insert({ title: cTitle.trim(), description: cDesc.trim() || null, amount: amt });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Campaign created"); setCTitle(""); setCDesc(""); setCAmt(""); load(); }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Delete campaign?")) return;
    const { error } = await supabase.from("reward_campaigns").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const createPromo = async () => {
    const amt = parseInt(pAmt, 10); const uses = parseInt(pUses, 10) || 1;
    if (!pCode.trim() || !amt) { toast.error("Code + amount required"); return; }
    setBusy(true);
    const { error } = await supabase.from("promo_codes").insert({ code: pCode.trim().toUpperCase(), amount: amt, discount_ksh: amt, max_uses: uses });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Promo created"); setPCode(""); setPAmt(""); setPUses("1"); load(); }
  };

  const deletePromo = async (id: string) => {
    if (!confirm("Delete promo?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-4">
      <Card className="gradient-card p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-2"><Megaphone className="h-4 w-4" />Reward campaigns</p>
        <div className="space-y-2 mb-3">
          <Input value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="Campaign title (e.g. Launch Week)" />
          <Textarea value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} placeholder="Description (optional)" />
          <Input type="number" value={cAmt} onChange={e => setCAmt(e.target.value)} placeholder="Points to award" />
          <Button onClick={createCampaign} disabled={busy} className="w-full gradient-accent">Create campaign</Button>
        </div>
        {campaigns.map(c => (
          <div key={c.id} className="flex items-center justify-between border-t border-border pt-2 mt-2">
            <div className="min-w-0"><p className="text-sm font-medium truncate">{c.title}</p><p className="text-xs text-accent">+{c.amount} pts</p></div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCampaign(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Card className="gradient-card p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-2"><Ticket className="h-4 w-4" />Promo codes</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Input value={pCode} onChange={e => setPCode(e.target.value.toUpperCase())} placeholder="CODE" />
          <Input type="number" value={pAmt} onChange={e => setPAmt(e.target.value)} placeholder="Discount KSh" />
          <Input type="number" value={pUses} onChange={e => setPUses(e.target.value)} placeholder="Uses" />
        </div>
        <Button onClick={createPromo} disabled={busy} className="w-full gradient-accent">Create promo</Button>
        <div className="mt-3 space-y-1">
          {promos.map(p => (
            <div key={p.id} className="flex items-center justify-between border-t border-border pt-2">
              <div className="text-xs"><span className="font-bold">{p.code}</span> · KSh {p.amount} off · {p.used_count}/{p.max_uses}</div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePromo(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gradient-card p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-2"><WalletIcon className="h-4 w-4" />User wallets ({wallets.length})</p>
        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {wallets.map(w => (
            <div key={w.user_id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{w.display_name ?? w.email ?? w.user_id.slice(0, 8)}</p>
                <p className="text-[10px] text-muted-foreground truncate">ID: {w.user_id}</p>
                <p className="text-xs text-muted-foreground">{w.balance.toLocaleString()} pts · {w.tier}{w.frozen && " · ❄️ frozen"}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" title="Copy user ID" onClick={() => copyUserId(w.user_id)}><Copy className="h-3 w-3" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" title="Credit 100" onClick={() => adjust(w.user_id, 100)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" title="Debit 100" onClick={() => adjust(w.user_id, -100)}><Minus className="h-3 w-3" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" title={w.frozen ? "Unfreeze" : "Freeze"} onClick={() => freeze(w.user_id, !w.frozen)}>
                  {w.frozen ? <Sun className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
