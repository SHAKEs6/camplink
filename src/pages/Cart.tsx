import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Plus, Minus } from "lucide-react";
import { Listing } from "@/components/ListingCard";
import { toast } from "sonner";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";
import { BuyDialog } from "@/components/BuyDialog";
import { ShoppingBag } from "lucide-react";

type CartRow = { id: string; quantity: number; listing_id: string; listings: Listing | null };

const Cart = () => {
  const { user } = useAuth();
  const online = useOnline();
  const [items, setItems] = useState<CartRow[]>([]);

  useEffect(() => {
    document.title = "Cart — Camplink";
  }, []);

  const load = async () => {
    if (!user) return;
    const cached = cacheGet<CartRow[]>("cart:" + user.id);
    if (cached) setItems(cached);
    if (!online) return;
    const { data } = await supabase
      .from("cart_items")
      .select("id, quantity, listing_id, listings(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as CartRow[];
    setItems(rows);
    cacheSet("cart:" + user.id, rows);
  };

  useEffect(() => {
    load();
  }, [user?.id, online]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  const setQty = async (id: string, q: number) => {
    if (q < 1) return remove(id);
    const { error } = await supabase.from("cart_items").update({ quantity: q }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((p) => p.map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  };

  const total = items.reduce((s, i) => s + (i.listings ? Number(i.listings.price) * i.quantity : 0), 0);

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold mb-4 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6" /> Your Cart
      </h1>

      {items.length === 0 ? (
        <Card className="p-8 text-center gradient-card text-muted-foreground">
          Your cart is empty. Add items from the marketplace.
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((row) =>
              row.listings ? (
                <Card key={row.id} className="gradient-card p-3 flex gap-3">
                  <div className="w-20 h-20 rounded-lg bg-secondary/40 grid place-items-center text-3xl shrink-0 overflow-hidden">
                    {row.listings.image_url ? (
                      <img src={row.listings.image_url} alt={row.listings.title} className="w-full h-full object-cover" />
                    ) : (
                      <span>{row.listings.category === "housing" ? "🏠" : "🛒"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{row.listings.title}</p>
                    <p className="text-primary font-bold text-sm mt-1">
                      KSh {Number(row.listings.price).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setQty(row.id, row.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs w-6 text-center">{row.quantity}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setQty(row.id, row.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(row.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null
            )}
          </div>
          <Card className="gradient-card p-4 mt-4 sticky bottom-24 shadow-glow">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-extrabold text-primary">KSh {total.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Choose delivery details before placing each order.</p>
            <div className="space-y-2 mt-3">
              {items.filter(i => i.listings).map((row) => (
                <BuyDialog
                  key={row.id}
                  listingId={row.listings!.id}
                  price={Number(row.listings!.price)}
                  title={row.listings!.title}
                  quantity={row.quantity}
                  trigger={
                    <Button className="w-full gradient-accent justify-between" size="sm">
                      <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Order {row.quantity}× {row.listings!.title.slice(0, 24)}</span>
                      <span className="font-bold">KSh {(Number(row.listings!.price) * row.quantity).toLocaleString()}</span>
                    </Button>
                  }
                />
              ))}
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
};

export default Cart;
