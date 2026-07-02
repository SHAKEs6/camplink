import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalize(phone: string) {
  const p = phone.trim().replace(/\s|-/g, "");
  if (!p.startsWith("+")) throw new Error("Phone must be in E.164 format, e.g. +2547XXXXXXXX");
  if (!/^\+[1-9]\d{7,14}$/.test(p)) throw new Error("Invalid phone number");
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    const to = normalize(phone ?? "");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate-limit: max 3 sends per phone per 5 min
    const { count } = await supabase.from("phone_otps").select("*", { count: "exact", head: true })
      .eq("phone", to).gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
    if ((count ?? 0) >= 3) throw new Error("Too many requests. Try again in a few minutes.");

    await supabase.from("phone_otps").insert({ phone: to, code_hash });

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const from = Deno.env.get("TWILIO_FROM_NUMBER")!;
    const body = new URLSearchParams({ To: to, From: from, Body: `Your Camplink code is ${code}. Valid for 10 minutes.` });

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("Twilio error", r.status, t);
      let msg = "Failed to send SMS";
      try {
        const j = JSON.parse(t);
        if (j.code === 21608) msg = "This number isn't verified on our SMS trial account yet. Please contact support to enable it, or try another number.";
        else if (j.code === 21211 || j.code === 21614) msg = "That phone number looks invalid. Use full international format e.g. +2547XXXXXXXX.";
        else if (j.code === 21610) msg = "This number has opted out of SMS.";
        else if (j.message) msg = j.message;
      } catch {}
      throw new Error(msg);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
