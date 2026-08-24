const NOTIFICATION_FALLBACK = "/dashboard";

export const getNotificationHref = (link: string | null | undefined) => {
  if (!link?.trim()) return NOTIFICATION_FALLBACK;

  try {
    const url = new URL(link, "https://camplink.local");
    if (url.origin !== "https://camplink.local") return NOTIFICATION_FALLBACK;
    return `${url.pathname}${url.search}${url.hash}` || NOTIFICATION_FALLBACK;
  } catch {
    return NOTIFICATION_FALLBACK;
  }
};