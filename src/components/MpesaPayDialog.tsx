import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  listingId: string;
  price: number;
  title: string;
  quantity?: number;
  trigger?: React.ReactNode;
};

type Status = "idle" | "pushing" | "pending" | "paid" | "failed" | "cancelled";

export const MpesaPayDialog = ({ listingId, price, title, quantity = 1, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!open) {
      setStatus("idle"); setOrderId(null); setMsg("");
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [open]);

  const startPolling = (id: string) => {
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries++;
      const { data } = await supabase.from("orders").select("status, result_desc, mpesa_receipt").eq("id", id).maybeSingle();
      if (data && data.status !== "pending") {
        setStatus(data.status as Status);
        setMsg(data.mpesa_receipt ? `Receipt: ${data.mpesa_receipt}` : (data.result_desc || ""));
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      }
      if (tries > 40 && pollRef.current) { // ~2 minutes
        window.clearInterval(pollRef.current); pollRef.current = null;
      }
    }, 3000);
  };

  const pay = async () => {
    if (!/^(\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ""))) {
      toast.error("Enter a valid Kenyan number e.g. 07XXXXXXXX");
      return;
    }
    setStatus("pushing"); setMsg("");
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { listing_id: listingId, phone, quantity },
    });
    if (error || (data as any)?.error) {
      setStatus("failed");
      const m = (data as any)?.error || error?.message || "Failed to start payment";
      setMsg(m);
      toast.error(m);
      return;
    }
    const oid = (data as any).order_id as string;
    setOrderId(oid);
    setStatus("pending");
    setMsg((data as any).customer_message || "Check your phone for the M-Pesa prompt");
    startPolling(oid);
  };

  const total = price * quantity;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="h-7 text-[11px] gradient-accent">
            <Smartphone className="h-3 w-3 mr-1" />Buy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Pay with M-Pesa</DialogTitle>
          <DialogDescription className="line-clamp-2">{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-secondary/30 p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-extrabold text-primary">KSh {total.toLocaleString()}</span>
          </div>

          {status === "idle" || status === "failed" || status === "cancelled" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="mp-phone">M-Pesa phone number</Label>
                <Input id="mp-phone" inputMode="tel" placeholder="07XXXXXXXX or 2547XXXXXXXX"
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {msg && <p className="text-xs text-destructive">{msg}</p>}
              <Button className="w-full gradient-accent" onClick={pay} disabled={!phone}>
                <Smartphone className="h-4 w-4 mr-2" />Send STK push
              </Button>
            </>
          ) : status === "pushing" ? (
            <div className="text-center py-6"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="mt-2 text-sm">Sending request…</p></div>
          ) : status === "pending" ? (
            <div className="text-center py-6">
              <Clock className="h-8 w-8 mx-auto text-primary animate-pulse" />
              <p className="mt-2 text-sm font-medium">Awaiting your confirmation</p>
              <p className="text-xs text-muted-foreground mt-1">{msg || "Enter your M-Pesa PIN on your phone."}</p>
            </div>
          ) : status === "paid" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
              <p className="mt-2 font-semibold">Payment received</p>
              {msg && <p className="text-xs text-muted-foreground mt-1">{msg}</p>}
              <Button className="w-full mt-3" variant="outline" onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground text-center">Powered by Safaricom Daraja</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
