// Extract a vibrant dominant color from an image URL (client-side, no deps).
export const extractDominantHex = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 48;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets: Record<string, { r: number; g: number; b: number; n: number; score: number }> = {};
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          // skip near-white / near-black / near-gray
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.25) continue;
          if (max < 40 || min > 230) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bk = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, n: 0, score: 0 });
          bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.score += sat;
        }
        const list = Object.values(buckets).sort((a, b) => b.score - a.score);
        const top = list[0];
        if (!top) return resolve("#7c3aed");
        const r = Math.round(top.r / top.n), g = Math.round(top.g / top.n), b = Math.round(top.b / top.n);
        const hex = "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("");
        resolve(hex);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });

// Shift a hex color's lightness for a glow variant. Returns hex.
export const shiftLightness = (hex: string, delta: number): string => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  const nl = Math.min(1, Math.max(0, l + delta));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let nr = nl, ng = nl, nb = nl;
  if (s !== 0) {
    const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
    const p = 2 * nl - q;
    nr = hue2rgb(p, q, h + 1/3); ng = hue2rgb(p, q, h); nb = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
};

// Complementary accent (hue rotate 150°)
export const complementHex = (hex: string): string => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h = (h + 150 / 360) % 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let nr = l, ng = l, nb = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1/3); ng = hue2rgb(p, q, h); nb = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
};
