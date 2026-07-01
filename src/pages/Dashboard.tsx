import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, ShoppingBag, ShoppingCart, MessageCircle, Bell, Package,
  Heart, TrendingUp, Sparkles, ArrowRight, Star, Building2, Film,
} from "lucide-react";

type Metric = {
  key: string; label: string; value: number | string; hint?: string;
  to: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>("");

  const [walletBal, setWalletBal] = useState(0);
  const [walletTier, setWalletTier] = useState("bronze");
  const [myListings, setMyListings] = useState(0);
  const [myViews, setMyViews] = useState(0);
  const [orders, setOrders] = useState({ bought: 0, sold: 0, pendingBought: 0 });
  const [cartCount, setCartCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [chats, setChats] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [recentListings, setRecentListings] = useState<any[]>([]);

  useEffect(() => { document.title = "Dashboard — Camplink"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [
        prof, w, listings, cart, notifs, boughtOrders, soldOrders, tx, convA, convB,
      ] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("balance,tier").eq("user_id", user.id).maybeSingle(),
        supabase.from("listings").select("id,title,price,category,photos,created_at,views", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("cart_items").select("id,quantity", { count: "exact", head: false }).eq("user_id", user.id),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("orders").select("id,status", { count: "exact" }).eq("buyer_id", user.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
        supabase.from("wallet_transactions").select("id,amount,type,description,created_at,balance_after").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_a", user.id),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_b", user.id),
      ]);

      setName(prof.data?.display_name || user.email?.split("@")[0] || "friend");
      setWalletBal(Number(w.data?.balance || 0));
      setWalletTier((w.data as any)?.tier || "bronze");

      const rows = (listings.data as any[]) || [];
      setRecentListings(rows);
      setMyListings(listings.count || 0);
      setMyViews(rows.reduce((s, r) => s + (Number(r.views) || 0), 0));

      const cartRows = (cart.data as any[]) || [];
      setCartCount(cartRows.reduce((s, r) => s + (Number(r.quantity) || 1), 0));

      setUnread(notifs.count || 0);

      const bo = (boughtOrders.data as any[]) || [];
      setOrders({
        bought: boughtOrders.count || 0,
        sold: soldOrders.count || 0,
        pendingBought: bo.filter(o => o.status === "pending").length,
      });

      setRecentTx((tx.data as any[]) || []);
      setChats((convA.count || 0) + (convB.count || 0));
      setLoading(false);
    })();
  }, [user]);

  const metrics: Metric[] = [
    { key: "wallet", label: "Wallet balance", value: walletBal.toLocaleString(), hint: walletTier.toUpperCase(), to: "/wallet", icon: Wallet, accent: true },
    { key: "listings", label: "My listings", value: myListings, hint: `${myViews} views`, to: "/profile", icon: ShoppingBag },
    { key: "orders", label: "Orders", value: orders.bought + orders.sold, hint: `${orders.pendingBought} pending`, to: "/cart", icon: Package },
    { key: "cart", label: "Cart items", value: cartCount, to: "/cart", icon: ShoppingCart },
    { key: "chats", label: "Conversations", value: chats, to: "/chat", icon: MessageCircle },
    { key: "alerts", label: "Unread alerts", value: unread, to: "/", icon: Bell },
  ];

  const shortcuts = [
    { to: "/market", label: "Marketplace", icon: ShoppingBag },
    { to: "/housing", label: "Housing", icon: Building2 },
    { to: "/dating", label: "Hookup", icon: Heart },
    { to: "/reviews", label: "Reviews", icon: Star },
    { to: "/reels", label: "Reels", icon: Film },
    { to: "/wallet", label: "Wallet", icon: Wallet },
  ];

  return (
    <AppShell>
      {/* Masthead */}
      <section className="relative overflow-hidden rounded-2xl gradient-hero p-6 md:p-10 mb-6 shadow-lux ring-gold">
        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/30 blur-3xl animate-neon-float" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-accent/20 blur-3xl animate-neon-float [animation-delay:-4s]" />
        <span className="kicker text-gold">Personal · Dashboard</span>
        <div className="hairline-gold my-3" />
        <h1 className="font-serif text-white text-4xl md:text-6xl leading-[0.95]">
          Welcome back, <em className="italic text-gold">{name}</em>.
        </h1>
        <p className="mt-3 text-white/75 max-w-xl">A single view of your money, listings, conversations and rewards on Camplink.</p>

        <div className="flex flex-wrap gap-2 mt-5">
          <Link to="/market"><Button className="rounded-full gradient-accent gap-1">Browse market <ArrowRight className="h-3 w-3" /></Button></Link>
          <Link to="/wallet"><Button variant="outline" className="rounded-full gap-1 bg-white/10 border-white/20 text-white hover:bg-white/20"><Sparkles className="h-3 w-3" /> Claim daily bonus</Button></Link>
        </div>
      </section>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {metrics.map(m => (
          <Link to={m.to} key={m.key}>
            <Card className={`relative overflow-hidden p-4 h-full gradient-card transition-smooth hover:-translate-y-0.5 hover:shadow-lux ${m.accent ? "ring-gold" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="kicker text-muted-foreground">{m.label}</span>
                <m.icon className={`h-4 w-4 ${m.accent ? "text-accent" : "text-muted-foreground"}`} />
              </div>
              {loading ? (
                <Skeleton className="h-8 w-20 mt-2" />
              ) : (
                <p className={`font-serif text-3xl mt-2 ${m.accent ? "text-gold" : ""}`}>{m.value}</p>
              )}
              {m.hint && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{m.hint}</p>}
            </Card>
          </Link>
        ))}
      </div>

      {/* Two-column: recent activity + shortcuts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 gradient-card">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="kicker text-accent">Recent · Wallet activity</span>
              <h2 className="font-serif text-2xl mt-1">Latest transactions</h2>
            </div>
            <Link to="/wallet" className="kicker text-muted-foreground hover:text-accent flex items-center gap-1">All <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="hairline-gold mb-3" />
          {loading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet. Claim your daily bonus to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTx.map(t => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.description || t.type}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`font-serif text-lg ${Number(t.amount) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Bal {Number(t.balance_after).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 gradient-card">
          <span className="kicker text-accent">Jump to</span>
          <h2 className="font-serif text-2xl mt-1">Shortcuts</h2>
          <div className="hairline-gold my-3" />
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map(s => (
              <Link key={s.to} to={s.to} className="group">
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/40 py-4 ring-1 ring-border transition-smooth hover:ring-accent/40 hover:bg-muted">
                  <s.icon className="h-4 w-4 text-accent" />
                  <span className="kicker">{s.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* My listings */}
      <Card className="p-5 gradient-card mt-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="kicker text-accent flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Your storefront</span>
            <h2 className="font-serif text-2xl mt-1">My listings</h2>
          </div>
          <Link to="/market" className="kicker text-muted-foreground hover:text-accent flex items-center gap-1">Post new <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="hairline-gold mb-3" />
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : recentListings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">You haven't posted anything yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recentListings.map(l => (
              <div key={l.id} className="rounded-xl overflow-hidden bg-muted/40 ring-1 ring-border">
                <div className="aspect-square bg-muted overflow-hidden">
                  {l.photos?.[0] ? <img src={l.photos[0]} alt={l.title} className="w-full h-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate">{l.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gold font-serif">KSh {Number(l.price).toLocaleString()}</span>
                    <Badge variant="secondary" className="text-[9px] uppercase">{l.category}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
};

export default Dashboard;
