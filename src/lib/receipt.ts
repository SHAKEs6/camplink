import { jsPDF } from "jspdf";

type ReceiptOrder = {
  id: string;
  buyer_name?: string | null;
  amount: number;
  quantity: number;
  status: string;
  provider: string;
  mpesa_receipt?: string | null;
  created_at: string;
  location?: string | null;
  pickup_station?: string | null;
  delivery_method?: string | null;
  delivery_address?: string | null;
};

export const downloadReceipt = (order: ReceiptOrder, title: string) => {
  const pdf = new jsPDF();
  const margin = 20;
  let y = 24;
  const add = (label: string, value: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "normal");
    const wrapped = pdf.splitTextToSize(value, 150);
    pdf.text(wrapped, margin + 42, y);
    y += Math.max(8, wrapped.length * 6);
  };

  pdf.setFillColor(18, 34, 52);
  pdf.rect(0, 0, 210, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Camplink Connect", margin, 18);
  pdf.setFontSize(12);
  pdf.text("Order receipt", margin, 29);
  pdf.setTextColor(25, 25, 25);
  pdf.setFontSize(11);
  y = 55;
  add("Order:", "Camplink marketplace order");
  add("Buyer:", order.buyer_name || "Camplink buyer");
  add("Date:", new Date(order.created_at).toLocaleString());
  add("Item:", title);
  add("Quantity:", String(order.quantity));
  add("Total:", `KSh ${Number(order.amount).toLocaleString()}`);
  add("Payment:", order.provider);
  add("Reference:", order.mpesa_receipt && !order.mpesa_receipt.startsWith("WALLET-") ? order.mpesa_receipt : "Wallet payment");
  y += 5;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margin, y, 190, y);
  y += 12;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Delivery details", margin, y);
  pdf.setFontSize(11);
  y += 12;
  add("Location:", order.location || "-");
  add("Station:", order.pickup_station || "-");
  add("Fulfilment:", order.delivery_method === "door" ? "Door delivery" : "Pickup station");
  if (order.delivery_address) add("Address:", order.delivery_address);
  y += 10;
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(90, 90, 90);
  pdf.text("Thank you for ordering with Camplink Connect.", margin, y);
  pdf.save("camplink-marketplace-receipt.pdf");
};