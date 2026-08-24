import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

type Ad = { id: string; title: string; body: string | null; image_url: string | null; video_url: string | null; link_url: string | null };

export const AdBanner = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [idx, setIdx] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    supabase.from("ads").select("id,title,body,image_url,video_url,link_url")
      .eq("active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const loadedAds = (data ?? []) as Ad[];
        setAds(loadedAds);
        setPopupOpen(loadedAds.length > 0);
      });
  }, []);

  useEffect(() => {
    if (ads.length < 2 || ads[idx]?.video_url) return;
    const t = setInterval(() => setIdx(i => (i + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [ads, idx]);

  if (!ads.length) return null;
  const ad = ads[idx];
  const inner = (
    <Card className="gradient-card border-border overflow-hidden flex items-stretch min-h-[80px] transition-smooth hover:shadow-glow">
      {ad.video_url ? <video src={ad.video_url} muted autoPlay playsInline onEnded={() => setIdx(i => (i + 1) % ads.length)} className="ad-media w-32 sm:w-48 aspect-video object-cover shrink-0" /> : ad.image_url && <img src={ad.image_url} alt="" className="ad-media w-24 sm:w-32 h-full object-cover shrink-0" />}
      <div className="p-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="kicker text-accent text-[10px]">Sponsored</span>
        </div>
        <p className="font-semibold text-sm truncate">{ad.title}</p>
        {ad.body && <p className="text-xs text-muted-foreground line-clamp-2">{ad.body}</p>}
      </div>
      {ad.link_url && <ExternalLink className="h-4 w-4 text-muted-foreground m-3 shrink-0" />}
    </Card>
  );

  return (
    <div className="mb-4">
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0 [&_.ad-media]:w-56 [&_.ad-media]:sm:w-96 [&_.ad-media]:h-64">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-left">Sponsored</DialogTitle>
          </DialogHeader>
          {!popupOpen && (ad.link_url ? (
            <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">
              {inner}
            </a>
          ) : inner)}
        </DialogContent>
      </Dialog>
      {ad.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>
      ) : inner}
      {ads.length > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {ads.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>
      )}
    </div>
  );
};
