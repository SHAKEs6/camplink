export type Platform = "ios" | "android" | "web";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

export function applyPlatformClass() {
  const p = detectPlatform();
  const root = document.documentElement;
  root.classList.remove("platform-ios", "platform-android", "platform-web");
  root.classList.add(`platform-${p}`);
  return p;
}
