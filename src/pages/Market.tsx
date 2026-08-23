import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard, Listing } from "@/components/ListingCard";
import { AddListingDialog } from "@/components/AddListingDialog";
import { Card } from "@/components/ui/card";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";
import { AdBanner } from "@/components/AdBanner";

const Page = ({ category, title, emoji }: { category: "marketplace" | "housing"; title: string; emoji: string }) => {
  const [items, setItems] = useState<Listing[]>([]);
  const online = useOnline();

  useEffect(() => { document.title = `${title} — Camplink`; }, [title]);

  const load = async () => {
    const cached = cacheGet<Listing[]>("listings:" + category);
    if (cached) setItems(cached);
    if (!online) return;
    const { data } = await supabase.from("listings").select("*").eq("category", category).order("created_at", { ascending: false });
    const rows = (data ?? []) as Listing[];
    setItems(rows);
    cacheSet("listings:" + category, rows);
  };
  useEffect(() => { load(); }, [category, online]);

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="kicker text-accent">Camplink · {title}</span>
          <h1 className="font-serif text-3xl md:text-5xl mt-1">{emoji} {title}</h1>
        </div>
        <AddListingDialog defaultCategory={category} onCreated={load} />
      </div>
      <div className="hairline-gold mb-4" />
      <AdBanner />

      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>{items.length} result{items.length === 1 ? "" : "s"}</span>
        {!online && <span className="text-warning">Offline · showing cached</span>}
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center gradient-card text-muted-foreground">
          No listings yet.
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(l => <ListingCard key={l.id} listing={l} onDelete={load} />)}
        </div>
      )}
    </AppShell>
  );
};

export const Market = () => <Page category="marketplace" title="Marketplace" emoji="🛒" />;
export const Housing = () => <Page category="housing" title="Housing" emoji="🏠" />;
