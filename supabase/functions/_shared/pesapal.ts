// Shared PesaPal v3 helpers for Camplink edge functions.
const SANDBOX = (Deno.env.get('PESAPAL_ENV') || 'live').toLowerCase() === 'sandbox';
export const PESAPAL_BASE = SANDBOX
  ? 'https://cybqa.pesapal.com/pesapalv3/api'
  : 'https://pay.pesapal.com/v3/api';

export async function pesapalToken(): Promise<string> {
  const consumer_key = Deno.env.get('PESAPAL_CONSUMER_KEY');
  const consumer_secret = Deno.env.get('PESAPAL_CONSUMER_SECRET');
  if (!consumer_key || !consumer_secret) throw new Error('PesaPal is not configured');
  const r = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key, consumer_secret }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.token) throw new Error(j?.error?.message || j?.message || 'PesaPal auth failed');
  return j.token as string;
}

export async function pesapalFetch(path: string, init: RequestInit = {}) {
  const token = await pesapalToken();
  const r = await fetch(`${PESAPAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: r.ok && !json?.error, status: r.status, json };
}

/** Registers (once) an IPN URL with PesaPal and caches the id in app_settings.theme. */
export async function getIpnId(admin: any, ipnUrl: string): Promise<string | null> {
  const { data: settings } = await admin.from('app_settings').select('theme').eq('id', 1).maybeSingle();
  const theme = (settings?.theme as any) || {};
  if (theme['pesapal_ipn_id'] && theme['pesapal_ipn_url'] === ipnUrl) return theme['pesapal_ipn_id'];

  const res = await pesapalFetch('/URLSetup/RegisterIPN', {
    method: 'POST',
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
  });
  const id = res.json?.ipn_id;
  if (!res.ok || !id) {
    console.error('pesapal RegisterIPN failed', JSON.stringify(res.json));
    return null;
  }
  await admin.from('app_settings').upsert({
    id: 1,
    theme: { ...theme, pesapal_ipn_id: id, pesapal_ipn_url: ipnUrl },
  });
  return id as string;
}

/** Marks an order paid and runs fulfilment (unlock / wallet credit / notifications). Idempotent. */
export async function fulfilOrder(admin: any, orderId: string, receipt: string | null, raw: unknown) {
  const { data: order } = await admin.from('orders')
    .select('id, buyer_id, seller_id, listing_id, amount, kind, status')
    .eq('id', orderId).maybeSingle();
  if (!order) return { status: 'not_found' };
  if (order.status === 'paid') return { status: 'paid', already: true };

  await admin.from('orders').update({
    status: 'paid',
    result_code: 0,
    result_desc: 'PesaPal payment confirmed',
    mpesa_receipt: receipt,
    raw_callback: raw,
  }).eq('id', order.id);

  const isUnlock = order.kind === 'contact_unlock';
  const notifs: any[] = [{
    user_id: order.buyer_id,
    title: isUnlock ? '🔓 Contact unlocked' : order.kind === 'wallet_topup' ? '💳 Wallet topped up' : '✅ Payment received',
    body: `KSh ${Number(order.amount).toLocaleString()} confirmed via PesaPal${receipt ? ` (${receipt})` : ''}`,
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
      _desc: 'PesaPal money top-up (KSh)',
      _ref: order.id,
    });
  } else if (order.seller_id) {
    notifs.push({
      user_id: order.seller_id,
      title: '💰 New sale',
      body: `You received KSh ${Number(order.amount).toLocaleString()} via PesaPal`,
      type: 'payment', link: '/wallet',
    });
  }

  await admin.from('notifications').insert(notifs);
  await admin.rpc('notify_order_seller', { _order_id: order.id });
  return { status: 'paid', kind: order.kind, amount: order.amount };
}
