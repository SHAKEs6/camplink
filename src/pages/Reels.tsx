import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Loader2, Send, X, CornerDownRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { detectReel } from "@/lib/reelEmbed";

type Reel = {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  created_by: string;
  source_type?: string | null;
};

const PAGE = 5;

const ReelMedia = ({ reel, active, muted, onToggleMute }: { reel: Reel; active: boolean; muted: boolean; onToggleMute: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const info = detectReel(reel.video_url);
  const isVideo = !info || info.platform === "video";

  useEffect(() => {
    if (!isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else { v.pause(); v.currentTime = 0; }
  }, [active, isVideo]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        loop
        playsInline
        muted={muted}
        onClick={onToggleMute}
        className="h-full w-full object-contain bg-black"
      />
    );
  }

  // External embed — only render iframe when active to save bandwidth & autoplay correctly
  return (
    <div className="h-full w-full flex items-center justify-center bg-black">
      {active ? (
        <iframe
          src={info!.embedUrl}
          className="w-full h-full max-w-[500px]"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups-to-escape-sandbox"
          title={`reel-${reel.id}`}
        />
      ) : (
        <div className="text-white/50 text-xs">Loading…</div>
      )}
    </div>
  );
};

const ReelItem = ({ reel, active, muted, onToggleMute, onOpenComments }: {
  reel: Reel; active: boolean; muted: boolean; onToggleMute: () => void; onOpenComments: (id: string) => void;
}) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [doubleTap, setDoubleTap] = useState(false);
  const lastTap = useRef(0);

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
      setLiked(false); setLikes(n => Math.max(0, n - 1));
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

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double tap → like
      if (!liked) toggleLike();
      setDoubleTap(true);
      setTimeout(() => setDoubleTap(false), 700);
    }
    lastTap.current = now;
  };

  return (
    <div className="relative h-[100svh] w-full snap-start snap-always bg-black flex items-center justify-center" onClick={handleTap}>
      <ReelMedia reel={reel} active={active} muted={muted} onToggleMute={onToggleMute} />
      {doubleTap && (
        <Heart className="absolute h-32 w-32 text-red-500 fill-red-500 animate-ping pointer-events-none" />
      )}
      <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className="absolute top-4 right-4 bg-black/40 rounded-full p-2 text-white z-10">
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      {reel.caption && (
        <div className="absolute bottom-20 left-4 right-20 text-white text-sm bg-black/40 backdrop-blur rounded-lg p-2">
          {reel.caption}
        </div>
      )}
      <div className="absolute right-3 bottom-24 flex flex-col gap-4 items-center z-10" onClick={(e) => e.stopPropagation()}>
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

const CommentRow = ({ c, replies, onReply, onDelete, currentUserId }: {
  c: any; replies: any[]; onReply: (id: string, name: string) => void; onDelete: (id: string) => void; currentUserId?: string;
}) => (
  <div className="bg-secondary/40 rounded-lg p-2">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{c.display_name ?? "User"}</p>
        <p className="text-sm break-words">{c.content}</p>
        <button onClick={() => onReply(c.id, c.display_name ?? "User")} className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <CornerDownRight className="h-3 w-3" />Reply
        </button>
      </div>
      {currentUserId === c.user_id && (
        <button onClick={() => onDelete(c.id)} className="text-destructive opacity-60 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
      )}
    </div>
    {replies.length > 0 && (
      <div className="mt-2 ml-4 space-y-1 border-l-2 border-border pl-2">
        {replies.map(r => (
          <div key={r.id} className="bg-background/40 rounded p-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold">{r.display_name ?? "User"}</p>
                <p className="text-xs break-words">{r.content}</p>
              </div>
              {currentUserId === r.user_id && (
                <button onClick={() => onDelete(r.id)} className="text-destructive opacity-60 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const CommentsSheet = ({ reelId, onClose }: { reelId: string; onClose: () => void }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("reel_comments").select("*").eq("reel_id", reelId).order("created_at", { ascending: true });
    const list = data ?? [];
    const ids = Array.from(new Set(list.map((c: any) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids as string[]);
      const map = new Map(profs?.map(p => [p.id, p.display_name]));
      list.forEach((c: any) => { c.display_name = map.get(c.user_id) ?? "User"; });
    }
    setComments(list);
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
    const payload: any = { reel_id: reelId, user_id: user.id, content: c };
    if (replyTo) payload.parent_id = replyTo.id;
    setReplyTo(null);
    await (supabase as any).from("reel_comments").insert(payload);
  };

  const del = async (id: string) => {
    await (supabase as any).from("reel_comments").delete().eq("id", id);
  };

  const tops = comments.filter(c => !c.parent_id).reverse();
  const repliesByParent = new Map<string, any[]>();
  comments.filter(c => c.parent_id).forEach(c => {
    const arr = repliesByParent.get(c.parent_id) ?? [];
    arr.push(c); repliesByParent.set(c.parent_id, arr);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="bg-card w-full max-h-[75vh] rounded-t-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-semibold">{comments.length} Comments</p>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tops.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">Be the first to comment</p> : tops.map((c: any) => (
            <CommentRow
              key={c.id}
              c={c}
              replies={repliesByParent.get(c.id) ?? []}
              onReply={(id, name) => setReplyTo({ id, name })}
              onDelete={del}
              currentUserId={user?.id}
            />
          ))}
        </div>
        {replyTo && (
          <div className="px-3 py-1 border-t border-border flex items-center justify-between text-xs bg-secondary/30">
            <span>Replying to <b>@{replyTo.name}</b></span>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="p-2 border-t border-border flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={replyTo ? "Write a reply…" : "Add a comment…"} />
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

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      if (idx !== activeIdx) setActiveIdx(idx);
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - window.innerHeight && hasMore && !loading) {
        const next = page + 1; setPage(next); fetchPage(next);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIdx, hasMore, loading, page, fetchPage]);

  return (
    <div className="relative">
      <Link to="/" className="fixed top-3 left-3 z-40 bg-black/50 text-white rounded-full px-3 py-1 text-xs font-semibold backdrop-blur">← Home</Link>
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
      <div className="relative z-30"><BottomNav /></div>
    </div>
  );
};

export default Reels;
