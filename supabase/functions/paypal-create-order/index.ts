import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { paypalFetch, usdFromKsh } from '../_shared/paypal.ts';

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
    const kind: string = ['contact_unlock', 'purchase', 'wallet_topup'].includes(body?.kind) ? body.kind : 'purchase';
    const origin: string = typeof body?.origin === 'string' && body.origin.startsWith('http') ? body.origin : '';
    if (!origin) return json({ error: 'origin required' }, 400);
    const qty = Math.max(1, Math.min(99, Number(body?.quantity || 1)));

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings } = await admin.from('app_settings').select('theme').eq('id', 1).maybeSingle();
    const theme = (settings?.theme as any) || {};
    const rate = Number(theme['usd_rate'] || 130);

    let amount = 0;
    let sellerId: string | null = null;
    let listingId: string | null = null;
    let title = 'Camplink';

    if (kind === 'contact_unlock') {
      const price = Number(theme['contact_unlock_price'] || 0);
      if (price < 1) return json({ error: "Admin hasn't set an unlock price yet." }, 400);
      if (!body?.seller_id) return json({ error: 'seller_id required' }, 400);
      if (body.seller_id === userId) return json({ error: 'You already own this contact' }, 400);
      amount = price;
      sellerId = body.seller_id;
      listingId = body.listing_id ?? null;
      title = 'Camplink contact unlock';
    } else if (kind === 'wallet_topup') {
      amount = Math.round(Number(body?.amount || 0));
      if (amount < 10) return json({ error: 'Minimum top-up is KSh 10' }, 400);
      if (amount > 200000) return json({ error: 'Maximum top-up is KSh 200,000' }, 400);
      title = 'Camplink wallet top-up';
    } else {
      if (!body?.listing_id) return json({ error: 'listing_id required' }, 400);
      const { data: listing } = await admin.from('listings').select('id, user_id, title, price').eq('id', body.listing_id).maybeSingle();
      if (!listing) return json({ error: 'Listing not found' }, 404);
      if (listing.user_id === userId) return json({ error: 'You cannot buy your own listing' }, 400);
      amount = Math.max(1, Math.round(Number(listing.price) * qty));
      sellerId = listing.user_id;
      listingId = listing.id;
      title = listing.title || 'Camplink purchase';
    }

    const usd = usdFromKsh(amount, rate);

    const { data: order, error: oerr } = await admin.from('orders').insert({
      listing_id: listingId,
      buyer_id: userId,
      seller_id: sellerId,
      quantity: qty,
      amount,
      amount_usd: usd,
      phone: '',
      status: 'pending',
      kind,
      provider: 'paypal',
    }).select('id').single();
    if (oerr) return json({ error: oerr.message }, 500);

    const returnUrl = `${origin}/paypal/return?order=${order.id}`;
    const cancelUrl = `${origin}/paypal/return?order=${order.id}&cancel=1`;

    const res = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.id,
          description: title.slice(0, 120),
          amount: { currency_code: 'USD', value: usd.toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'Camplink',
              user_action: 'PAY_NOW',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }),
    });

    if (!res.ok) {
      await admin.from('orders').update({ status: 'failed', result_desc: res.json?.message || 'PayPal order failed' }).eq('id', order.id);
      console.error('paypal create failed', JSON.stringify(res.json));
      return json({ error: res.json?.message || 'Could not start PayPal checkout' }, 400);
    }

    const approve = (res.json.links || []).find((l: any) => l.rel === 'payer-action' || l.rel === 'approve');
    await admin.from('orders').update({ paypal_order_id: res.json.id }).eq('id', order.id);

    if (!approve?.href) return json({ error: 'No PayPal approval link returned' }, 400);

    return json({ order_id: order.id, approve_url: approve.href, amount, amount_usd: usd });
  } catch (e) {
    console.error('paypal-create-order error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
