import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Download, ShoppingBag, MapPin, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { downloadReceipt } from "@/lib/receipt";
import { ListingReviewsDialog } from "@/components/ListingReviewsDialog";

type Order = {
  id: string;
  listing_id: string | null;
  buyer_id: string;
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
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  tracking_latitude?: number | null;
  tracking_longitude?: number | null;
  tracking_updated_at?: string | null;
  delivered_at?: string | null;
  refund_status?: string | null;
  listings: { title: string; image_url: string | null } | null;
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const selectedOrderId = searchParams.get("order");

  const load = async () => {
    if (!user) return;
    setLoadError(null);
    const { data, error } = await (supabase as any).from("orders").select("id,listing_id,buyer_id,seller_id,amount,quantity,status,provider,mpesa_receipt,created_at,location,pickup_station,delivery_method,delivery_address,delivery_latitude,delivery_longitude,tracking_latitude,tracking_longitude,tracking_updated_at,delivered_at,refund_status").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order("created_at", { ascending: false });
    if (error) {
      setOrders([]);
      setLoadError(error.message);
      return;
    }

    const rows = (data ?? []) as Omit<Order, "listings">[];
    const listingIds = rows.map(order => order.listing_id).filter((id): id is string => Boolean(id));
    const { data: listings, error: listingsError } = listingIds.length
      ? await (supabase as any).from("listings").select("id,title,image_url").in("id", listingIds)
      : { data: [], error: null };
    if (listingsError) setLoadError(listingsError.message);
    const listingById = new Map((listings ?? []).map((listing: { id: string; title: string; image_url: string | null }) => [listing.id, listing]));
    setOrders(rows.map(order => ({ ...order, listings: order.listing_id ? listingById.get(order.listing_id) ?? null : null })));
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase.channel(`orders:${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (!trackingOrderId || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(async position => {
      const { error } = await (supabase.rpc as any)("seller_update_order_location", { _order_id: trackingOrderId, _latitude: position.coords.latitude, _longitude: position.coords.longitude });
      if (error) setTrackingOrderId(null);
    }, () => setTrackingOrderId(null), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingOrderId]);

  return <AppShell>
    <div className="mb-5 flex items-center justify-between gap-3"><div><span className="kicker text-accent">Camplink · account</span><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold"><Package className="h-6 w-6" />Orders & sales</h1></div><Link to="/market"><Button size="sm" className="gradient-accent"><ShoppingBag className="mr-1 h-4 w-4" />Market</Button></Link></div>
    {loadError && <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Could not load orders: {loadError}</p>}
    {orders.length === 0 ? <Card className="gradient-card p-10 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">No orders yet</p><p className="mt-1 text-sm text-muted-foreground">Your purchases and sales will appear here.</p><Link to="/market"><Button className="mt-4 gradient-accent">Browse marketplace</Button></Link></Card> : <div className="space-y-3">{orders.map(order => { const title = order.listings?.title || "Marketplace order"; const isSale = order.seller_id === user?.id; const canCancel = !isSale && ["paid", "processing"].includes(order.status); const canReview = !isSale && ["shipped", "delivered"].includes(order.status) && Boolean(order.listing_id); const tracking = order.tracking_latitude != null && order.tracking_longitude != null; const nextStatus = order.status === "paid" ? "processing" : order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null; const nextStatusLabel = nextStatus === "processing" ? "Confirm order" : nextStatus === "shipped" ? "Mark as shipped" : nextStatus === "delivered" ? "Confirm delivered" : null; const deliveryMap = order.delivery_latitude != null && order.delivery_longitude != null ? `https://www.google.com/maps/search/?api=1&query=${order.delivery_latitude},${order.delivery_longitude}` : null; return <Card key={order.id} className={`gradient-card p-4 ${selectedOrderId === order.id ? "ring-2 ring-primary" : ""}`}><div className="flex gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary/40">{order.listings?.image_url ? <img src={order.listings.image_url} alt={title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold leading-tight">{title}</p><Badge variant={order.status === "paid" ? "default" : "secondary"}>{isSale ? (order.status === "paid" ? "Awaiting confirmation" : order.status) : order.status}</Badge></div><p className="mt-1 text-sm font-bold text-primary">KSh {Number(order.amount).toLocaleString()} · {order.quantity} item{order.quantity === 1 ? "" : "s"}</p><p className="text-[11px] text-muted-foreground">{new Date(order.created_at).toLocaleString()} · {order.provider}</p></div></div><div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2"><p><span className="font-semibold text-foreground">Location:</span> {order.location || "Not provided"}</p><p><span className="font-semibold text-foreground">Pickup station:</span> {order.pickup_station || "Not provided"}</p><p><span className="font-semibold text-foreground">Fulfilment:</span> {order.delivery_method === "door" ? "Door delivery" : "Pickup station"}</p>{order.delivery_address && <p><span className="font-semibold text-foreground">Address:</span> {order.delivery_address}</p>}{deliveryMap && <p><a className="text-primary underline" target="_blank" rel="noreferrer" href={deliveryMap}>View exact delivery location in Google Maps</a></p>}</div>{isSale && nextStatus && <Button size="sm" className="mt-3 gradient-accent" onClick={async () => { const { error } = await (supabase.rpc as any)("seller_update_order_status", { _order_id: order.id, _status: nextStatus }); if (error) alert(error.message); else load(); }}>{nextStatusLabel}</Button>}{isSale && !["delivered", "cancelled"].includes(order.status) && <Button size="sm" variant="outline" className="mt-3 ml-2" onClick={() => setTrackingOrderId(current => current === order.id ? null : order.id)}>{trackingOrderId === order.id ? <><Radio className="mr-1 h-4 w-4" />Stop live tracking</> : <><MapPin className="mr-1 h-4 w-4" />Share live location</>}</Button>}{tracking && <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs"><p className="font-semibold text-foreground">Live delivery location</p><p>Updated {order.tracking_updated_at ? new Date(order.tracking_updated_at).toLocaleTimeString() : "just now"}</p><a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${order.tracking_latitude},${order.tracking_longitude}`}>Open current location on map</a></div>}{canCancel && <Button size="sm" variant="destructive" className="mt-3" onClick={async () => { const { error } = await (supabase.rpc as any)("buyer_cancel_order", { _order_id: order.id }); if (error) alert(error.message); else load(); }}>Cancel order and request refund</Button>}{canReview && <ListingReviewsDialog listingId={order.listing_id!} />}{order.status === "paid" || order.status === "delivered" ? <Button size="sm" variant="outline" className="mt-3 ml-2" onClick={() => downloadReceipt(order, title)}><Download className="mr-1 h-4 w-4" />Download receipt</Button> : null}</Card>; })}</div>}
  </AppShell>;
};

export default Orders;
