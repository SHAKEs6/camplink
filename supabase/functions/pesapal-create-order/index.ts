import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { pesapalFetch, getIpnId } from '../_shared/pesapal.ts';

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
    const userEmail = (claims.claims as any).email || '';

    const body = await req.json().catch(() => ({}));
    const kind: string = ['contact_unlock', 'purchase', 'wallet_topup'].includes(body?.kind) ? body.kind : 'purchase';
    const origin: string = typeof body?.origin === 'string' && body.origin.startsWith('http') ? body.origin : '';
    if (!origin) return json({ error: 'origin required' }, 400);
    const qty = Math.max(1, Math.min(99, Number(body?.quantity || 1)));

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: settings } = await admin.from('app_settings').select('theme').eq('id', 1).maybeSingle();
    const theme = (settings?.theme as any) || {};

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
      if (typeof body?.location !== 'string' || !body.location.trim() || typeof body?.pickup_station !== 'string' || !body.pickup_station.trim()) return json({ error: 'location and pickup station are required' }, 400);
      if (typeof body?.latitude !== 'number' || typeof body?.longitude !== 'number' || body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) return json({ error: 'exact delivery location is required' }, 400);
      if (body?.delivery_method === 'door' && (typeof body?.address !== 'string' || !body.address.trim())) return json({ error: 'delivery address is required' }, 400);
      const { data: listing } = await admin.from('listings').select('id, user_id, title, price').eq('id', body.listing_id).maybeSingle();
      if (!listing) return json({ error: 'Listing not found' }, 404);
      if (listing.user_id === userId) return json({ error: 'You cannot buy your own listing' }, 400);
      amount = Math.max(1, Math.round(Number(listing.price) * qty));
      sellerId = listing.user_id;
      listingId = listing.id;
      title = listing.title || 'Camplink purchase';
    }

    const { data: profile } = await admin.from('profiles')
      .select('display_name, phone').eq('id', userId).maybeSingle();

    const { data: order, error: oerr } = await admin.from('orders').insert({
      listing_id: listingId,
      buyer_id: userId,
      seller_id: sellerId,
      quantity: qty,
      amount,
      phone: (profile as any)?.phone || '',
      location: typeof body?.location === 'string' ? body.location.trim() : null,
      pickup_station: typeof body?.pickup_station === 'string' ? body.pickup_station.trim() : null,
      delivery_method: body?.delivery_method === 'door' ? 'door' : 'pickup',
      delivery_address: typeof body?.address === 'string' ? body.address.trim() || null : null,
      delivery_latitude: typeof body?.latitude === 'number' ? body.latitude : null,
      delivery_longitude: typeof body?.longitude === 'number' ? body.longitude : null,
      status: 'pending',
      kind,
      provider: 'pesapal',
    }).select('id').single();
    if (oerr) return json({ error: oerr.message }, 500);

    const ipnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pesapal-ipn`;
    const ipnId = await getIpnId(admin, ipnUrl);
    if (!ipnId) {
      await admin.from('orders').update({ status: 'failed', result_desc: 'PesaPal IPN registration failed' }).eq('id', order.id);
      return json({ error: 'Could not register PesaPal notifications' }, 400);
    }

    const nameParts = String((profile as any)?.display_name || 'Camplink User').trim().split(/\s+/);

    const res = await pesapalFetch('/Transactions/SubmitOrderRequest', {
      method: 'POST',
      body: JSON.stringify({
        id: order.id,
        currency: 'KES',
        amount: Number(amount),
        description: title.slice(0, 100),
        callback_url: `${origin}/pesapal/return?order=${order.id}`,
        cancellation_url: `${origin}/pesapal/return?order=${order.id}&cancel=1`,
        notification_id: ipnId,
        billing_address: {
          email_address: userEmail || undefined,
          phone_number: (profile as any)?.phone || undefined,
          first_name: nameParts[0] || 'Camplink',
          last_name: nameParts.slice(1).join(' ') || 'User',
        },
      }),
    });

    if (!res.ok || !res.json?.redirect_url) {
      const desc = res.json?.error?.message || res.json?.message || 'Could not start PesaPal checkout';
      await admin.from('orders').update({ status: 'failed', result_desc: desc, raw_callback: res.json }).eq('id', order.id);
      console.error('pesapal submit failed', JSON.stringify(res.json));
      return json({ error: desc }, 400);
    }

    await admin.from('orders').update({ pesapal_tracking_id: res.json.order_tracking_id }).eq('id', order.id);

    return json({ order_id: order.id, redirect_url: res.json.redirect_url, amount });
  } catch (e) {
    console.error('pesapal-create-order error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
