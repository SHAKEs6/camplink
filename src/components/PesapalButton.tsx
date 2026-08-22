import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone } from "lucide-react";
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
};

export const PesapalButton = ({ kind, sellerId, listingId, quantity = 1, amount, disabled, label = "Pay with M-Pesa / Card", className }: Props) => {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("pesapal-create-order", {
      body: { kind, seller_id: sellerId, listing_id: listingId, quantity, amount, origin: window.location.origin },
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
      errMsg = errMsg || error.message || "Could not start PesaPal checkout";
    } else if ((data as any)?.error) {
      errMsg = (data as any).error;
    }
    if (errMsg) { setLoading(false); toast.error(errMsg); return; }
    window.location.href = (data as any).redirect_url;
  };

  return (
    <Button
      type="button"
      className={className ?? "w-full gradient-accent font-bold"}
      onClick={start}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
};
