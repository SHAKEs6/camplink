import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard, Listing } from "@/components/ListingCard";
import { AddListingDialog } from "@/components/AddListingDialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Search, SlidersHorizontal, MapPin, X, ArrowUpDown } from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";
import { SUBCATEGORIES } from "@/components/AddListingDialog";

const MARKET_CATS = ["All", ...SUBCATEGORIES.filter(s => s !== "Housing")] as const;
type SortKey = "newest" | "price_asc" | "price_desc" | "title";

const Page = ({ category, title, emoji }: { category: "marketplace" | "housing"; title: string; emoji: string }) => {
  const [items, setItems] = useState<Listing[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [loc, setLoc] = useState<string>("All");
  const [priceMax, setPriceMax] = useState<number>(0); // 0 = compute
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [open, setOpen] = useState(false);
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

  // Compute price bounds + location list from data
  const locations = useMemo(() => {
    const s = new Set<string>();
    items.forEach(l => l.location && s.add(l.location.trim()));
    return ["All", ...Array.from(s).sort()];
  }, [items]);

  const maxPrice = useMemo(() => {
    const m = items.reduce((a, l) => Math.max(a, Number(l.price) || 0), 0);
    return Math.max(100, Math.ceil(m / 100) * 100);
  }, [items]);

  useEffect(() => {
    if (priceMax === 0 && maxPrice > 0) {
      setPriceMax(maxPrice);
      setRange([0, maxPrice]);
    }
  }, [maxPrice, priceMax]);

  const filtered = useMemo(() => {
    let out = items.filter(l => {
      if (cat !== "All" && (l.subcategory || "Other") !== cat) return false;
      if (loc !== "All" && (l.location || "").trim() !== loc) return false;
      const p = Number(l.price) || 0;
      if (priceMax > 0 && (p < range[0] || p > range[1])) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return [l.title, l.description, l.location, l.subcategory].some(v => v?.toLowerCase().includes(s));
    });
    switch (sort) {
      case "price_asc": out = [...out].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)); break;
      case "price_desc": out = [...out].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0)); break;
      case "title": out = [...out].sort((a, b) => a.title.localeCompare(b.title)); break;
      default: break;
    }
    return out;
  }, [items, q, cat, loc, range, priceMax, sort]);

  const activeFilters = [
    cat !== "All" && { key: "cat", label: cat, clear: () => setCat("All") },
    loc !== "All" && { key: "loc", label: `📍 ${loc}`, clear: () => setLoc("All") },
    priceMax > 0 && (range[0] > 0 || range[1] < maxPrice) && {
      key: "price",
      label: `KSh ${range[0].toLocaleString()}–${range[1].toLocaleString()}`,
      clear: () => setRange([0, maxPrice]),
    },
    sort !== "newest" && { key: "sort", label: `Sort: ${sort.replace("_", " ")}`, clear: () => setSort("newest") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

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

      {/* Search + filters row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-11 rounded-full" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 rounded-full gap-2 shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters.length > 0 && (
                <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] gradient-accent">{activeFilters.length}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Refine {title.toLowerCase()}</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              {category === "marketplace" && (
                <div>
                  <label className="kicker text-muted-foreground">Category</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MARKET_CATS.map(c => (
                      <Button key={c} size="sm" variant={cat === c ? "default" : "outline"}
                        className={`h-8 text-xs ${cat === c ? "gradient-accent" : ""}`}
                        onClick={() => setCat(c)}>{c}</Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="kicker text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</label>
                <Select value={loc} onValueChange={setLoc}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="kicker text-muted-foreground">Price range (KSh)</label>
                <div className="mt-3 px-1">
                  <Slider
                    value={range}
                    onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
                    min={0} max={maxPrice || 100} step={Math.max(50, Math.round((maxPrice || 100) / 100))}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mt-2 text-muted-foreground">
                  <span>KSh {range[0].toLocaleString()}</span>
                  <span>KSh {range[1].toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input type="number" min={0} value={range[0]} onChange={e => setRange([Math.max(0, +e.target.value || 0), range[1]])} placeholder="Min" className="h-9" />
                  <Input type="number" min={0} value={range[1]} onChange={e => setRange([range[0], Math.max(range[0], +e.target.value || 0)])} placeholder="Max" className="h-9" />
                </div>
              </div>

              <div>
                <label className="kicker text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Sort by</label>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="price_asc">Price: Low → High</SelectItem>
                    <SelectItem value="price_desc">Price: High → Low</SelectItem>
                    <SelectItem value="title">Name (A–Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SheetFooter className="mt-8 flex-row gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => { setCat("All"); setLoc("All"); setRange([0, maxPrice]); setSort("newest"); setQ(""); }}>
                Reset
              </Button>
              <Button className="gradient-accent" onClick={() => setOpen(false)}>Show {filtered.length} results</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Quick category chips (marketplace) */}
      {category === "marketplace" && (
        <div className="flex gap-2 overflow-x-auto mb-3 pb-1 -mx-1 px-1 scrollbar-none">
          {MARKET_CATS.map(c => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              className={`h-8 text-xs whitespace-nowrap rounded-full ${cat === c ? "gradient-accent" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeFilters.map(f => (
            <Badge key={f.key} variant="secondary" className="gap-1 pr-1 rounded-full">
              {f.label}
              <button onClick={f.clear} className="rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        {!online && <span className="text-warning">Offline · showing cached</span>}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center gradient-card text-muted-foreground">
          Nothing matches your filters. Try widening the price range or clearing categories.
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(l => <ListingCard key={l.id} listing={l} onDelete={load} />)}
        </div>
      )}
    </AppShell>
  );
};

export const Market = () => <Page category="marketplace" title="Marketplace" emoji="🛒" />;
export const Housing = () => <Page category="housing" title="Housing" emoji="🏠" />;
