import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

type Reel = {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  created_by: string;
};

const PAGE = 5;

const ReelItem = ({ reel, active, muted, onToggleMute, onOpenComments }: {
  reel: Reel; active: boolean; muted: boolean; onToggleMute: () => void; onOpenComments: (id: string) => void;
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) { v.play().catch(() => {}); } else { v.pause(); v.currentTime = 0; }
  }, [active]);

  useEffect(() => {
    (async () => {
      const [{ count: lc }, { count: cc }] = await Promise.all([
        (supabase as any).from("reel_likes").select("*", { count: "exact", head: true }).eq("reel_id", reel.id),
        (supabase as any).from("reel_comments").select("*", { count: "exact", head: true }).eq("reel_id", reel.id),
      ]);
      setLikes(lc ?? 0); setCommentCount(cc ?? 0);
      if (user) {
        const [{ data: l }, { data: s }] = await Promise.all([
          (supabase as any).from("reel_likes").select("user_id").eq("reel_id", reel.id).eq("user_id", user.id).maybeSingle(),
          (supabase as any).from("reel_saves").select("user_id").eq("reel_id", reel.id).eq("user_id", user.id).maybeSingle(),
        ]);
        setLiked(!!l); setSaved(!!s);
      }
    })();
  }, [reel.id, user]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false); setLikes(n => n - 1);
      await (supabase as any).from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", user.id);
    } else {
      setLiked(true); setLikes(n => n + 1);
      await (supabase as any).from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    }
  };

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      setSaved(false);
      await (supabase as any).from("reel_saves").delete().eq("reel_id", reel.id).eq("user_id", user.id);
      toast.success("Removed from saved");
    } else {
      setSaved(true);
      await (supabase as any).from("reel_saves").insert({ reel_id: reel.id, user_id: user.id });
      toast.success("Saved");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/reels?r=${reel.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
  };

  return (
    <div className="relative h-[100svh] w-full snap-start snap-always bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        loop
        playsInline
        muted={muted}
        onClick={onToggleMute}
        className="h-full w-full object-contain"
      />
      <button onClick={onToggleMute} className="absolute top-4 right-4 bg-black/40 rounded-full p-2 text-white">
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      {reel.caption && (
        <div className="absolute bottom-20 left-4 right-20 text-white text-sm bg-black/30 backdrop-blur rounded-lg p-2">
          {reel.caption}
        </div>
      )}
      <div className="absolute right-3 bottom-24 flex flex-col gap-4 items-center">
        <button onClick={toggleLike} className="flex flex-col items-center text-white">
          <Heart className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          <span className="text-xs mt-0.5">{likes}</span>
        </button>
        <button onClick={() => onOpenComments(reel.id)} className="flex flex-col items-center text-white">
          <MessageCircle className="h-7 w-7" />
          <span className="text-xs mt-0.5">{commentCount}</span>
        </button>
        <button onClick={toggleSave} className="flex flex-col items-center text-white">
          <Bookmark className={`h-7 w-7 ${saved ? "fill-yellow-400 text-yellow-400" : ""}`} />
        </button>
        <button onClick={share} className="flex flex-col items-center text-white">
          <Share2 className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
};

const CommentsSheet = ({ reelId, onClose }: { reelId: string; onClose: () => void }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [input, setInput] = useState("");

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("reel_comments")
      .select("id, content, user_id, created_at, profiles:profiles!reel_comments_user_id_fkey(display_name)")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: false });
    if (data) setComments(data);
    else {
      const { data: d2 } = await (supabase as any).from("reel_comments").select("*").eq("reel_id", reelId).order("created_at", { ascending: false });
      setComments(d2 ?? []);
    }
  }, [reelId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`reel-c-${reelId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "reel_comments", filter: `reel_id=eq.${reelId}` },
      () => load()
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reelId, load]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const c = input.trim().slice(0, 500);
    setInput("");
    await (supabase as any).from("reel_comments").insert({ reel_id: reelId, user_id: user.id, content: c });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-card w-full max-h-[70vh] rounded-t-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-semibold">Comments</p>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {comments.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">Be the first to comment</p> : comments.map(c => (
            <div key={c.id} className="bg-secondary/40 rounded-lg p-2">
              <p className="text-xs font-semibold">{c.profiles?.display_name ?? "User"}</p>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-border flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Add a comment…" />
          <Button onClick={send} size="icon" className="gradient-accent"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

const Reels = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Reels — Camplink"; }, []);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    const from = p * PAGE, to = from + PAGE - 1;
    const { data } = await (supabase as any).from("reels").select("*").order("created_at", { ascending: false }).range(from, to);
    const rows = (data ?? []) as Reel[];
    setHasMore(rows.length === PAGE);
    setReels(prev => p === 0 ? rows : [...prev, ...rows]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  // Track active reel by scroll position
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      if (idx !== activeIdx) setActiveIdx(idx);
      // Load more when near end
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - window.innerHeight && hasMore && !loading) {
        const next = page + 1; setPage(next); fetchPage(next);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIdx, hasMore, loading, page, fetchPage]);

  return (
    <AppShell hideHeader>
      <div ref={scrollerRef} className="fixed inset-0 h-[100svh] w-full overflow-y-auto snap-y snap-mandatory bg-black z-10">
        {reels.length === 0 && !loading && (
          <div className="h-[100svh] flex items-center justify-center text-white/70">No reels yet</div>
        )}
        {reels.map((r, i) => (
          <ReelItem key={r.id} reel={r} active={i === activeIdx} muted={muted} onToggleMute={() => setMuted(m => !m)} onOpenComments={setCommentsFor} />
        ))}
        {loading && (
          <div className="h-24 flex items-center justify-center text-white"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}
      </div>
      {commentsFor && <CommentsSheet reelId={commentsFor} onClose={() => setCommentsFor(null)} />}
    </AppShell>
  );
};

export default Reels;
