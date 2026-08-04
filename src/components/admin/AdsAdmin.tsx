import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Megaphone, Save, DollarSign, Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Ad = { id: string; title: string; body: string | null; image_url: string | null; link_url: string | null; active: boolean; priority: number; created_at: string };

export const AdsAdmin = () => {
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [price, setPrice] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [usdRate, setUsdRate] = useState<string>("");
  const [form, setForm] = useState({ title: "", body: "", image_url: "", link_url: "", priority: 0 });
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `ads/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    setForm(f => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    e.target.value = "";
    toast.success("Image uploaded");
  };

  const load = async () => {
    const { data } = await supabase.from("ads").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
    setAds((data ?? []) as Ad[]);
    const { data: s } = await supabase.from("app_settings").select("theme").eq("id", 1).maybeSingle();
    const p = Number((s?.theme as any)?.["contact_unlock_price"] || 0);
    setPrice(p ? String(p) : "");
    const r = Number((s?.theme as any)?.["usd_rate"] || 0);
    setUsdRate(r ? String(r) : "130");
  };
  useEffect(() => { load(); }, []);

  const savePrice = async () => {
    setSavingPrice(true);
    const val = Math.max(0, Math.round(Number(price) || 0));
    const { data: existing } = await supabase.from("app_settings").select("theme").eq("id", 1).maybeSingle();
    const theme = { ...(existing?.theme as any || {}), ["contact_unlock_price"]: val };
    const { error } = await supabase.from("app_settings").upsert({ id: 1, theme });
    setSavingPrice(false);
    if (error) toast.error(error.message); else toast.success(`Unlock price set to KSh ${val}`);
  };

  const saveRate = async () => {
    setSavingPrice(true);
    const val = Math.max(1, Number(usdRate) || 130);
    const { data: existing } = await supabase.from("app_settings").select("theme").eq("id", 1).maybeSingle();
    const theme = { ...(existing?.theme as any || {}), ["usd_rate"]: val };
    const { error } = await supabase.from("app_settings").upsert({ id: 1, theme });
    setSavingPrice(false);
    if (error) toast.error(error.message); else toast.success(`PayPal rate set to KSh ${val} per USD`);
  };

  const create = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    setCreating(true);
    const { error } = await supabase.from("ads").insert({
      title: form.title.trim(),
      body: form.body.trim() || null,
      image_url: form.image_url.trim() || null,
      link_url: form.link_url.trim() || null,
      priority: Number(form.priority) || 0,
      active: true,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Ad added");
    setForm({ title: "", body: "", image_url: "", link_url: "", priority: 0 });
    load();
  };

  const toggle = async (a: Ad) => {
    const { error } = await supabase.from("ads").update({ active: !a.active }).eq("id", a.id);
    if (error) toast.error(error.message); else load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-4">
      <Card className="gradient-card p-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Contact unlock price</p>
        <p className="text-xs text-muted-foreground">The one-time KSh amount buyers pay to unlock a seller's phone, email, and chat.</p>
        <div className="flex gap-2">
          <Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 50" />
          <Button className="gradient-accent" onClick={savePrice} disabled={savingPrice}><Save className="h-4 w-4 mr-1" />Save</Button>
        </div>
      </Card>

      <Card className="gradient-card p-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />PayPal exchange rate</p>
        <p className="text-xs text-muted-foreground">KSh per 1 USD. Used to convert prices when a buyer pays with PayPal.</p>
        <div className="flex gap-2">
          <Input type="number" min={1} value={usdRate} onChange={e => setUsdRate(e.target.value)} placeholder="130" />
          <Button className="gradient-accent" onClick={saveRate} disabled={savingPrice}><Save className="h-4 w-4 mr-1" />Save</Button>
        </div>
      </Card>

      <Card className="gradient-card p-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><Megaphone className="h-4 w-4" />New banner ad</p>
        <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label className="text-xs">Body (optional)</Label><Textarea rows={2} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Image</Label>
          {form.image_url ? (
            <div className="relative">
              <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-lg border border-border" />
              <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={() => setForm({ ...form, image_url: "" })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-stretch">
              <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="Paste URL…" className="flex-1" />
              <label className="inline-flex items-center gap-1 px-3 rounded-md border border-border cursor-pointer hover:bg-secondary/30 text-xs shrink-0">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Upload</>}
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
            </div>
          )}
        </div>
        <div><Label className="text-xs">Link URL</Label><Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" /></div>
        <div><Label className="text-xs">Priority (higher = shown first)</Label><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></div>
        <Button className="gradient-accent w-full" onClick={create} disabled={creating}>Add ad</Button>
      </Card>

      <div className="space-y-2">
        {ads.length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">No ads yet.</Card>}
        {ads.map(a => (
          <Card key={a.id} className="p-3 gradient-card flex items-center gap-3">
            {a.image_url && <img src={a.image_url} alt="" className="h-14 w-14 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{a.title}</p>
              {a.body && <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>}
              {a.link_url && <p className="text-[10px] text-primary truncate">{a.link_url}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={a.active} onCheckedChange={() => toggle(a)} />
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
