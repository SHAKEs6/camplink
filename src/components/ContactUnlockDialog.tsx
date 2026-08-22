import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useUnlockPrice } from "@/hooks/useContactUnlock";
import { PayPalButton } from "@/components/PayPalButton";
import { PesapalButton } from "@/components/PesapalButton";

type Props = {
  sellerId: string;
  listingId?: string;
  sellerName?: string;
  onUnlocked?: () => void;
  trigger?: React.ReactNode;
};

export const ContactUnlockDialog = ({ sellerId, listingId, sellerName, trigger }: Props) => {
  const price = useUnlockPrice();
  const [open, setOpen] = useState(false);

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

          <PesapalButton kind="contact_unlock" sellerId={sellerId} listingId={listingId} disabled={price < 1} label="M-Pesa / Card" />
          <PayPalButton kind="contact_unlock" sellerId={sellerId} listingId={listingId} disabled={price < 1} />
          {price < 1 && <p className="text-xs text-muted-foreground text-center">Admin hasn't set an unlock price yet.</p>}

          <p className="text-[10px] text-muted-foreground text-center">Secure checkout powered by PesaPal & PayPal</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

