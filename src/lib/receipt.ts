type ReceiptOrder = {
  id: string;
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
  const lines = [
    "Camplink order receipt",
    "======================",
    `Order: ${order.id}`,
    `Date: ${new Date(order.created_at).toLocaleString()}`,
    `Item: ${title}`,
    `Quantity: ${order.quantity}`,
    `Total: KSh ${Number(order.amount).toLocaleString()}`,
    `Payment: ${order.provider}`,
    `Payment reference: ${order.mpesa_receipt || "Pending"}`,
    "",
    `Location: ${order.location || "-"}`,
    `Pickup station: ${order.pickup_station || "-"}`,
    `Fulfilment: ${order.delivery_method === "door" ? "Door delivery" : "Pickup station"}`,
    ...(order.delivery_address ? [`Address: ${order.delivery_address}`] : []),
    "",
    "Thank you for ordering with Camplink.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `camplink-receipt-${order.id.slice(0, 8)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};