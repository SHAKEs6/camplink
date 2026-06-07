import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hexToHsl, hslToHex, applyTheme, saveTheme, THEME_KEYS, ThemeMap } from "@/lib/theme";
import { extractDominantHex, shiftLightness, complementHex } from "@/lib/colorExtract";
import { parsePlaylist, Track } from "@/components/MusicPlayer";
import { Switch } from "@/components/ui/switch";
import { Palette, RotateCcw, Music, Play, Square, Image as ImageIcon, Sparkles, Plus, Trash2, SkipForward, SkipBack, Volume2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULTS: ThemeMap = {
  "primary": "252 84% 65%", "primary-glow": "270 90% 72%", "accent": "168 76% 52%",
  "background": "240 10% 6%", "card": "240 12% 10%",
};

const DECORATIONS = [
  { v: "none", label: "None" }, { v: "christmas", label: "🎄 Christmas" },
  { v: "halloween", label: "🎃 Halloween" }, { v: "valentine", label: "💖 Valentine" },
  { v: "newyear", label: "🎆 New Year" }, { v: "birthday", label: "🎂 Birthday" },
  { v: "easter", label: "🐰 Easter" },
];

const MAX_TRACKS = 20;

export const ThemeEditor = () => {
  const [theme, setTheme] = useState<ThemeMap>({});
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicLink, setMusicLink] = useState("");
  const [musicLinkType, setMusicLinkType] = useState<"youtube" | "spotify">("youtube");
  const [linkName, setLinkName] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("theme").eq("id", 1).maybeSingle()
      .then(({ data }) => setTheme((data?.theme as ThemeMap) ?? {}));
  }, []);

  const playlist: Track[] = parsePlaylist(theme["music-playlist"]);
  const idx = parseInt(theme["music-index"] || "0", 10) || 0;
  const volume = parseFloat(theme["music-volume"] || "0.5");

  const update = async (next: ThemeMap, msg?: string) => {
    setTheme(next);
    const { error } = await saveTheme(next);
    if (error) toast.error(error.message);
    else if (msg) toast.success(msg);
  };

  const setKey = (k: string, hex: string) => {
    const next = { ...theme, [k]: hexToHsl(hex) };
    setTheme(next); applyTheme(next);
  };

  const saveColors = async () => {
    setSaving(true);
    const { error } = await saveTheme(theme); setSaving(false);
    if (error) toast.error(error.message); else toast.success("Theme saved for everyone 🎨");
  };

  const reset = async () => {
    setTheme({}); applyTheme(DEFAULTS); await saveTheme({});
    toast.success("Reset"); location.reload();
  };

  const uploadTo = async (bucket: string, file: File, prefix: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const uploadFavicon = async (file: File) => {
    setUploadingIcon(true);
    try { const url = await uploadTo("avatars", file, "favicon"); await update({ ...theme, "favicon-url": url }, "Web icon updated 🖼️"); }
    catch (e: any) { toast.error(e.message); } finally { setUploadingIcon(false); }
  };

  const applyAutoFromUrl = async (url: string) => {
    try {
      const hex = await extractDominantHex(url);
      const glow = shiftLightness(hex, 0.12);
      const accent = complementHex(hex);
      return {
        "primary": hexToHsl(hex),
        "primary-glow": hexToHsl(glow),
        "accent": hexToHsl(accent),
      } as ThemeMap;
    } catch { return {} as ThemeMap; }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadTo("avatars", file, "logo");
      const auto = theme["auto-theme"] === "1" ? await applyAutoFromUrl(url) : {};
      await update({ ...theme, ...auto, "logo-url": url }, "App logo updated");
    }
    catch (e: any) { toast.error(e.message); } finally { setUploadingLogo(false); }
  };

  const reExtract = async () => {
    if (!theme["logo-url"]) { toast.error("Upload a logo first"); return; }
    const auto = await applyAutoFromUrl(theme["logo-url"]);
    if (!Object.keys(auto).length) { toast.error("Could not extract color"); return; }
    await update({ ...theme, ...auto }, "Theme synced to logo 🎨");
  };

  const savePlaylist = (tracks: Track[], extras: ThemeMap = {}) =>
    update({ ...theme, "music-playlist": JSON.stringify(tracks.slice(0, MAX_TRACKS)), ...extras });

  const addTrackFile = async (file: File) => {
    if (playlist.length >= MAX_TRACKS) { toast.error(`Max ${MAX_TRACKS} songs`); return; }
    setUploadingMusic(true);
    try {
      const url = await uploadTo("music", file, "track");
      const next = [...playlist, { type: "file" as const, url, name: file.name }];
      const startNow = playlist.length === 0;
      await savePlaylist(next, startNow ? { "music-index": "0", "music-started-at": new Date().toISOString(), "music-playing": "1" } : {});
      toast.success(`Added "${file.name}"`);
    } catch (e: any) { toast.error(e.message); } finally { setUploadingMusic(false); }
  };

  const addTrackLink = async () => {
    if (!musicLink.trim()) { toast.error("Paste a link"); return; }
    if (playlist.length >= MAX_TRACKS) { toast.error(`Max ${MAX_TRACKS} songs`); return; }
    const next = [...playlist, { type: musicLinkType, url: musicLink.trim(), name: linkName.trim() || musicLinkType }];
    const startNow = playlist.length === 0;
    await savePlaylist(next, startNow ? { "music-index": "0", "music-started-at": new Date().toISOString(), "music-playing": "1" } : {});
    setMusicLink(""); setLinkName(""); toast.success("Added");
  };

  const removeTrack = async (i: number) => {
    const next = playlist.filter((_, j) => j !== i);
    let extras: ThemeMap = {};
    if (next.length === 0) extras = { "music-playing": "0", "music-index": "0" };
    else if (i === idx) extras = { "music-index": "0", "music-started-at": new Date().toISOString() };
    else if (i < idx) extras = { "music-index": String(idx - 1) };
    await savePlaylist(next, extras);
  };

  const playAt = (i: number) => update({ ...theme, "music-index": String(i), "music-started-at": new Date().toISOString(), "music-playing": "1" }, "Now syncing to all users 🎵");
  const next = () => playlist.length && playAt((idx + 1) % playlist.length);
  const prev = () => playlist.length && playAt((idx - 1 + playlist.length) % playlist.length);
  const togglePlay = () => {
    const wasPlaying = theme["music-playing"] === "1";
    update({ ...theme, "music-playing": wasPlaying ? "0" : "1", ...(wasPlaying ? {} : { "music-started-at": new Date().toISOString() }) });
  };
  const stopMusic = () => update({ ...theme, "music-playing": "0" }, "Stopped");
  const setVolume = (v: number) => update({ ...theme, "music-volume": String(v) });

  return (
    <Card className="gradient-card p-4 space-y-4 mb-4">
      <div>
        <p className="font-semibold text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> App theme & colors</p>
        <p className="text-xs text-muted-foreground">Pick colors — every user sees them live.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {THEME_KEYS.map(k => {
          const hsl = theme[k] || DEFAULTS[k];
          return (
            <div key={k}>
              <Label className="text-xs capitalize">{k.replace("-", " ")}</Label>
              <div className="flex gap-2 items-center">
                <Input type="color" value={hslToHex(hsl)} onChange={e => setKey(k, e.target.value)} className="h-9 w-14 p-1" />
                <span className="text-[10px] text-muted-foreground truncate">{hsl}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-xs flex items-center gap-2"><ImageIcon className="h-3 w-3" /> Top-left app logo</Label>
        <div className="flex items-center gap-2">
          {theme["logo-url"] && <img src={theme["logo-url"]} alt="logo" className="h-10 w-10 rounded object-cover" />}
          <Input type="file" accept="image/*" disabled={uploadingLogo}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3 w-3 text-accent" />
            <Label className="text-xs">Auto theme — match colors to logo</Label>
          </div>
          <Switch checked={theme["auto-theme"] === "1"}
            onCheckedChange={(v) => update({ ...theme, "auto-theme": v ? "1" : "0" }, v ? "Auto theme on" : "Custom theme on")} />
        </div>
        {theme["auto-theme"] === "1" && (
          <Button size="sm" variant="outline" className="w-full" onClick={reExtract}>
            <Wand2 className="h-3 w-3 mr-1" />Re-sync theme to current logo
          </Button>
        )}
        <Label className="text-xs">App name (optional)</Label>
        <div className="flex gap-2">
          <Input value={theme["app-name"] ?? ""} placeholder="Camplink" onChange={e => setTheme({ ...theme, "app-name": e.target.value })} />
          <Button size="sm" onClick={() => update(theme, "Name updated")}>Save</Button>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <Label className="text-xs">🖼️ Web icon (favicon)</Label>
        <div className="flex items-center gap-2 mt-1">
          {theme["favicon-url"] && <img src={theme["favicon-url"]} alt="icon" className="h-8 w-8 rounded" />}
          <Input type="file" accept="image/*" disabled={uploadingIcon}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFavicon(f); }} />
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-xs flex items-center gap-2"><Sparkles className="h-3 w-3" /> Decorations / holiday theme</Label>
        <Select value={theme["decoration"] ?? "none"} onValueChange={v => update({ ...theme, "decoration": v }, "Decoration updated ✨")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{DECORATIONS.map(d => <SelectItem key={d.v} value={d.v}>{d.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2"><Music className="h-4 w-4" /> Synced playlist (plays for ALL users)</p>
        <p className="text-[11px] text-muted-foreground">Up to {MAX_TRACKS} songs. Uploaded files sync exactly (same track + timestamp). YouTube/Spotify links autoplay but can't be position-synced.</p>

        <div className="rounded-md bg-secondary/40 p-2 space-y-1 max-h-60 overflow-y-auto">
          {playlist.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No tracks yet</p>}
          {playlist.map((tr, i) => (
            <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-xs ${i === idx ? "bg-primary/20" : ""}`}>
              <span className="w-6 text-center text-muted-foreground">{i + 1}</span>
              <button className="flex-1 truncate text-left" onClick={() => playAt(i)}>{tr.name || tr.url} <span className="text-muted-foreground">· {tr.type}</span></button>
              {i === idx && theme["music-playing"] === "1" && <span className="text-[10px] text-primary">▶</span>}
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeTrack(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <Button size="sm" variant="outline" onClick={prev} disabled={playlist.length < 2}><SkipBack className="h-3 w-3" /></Button>
          <Button size="sm" onClick={togglePlay} disabled={playlist.length === 0} className="flex-1">
            {theme["music-playing"] === "1" ? <><Square className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Play</>}
          </Button>
          <Button size="sm" variant="outline" onClick={next} disabled={playlist.length < 2}><SkipForward className="h-3 w-3" /></Button>
          <Button size="sm" variant="outline" onClick={stopMusic}>Stop</Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-2"><Volume2 className="h-3 w-3" /> Volume — {Math.round(volume * 100)}%</Label>
          <Slider value={[volume * 100]} max={100} step={1} onValueChange={v => setVolume(v[0] / 100)} />
        </div>

        <div className="border-t border-border/50 pt-2 space-y-2">
          <Label className="text-xs flex items-center gap-2"><Plus className="h-3 w-3" /> Add audio file</Label>
          <Input type="file" accept="audio/*" disabled={uploadingMusic || playlist.length >= MAX_TRACKS}
            onChange={e => { const f = e.target.files?.[0]; if (f) addTrackFile(f); e.currentTarget.value = ""; }} />

          <Label className="text-xs">Or add YouTube / Spotify link</Label>
          <div className="flex gap-2">
            <Input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Name (optional)" className="w-32" />
            <Input value={musicLink} onChange={e => setMusicLink(e.target.value)} placeholder="https://…" />
            <Select value={musicLinkType} onValueChange={(v: any) => setMusicLinkType(v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="spotify">Spotify</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addTrackLink} disabled={playlist.length >= MAX_TRACKS}>Add</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">{playlist.length}/{MAX_TRACKS} songs</p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-border pt-3">
        <Button className="flex-1 gradient-accent" onClick={saveColors} disabled={saving}>{saving ? "Saving…" : "Apply colors for everyone"}</Button>
        <Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
      </div>
    </Card>
  );
};
