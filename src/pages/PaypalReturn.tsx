import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PaypalReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "paid" | "failed" | "cancelled">("working");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<string>("");

  useEffect(() => { document.title = "PayPal payment — Camplink"; }, []);

  useEffect(() => {
    const orderId = params.get("order");
    const cancel = params.get("cancel") === "1";
    if (!orderId) { setStatus("failed"); setMsg("Missing order reference."); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
        body: { order_id: orderId, cancel },
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
        errMsg = errMsg || error.message || "Payment could not be confirmed";
      }
      if (errMsg) { setStatus("failed"); setMsg(errMsg); return; }
      const s = (data as any)?.status;
      setKind((data as any)?.kind || "");
      if (s === "paid") { setStatus("paid"); setMsg((data as any)?.receipt ? `Receipt: ${(data as any).receipt}` : ""); setTimeout(() => navigate("/", { replace: true }), 1800); }
      else if (s === "cancelled") { setStatus("cancelled"); setMsg("You cancelled the payment."); }
      else { setStatus("failed"); setMsg((data as any)?.error || "Payment failed."); }
    })();
  }, [params, navigate]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto py-10 px-4">
        <Card className="gradient-card p-8 text-center space-y-3">
          {status === "working" && (
            <>
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
              <p className="font-semibold">Confirming your PayPal payment…</p>
              <p className="text-xs text-muted-foreground">Please don't close this page.</p>
            </>
          )}
          {status === "paid" && (
            <>
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="text-lg font-semibold">Payment successful</p>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
              <Button className="w-full gradient-accent" onClick={() => navigate("/")}>
                Continue
              </Button>
            </>
          )}
          {(status === "failed" || status === "cancelled") && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-lg font-semibold">{status === "cancelled" ? "Payment cancelled" : "Payment failed"}</p>
              {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Back to home</Button>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
};

export default PaypalReturn;
