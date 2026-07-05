import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (Deno.env.get('MPESA_ENV') || 'sandbox').toLowerCase();
const BASE = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

function normalizePhone(input: string): string | null {
  const d = (input || '').replace(/\D/g, '');
  if (d.startsWith('254') && d.length === 12) return d;
  if (d.startsWith('0') && d.length === 10) return '254' + d.slice(1);
  if (d.startsWith('7') && d.length === 9) return '254' + d;
  if (d.startsWith('1') && d.length === 9) return '254' + d;
  return null;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function getToken(): Promise<string> {
  const key = Deno.env.get('MPESA_CONSUMER_KEY')!;
  const secret = Deno.env.get('MPESA_CONSUMER_SECRET')!;
  const auth = btoa(`${key}:${secret}`);
  const r = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!r.ok) throw new Error(`oauth failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { listing_id, quantity, phone, kind, seller_id } = body as {
      listing_id?: string; quantity?: number; phone?: string;
      kind?: 'purchase' | 'contact_unlock'; seller_id?: string;
    };
    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const msisdn = normalizePhone(phone);
    if (!msisdn) {
      return new Response(JSON.stringify({ error: 'Invalid Kenyan phone number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const orderKind = kind === 'contact_unlock' ? 'contact_unlock' : 'purchase';
    const qty = Math.max(1, Math.min(99, Number(quantity || 1)));

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let amount = 0;
    let effectiveSellerId: string | null = null;
    let effectiveListingId: string | null = null;
    let refTitle = 'Camplink';
    let accountRef = 'CAMPLINK';

    if (orderKind === 'contact_unlock') {
      const { data: settings } = await admin.from('app_settings').select('theme').eq('id', 1).maybeSingle();
      const price = Number((settings?.theme as any)?.['contact_unlock_price'] || 0);
      if (!price || price < 1) {
        return new Response(JSON.stringify({ error: 'Unlock price not set. Ask an admin to configure it.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let sid = seller_id || null;
      if (!sid && listing_id) {
        const { data: l } = await admin.from('listings').select('user_id, title, id').eq('id', listing_id).maybeSingle();
        if (!l) return new Response(JSON.stringify({ error: 'Listing not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        sid = l.user_id; effectiveListingId = l.id; refTitle = `Unlock: ${l.title}`;
      }
      if (!sid) return new Response(JSON.stringify({ error: 'seller_id or listing_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (sid === userId) return new Response(JSON.stringify({ error: 'Cannot unlock your own contact' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: existing } = await admin.from('contact_unlocks').select('id').eq('user_id', userId).eq('seller_id', sid).maybeSingle();
      if (existing) return new Response(JSON.stringify({ error: 'Already unlocked' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      effectiveSellerId = sid;
      amount = Math.round(price);
      accountRef = `UNL-${sid.slice(0, 8)}`;
      if (refTitle === 'Camplink') refTitle = 'Contact unlock';
    } else {
      if (!listing_id) return new Response(JSON.stringify({ error: 'listing_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: listing, error: lerr } = await admin
        .from('listings').select('id, user_id, title, price').eq('id', listing_id).maybeSingle();
      if (lerr || !listing) return new Response(JSON.stringify({ error: 'Listing not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (listing.user_id === userId) return new Response(JSON.stringify({ error: 'You cannot buy your own listing' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      amount = Math.max(1, Math.round(Number(listing.price) * qty));
      effectiveSellerId = listing.user_id;
      effectiveListingId = listing.id;
      refTitle = listing.title || 'Camplink purchase';
      accountRef = `LST-${listing.id.slice(0, 8)}`;
    }

    const shortcode = Deno.env.get('MPESA_SHORTCODE')!;
    const passkey = Deno.env.get('MPESA_PASSKEY')!;
    const ts = timestamp();
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    const token = await getToken();
    const stkRes = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: msisdn,
        PartyB: shortcode,
        PhoneNumber: msisdn,
        CallBackURL: callbackUrl,
        AccountReference: accountRef,
        TransactionDesc: refTitle.slice(0, 60),
      }),
    });
    const stk = await stkRes.json();
    if (!stkRes.ok || stk.ResponseCode !== '0') {
      return new Response(JSON.stringify({ error: stk.errorMessage || stk.ResponseDescription || 'STK push failed', detail: stk }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: order, error: oerr } = await admin.from('orders').insert({
      listing_id: effectiveListingId,
      buyer_id: userId,
      seller_id: effectiveSellerId,
      quantity: qty,
      amount,
      phone: msisdn,
      status: 'pending',
      kind: orderKind,
      checkout_request_id: stk.CheckoutRequestID,
      merchant_request_id: stk.MerchantRequestID,
    }).select('id').single();
    if (oerr) {
      return new Response(JSON.stringify({ error: oerr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      order_id: order.id,
      checkout_request_id: stk.CheckoutRequestID,
      customer_message: stk.CustomerMessage,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mpesa-stk-push error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
