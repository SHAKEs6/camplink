import { useEffect, useRef } from "react";
import { useTheme, saveTheme, getTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";

export type Track = { type: "file" | "youtube" | "spotify"; url: string; name?: string };

export const parsePlaylist = (raw?: string): Track[] => {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.slice(0, 20) : []; } catch { return []; }
};

/** Hidden global music player. Admin is authoritative for advancing tracks; everyone syncs. */
export const MusicPlayer = () => {
  const t = useTheme();
  const { isAdmin } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  const playlist = parsePlaylist(t["music-playlist"]);
  const idx = Math.max(0, Math.min(playlist.length - 1, parseInt(t["music-index"] || "0", 10) || 0));
  const current: Track | undefined = playlist[idx] ?? (t["music-url"] ? { type: (t["music-type"] as any) || "file", url: t["music-url"] } : undefined);
  const playing = t["music-playing"] === "1";
  const volume = Math.max(0, Math.min(1, parseFloat(t["music-volume"] || "0.5")));
  const startedAt = t["music-started-at"] ? new Date(t["music-started-at"]).getTime() : 0;

  // Apply src / sync position / playback state for FILE tracks
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (current.type !== "file" || !playing) { a.pause(); return; }

    if (a.src !== current.url) a.src = current.url;
    a.loop = false;
    a.volume = volume;

    const sync = () => {
      if (!startedAt) return;
      const offset = (Date.now() - startedAt) / 1000;
      if (isFinite(a.duration) && offset > 0 && offset < a.duration) {
        if (Math.abs(a.currentTime - offset) > 1.5) a.currentTime = offset;
      }
      a.play().catch(() => {});
    };
    if (a.readyState >= 1) sync();
    else a.addEventListener("loadedmetadata", sync, { once: true });
  }, [current?.url, current?.type, playing, startedAt, volume]);

  // Keep volume reactive
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  // Re-attempt play on first user interaction (autoplay block)
  useEffect(() => {
    if (!playing || current?.type !== "file") return;
    const tryPlay = () => audioRef.current?.play().catch(() => {});
    window.addEventListener("click", tryPlay, { once: true });
    window.addEventListener("touchstart", tryPlay, { once: true });
    return () => { window.removeEventListener("click", tryPlay); window.removeEventListener("touchstart", tryPlay); };
  }, [playing, current?.url, current?.type]);

  // Any client advances to the next track when current ends → broadcasts to all.
  // Server-side debounce prevents stampede when multiple clients fire near-simultaneously.
  const onEnded = async () => {
    if (playlist.length === 0) return;
    if (isAdmin) {
      const next = (idx + 1) % playlist.length;
      await saveTheme({ ...getTheme(), "music-index": String(next), "music-started-at": new Date().toISOString(), "music-playing": "1" });
    } else {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.rpc("advance_music" as any);
    }
  };

  // Hidden iframe embeds for YouTube / Spotify (no per-second sync possible)
  const renderEmbed = () => {
    if (!playing || !current) return null;
    if (current.type === "youtube") {
      const id = extractYouTubeId(current.url); if (!id) return null;
      const src = `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&controls=0`;
      return <iframe title="bg-music" src={src} allow="autoplay" style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999 }} />;
    }
    if (current.type === "spotify") {
      const embed = toSpotifyEmbed(current.url); if (!embed) return null;
      return <iframe title="bg-music" src={embed} allow="autoplay" style={{ position: "fixed", width: 1, height: 80, opacity: 0, pointerEvents: "none", left: -9999 }} />;
    }
    return null;
  };

  return (
    <>
      <audio ref={audioRef} hidden onEnded={onEnded} />
      {renderEmbed()}
    </>
  );
};

const extractYouTubeId = (u: string): string | null => {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const parts = url.pathname.split("/");
    const i = parts.findIndex(p => p === "embed" || p === "shorts");
    if (i >= 0) return parts[i + 1] ?? null;
  } catch { /* ignore */ }
  return null;
};

const toSpotifyEmbed = (u: string): string | null => {
  try {
    const url = new URL(u);
    if (!url.hostname.includes("spotify.com")) return null;
    return `https://open.spotify.com${url.pathname.startsWith("/embed") ? "" : "/embed"}${url.pathname}`;
  } catch { return null; }
};
