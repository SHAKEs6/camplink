import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { paypalFetch } from '../_shared/paypal.ts';

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
      .select('id, buyer_id, seller_id, listing_id, amount, kind, status, provider, paypal_order_id, mpesa_receipt')
      .eq('id', orderId).maybeSingle();

    if (!order) return json({ error: 'Order not found' }, 404);
    if (order.buyer_id !== userId) return json({ error: 'Not your order' }, 403);
    if (order.provider !== 'paypal' || !order.paypal_order_id) return json({ error: 'Not a PayPal order' }, 400);
    if (order.status === 'paid') return json({ status: 'paid', receipt: order.mpesa_receipt, kind: order.kind, amount: order.amount });
    if (body?.cancel) {
      await admin.from('orders').update({ status: 'cancelled', result_desc: 'Cancelled at PayPal' }).eq('id', order.id);
      return json({ status: 'cancelled' });
    }

    const res = await paypalFetch(`/v2/checkout/orders/${order.paypal_order_id}/capture`, { method: 'POST' });
    const already = !res.ok && String(res.json?.details?.[0]?.issue || '') === 'ORDER_ALREADY_CAPTURED';

    if (!res.ok && !already) {
      const desc = res.json?.details?.[0]?.description || res.json?.message || 'Capture failed';
      await admin.from('orders').update({ status: 'failed', result_desc: desc, raw_callback: res.json }).eq('id', order.id);
      console.error('paypal capture failed', JSON.stringify(res.json));
      return json({ status: 'failed', error: desc }, 400);
    }

    const capture = res.json?.purchase_units?.[0]?.payments?.captures?.[0];
    const receipt = capture?.id || res.json?.id || null;

    await admin.from('orders').update({
      status: 'paid',
      result_code: 0,
      result_desc: 'PayPal payment captured',
      mpesa_receipt: receipt,
      raw_callback: res.json,
    }).eq('id', order.id);

    // ---- Fulfilment (same rules as M-Pesa) ----
    const isUnlock = order.kind === 'contact_unlock';
    const notifs: any[] = [{
      user_id: order.buyer_id,
      title: isUnlock ? '🔓 Contact unlocked' : order.kind === 'wallet_topup' ? '💳 Wallet topped up' : '✅ Payment received',
      body: `KSh ${Number(order.amount).toLocaleString()} confirmed via PayPal${receipt ? ` (${receipt})` : ''}`,
      type: 'payment',
      link: isUnlock ? '/market' : '/wallet',
    }];

    if (isUnlock && order.seller_id) {
      await admin.from('contact_unlocks').insert({
        user_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: order.listing_id,
        amount: order.amount,
        order_id: order.id,
      });
      notifs.push({
        user_id: order.seller_id,
        title: '👀 Someone unlocked your contact',
        body: `A buyer paid KSh ${Number(order.amount).toLocaleString()} to reach you.`,
        type: 'payment', link: '/market',
      });
    } else if (order.kind === 'wallet_topup') {
      await admin.rpc('wallet_cash_credit', {
        _uid: order.buyer_id,
        _amount: Number(order.amount),
        _type: 'topup',
        _desc: 'PayPal money top-up (KSh)',
        _ref: order.id,
      });
    } else if (order.seller_id) {
      notifs.push({
        user_id: order.seller_id,
        title: '💰 New sale',
        body: `You received KSh ${Number(order.amount).toLocaleString()} via PayPal`,
        type: 'payment', link: '/wallet',
      });
    }

    await admin.from('notifications').insert(notifs);
    await admin.rpc('notify_order_seller', { _order_id: order.id });

    return json({ status: 'paid', receipt, kind: order.kind, amount: order.amount });
  } catch (e) {
    console.error('paypal-capture-order error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
