// Detect platform from URL and return iframe embed info, or null for direct video file
export type EmbedInfo = {
  platform: "youtube" | "tiktok" | "instagram" | "facebook" | "twitter" | "vimeo" | "video";
  embedUrl?: string;
  videoUrl?: string;
};

export const detectReel = (raw: string): EmbedInfo | null => {
  const url = raw.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube (incl. Shorts)
    if (host.includes("youtube.com") || host === "youtu.be") {
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1);
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
      else id = u.searchParams.get("v") ?? "";
      if (!id) return null;
      return { platform: "youtube", embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${id}` };
    }

    // TikTok
    if (host.includes("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      const id = m?.[1];
      if (!id) return null;
      return { platform: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${id}` };
    }

    // Instagram reel/post
    if (host.includes("instagram.com")) {
      const m = u.pathname.match(/\/(reel|p|tv)\/([^/]+)/);
      const id = m?.[2];
      if (!id) return null;
      return { platform: "instagram", embedUrl: `https://www.instagram.com/p/${id}/embed/?autoplay=1` };
    }

    // Facebook
    if (host.includes("facebook.com") || host.includes("fb.watch")) {
      return { platform: "facebook", embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=1` };
    }

    // X / Twitter
    if (host.includes("twitter.com") || host === "x.com" || host.endsWith(".x.com")) {
      return { platform: "twitter", embedUrl: `https://platform.twitter.com/embed/Tweet.html?url=${encodeURIComponent(url)}` };
    }

    // Vimeo
    if (host.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (!id) return null;
      return { platform: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&loop=1&playsinline=1` };
    }

    // Direct video file
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u.pathname)) {
      return { platform: "video", videoUrl: url };
    }

    return null;
  } catch {
    return null;
  }
};
