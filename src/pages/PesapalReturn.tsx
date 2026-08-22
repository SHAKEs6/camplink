import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PesapalReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "paid" | "failed" | "cancelled">("working");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<string>("");
  const tries = useRef(0);

  useEffect(() => { document.title = "Payment status — Camplink"; }, []);

  useEffect(() => {
    const orderId = params.get("order") || params.get("OrderMerchantReference");
    const cancel = params.get("cancel") === "1";
    if (!orderId) { setStatus("failed"); setMsg("Missing order reference."); return; }

    let stopped = false;
    const poll = async () => {
      const { data, error } = await supabase.functions.invoke("pesapal-status", {
        body: { order_id: orderId, cancel },
      });
      if (stopped) return;
      let errMsg: string | null = null;
      if (error) {
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const b = await ctx.json();
            errMsg = b?.error || b?.message || null;
          }
        } catch { /* ignore */ }
        errMsg = errMsg || error.message || "Payment could not be confirmed";
      }
      if (errMsg) { setStatus("failed"); setMsg(errMsg); return; }
      const s = (data as any)?.status;
      setKind((data as any)?.kind || "");
      if (s === "paid") { setStatus("paid"); setMsg((data as any)?.receipt ? `Receipt: ${(data as any).receipt}` : ""); return; }
      if (s === "cancelled") { setStatus("cancelled"); setMsg("You cancelled the payment."); return; }
      if (s === "failed") { setStatus("failed"); setMsg((data as any)?.error || "Payment failed."); return; }
      // pending — keep polling for up to ~1 minute
      tries.current += 1;
      if (tries.current < 20) setTimeout(poll, 3000);
      else { setStatus("failed"); setMsg("Still waiting on PesaPal. If you were charged, it will confirm shortly."); }
    };
    poll();
    return () => { stopped = true; };
  }, [params]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto py-10 px-4">
        <Card className="gradient-card p-8 text-center space-y-3">
          {status === "working" && (
            <>
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
              <p className="font-semibold">Confirming your payment…</p>
              <p className="text-xs text-muted-foreground">Please don't close this page.</p>
            </>
          )}
          {status === "paid" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="text-lg font-semibold">Payment successful</p>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
              <Button className="w-full gradient-accent" onClick={() => navigate(kind === "wallet_topup" ? "/wallet" : "/market")}>
                Continue
              </Button>
            </>
          )}
          {(status === "failed" || status === "cancelled") && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-lg font-semibold">{status === "cancelled" ? "Payment cancelled" : "Payment not confirmed"}</p>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
              <Button variant="outline" className="w-full" onClick={() => navigate("/market")}>Back to marketplace</Button>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default PesapalReturn;
