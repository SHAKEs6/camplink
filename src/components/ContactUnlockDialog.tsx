import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, CheckCircle2, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnlockPrice } from "@/hooks/useContactUnlock";

type Props = {
  sellerId: string;
  listingId?: string;
  sellerName?: string;
  onUnlocked?: () => void;
  trigger?: React.ReactNode;
};

type Status = "idle" | "pushing" | "pending" | "paid" | "failed" | "cancelled";

export const ContactUnlockDialog = ({ sellerId, listingId, sellerName, onUnlocked, trigger }: Props) => {
  const price = useUnlockPrice();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (!open) {
      setStatus("idle"); setMsg("");
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [open]);

  const startPolling = (orderId: string) => {
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries++;
      const { data } = await supabase.from("orders").select("status, result_desc, mpesa_receipt").eq("id", orderId).maybeSingle();
      if (data && data.status !== "pending") {
        setStatus(data.status as Status);
        setMsg(data.mpesa_receipt ? `Receipt: ${data.mpesa_receipt}` : (data.result_desc || ""));
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        if (data.status === "paid") {
          onUnlocked?.();
          toast.success("Contact unlocked!");
          setTimeout(() => setOpen(false), 1500);
        }
      }
      if (tries > 40 && pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }, 3000);
  };

  const pay = async () => {
    if (!/^(\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ""))) {
      toast.error("Enter a valid Kenyan number e.g. 07XXXXXXXX");
      return;
    }
    setStatus("pushing"); setMsg("");
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { kind: "contact_unlock", seller_id: sellerId, listing_id: listingId, phone },
    });
    let errMsg: string | null = null;
    if (error) {
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          errMsg = body?.error || body?.message || null;
        }
      } catch {}
      errMsg = errMsg || error.message || "Failed to start payment";
    } else if ((data as any)?.error) {
      errMsg = (data as any).error;
    }
    if (errMsg) { setStatus("failed"); setMsg(errMsg); toast.error(errMsg); return; }
    setStatus("pending");
    setMsg((data as any).customer_message || "Check your phone for the M-Pesa prompt");
    startPolling((data as any).order_id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="h-8 text-xs gradient-accent">
            <Lock className="h-3 w-3 mr-1" />Unlock contact {price > 0 && `· KSh ${price}`}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Unlock seller contact</DialogTitle>
          <DialogDescription>
            Pay a one-time fee to reveal {sellerName ? sellerName + "'s" : "this seller's"} phone number, email, and start a chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-secondary/30 p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">One-time unlock</span>
            <span className="text-xl font-extrabold text-primary">KSh {price.toLocaleString()}</span>
          </div>

          {status === "idle" || status === "failed" || status === "cancelled" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="unlock-phone">M-Pesa phone number</Label>
                <Input id="unlock-phone" inputMode="tel" placeholder="07XXXXXXXX"
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {msg && <p className="text-xs text-destructive">{msg}</p>}
              <Button className="w-full gradient-accent" onClick={pay} disabled={!phone || price < 1}>
                <Smartphone className="h-4 w-4 mr-2" />Send STK push
              </Button>
              {price < 1 && <p className="text-xs text-muted-foreground text-center">Admin hasn't set an unlock price yet.</p>}
            </>
          ) : status === "pushing" ? (
            <div className="text-center py-6"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="mt-2 text-sm">Sending request…</p></div>
          ) : status === "pending" ? (
            <div className="text-center py-6">
              <Clock className="h-8 w-8 mx-auto text-primary animate-pulse" />
              <p className="mt-2 text-sm font-medium">Enter your M-Pesa PIN on your phone</p>
              <p className="text-xs text-muted-foreground mt-1">{msg}</p>
            </div>
          ) : status === "paid" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
              <p className="mt-2 font-semibold">Contact unlocked</p>
              {msg && <p className="text-xs text-muted-foreground mt-1">{msg}</p>}
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground text-center">Powered by Safaricom Daraja</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
