import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, MessageCircle, Trash2, Play, Images, Lock, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PhotoLightbox } from "./PhotoLightbox";
import { ListingReviewsDialog } from "./ListingReviewsDialog";
import { ContactUnlockDialog } from "./ContactUnlockDialog";
import { useContactUnlock } from "@/hooks/useContactUnlock";
import { BuyDialog } from "./BuyDialog";

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  category: "marketplace" | "housing";
  subcategory?: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  image_url: string | null;
  photos?: string[] | null;
  video_url?: string | null;
  created_at: string;
};

const emoji = (c: string) => (c === "housing" ? "🏠" : "🛒");

export const ListingCard = ({ listing, onDelete }: { listing: Listing; onDelete?: () => void }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canDelete = user && (user.id === listing.user_id || isAdmin);
  const isOwn = user?.id === listing.user_id;
  const [lightbox, setLightbox] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const allPhotos = (listing.photos && listing.photos.length ? listing.photos : (listing.image_url ? [listing.image_url] : []));
  const { unlocked, refresh } = useContactUnlock(listing.user_id);
  const canSeeContact = isOwn || unlocked;
  const requireAuth = () => { navigate("/auth"); };

  const startChat = async () => {
    if (!user || isOwn) return;
    const [a, b] = [user.id, listing.user_id].sort();
    const { data: existing } = await supabase.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
    let convoId = existing?.id;
    if (!convoId) {
      const { data, error } = await supabase.from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
      if (error) { toast.error(error.message); return; }
      convoId = data.id;
    }
    window.location.href = `/chat?c=${convoId}`;
  };

  const remove = async () => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onDelete?.();
  };

  return (
    <Card className="gradient-card border-border overflow-hidden transition-smooth hover:shadow-glow hover:-translate-y-0.5">
      <button
        type="button"
        className="aspect-[4/3] bg-secondary/40 grid place-items-center text-6xl w-full relative"
        onClick={() => !user ? requireAuth() : (allPhotos.length ? setLightbox(true) : (listing.video_url && setShowVideo(true)))}
      >
        {allPhotos.length ? (
          <img src={allPhotos[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span>{emoji(listing.category)}</span>
        )}
        {allPhotos.length > 1 && (
          <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Images className="h-3 w-3" /> {allPhotos.length}
          </span>
        )}
        {listing.video_url && (
          <span
            className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); if (!user) { requireAuth(); return; } setShowVideo(true); }}
          >
            <Play className="h-3 w-3" /> video
          </span>
        )}
      </button>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{listing.title}</h3>
          <Badge variant="secondary" className="shrink-0 text-[10px]">{listing.subcategory || listing.category}</Badge>
        </div>
        <p className="text-primary font-bold">KSh {Number(listing.price).toLocaleString()}</p>
        {listing.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{listing.location}</p>}
        {listing.description && <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {!user && (
            <Button size="sm" className="h-7 text-[11px] gradient-accent w-full" onClick={requireAuth}>
              <LogIn className="h-3 w-3 mr-1" />Sign up to view
            </Button>
          )}
          {user && !isOwn && !canSeeContact && (
            <ContactUnlockDialog sellerId={listing.user_id} listingId={listing.id} sellerName={listing.title} onUnlocked={refresh} />
          )}
          {user && canSeeContact && listing.contact_phone && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
              <a href={`tel:${listing.contact_phone}`}><Phone className="h-3 w-3 mr-1" />Call</a>
            </Button>
          )}
          {user && canSeeContact && listing.contact_email && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
              <a href={`mailto:${listing.contact_email}`}><Mail className="h-3 w-3 mr-1" />Email</a>
            </Button>
          )}
          {user && canSeeContact && !isOwn && (
            <Button size="sm" className="h-7 text-[11px] gradient-accent" onClick={startChat}>
              <MessageCircle className="h-3 w-3 mr-1" />Chat
            </Button>
          )}
          {user && !isOwn && !canSeeContact && (
            <Badge variant="outline" className="h-7 text-[10px] flex items-center gap-1 px-2">
              <Lock className="h-3 w-3" /> Contact locked
            </Badge>
          )}
          {user && !isOwn && (
            <BuyDialog listingId={listing.id} price={Number(listing.price)} title={listing.title} />
          )}
          {user && <ListingReviewsDialog listingId={listing.id} />}
          {canDelete && <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={remove}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>

      {allPhotos.length > 0 && <PhotoLightbox photos={allPhotos} open={lightbox} onOpenChange={setLightbox} />}
      {listing.video_url && showVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowVideo(false)}>
          <video src={listing.video_url} controls autoPlay className="max-h-[90vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </Card>
  );
};
