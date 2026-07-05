import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Public endpoint hit by Safaricom — no JWT verification.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    console.log('mpesa-callback payload', JSON.stringify(body));
    const stk = body?.Body?.stkCallback;
    if (!stk) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Ignored' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const checkoutId = stk.CheckoutRequestID as string;
    const resultCode = Number(stk.ResultCode);
    const resultDesc = String(stk.ResultDesc || '');
    let receipt: string | null = null;
    const items = stk.CallbackMetadata?.Item ?? [];
    for (const it of items) {
      if (it.Name === 'MpesaReceiptNumber') receipt = String(it.Value);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const status = resultCode === 0 ? 'paid' : (resultCode === 1032 ? 'cancelled' : 'failed');

    const { data: order } = await admin.from('orders')
      .update({ status, result_code: resultCode, result_desc: resultDesc, mpesa_receipt: receipt, raw_callback: body })
      .eq('checkout_request_id', checkoutId)
      .select('id, buyer_id, seller_id, amount, listing_id, kind')
      .maybeSingle();

    if (order) {
      const isUnlock = order.kind === 'contact_unlock';
      const title = status === 'paid'
        ? (isUnlock ? '🔓 Contact unlocked' : '✅ Payment received')
        : status === 'cancelled' ? '⚠️ Payment cancelled' : '❌ Payment failed';
      const desc = status === 'paid'
        ? `KSh ${order.amount.toLocaleString()} confirmed${receipt ? ` (${receipt})` : ''}`
        : resultDesc;
      const link = isUnlock ? '/market' : '/wallet';
      const notifs: any[] = [
        { user_id: order.buyer_id, title, body: desc, type: 'payment', link },
      ];
      if (order.seller_id && status === 'paid') {
        notifs.push({
          user_id: order.seller_id,
          title: isUnlock ? '👀 Someone unlocked your contact' : '💰 New sale',
          body: isUnlock ? `A buyer paid KSh ${order.amount.toLocaleString()} to reach you.` : `You received KSh ${order.amount.toLocaleString()}${receipt ? ` (${receipt})` : ''}`,
          type: 'payment', link,
        });
      }
      await admin.from('notifications').insert(notifs);

      if (status === 'paid' && isUnlock && order.seller_id) {
        await admin.from('contact_unlocks').insert({
          user_id: order.buyer_id,
          seller_id: order.seller_id,
          listing_id: order.listing_id,
          amount: order.amount,
          order_id: order.id,
        }).select();
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mpesa-callback error', e);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
