import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Shield, Send, Ban, CheckCircle2, MessageCircle, Wallet as WalletIcon, Film, Users, Megaphone, Unlock, Lock } from "lucide-react";
import { ThemeEditor } from "@/components/ThemeEditor";
import { WalletAdmin } from "@/components/admin/WalletAdmin";
import { ReelsAdmin } from "@/components/admin/ReelsAdmin";
import { GroupChatAdmin } from "@/components/admin/GroupChatAdmin";
import { AdsAdmin } from "@/components/admin/AdsAdmin";
import { toast } from "sonner";

type Row = Record<string, any>;

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [reviews, setReviews] = useState<Row[]>([]);
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { document.title = "Admin — Camplink"; }, []);

  const load = async () => {
    const [{ data: l }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
    ]);
    setListings(l ?? []); setUsers(p ?? []); setReviews(r ?? []);
  };
  useEffect(() => { load(); }, []);

  const del = async (table: "listings" | "reviews", id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const broadcast = async () => {
    if (!bcTitle.trim()) { toast.error("Title required"); return; }
    setSending(true);
    const rows = users.map(u => ({ user_id: u.id, title: bcTitle.trim(), body: bcBody.trim() || null, type: "admin_broadcast" }));
    const { error } = await supabase.from("notifications").insert(rows);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Sent to ${rows.length} users`);
    setBcTitle(""); setBcBody("");
  };

  const toggleSuspend = async (u: Row) => {
    const next = !u.suspended;
    const { error } = await supabase.from("profiles").update({ suspended: next }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: u.id,
      title: next ? "Account suspended" : "Account reinstated",
      body: next ? "An admin suspended your account." : "An admin restored your account.",
      type: "admin_action",
    });
    toast.success(next ? "Suspended" : "Reinstated");
    load();
  };

  const removeUser = async (u: Row) => {
    if (u.id === user?.id) { toast.error("Don't delete yourself!"); return; }
    if (!confirm(`Permanently delete ${u.email}?`)) return;
    const { error } = await supabase.functions.invoke("delete-user", { body: { target_user_id: u.id } });
    if (error) { toast.error(error.message); return; }
    toast.success("User deleted");
    load();
  };

  const dmUser = async (u: Row) => {
    if (!user || u.id === user.id) return;
    const [a, b] = [user.id, u.id].sort();
    const { data: existing } = await supabase.from("conversations").select("id").or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`).maybeSingle();
    let cid = existing?.id;
    if (!cid) {
      const { data, error } = await supabase.from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
      if (error) { toast.error(error.message); return; }
      cid = data.id;
    }
    navigate(`/chat?c=${cid}`);
  };

  const toggleContactAccess = async (u: Row) => {
    const next = !u.contact_access;
    const { error } = await supabase.from("profiles").update({ contact_access: next } as any).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Granted contact access" : "Revoked contact access");
    load();
  };

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4"><Shield className="h-6 w-6 text-accent" /><h1 className="text-2xl font-extrabold">Admin Panel</h1></div>

      <ThemeEditor />

      <Card className="gradient-card p-4 mb-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><Send className="h-4 w-4" />Broadcast notification 🔔</p>
        <div><Label className="text-xs">Title</Label><Input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="Announcement" /></div>
        <div><Label className="text-xs">Message</Label><Textarea value={bcBody} onChange={e => setBcBody(e.target.value)} placeholder="What's the news?" rows={2} /></div>
        <Button className="gradient-accent w-full" onClick={broadcast} disabled={sending}>Send to all users</Button>
      </Card>

      <Tabs defaultValue="users">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="ads"><Megaphone className="h-3 w-3 mr-1" />Ads</TabsTrigger>
          <TabsTrigger value="wallet"><WalletIcon className="h-3 w-3 mr-1" />Wallet</TabsTrigger>
          <TabsTrigger value="reels"><Film className="h-3 w-3 mr-1" />Reels</TabsTrigger>
          <TabsTrigger value="groups"><Users className="h-3 w-3 mr-1" />Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="ads" className="mt-3"><AdsAdmin /></TabsContent>
        <TabsContent value="wallet" className="mt-3"><WalletAdmin /></TabsContent>
        <TabsContent value="reels" className="mt-3"><ReelsAdmin /></TabsContent>
        <TabsContent value="groups" className="mt-3"><GroupChatAdmin /></TabsContent>

        <TabsContent value="users" className="space-y-2 mt-3">
          {users.map(u => (
            <Card key={u.id} className="p-3 gradient-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{u.display_name ?? "—"} {u.suspended && <span className="text-destructive text-[10px] ml-1">SUSPENDED</span>}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => dmUser(u)} disabled={u.id === user?.id}>
                  <MessageCircle className="h-3 w-3 mr-1" />DM
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => toggleSuspend(u)} disabled={u.id === user?.id}>
                  {u.suspended ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                  {u.suspended ? "Unsuspend" : "Suspend"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => toggleContactAccess(u)}>
                  {u.contact_access ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                  {u.contact_access ? "Revoke contacts" : "Grant contacts"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-destructive" onClick={() => removeUser(u)} disabled={u.id === user?.id}>
                  <Trash2 className="h-3 w-3 mr-1" />Delete
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="listings" className="space-y-2 mt-3">
          {listings.map(l => (
            <Card key={l.id} className="p-3 gradient-card flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{l.title}</p>
                <p className="text-xs text-muted-foreground">{l.category} · KSh {l.price}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del("listings", l.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-2 mt-3">
          {reviews.map(r => (
            <Card key={r.id} className="p-3 gradient-card flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm">⭐ {r.rating} — {r.comment}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del("reviews", r.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

export default Admin;
