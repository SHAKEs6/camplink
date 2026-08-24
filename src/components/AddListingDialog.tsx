import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MultiImageUpload } from "./MultiImageUpload";
import { VideoUpload } from "./VideoUpload";
import { LocationPicker } from "./LocationPicker";

export const SUBCATEGORIES = [
  "Textbooks", "Electronics", "Furniture", "Clothing", "Services", "Tickets", "Housing", "Other",
] as const;

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0).max(100000000),
  category: z.enum(["marketplace", "housing"]),
  subcategory: z.string().max(40).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  contact_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional(),
});

export const AddListingDialog = ({
  defaultCategory = "marketplace", onCreated, trigger,
}: { defaultCategory?: "marketplace" | "housing"; onCreated?: () => void; trigger?: React.ReactNode }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({ latitude: null, longitude: null });
  const [form, setForm] = useState({
    title: "", description: "", price: "", category: defaultCategory,
    subcategory: defaultCategory === "housing" ? "Housing" : "Other",
    contact_phone: "", contact_email: user?.email ?? "", location: "",
  });

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    if (photos.length < 1) { toast.error("Add at least 1 photo (up to 3 recommended)"); return; }
    if (coordinates.latitude == null || coordinates.longitude == null) { toast.error("Pin the exact listing location"); return; }
    setBusy(true);
    const { error } = await supabase.from("listings").insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      price: parsed.data.price,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory || null,
      contact_phone: parsed.data.contact_phone || null,
      contact_email: parsed.data.contact_email || null,
      location: parsed.data.location || null,
      location_latitude: coordinates.latitude,
      location_longitude: coordinates.longitude,
      image_url: photos[0] ?? null,
      photos,
      video_url: video,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing posted!");
    setOpen(false);
    setPhotos([]); setVideo(null); setCoordinates({ latitude: null, longitude: null });
    setForm({ ...form, title: "", description: "", price: "", location: "" });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="gradient-accent shadow-glow"><Plus className="h-4 w-4 mr-1" />Post</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Post a listing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v, subcategory: v === "housing" ? "Housing" : "Other" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marketplace">Marketplace</SelectItem>
                <SelectItem value="housing">Housing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.category === "marketplace" && (
            <div>
              <Label>Type</Label>
              <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBCATEGORIES.filter(s => s !== "Housing").map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Scientific Calculator FX-991" /></div>
          <div><Label>Price (KSh) *</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="800" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Condition, details…" rows={3} /></div>
          <LocationPicker label="Location" text={form.location} latitude={coordinates.latitude} longitude={coordinates.longitude} onTextChange={location => setForm({ ...form, location })} onCoordinatesChange={(latitude, longitude) => setCoordinates({ latitude, longitude })} />
          <div>
            <Label>Photos (2–3 recommended)</Label>
            {user && <MultiImageUpload userId={user.id} values={photos} onChange={setPhotos} max={5} />}
          </div>
          <div>
            <Label>Video (optional)</Label>
            {user && <VideoUpload userId={user.id} value={video} onChange={setVideo} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+254…" /></div>
            <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
          </div>
          <Button className="w-full gradient-accent" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post listing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
