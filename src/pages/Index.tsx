import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Building2, Star, ArrowRight, Heart, Megaphone, Loader2, Film, Search, TrendingUp, Sparkles, Flame } from "lucide-react";
import { ListingCard, Listing } from "@/components/ListingCard";
import { AddListingDialog } from "@/components/AddListingDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [stats, setStats] = useState({ listings: 0, users: 0, today: 0 });
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
    // Cool stat counters
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const [{ count: lc }, { count: uc }, { count: tc }] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    ]);
    setStats({ listings: lc ?? 0, users: uc ?? 0, today: tc ?? 0 });
  }, [user, fetchPage]);

  useEffect(() => { load(); }, [user, online]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [page, hasMore, loadingMore, fetchPage]);

  // Vertical infinite scroll on window
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "600px 0px 600px 0px", threshold: 0.01 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [loadMore, recent.length]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    recent.forEach(r => {
      const t = (r.subcategory || r.category || "").toString().trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [recent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recent.filter(l => {
      if (activeTag && (l.subcategory || l.category) !== activeTag) return false;
      if (!q) return true;
      return (l.title?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q) || l.location?.toLowerCase().includes(q));
    });
  }, [recent, query, activeTag]);

  const featured = useMemo(() => {
    // Top by price as a simple "premium picks" highlight
    return [...recent].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 6);
  }, [recent]);

  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-6 shadow-neon mb-6">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-400/40 blur-3xl animate-neon-float" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-violet-400/40 blur-3xl animate-neon-float [animation-delay:-3s]" />
        <p className="text-white/90 text-sm font-medium">Hey {name || "there"} 👋</p>
        <h1 className="text-white text-3xl font-extrabold leading-tight mt-1 neon-glow-text">What are you<br />looking for today?</h1>

        {/* Search bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings, places, items…"
            className="pl-9 bg-white/15 backdrop-blur border-white/20 text-white placeholder:text-white/60"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <Link to="/market"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><ShoppingBag className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Marketplace</p></Card></Link>
          <Link to="/housing"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Building2 className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Housing</p></Card></Link>
          <Link to="/dating"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Heart className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Hookup 💖</p></Card></Link>
          <Link to="/community"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Megaphone className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Community</p></Card></Link>
          <Link to="/reviews"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><Star className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">Reviews</p></Card></Link>
          <Link to="/anon"><Card className="bg-white/15 backdrop-blur border-white/20 p-3 text-center hover:bg-white/25 transition-smooth"><span className="block text-2xl mb-0.5">🤫</span><p className="text-xs font-semibold text-white">How Was It?</p></Card></Link>
          <Link to="/reels" className="col-span-2"><Card className="bg-gradient-to-r from-pink-500/30 to-violet-500/30 backdrop-blur border-white/20 p-3 text-center hover:from-pink-500/40 hover:to-violet-500/40 transition-smooth"><Film className="h-6 w-6 mx-auto text-white mb-1" /><p className="text-xs font-semibold text-white">🎬 Reels — swipe up</p></Card></Link>
        </div>
      </section>

      {/* Live stats strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Card className="p-3 text-center gradient-card">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Listings</p>
          <p className="text-lg font-extrabold">{stats.listings.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center gradient-card">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Members</p>
          <p className="text-lg font-extrabold">{stats.users.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center gradient-card">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1"><Flame className="h-3 w-3" />Today</p>
          <p className="text-lg font-extrabold">{stats.today.toLocaleString()}</p>
        </Card>
      </div>

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Trending</div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4">
            <Badge
              variant={activeTag === null ? "default" : "secondary"}
              className="cursor-pointer shrink-0"
              onClick={() => setActiveTag(null)}
            >All</Badge>
            {trendingTags.map(t => (
              <Badge
                key={t}
                variant={activeTag === t ? "default" : "secondary"}
                className="cursor-pointer shrink-0 capitalize"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
              >#{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Featured picks */}
      {featured.length > 0 && !query && !activeTag && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Featured Picks</h2>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto pb-3 px-4 snap-x snap-mandatory scrollbar-none">
            {featured.map(l => (
              <div key={l.id} className="snap-start shrink-0 w-44 sm:w-52">
                <ListingCard listing={l} onDelete={load} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Recent Listings</h2>
        <Link to="/market" className="text-sm text-primary flex items-center gap-1">See all <ArrowRight className="h-3 w-3" /></Link>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center gradient-card">
          <p className="text-muted-foreground mb-3">{recent.length === 0 ? "No listings yet — be the first!" : "No matches for your search."}</p>
          {recent.length === 0 && <AddListingDialog onCreated={load} />}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} onDelete={load} />
            ))}
          </div>

          <div ref={sentinelRef} className="h-10" aria-hidden />

          <div className="flex justify-center py-6">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
              </div>
            ) : hasMore ? (
              <Button variant="outline" onClick={loadMore}>Load more</Button>
            ) : (
              <p className="text-xs text-muted-foreground">🎉 You're all caught up</p>
            )}
          </div>
        </>
      )}

      <div className="fixed bottom-24 right-4 z-40">
        <AddListingDialog onCreated={load} trigger={<Button size="lg" className="rounded-full h-14 w-14 p-0 gradient-accent shadow-glow"><span className="text-2xl leading-none">+</span></Button>} />
      </div>
    </AppShell>
  );
};

export default Index;
