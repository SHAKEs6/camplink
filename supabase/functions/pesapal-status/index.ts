import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { pesapalFetch, fulfilOrder } from '../_shared/pesapal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.order_id;
    if (!orderId) return json({ error: 'order_id required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order } = await admin.from('orders')
      .select('id, buyer_id, kind, amount, status, provider, pesapal_tracking_id, mpesa_receipt')
      .eq('id', orderId).maybeSingle();

    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.buyer_id !== userId) return json({ error: 'Not your order' }, 403);
    if (order.provider !== 'pesapal' || !order.pesapal_tracking_id) return json({ error: 'Not a PesaPal order' }, 400);
    if (order.status === 'paid') return json({ status: 'paid', receipt: order.mpesa_receipt, kind: order.kind, amount: order.amount });

    const res = await pesapalFetch(`/Transactions/GetTransactionStatus?orderTrackingId=${order.pesapal_tracking_id}`, { method: 'GET' });
    const code = Number(res.json?.status_code); // 0 invalid, 1 completed, 2 failed, 3 reversed
    const receipt = res.json?.confirmation_code || null;
    const desc = res.json?.description || res.json?.payment_status_description || '';

    if (code === 1) {
      const done = await fulfilOrder(admin, order.id, receipt, res.json);
      return json({ status: 'paid', receipt, kind: (done as any).kind || order.kind, amount: order.amount });
    }

    if (code === 2 || code === 3 || body?.cancel) {
      const status = body?.cancel && code !== 2 ? 'cancelled' : 'failed';
      await admin.from('orders').update({
        status,
        result_desc: desc || (status === 'cancelled' ? 'Cancelled at PesaPal' : 'Payment failed'),
        raw_callback: res.json,
      }).eq('id', order.id);
      return json({ status, error: desc || undefined });
    }

    return json({ status: 'pending', message: desc || 'Waiting for confirmation' });
  } catch (e) {
    console.error('pesapal-status error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
