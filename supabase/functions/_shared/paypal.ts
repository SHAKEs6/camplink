// Shared PayPal (live) helpers for Camplink edge functions.
const PAYPAL_BASE = (Deno.env.get('PAYPAL_ENV') || 'live').toLowerCase() === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

export async function paypalToken(): Promise<string> {
  const id = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal is not configured');
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || 'PayPal auth failed');
  return j.access_token as string;
}

export async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await paypalToken();
  const r = await fetch(`${PAYPAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json };
}

/** KSh per 1 USD, configurable by admin in app_settings.theme.usd_rate */
export function usdFromKsh(ksh: number, rate: number): number {
  const r = rate > 0 ? rate : 130;
  return Math.max(0.5, Math.round((ksh / r) * 100) / 100);
}
