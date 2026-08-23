import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Download, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadReceipt } from "@/lib/receipt";

type Order = {
  id: string;
  seller_id: string | null;
  amount: number;
  quantity: number;
  status: string;
  provider: string;
  mpesa_receipt: string | null;
  created_at: string;
  location: string | null;
  pickup_station: string | null;
  delivery_method: string | null;
  delivery_address: string | null;
  listings: { title: string; image_url: string | null } | null;
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("orders").select("id,buyer_id,seller_id,amount,quantity,status,provider,mpesa_receipt,created_at,location,pickup_station,delivery_method,delivery_address,listings(title,image_url)").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at", { ascending: false });
    setOrders((data ?? []) as Order[]);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.channel(`orders:${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return <AppShell>
    <div className="mb-5 flex items-center justify-between gap-3"><div><span className="kicker text-accent">Camplink · account</span><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><Package className="h-6 w-6" />Orders & sales</h1></div><Link to="/market"><Button size="sm" className="gradient-accent"><ShoppingBag className="mr-1 h-4 w-4" />Market</Button></Link></div>
    {orders.length === 0 ? <Card className="gradient-card p-10 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">No orders yet</p><p className="mt-1 text-sm text-muted-foreground">Your purchases and sales will appear here.</p><Link to="/market"><Button className="mt-4 gradient-accent">Browse marketplace</Button></Link></Card> : <div className="space-y-3">{orders.map(order => { const title = order.listings?.title || "Marketplace order"; const isSale = order.seller_id === user?.id; return <Card key={order.id} className="gradient-card p-4"><div className="flex gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/40">{order.listings?.image_url ? <img src={order.listings.image_url} alt={title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold leading-tight">{title}</p><Badge variant={order.status === "paid" ? "default" : "secondary"}>{isSale ? "Sale" : order.status}</Badge></div><p className="mt-1 text-sm font-bold text-primary">KSh {Number(order.amount).toLocaleString()} · {order.quantity} item{order.quantity === 1 ? "" : "s"}</p><p className="text-[11px] text-muted-foreground">{new Date(order.created_at).toLocaleString()} · {order.provider}</p></div></div><div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2"><p><span className="font-semibold text-foreground">Location:</span> {order.location || "Not provided"}</p><p><span className="font-semibold text-foreground">Pickup station:</span> {order.pickup_station || "Not provided"}</p><p><span className="font-semibold text-foreground">Fulfilment:</span> {order.delivery_method === "door" ? "Door delivery" : "Pickup station"}</p>{order.delivery_address && <p><span className="font-semibold text-foreground">Address:</span> {order.delivery_address}</p>}</div>{order.status === "paid" && <Button size="sm" variant="outline" className="mt-3" onClick={() => downloadReceipt(order, title)}><Download className="mr-1 h-4 w-4" />Download receipt</Button>}</Card>; })}</div>}
  </AppShell>;
};

export default Orders;
