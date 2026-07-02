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
  if (!/^\+[1-9]\d{7,14}$/.test(p)) throw new Error("Invalid phone number");
  return p;
}

function randPass() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "P!" + Array.from(bytes).map(b => b.toString(36)).join("").slice(0, 28);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, code, display_name } = await req.json();
    const to = normalize(phone ?? "");
    if (!/^\d{6}$/.test(String(code ?? ""))) throw new Error("Enter the 6-digit code");
    const code_hash = await sha256(String(code));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get most recent unexpired OTP for this phone
    const { data: otps } = await admin.from("phone_otps")
      .select("*").eq("phone", to).order("created_at", { ascending: false }).limit(1);
    const otp = otps?.[0];
    if (!otp) throw new Error("No code found. Request a new one.");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (otp.attempts >= 5) throw new Error("Too many attempts. Request a new code.");
    if (otp.code_hash !== code_hash) {
      await admin.from("phone_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      throw new Error("Invalid code");
    }

    // Delete used OTPs for this phone
    await admin.from("phone_otps").delete().eq("phone", to);

    // Find existing user by phone
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users?.find((u: any) => u.phone === to.replace(/^\+/, "") || u.phone === to);

    const password = randPass();
    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        phone: to,
        password,
        phone_confirm: true,
        user_metadata: { display_name: display_name || to },
      });
      if (error) throw error;
      user = created.user!;
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password, phone_confirm: true });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ phone: to, password }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
