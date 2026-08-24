import { describe, expect, it } from "vitest";
import { decodeCookieConsent, defaultCookieConsent, encodeCookieConsent } from "@/lib/cookieConsent";
import { validateDeliveryDetails } from "@/lib/orderValidation";
import { getNotificationHref } from "@/lib/notificationLink";

describe("cookie consent", () => {
  it("round trips only the three optional categories", () => {
    const value = { analytics: true, preferences: false, marketing: true };
    expect(decodeCookieConsent(encodeCookieConsent(value))).toEqual(value);
  });

  it("rejects malformed or incomplete consent values", () => {
    expect(decodeCookieConsent("%7B%22analytics%22%3Atrue%7D")).toBeNull();
    expect(decodeCookieConsent(undefined)).toBeNull();
    expect(defaultCookieConsent).toEqual({ analytics: false, preferences: false, marketing: false });
  });
});

describe("order delivery validation", () => {
  it("requires location and pickup station for wallet orders", () => {
    expect(validateDeliveryDetails({ location: "", pickup_station: "", delivery_method: "pickup", address: "" })).toBeTruthy();
    expect(validateDeliveryDetails({ location: "Nairobi", pickup_station: "CBD", delivery_method: "pickup", address: "" })).toBeNull();
  });

  it("requires an address for door delivery", () => {
    expect(validateDeliveryDetails({ location: "Nairobi", pickup_station: "CBD", delivery_method: "door", address: "" })).toBeTruthy();
  });
});

describe("notification links", () => {
  it("keeps valid internal destinations and their query strings", () => {
    expect(getNotificationHref("/chat?c=conversation-id")).toBe("/chat?c=conversation-id");
  });

  it("falls back to the dashboard for missing or external destinations", () => {
    expect(getNotificationHref(null)).toBe("/dashboard");
    expect(getNotificationHref("https://example.com")).toBe("/dashboard");
  });
});