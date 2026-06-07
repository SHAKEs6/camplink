import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Building2, Star, ArrowRight, Heart, Megaphone, ChevronRight, Loader2 } from "lucide-react";
import { ListingCard, Listing } from "@/components/ListingCard";
import { AddListingDialog } from "@/components/AddListingDialog";
import { Button } from "@/components/ui/button";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";


const PAGE_SIZE = 30;

const Index = () => {
  const { user } = useAuth();
  const online = useOnline();
  const [recent, setRecent] = useState<Listing[]>([]);
  const [name, setName] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Camplink — Campus Marketplace"; }, []);

  const fetchPage = useCallback(async (pageIdx: number, replace = false) => {
    if (!online) return;
    setLoadingMore(true);
    const from = pageIdx * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    const rows = (data ?? []) as Listing[];
    setHasMore(rows.length === PAGE_SIZE);
    setRecent(prev => {
      const merged = replace ? rows : [...prev, ...rows];
      if (replace) cacheSet("listings:recent", merged);
      return merged;
    });
    setLoadingMore(false);
  }, [online]);

  const load = useCallback(async () => {
    const cached = cacheGet<Listing[]>("listings:recent");
    if (cached) setRecent(cached);
    setPage(0);
    await fetchPage(0, true);
    if (user) {
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      setName(p?.display_name ?? user.email?.split("@")[0] ?? "");
    }
  }, [user, fetchPage]);

  useEffect(() => { load(); }, [user, online]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [page, hasMore, loadingMore, fetchPage]);

  // Infinite scroll via horizontal IntersectionObserver
  useEffect(() => {
    const root = scrollerRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { root, rootMargin: "0px 300px 0px 0px", threshold: 0.1 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [loadMore, recent.length]);

  const onScroll = () => { if (showHint) setShowHint(false); };

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
        <div className="relative -mx-4">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex gap-3 overflow-x-auto pb-3 px-4 snap-x snap-mandatory scrollbar-none scroll-smooth"
          >
            {recent.map(l => (
              <div key={l.id} className="snap-start shrink-0 w-44 sm:w-52">
                <ListingCard listing={l} onDelete={load} />
              </div>
            ))}
            <div ref={sentinelRef} className="shrink-0 w-1" aria-hidden />
            {hasMore && (
              <div className="snap-start shrink-0 w-44 sm:w-52 flex items-center justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="h-full w-full min-h-[180px] flex-col gap-2">
                  {loadingMore ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                  <span className="text-xs">{loadingMore ? "Loading…" : "Load more"}</span>
                </Button>
              </div>
            )}
          </div>
          {/* Right-edge fade + swipe hint */}
          <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
          {showHint && recent.length >= 3 && (
            <div className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-semibold px-2 py-1 rounded-full shadow-glow animate-pulse">
              Swipe <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-24 right-4 z-40">
        <AddListingDialog onCreated={load} trigger={<Button size="lg" className="rounded-full h-14 w-14 p-0 gradient-accent shadow-glow"><span className="text-2xl leading-none">+</span></Button>} />
      </div>
    </AppShell>
  );
};

export default Index;

