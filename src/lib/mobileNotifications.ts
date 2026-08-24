// Mobile notifications: separate channel from browser desktop notifications.
// Uses vibration + a beep + (on mobile) the Notification API tagged "mobile".
// Toggleable via localStorage key "mobile-notify".
import { getNotificationHref } from "@/lib/notificationLink";

const KEY = "mobile-notify";

export const isMobile = () => /Mobi|Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== "undefined" ? navigator.userAgent : ""
);

export const isMobileNotifyEnabled = () =>
  (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) !== "off";

export const setMobileNotifyEnabled = (on: boolean) => {
  localStorage.setItem(KEY, on ? "on" : "off");
};

let audioCtx: AudioContext | null = null;
const beep = () => {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880; o.type = "sine";
    g.gain.value = 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.18);
  } catch { /* noop */ }
};

export const showMobileNotification = (title: string, body?: string, link?: string) => {
  if (!isMobile() || !isMobileNotifyEnabled()) return;
  if ("vibrate" in navigator) navigator.vibrate([120, 60, 120]);
  beep();
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const href = getNotificationHref(link);
      const n = new Notification("📱 " + title, { body, icon: "/favicon.png", tag: "mobile-" + href, silent: false });
      n.onclick = () => { window.focus(); window.location.href = href; n.close(); };
    } catch { /* noop */ }
  }
};
