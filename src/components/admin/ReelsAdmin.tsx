import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Film, Upload } from "lucide-react";
import { toast } from "sonner";

export const ReelsAdmin = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<any[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("reels").select("*").order("created_at", { ascending: false });
    setReels(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/reel-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file, { cacheControl: "3600" });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    setVideoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Uploaded — now save");
    e.target.value = "";
  };

  const save = async () => {
    if (!videoUrl || !user) { toast.error("Upload a video first"); return; }
    const { error } = await (supabase as any).from("reels").insert({ video_url: videoUrl, caption: caption.trim() || null, created_by: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Reel published");
    setVideoUrl(""); setCaption("");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete reel?")) return;
    const { error } = await (supabase as any).from("reels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-3">
      <Card className="gradient-card p-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><Film className="h-4 w-4" />Upload a new reel</p>
        <Label className="text-xs">Video (≤50MB)</Label>
        <label className="flex items-center justify-center h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/30">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-4 w-4" />Choose video</span>}
          <input type="file" accept="video/*" className="hidden" onChange={upload} disabled={uploading} />
        </label>
        {videoUrl && <video src={videoUrl} controls className="w-full max-h-48 rounded-lg" />}
        <Label className="text-xs">Caption</Label>
        <Textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Say something…" rows={2} />
        <Button className="gradient-accent w-full" onClick={save} disabled={!videoUrl}>Publish Reel</Button>
      </Card>

      <p className="text-xs text-muted-foreground">{reels.length} reels</p>
      {reels.map(r => (
        <Card key={r.id} className="p-2 gradient-card flex gap-2 items-center">
          <video src={r.video_url} className="h-16 w-12 rounded object-cover bg-black" />
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate">{r.caption ?? "(no caption)"}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
          </div>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </Card>
      ))}
    </div>
  );
};
