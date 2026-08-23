export type DeliveryDetails = { location: string; pickup_station: string; delivery_method: "pickup" | "door"; address: string };

export const validateDeliveryDetails = (delivery: DeliveryDetails): string | null => {
  if (!delivery.location.trim() || !delivery.pickup_station.trim()) return "Choose your location and pickup station";
  if (delivery.delivery_method === "door" && !delivery.address.trim()) return "Enter your door delivery address";
  return null;
};
