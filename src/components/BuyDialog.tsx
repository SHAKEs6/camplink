import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PesapalButton } from "./PesapalButton";
import { PayPalButton } from "./PayPalButton";
import { downloadReceipt } from "@/lib/receipt";

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
  const [location, setLocation] = useState("");
  const [pickupStation, setPickupStation] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "door">("pickup");
  const [address, setAddress] = useState("");
  const total = price * quantity;

  const delivery = { location: location.trim(), pickup_station: pickupStation.trim(), delivery_method: deliveryMethod, address: address.trim() };

  const validateDelivery = () => {
    if (!delivery.location || !delivery.pickup_station) {
      toast.error("Choose your location and pickup station");
      return false;
    }
    if (deliveryMethod === "door" && !delivery.address) {
      toast.error("Enter your door delivery address");
      return false;
    }
    return true;
  };

  const buyWithWallet = async () => {
    if (!validateDelivery()) return;
    setBusy(true);
    const { data: orderId, error } = await supabase.rpc("wallet_cash_purchase" as any, { _listing_id: listingId, _quantity: quantity, _location: delivery.location, _pickup_station: delivery.pickup_station, _delivery_method: delivery.delivery_method, _address: delivery.address || null });
    setBusy(false);
    if (error) toast.error(error.message); else {
      const { data: order } = await supabase.from("orders").select("id,amount,quantity,status,provider,mpesa_receipt,created_at,location,pickup_station,delivery_method,delivery_address").eq("id", orderId).maybeSingle();
      if (order) downloadReceipt(order, title);
      toast.success("Order successful"); setOpen(false);
    }
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

          <div className="space-y-2">
            <Label className="text-xs">Choose your location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="County / city / area" />
            <Label className="text-xs">Pickup station</Label>
            <Input value={pickupStation} onChange={e => setPickupStation(e.target.value)} placeholder="Station or landmark" />
            <Label className="text-xs">Fulfilment</Label>
            <Select value={deliveryMethod} onValueChange={(value: "pickup" | "door") => setDeliveryMethod(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pickup">Pickup station</SelectItem><SelectItem value="door">Door delivery</SelectItem></SelectContent>
            </Select>
            {deliveryMethod === "door" && <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Full delivery address" rows={2} />}
          </div>

          <Button className="w-full gradient-accent" disabled={busy} onClick={buyWithWallet}>Order and pay KSh {total.toLocaleString()} from wallet</Button>
          <PesapalButton kind="purchase" listingId={listingId} quantity={quantity} delivery={delivery} label="Order with M-Pesa / Card" />
          <PayPalButton kind="purchase" listingId={listingId} quantity={quantity} delivery={delivery} label="Order with PayPal" />
          <p className="text-[10px] text-muted-foreground text-center">Your delivery details are shared with the seller only after payment.</p>
          <p className="text-[10px] text-muted-foreground text-center">Wallet funds can be used only for Camplink marketplace purchases.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
