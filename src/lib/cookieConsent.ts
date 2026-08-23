export type CookieConsent = { analytics: boolean; preferences: boolean; marketing: boolean };

export const defaultCookieConsent: CookieConsent = { analytics: false, preferences: false, marketing: false };
export const cookieConsentName = "camplink_cookie_consent";

export const encodeCookieConsent = (consent: CookieConsent) => encodeURIComponent(JSON.stringify(consent));

export const decodeCookieConsent = (value: string | undefined): CookieConsent | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<CookieConsent>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.preferences !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return { analytics: parsed.analytics, preferences: parsed.preferences, marketing: parsed.marketing };
  } catch {
    return null;
  }
};
