// Request and show native browser notifications
import { getNotificationHref } from "@/lib/notificationLink";

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
};

export const showBrowserNotification = (title: string, body?: string, link?: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible" && !link) {
    // skip when tab visible to avoid being annoying for in-app toasts
  }
  try {
    const href = getNotificationHref(link);
    const n = new Notification(title, { body, icon: "/favicon.png", badge: "/favicon.png", tag: href });
    if (href) {
      n.onclick = () => {
        window.focus();
        window.location.href = href;
        n.close();
      };
    }
  } catch { /* noop */ }
};
