import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Search, Settings, ThumbsDown, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

type DP = {
  id: string; user_id: string; display_name: string;
  age: number | null; gender: string | null; looking_for: string | null;
  bio: string | null; interests: string | null; photo_url: string | null;
  photos?: string[] | null;
};

const Dating = () => {
  const { user, isAdmin } = useAuth();
  const { hookup_enabled } = useFeatureFlags();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<DP[]>([]);
  const [q, setQ] = useState("");
  const [hasOwn, setHasOwn] = useState<boolean | null>(null);
  const [viewing, setViewing] = useState<{ profile: DP | null; index: number; open: boolean }>({ profile: null, index: 0, open: false });
  const [reactions, setReactions] = useState<Record<string, { likes: number; dislikes: number; mine: "like" | "dislike" | null }>>({});

  useEffect(() => { document.title = "Hookup — Camplink"; }, []);

  if (!hookup_enabled) return <AppShell><Card className="p-8 text-center gradient-card text-muted-foreground">Hookup is not available yet.</Card></AppShell>;

  const loadReactions = async (uids: string[]) => {
    if (!uids.length) return;
    const { data } = await supabase.from("dating_reactions").select("profile_user_id, reaction, reactor_id").in("profile_user_id", uids);
    const map: typeof reactions = {};
    uids.forEach(u => map[u] = { likes: 0, dislikes: 0, mine: null });
    (data ?? []).forEach((r: any) => {
      const m = map[r.profile_user_id]; if (!m) return;
      if (r.reaction === "like") m.likes++; else m.dislikes++;
      if (user && r.reactor_id === user.id) m.mine = r.reaction;
    });
    setReactions(map);
  };

  const load = async () => {
    const { data } = await supabase.from("dating_profiles").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as DP[];
    setProfiles(rows);
    loadReactions(rows.map(r => r.user_id));
    if (user) {
      const { data: own } = await supabase.from("dating_profiles").select("id").eq("user_id", user.id).maybeSingle();
      setHasOwn(!!own);
    }
  };
  useEffect(() => { load(); }, [user]);

  const filtered = profiles.filter(p => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (p.display_name?.toLowerCase().includes(s) || p.bio?.toLowerCase().includes(s) || p.interests?.toLowerCase().includes(s) || p.looking_for?.toLowerCase().includes(s));
  });

  const dm = async (otherId: string) => {
    if (!user) return;
    if (otherId === user.id) { toast.error("That's you 😄"); return; }
    const [a, b] = [user.id, otherId].sort();
    const { data: existing } = await supabase.from("conversations").select("id").or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`).maybeSingle();
    let cid = existing?.id;
    if (!cid) {
      const { data, error } = await supabase.from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
      if (error) { toast.error(error.message); return; }
      cid = data.id;
    }
    navigate(`/chat?c=${cid}`);
  };

  const react = async (profileUserId: string, reaction: "like" | "dislike") => {
    if (!user) return;
    if (profileUserId === user.id) { toast.error("Can't react to yourself"); return; }
    const cur = reactions[profileUserId]?.mine;
    if (cur === reaction) {
      await supabase.from("dating_reactions").delete().eq("reactor_id", user.id).eq("profile_user_id", profileUserId);
    } else {
      await supabase.from("dating_reactions").upsert(
        { reactor_id: user.id, profile_user_id: profileUserId, reaction },
        { onConflict: "profile_user_id,reactor_id" }
      );
    }
    loadReactions(profiles.map(p => p.user_id));
  };

  const adminDeletePhoto = async (p: DP, idx: number) => {
    if (!isAdmin) return;
    if (!confirm("Delete this photo?")) return;
    const next = [...(p.photos ?? [])];
    next.splice(idx, 1);
    const { error } = await supabase.from("dating_profiles").update({ photos: next, photo_url: next[0] ?? null }).eq("user_id", p.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Photo deleted");
    setViewing({ profile: null, index: 0, open: false });
    load();
  };

  const adminDeleteProfile = async (p: DP) => {
    if (!isAdmin) return;
    if (!confirm(`Delete ${p.display_name}'s entire dating profile?`)) return;
    const { error } = await supabase.from("dating_profiles").delete().eq("user_id", p.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile removed");
    setViewing({ profile: null, index: 0, open: false });
    load();
  };

  const adminDeleteUser = async (p: DP) => {
    if (!isAdmin) return;
    if (!confirm(`Permanently delete user ${p.display_name}? This removes their account.`)) return;
    const { error } = await supabase.functions.invoke("delete-user", { body: { target_user_id: p.user_id } });
    if (error) { toast.error(error.message); return; }
    toast.success("User deleted");
    setViewing({ profile: null, index: 0, open: false });
    load();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">💖 Hookup</h1>
        <Link to="/dating/edit"><Button size="sm" variant="outline"><Settings className="h-4 w-4 mr-1" />{hasOwn ? "Edit" : "Create"}</Button></Link>
      </div>

      {hasOwn === false && (
        <Card className="p-4 mb-3 gradient-card text-sm text-muted-foreground">
          Create your dating profile to be discovered. Tap <b>Create</b> ↑
        </Card>
      )}

      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, interests, bio…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center gradient-card text-muted-foreground">No matches found.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(p => {
            const gallery = (p.photos && p.photos.length ? p.photos : (p.photo_url ? [p.photo_url] : []));
            const r = reactions[p.user_id] ?? { likes: 0, dislikes: 0, mine: null };
            return (
            <Card key={p.id} className="overflow-hidden gradient-card hover:shadow-glow transition-smooth">
              <button type="button" className="aspect-[3/4] bg-secondary relative w-full" onClick={() => gallery.length && setViewing({ profile: p, index: 0, open: true })}>
                {gallery[0] ? (
                  <img src={gallery[0]} alt={p.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center"><Avatar className="h-20 w-20"><AvatarFallback className="text-2xl bg-primary/20 text-primary">{p.display_name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar></div>
                )}
                {gallery.length > 1 && (
                  <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">📷 {gallery.length}</span>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left">
                  <p className="text-white font-bold text-sm truncate">{p.display_name}{p.age ? `, ${p.age}` : ""}</p>
                  {p.gender && <p className="text-white/80 text-[10px]">{p.gender}{p.looking_for ? ` · seeks ${p.looking_for}` : ""}</p>}
                </div>
              </button>
              <div className="p-2 space-y-1">
                {p.bio && <p className="text-xs text-muted-foreground line-clamp-2">{p.bio}</p>}
                {p.interests && <p className="text-[10px] text-primary truncate">❤ {p.interests}</p>}
                <div className="flex gap-1">
                  <Button size="sm" variant={r.mine === "like" ? "default" : "outline"} className={`flex-1 h-7 text-[10px] px-1 ${r.mine === "like" ? "gradient-accent" : ""}`} onClick={() => react(p.user_id, "like")}>
                    <Heart className="h-3 w-3 mr-1" />{r.likes}
                  </Button>
                  <Button size="sm" variant={r.mine === "dislike" ? "default" : "outline"} className="flex-1 h-7 text-[10px] px-1" onClick={() => react(p.user_id, "dislike")}>
                    <ThumbsDown className="h-3 w-3 mr-1" />{r.dislikes}
                  </Button>
                </div>
                <Button size="sm" className="w-full gradient-accent h-7 text-[10px]" onClick={() => dm(p.user_id)}>
                  <MessageCircle className="h-3 w-3 mr-1" /> Message
                </Button>
                {isAdmin && p.user_id !== user?.id && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] px-1" onClick={() => adminDeleteProfile(p)}>Remove</Button>
                    <Button size="sm" variant="destructive" className="flex-1 h-7 text-[9px] px-1" onClick={() => adminDeleteUser(p)}>Delete user</Button>
                  </div>
                )}
              </div>
            </Card>
          );})}
        </div>
      )}

      {viewing.open && viewing.profile && (() => {
        const p = viewing.profile;
        const gallery = (p.photos && p.photos.length ? p.photos : (p.photo_url ? [p.photo_url] : []));
        if (isAdmin) {
          // custom lightbox with delete
          return (
            <div className="fixed inset-0 z-50 bg-black/90 p-4 overflow-y-auto" onClick={() => setViewing({ profile: null, index: 0, open: false })}>
              <Button size="icon" variant="ghost" className="absolute top-3 right-3 text-white" onClick={() => setViewing({ profile: null, index: 0, open: false })}><X /></Button>
              <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto mt-12" onClick={e => e.stopPropagation()}>
                {gallery.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-full rounded-lg" />
                    <Button size="sm" variant="destructive" className="absolute top-1 right-1 h-7 text-[10px]" onClick={() => adminDeletePhoto(p, i)}>Delete</Button>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return <PhotoLightbox photos={gallery} open={viewing.open} onOpenChange={(o) => setViewing(v => ({ ...v, open: o }))} />;
      })()}
    </AppShell>
  );
};

export default Dating;
