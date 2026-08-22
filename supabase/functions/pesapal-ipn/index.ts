import { createClient } from 'npm:@supabase/supabase-js@2';
import { pesapalFetch, fulfilOrder } from '../_shared/pesapal.ts';

// Public endpoint called by PesaPal servers (no JWT).
Deno.serve(async (req) => {
  const respond = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const url = new URL(req.url);
    let trackingId = url.searchParams.get('OrderTrackingId');
    let merchantRef = url.searchParams.get('OrderMerchantReference');
    let notificationType = url.searchParams.get('OrderNotificationType') || 'IPNCHANGE';

    if (!trackingId && req.method === 'POST') {
      const b = await req.json().catch(() => ({} as any));
      trackingId = b?.OrderTrackingId ?? null;
      merchantRef = b?.OrderMerchantReference ?? null;
      notificationType = b?.OrderNotificationType || notificationType;
    }
    if (!trackingId) return respond({ orderNotificationType: notificationType, status: 500 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order } = await admin.from('orders')
      .select('id, status').eq('pesapal_tracking_id', trackingId).maybeSingle();
    const orderId = order?.id || merchantRef;
    if (!orderId) return respond({ orderNotificationType: notificationType, orderTrackingId: trackingId, status: 500 });

    const res = await pesapalFetch(`/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`, { method: 'GET' });
    const code = Number(res.json?.status_code);
    const receipt = res.json?.confirmation_code || null;

    if (code === 1) {
      await fulfilOrder(admin, orderId, receipt, res.json);
    } else if (code === 2 || code === 3) {
      await admin.from('orders').update({
        status: 'failed',
        result_desc: res.json?.description || 'Payment failed',
        raw_callback: res.json,
      }).eq('id', orderId).neq('status', 'paid');
    }

    return respond({
      orderNotificationType: notificationType,
      orderTrackingId: trackingId,
      orderMerchantReference: merchantRef,
      status: 200,
    });
  } catch (e) {
    console.error('pesapal-ipn error', e);
    return respond({ status: 500 });
  }
});
