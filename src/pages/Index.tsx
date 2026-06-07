import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Building2, Star, ArrowRight, Heart, Megaphone } from "lucide-react";
import { ListingCard, Listing } from "@/components/ListingCard";
import { AddListingDialog } from "@/components/AddListingDialog";
import { Button } from "@/components/ui/button";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";

const Index = () => {
  const { user } = useAuth();
  const online = useOnline();
  const [recent, setRecent] = useState<Listing[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { document.title = "Camplink — Campus Marketplace"; }, []);

  const load = async () => {
    const cached = cacheGet<Listing[]>("listings:recent");
    if (cached) setRecent(cached);
    if (!online) return;
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(30);
    const rows = (data ?? []) as Listing[];
    setRecent(rows);
    cacheSet("listings:recent", rows);
    if (user) {
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      setName(p?.display_name ?? user.email?.split("@")[0] ?? "");
    }
  };
  useEffect(() => { load(); }, [user, online]);

  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 shadow-neon mb-6">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-400/40 blur-3xl animate-neon-float" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-violet-400/40 blur-3xl animate-neon-float [animation-delay:-3s]" />
        <p className="text-white/90 text-sm font-medium">Hey {name || "there"} 👋</p>
        <h1 className="text-white text-3xl font-extrabold leading-tight mt-1 neon-glow-text">What are you<br />looking for today?</h1>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Link to="/market"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><ShoppingBag className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Marketplace</p></Card></Link>
          <Link to="/housing"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Building2 className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Housing</p></Card></Link>
          <Link to="/dating"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Heart className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Hookup 💖</p></Card></Link>
          <Link to="/community"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Megaphone className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Community</p></Card></Link>
          <Link to="/reviews"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Star className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Reviews</p></Card></Link>
          <Link to="/anon"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><span className="block text-2xl mb-0.5">🤫</span><p className="text-xs font-semibold text-white">How Was It?</p></Card></Link>
        </div>
      </section>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Recent Listings</h2>
        <Link to="/market" className="text-sm text-primary flex items-center gap-1">See all <ArrowRight className="h-3 w-3" /></Link>
      </div>

      {recent.length === 0 ? (
        <Card className="p-8 text-center gradient-card">
          <p className="text-muted-foreground mb-3">No listings yet — be the first!</p>
          <AddListingDialog onCreated={load} />
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
          {recent.map(l => (
            <div key={l.id} className="snap-start shrink-0 w-44 sm:w-52">
              <ListingCard listing={l} onDelete={load} />
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-24 right-4 z-40">
        <AddListingDialog onCreated={load} trigger={<Button size="lg" className="rounded-full h-14 w-14 p-0 gradient-accent shadow-glow"><span className="text-2xl leading-none">+</span></Button>} />
      </div>
    </AppShell>
  );
};

export default Index;      
