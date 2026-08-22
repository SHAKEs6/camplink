import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { PayPalButton } from "@/components/PayPalButton";
import { PesapalButton } from "@/components/PesapalButton";

type Props = {
  listingId: string;
  price: number;
  title: string;
  quantity?: number;
  trigger?: React.ReactNode;
};

export const BuyDialog = ({ listingId, price, title, quantity = 1, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const total = price * quantity;

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

          <PesapalButton kind="purchase" listingId={listingId} quantity={quantity} label="M-Pesa / Card" />
          <PayPalButton kind="purchase" listingId={listingId} quantity={quantity} label="Pay with PayPal" />

          <p className="text-[10px] text-muted-foreground text-center">Secure checkout powered by PesaPal & PayPal</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
