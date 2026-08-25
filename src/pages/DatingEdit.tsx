import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AvatarUpload } from "@/components/AvatarUpload";
import { MultiImageUpload } from "@/components/MultiImageUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const DatingEdit = () => {
  const { user } = useAuth();
  const { hookup_enabled } = useFeatureFlags();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [lookingFor, setLookingFor] = useState<string>("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  useEffect(() => { document.title = "My Dating Profile — Camplink"; }, []);

  if (!hookup_enabled) return <AppShell><Card className="p-8 text-center gradient-card text-muted-foreground">Hookup is not available yet.</Card></AppShell>;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("dating_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setExists(true);
        setDisplayName(data.display_name);
        setAge(data.age?.toString() ?? "");
        setGender(data.gender ?? "");
        setLookingFor(data.looking_for ?? "");
        setBio(data.bio ?? "");
        setInterests(data.interests ?? "");
        setPhoto(data.photo_url);
        setPhotos(((data as any).photos ?? []) as string[]);
        setActive(data.is_active);
      } else {
        const { data: p } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        setDisplayName(p?.display_name ?? user.email?.split("@")[0] ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (!displayName.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      display_name: displayName.trim().slice(0, 60),
      age: age ? Math.max(18, Math.min(99, parseInt(age))) : null,
      gender: gender || null,
      looking_for: lookingFor || null,
      bio: bio.trim().slice(0, 500) || null,
      interests: interests.trim().slice(0, 200) || null,
      photo_url: photo ?? photos[0] ?? null,
      photos,
      is_active: active,
    } as any;
    const { error } = exists
      ? await supabase.from("dating_profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("dating_profiles").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    navigate("/dating");
  };

  const remove = async () => {
    if (!user || !confirm("Delete your dating profile?")) return;
    const { error } = await supabase.from("dating_profiles").delete().eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); navigate("/dating"); }
  };

  if (loading) return <AppShell><p className="text-center text-muted-foreground py-10">Loading…</p></AppShell>;

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold mb-4">💖 My Dating Profile</h1>
      <Card className="p-4 gradient-card space-y-4">
        <AvatarUpload userId={user!.id} value={photo} fallback={(displayName || "U").slice(0,2).toUpperCase()} onChange={setPhoto} size={96} />

        <div>
          <Label>More photos (up to 6)</Label>
          <p className="text-[10px] text-muted-foreground mb-2">Add 2 or more photos so others can swipe through your gallery.</p>
          <MultiImageUpload userId={user!.id} bucket="avatars" values={photos} onChange={setPhotos} max={6} />
        </div>

        <div><Label>Display name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} /></div>

        <div className="grid grid-cols-3 gap-2">
          <div><Label>Age</Label><Input type="number" min={18} max={99} value={age} onChange={e => setAge(e.target.value)} /></div>
          <div>
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Non-binary">Non-binary</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Seeking</Label>
            <Select value={lookingFor} onValueChange={setLookingFor}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Anyone">Anyone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div><Label>Bio</Label><Textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={500} placeholder="Tell people about yourself…" /></div>
        <div><Label>Interests</Label><Input value={interests} onChange={e => setInterests(e.target.value)} maxLength={200} placeholder="movies, hiking, music…" /></div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div><p className="text-sm font-medium">Visible to others</p><p className="text-xs text-muted-foreground">Toggle off to hide your profile</p></div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        <Button className="w-full gradient-accent" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        {exists && <Button variant="outline" className="w-full text-destructive" onClick={remove}><Trash2 className="h-4 w-4 mr-2" />Delete dating profile</Button>}
      </Card>
    </AppShell>
  );
};

export default DatingEdit;
