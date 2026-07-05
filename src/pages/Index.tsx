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
import { AdBanner } from "@/components/AdBanner";

const PAGE_SIZE = 30;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return { text: "Burning the midnight oil", emoji: "🌙" };
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (h < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Good night", emoji: "✨" };
};

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
  const [greeting, setGreeting] = useState(getGreeting());
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Camplink — Campus Marketplace"; }, []);
  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

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
      {/* Magazine masthead */}
      <section className="relative mb-8 overflow-hidden rounded-2xl gradient-hero p-6 md:p-10 shadow-lux ring-gold">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-neon-float" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-neon-float [animation-delay:-4s]" />

        <div className="relative flex items-center justify-between">
          <span className="kicker text-gold">Camplink · Issue N°{String(stats.today || 1).padStart(2, "0")}</span>
          <span className="kicker text-white/60 hidden sm:block">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        <div className="hairline-gold my-4" />

        <h1 className="relative font-serif text-white text-4xl sm:text-5xl md:text-7xl leading-[0.95] tracking-tight ios:text-5xl">
          {greeting.text} {greeting.emoji}, <em className="italic text-gold">{name || "friend"}</em>.<br />
          <span className="text-white/85">Your campus, curated.</span>
        </h1>
        <p className="relative mt-4 max-w-xl text-white/75 text-sm md:text-base leading-relaxed">
          A private marketplace, community and social club for students — refined, real-time, and richly rewarding.
        </p>

        {/* Search bar */}
        <div className="relative mt-6 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the marketplace, housing, people…"
            className="pl-10 h-12 rounded-full bg-white/10 backdrop-blur border-white/15 text-white placeholder:text-white/50 focus-visible:ring-accent"
          />
        </div>

        {/* Section chips */}
        <div className="relative mt-6 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { to: "/market", label: "Market", icon: ShoppingBag },
            { to: "/housing", label: "Housing", icon: Building2 },
            { to: "/dating", label: "Hookup", icon: Heart },
            { to: "/community", label: "Community", icon: Megaphone },
            { to: "/reviews", label: "Reviews", icon: Star },
            { to: "/reels", label: "Reels", icon: Film },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="group">
              <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white/8 backdrop-blur ring-1 ring-white/10 py-3 transition-smooth hover:bg-white/15 hover:ring-accent/40">
                <Icon className="h-4 w-4 text-accent" />
                <span className="kicker text-white/85">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>


      {/* Editorial stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Listings", value: stats.listings },
          { label: "Members", value: stats.users },
          { label: "Today", value: stats.today, icon: Flame },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="relative overflow-hidden p-4 gradient-card ring-gold">
            <span className="kicker text-muted-foreground flex items-center gap-1">
              {Icon && <Icon className="h-3 w-3 text-accent" />} {label}
            </span>
            <p className="font-serif text-3xl md:text-4xl mt-1 text-gold">{value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span className="kicker text-muted-foreground">In circulation</span>
            <div className="hairline-gold flex-1" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4">
            <Badge
              variant={activeTag === null ? "default" : "secondary"}
              className="cursor-pointer shrink-0 rounded-full"
              onClick={() => setActiveTag(null)}
            >All</Badge>
            {trendingTags.map(t => (
              <Badge
                key={t}
                variant={activeTag === t ? "default" : "secondary"}
                className="cursor-pointer shrink-0 rounded-full capitalize"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
              >#{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Featured — magazine hero row */}
      {featured.length > 0 && !query && !activeTag && (
        <div className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <span className="kicker text-accent flex items-center gap-1"><Sparkles className="h-3 w-3" /> The Editors' Selection</span>
              <h2 className="font-serif text-3xl md:text-4xl mt-1">Featured this week</h2>
            </div>
            <Link to="/market" className="hidden md:inline-flex kicker text-muted-foreground hover:text-accent items-center gap-1">Browse all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="hairline-gold mb-4" />
          <div className="-mx-4 flex gap-4 overflow-x-auto pb-3 px-4 snap-x snap-mandatory scrollbar-none">
            {featured.map(l => (
              <div key={l.id} className="snap-start shrink-0 w-48 sm:w-56 md:w-64">
                <ListingCard listing={l} onDelete={load} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="kicker text-accent">Latest dispatches</span>
          <h2 className="font-serif text-3xl md:text-4xl mt-1">Recent Listings</h2>
        </div>
        <Link to="/market" className="kicker text-muted-foreground hover:text-accent flex items-center gap-1">See all <ArrowRight className="h-3 w-3" /></Link>
      </div>
      <div className="hairline-gold mb-5" />


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
