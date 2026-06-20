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
      .select('id, buyer_id, seller_id, amount, listing_id')
      .maybeSingle();

    if (order) {
      const title = status === 'paid' ? '✅ Payment received' : status === 'cancelled' ? '⚠️ Payment cancelled' : '❌ Payment failed';
      const desc = status === 'paid'
        ? `KSh ${order.amount.toLocaleString()} confirmed${receipt ? ` (${receipt})` : ''}`
        : resultDesc;
      const notifs = [
        { user_id: order.buyer_id, title, body: desc, type: 'payment', link: '/cart' },
      ];
      if (order.seller_id && status === 'paid') {
        notifs.push({ user_id: order.seller_id, title: '💰 New sale', body: `You received KSh ${order.amount.toLocaleString()}${receipt ? ` (${receipt})` : ''}`, type: 'payment', link: '/cart' });
      }
      await admin.from('notifications').insert(notifs);

      // Clear cart item if paid
      if (status === 'paid' && order.listing_id) {
        await admin.from('cart_items').delete().eq('user_id', order.buyer_id).eq('listing_id', order.listing_id);
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('mpesa-callback error', e);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
