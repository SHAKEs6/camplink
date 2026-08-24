import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  kind: "contact_unlock" | "purchase" | "wallet_topup";
  sellerId?: string;
  listingId?: string;
  quantity?: number;
  amount?: number; // KSh, wallet_topup only
  disabled?: boolean;
  label?: string;
  className?: string;
  delivery?: { location: string; pickup_station: string; delivery_method: string; address: string; latitude?: number | null; longitude?: number | null; promo_code?: string };
  beforeStart?: () => boolean;
};

export const PayPalButton = ({ kind, sellerId, listingId, quantity = 1, amount, disabled, label = "Pay with PayPal", className, delivery, beforeStart }: Props) => {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (beforeStart && !beforeStart()) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("paypal-create-order", {
      body: { kind, seller_id: sellerId, listing_id: listingId, quantity, amount, ...delivery, origin: window.location.origin },
    });
    let errMsg: string | null = null;
    if (error) {
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const b = await ctx.json();
          errMsg = b?.error || b?.message || null;
        }
      } catch { /* ignore */ }
      errMsg = errMsg || error.message || "Could not start PayPal checkout";
    } else if ((data as any)?.error) {
      errMsg = (data as any).error;
    }
    if (errMsg) { setLoading(false); toast.error(errMsg); return; }
    window.location.href = (data as any).approve_url;
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "w-full border-[#003087]/40 bg-[#ffc439] text-[#003087] hover:bg-[#f0b429] hover:text-[#003087] font-bold"}
      onClick={start}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
      {label}
    </Button>
  );
};
