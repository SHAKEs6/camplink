import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  listingId: string;
  price: number;
  title: string;
  quantity?: number;
  trigger?: React.ReactNode;
};

export const BuyDialog = ({ listingId, price, title, quantity = 1, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = price * quantity;

  const buyWithWallet = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("wallet_cash_purchase" as any, { _listing_id: listingId, _quantity: quantity });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Purchase successful"); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="h-7 text-[11px] gradient-accent">
            <ShoppingBag className="h-3 w-3 mr-1" />Buy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" />Buy online</DialogTitle>
          <DialogDescription className="line-clamp-2">{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-secondary/30 p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total{quantity > 1 ? ` (${quantity}×)` : ""}</span>
            <span className="text-xl font-extrabold text-primary">KSh {total.toLocaleString()}</span>
          </div>

          <Button className="w-full gradient-accent" disabled={busy} onClick={buyWithWallet}>Pay KSh {total.toLocaleString()} from wallet</Button>
          <p className="text-[10px] text-muted-foreground text-center">Wallet funds can be used only for Camplink marketplace purchases.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
