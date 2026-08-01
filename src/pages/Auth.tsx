import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { NeonBackground } from "@/components/NeonBackground"; // 👈 add this

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});
const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format e.g. +2547XXXXXXXX");

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => { document.title = "Sign in — Camplink"; }, []);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handle = async (mode: "signin" | "signup") => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Account created! You're in.");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Authentication failed");
    } finally { setBusy(false); }
  };

  const oauth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Sign in failed"); return; }
    if (result.redirected) return;
    navigate("/");
  };

  const fnError = async (error: any, data: any) => {
    if ((data as any)?.error) return (data as any).error as string;
    try {
      const body = await (error?.context as Response)?.clone?.().json?.();
      if (body?.error) return body.error as string;
    } catch { /* ignore */ }
    return error?.message ?? "Request failed";
  };

  const sendOtp = async () => {
    const p = phoneSchema.safeParse(phone);
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setPhoneBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", { body: { phone: p.data } });
      if (error || (data as any)?.error) throw new Error(await fnError(error, data));
      setOtpSent(true);
      toast.success("Code sent via SMS");
    } catch (e: any) { toast.error(e.message ?? "Failed to send code"); }
    finally { setPhoneBusy(false); }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) { toast.error("Enter the 6-digit code"); return; }
    setPhoneBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otp, display_name: name || phone },
      });
      if (error || (data as any)?.error) throw new Error(await fnError(error, data));
      const { phone: verifiedPhone, password: tempPass } = data as { phone: string; password: string };
      const { error: signErr } = await supabase.auth.signInWithPassword({ phone: verifiedPhone, password: tempPass });
      if (signErr) throw signErr;
      toast.success("Phone verified! You're in.");
      navigate("/");
    } catch (e: any) { toast.error(e.message ?? "Verification failed"); }
    finally { setPhoneBusy(false); }
  };


  return (
    <NeonBackground>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-card/80 backdrop-blur-xl shadow-neon border border-primary/30 p-8 animate-fade-in">
          <div className="flex flex-col items-center mb-6">
            <div className="relative animate-neon-bob">
              <div className="absolute inset-0 rounded-2xl bg-primary/60 blur-2xl" />
              <Logo size={56} withText={false} />
            </div>
            <h1 className="text-3xl font-extrabold mt-4 text-gradient">Welcome to Camplink</h1>
            <p className="text-sm text-muted-foreground mt-1">Your campus marketplace & community</p>
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v); setOtpSent(false); }}>
            <TabsList className="grid grid-cols-3 w-full bg-secondary/50">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="space-y-3 mt-4">
              <div><Label>Display name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Alice W." maxLength={60} /></div>
            </TabsContent>

            {tab !== "phone" ? (
              <div className="space-y-3 mt-4">
                <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
                <Button className="w-full gradient-accent shadow-neon hover-scale" onClick={() => handle(tab as any)} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tab === "signin" ? "Sign in" : "Create account"}
                </Button>
                {tab === "signin" && (
                  <a href="/forgot-password" className="block text-center text-xs text-muted-foreground hover:text-primary">Forgot password?</a>
                )}
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                <div>
                  <Label>Phone number</Label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" disabled={otpSent} />
                  <p className="text-[11px] text-muted-foreground mt-1">Include country code, e.g. +254 for Kenya.</p>
                </div>
                {!otpSent ? (
                  <Button className="w-full gradient-accent shadow-neon hover-scale" onClick={sendOtp} disabled={phoneBusy}>
                    {phoneBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Send code
                  </Button>
                ) : (
                  <>
                    <div>
                      <Label>6-digit code</Label>
                      <Input inputMode="numeric" pattern="\d{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
                    </div>
                    <div><Label>Display name (optional)</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Alice W." maxLength={60} /></div>
                    <Button className="w-full gradient-accent shadow-neon hover-scale" onClick={verifyOtp} disabled={phoneBusy}>
                      {phoneBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Verify & continue
                    </Button>
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="block w-full text-center text-xs text-muted-foreground hover:text-primary">
                      Change number
                    </button>
                  </>
                )}
              </div>
            )}
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-primary/20" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-primary/30 hover:bg-primary/10" onClick={() => oauth("google")}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </Button>
            <Button variant="outline" className="border-primary/30 hover:bg-primary/10" onClick={() => oauth("apple")}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.03-3.05 2.49-4.51 2.6-4.59-1.42-2.07-3.62-2.36-4.4-2.39-1.87-.19-3.66 1.1-4.61 1.1-.96 0-2.42-1.08-3.99-1.05-2.05.03-3.95 1.19-5 3.03-2.14 3.7-.55 9.18 1.53 12.18 1.02 1.47 2.23 3.12 3.81 3.06 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.99.96c1.65-.03 2.69-1.5 3.7-2.97 1.16-1.71 1.64-3.36 1.66-3.45-.04-.02-3.18-1.22-3.21-4.86zM14.04 3.18c.85-1.03 1.42-2.46 1.27-3.88-1.22.05-2.71.81-3.58 1.84-.79.91-1.48 2.37-1.29 3.76 1.36.11 2.74-.69 3.6-1.72z"/></svg>
              Apple
            </Button>
          </div>
        </div>
      </div>
    </NeonBackground>
  );
};

export default Auth;
